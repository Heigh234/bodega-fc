import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';

export const config = {
  api: { bodyParser: false },
  maxDuration: 60, // Vercel Hobby plan permite hasta 60s
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Sistema de prompt optimizado para extracción limpia sin razonamiento extra
const SYSTEM_PROMPT = `Eres un extractor de datos de listas de precios de distribuidoras venezolanas.
Recibirás texto crudo extraído de un PDF. Tu única tarea es extraer productos y precios.

REGLAS DE EXTRACCIÓN:
- Extrae SOLO líneas que contengan un nombre de producto en MAYÚSCULAS y su precio en Bs
- El precio siempre termina en "Bs" con 2 decimales (ej: 3.643,20Bs o 30.820,00Bs o 3 643.20Bs)
- Si el nombre termina en "X" seguido de número y unidades (X 6 UNI, X 12 PACK, X6 DISP, etc.), inclúyelo COMPLETO. El "X" con su cantidad ES parte del nombre del producto
- Ignora completamente estas líneas: DISTRIBUIDORA, LISTA DE PRECIOS, DESCRIPCION DEL PRODUCTO, Reporte Generado, Pag.:, Fin de los Registros, Precio en Bs, TASA DEL DIA, FECHA, C. A.
- Extrae la fecha si aparece (convertir de DD/MM/YYYY a YYYY-MM-DD)
- Extrae la tasa BCV si aparece (número decimal después de "TASA DEL DIA:")

RESPONDE ÚNICAMENTE con JSON compacto válido, sin markdown, sin explicaciones:
{"fecha":"YYYY-MM-DD","tasa_bcv":número,"productos":[{"n":"NOMBRE COMPLETO","p":número}]}

Donde "n" = nombre_pdf completo en mayúsculas, "p" = precio en Bs como número (sin el texto "Bs").`;

function generarNombreDisplay(nombrePdf) {
  let nombre = nombrePdf
    .replace(/\s+X\s+\d+[\s,]*(?:UNI(?:D(?:ADES?)?)?|PQ|PAQUE|DISP(?:LAYS?)?|PACK|KIT)\s*$/i, '')
    .replace(/\s+X\d+\s*UNI\s*$/i, '')
    .replace(/\s+X\s+\d+\s*UNI\s*$/i, '')
    .trim();
  return nombre.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function llamarClaudeIA(textoPdf) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16000, // Suficiente para ~855 productos en JSON compacto
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extrae todos los productos de esta lista de precios:\n\n${textoPdf}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const texto = data.content?.[0]?.text || '';

  // Limpiar posibles bloques markdown por si acaso
  const cleanJson = texto.replace(/```json\s*|\s*```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    // Intentar extraer JSON con regex como fallback
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No se pudo parsear la respuesta de IA como JSON válido');
    }
  }

  // La IA usa claves cortas "n" y "p" para minimizar tokens de salida
  const productos = (parsed.productos || []).map((item) => ({
    nombre_pdf: (item.n || item.nombre_pdf || '').trim(),
    precio_bs: typeof item.p !== 'undefined' ? item.p : item.precio_bs,
  })).filter((item) => item.nombre_pdf && item.precio_bs > 0);

  return {
    fecha: parsed.fecha || null,
    tasa_bcv: parsed.tasa_bcv || null,
    productos,
  };
}

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

    // 2. Extraer texto del PDF con pdf-parse (ya instalado, sin Python)
    const buffer = fs.readFileSync(archivo.filepath);
    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfError) {
      return res.status(400).json({ error: `No se pudo leer el PDF: ${pdfError.message}` });
    }

    const textoPdf = pdfData.text;
    if (!textoPdf || textoPdf.trim().length < 50) {
      return res.status(400).json({ error: 'El PDF no tiene texto extraíble o está vacío' });
    }

    // 3. Enviar a Claude Haiku 4.5 para extracción inteligente
    let parsedResult;
    try {
      parsedResult = await llamarClaudeIA(textoPdf);
    } catch (iaError) {
      console.error('Error en Claude IA:', iaError);
      return res.status(500).json({ error: `Error al procesar con IA: ${iaError.message}` });
    }

    const { fecha, tasa_bcv, productos } = parsedResult;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: 'La IA no encontró productos en el PDF' });
    }

    // 4. Agregar nombre_display generado localmente
    const productosCompletos = productos.map((p) => ({
      ...p,
      nombre_display: generarNombreDisplay(p.nombre_pdf),
    }));

    // 5. Obtener precios anteriores en UNA sola consulta
    const { data: existentes } = await supabase
      .from('productos')
      .select('nombre_pdf, precio_bs');

    const preciosAnteriores = {};
    if (existentes) {
      for (const p of existentes) {
        preciosAnteriores[p.nombre_pdf] = p.precio_bs;
      }
    }

    // 6. Preparar todos los productos para upsert en lote
    const productosParaUpsert = productosCompletos.map((prod) => ({
      nombre_pdf: prod.nombre_pdf,
      nombre_display: prod.nombre_display,
      precio_bs: prod.precio_bs,
      precio_anterior_bs: preciosAnteriores[prod.nombre_pdf] || null,
      fecha_pdf: fecha,
      tasa_bcv: tasa_bcv,
      updated_at: new Date().toISOString(),
    }));

    // 7. Upsert en lotes dinámicos
    const BATCH_SIZE = Math.max(100, Math.ceil(productosParaUpsert.length / 10));
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

    // 8. Guardar historial del PDF
    await supabase.from('pdfs_historial').insert({
      nombre_archivo: archivo.originalFilename || 'lista_precios.pdf',
      fecha_pdf: fecha,
      tasa_bcv: tasa_bcv,
      total_productos: productos.length,
    });

    // 9. Limpiar archivo temporal
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
