import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
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
    // Parsear el archivo subido
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB max
    const [, files] = await form.parse(req);
    const archivo = files.pdf?.[0];

    if (!archivo) {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
    }

    // Leer el archivo
    const buffer = fs.readFileSync(archivo.filepath);

    // Parsear el PDF
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const { fecha, tasaBcv, productos } = parsearTextoPDF(pdfData.text);

    if (productos.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron productos en el PDF. Verifica que sea el PDF correcto.',
      });
    }

    // Guardar registro del PDF en historial
    const { error: histError } = await supabase.from('pdfs_historial').insert({
      nombre_archivo: archivo.originalFilename || 'lista_precios.pdf',
      fecha_pdf: fecha,
      tasa_bcv: tasaBcv,
      total_productos: productos.length,
    });

    if (histError) console.error('Error guardando historial:', histError);

    // Actualizar precios de productos existentes y crear los nuevos
    let actualizados = 0;
    let creados = 0;

    for (const prod of productos) {
      // Intentar actualizar si ya existe
      const { data: existente } = await supabase
        .from('productos')
        .select('id, precio_bs')
        .eq('nombre_pdf', prod.nombre_pdf)
        .single();

      if (existente) {
        // Actualizar precio guardando el anterior
        const { error: updateError } = await supabase
          .from('productos')
          .update({
            precio_anterior_bs: existente.precio_bs,
            precio_bs: prod.precio_bs,
            nombre_display: prod.nombre_display,
            fecha_pdf: fecha,
            tasa_bcv: tasaBcv,
          })
          .eq('id', existente.id);

        if (!updateError) actualizados++;
      } else {
        // Crear nuevo producto
        const { error: insertError } = await supabase.from('productos').insert({
          nombre_pdf: prod.nombre_pdf,
          nombre_display: prod.nombre_display,
          precio_bs: prod.precio_bs,
          fecha_pdf: fecha,
          tasa_bcv: tasaBcv,
        });

        if (!insertError) creados++;
      }
    }

    // Limpiar archivo temporal
    fs.unlinkSync(archivo.filepath);

    return res.status(200).json({
      ok: true,
      fecha,
      tasaBcv,
      totalEnPdf: productos.length,
      actualizados,
      creados,
      mensaje: `PDF procesado correctamente. ${actualizados} actualizados, ${creados} nuevos.`,
    });
  } catch (error) {
    console.error('Error al procesar PDF:', error);
    return res.status(500).json({
      error: 'Error interno al procesar el PDF. Verifica que sea un PDF válido.',
    });
  }
}
