const formidable = require('formidable');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { parsearTextoPDF } = require('../../lib/pdfParser');

export const config = {
  api: {
    bodyParser: false,
  },
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
    const form = formidable({ maxFileSize: 15 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const archivo = files.pdf?.[0];

    if (!archivo) {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
    }

    const buffer = fs.readFileSync(archivo.filepath);

    let pdfData;
    try {
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      pdfData = await pdfParse(buffer);
    } catch (e1) {
      try {
        const pdfParse = require('pdf-parse');
        pdfData = await pdfParse(buffer);
      } catch (e2) {
        return res.status(500).json({
          error: 'No se pudo leer el PDF: ' + e2.message,
        });
      }
    }

    if (!pdfData || !pdfData.text || pdfData.text.length < 100) {
      return res.status(400).json({
        error: 'El PDF no contiene texto legible.',
      });
    }

    const { fecha, tasaBcv, productos } = parsearTextoPDF(pdfData.text);

    console.log('PDF procesado - Productos:', productos.length, 'Fecha:', fecha, 'Tasa:', tasaBcv);

    if (productos.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron productos en el PDF.',
        debug_text: pdfData.text.substring(0, 1000),
      });
    }

    await supabase.from('pdfs_historial').insert({
      nombre_archivo: archivo.originalFilename || 'lista_precios.pdf',
      fecha_pdf: fecha,
      tasa_bcv: tasaBcv,
      total_productos: productos.length,
    });

    let actualizados = 0;
    let creados = 0;

    for (const prod of productos) {
      try {
        const { data: existente } = await supabase
          .from('productos')
          .select('id, precio_bs')
          .eq('nombre_pdf', prod.nombre_pdf)
          .maybeSingle();

        if (existente) {
          await supabase
            .from('productos')
            .update({
              precio_anterior_bs: existente.precio_bs,
              precio_bs: prod.precio_bs,
              nombre_display: prod.nombre_display,
              fecha_pdf: fecha,
              tasa_bcv: tasaBcv,
            })
            .eq('id', existente.id);
          actualizados++;
        } else {
          await supabase.from('productos').insert({
            nombre_pdf: prod.nombre_pdf,
            nombre_display: prod.nombre_display,
            precio_bs: prod.precio_bs,
            fecha_pdf: fecha,
            tasa_bcv: tasaBcv,
          });
          creados++;
        }
      } catch (e) {
        console.error('Error guardando producto:', prod.nombre_pdf, e.message);
      }
    }

    try { fs.unlinkSync(archivo.filepath); } catch (_) {}

    return res.status(200).json({
      ok: true,
      fecha,
      tasaBcv,
      totalEnPdf: productos.length,
      actualizados,
      creados,
    });
  } catch (error) {
    console.error('Error general:', error);
    return res.status(500).json({ error: error.message });
  }
}
