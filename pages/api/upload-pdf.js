import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Recibir el archivo PDF
    const form = formidable({ maxFileSize: 15 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const archivo = files.pdf?.[0];

    if (!archivo) {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
    }

    // 2. Convertir PDF a base64
    const buffer = fs.readFileSync(archivo.filepath);
    const pdfBase64 = buffer.toString('base64');

    // 3. Llamar a la función Python
    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const pythonUrl = `${protocol}://${host}/api/parse-pdf`;

    const pythonRes = await fetch(pythonUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_base64: pdfBase64 }),
    });

    const parsed = await pythonRes.json();

    if (!pythonRes.ok) {
      return res.status(400).json({ error: parsed.error || 'Error al parsear el PDF' });
    }

    const { fecha, tasa_bcv, productos } = parsed;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: 'No se encontraron productos en el PDF' });
    }

    // 4. Obtener precios anteriores en UNA sola consulta
    const { data: existentes } = await supabase
      .from('productos')
      .select('nombre_pdf, precio_bs');

    // Crear mapa de precios anteriores
    const preciosAnteriores = {};
    if (existentes) {
      for (const p of existentes) {
        preciosAnteriores[p.nombre_pdf] = p.precio_bs;
      }
    }

    // 5. Preparar todos los productos para upsert en lote
    const productosParaUpsert = productos.map((prod) => ({
      nombre_pdf: prod.nombre_pdf,
      nombre_display: prod.nombre_display,
      precio_bs: prod.precio_bs,
      precio_anterior_bs: preciosAnteriores[prod.nombre_pdf] || null,
      fecha_pdf: fecha,
      tasa_bcv: tasa_bcv,
      updated_at: new Date().toISOString(),
    }));

    // 6. Upsert en lotes de 100 (más rápido y seguro)
    const BATCH_SIZE = 100;
    let totalUpserted = 0;

    for (let i = 0; i < productosParaUpsert.length; i += BATCH_SIZE) {
      const lote = productosParaUpsert.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('productos')
        .upsert(lote, { onConflict: 'nombre_pdf' });

      if (upsertError) {
        console.error('Error en upsert lote:', upsertError);
      } else {
        totalUpserted += lote.length;
      }
    }

    // 7. Guardar historial del PDF
    await supabase.from('pdfs_historial').insert({
      nombre_archivo: archivo.originalFilename || 'lista_precios.pdf',
      fecha_pdf: fecha,
      tasa_bcv: tasa_bcv,
      total_productos: productos.length,
    });

    // 8. Limpiar archivo temporal
    try { fs.unlinkSync(archivo.filepath); } catch (_) {}

    return res.status(200).json({
      ok: true,
      fecha,
      tasaBcv: tasa_bcv,
      totalEnPdf: productos.length,
      actualizados: totalUpserted,
    });

  } catch (error) {
    console.error('Error en upload-pdf:', error);
    return res.status(500).json({ error: error.message });
  }
}
