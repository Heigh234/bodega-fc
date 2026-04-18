/**
 * upload-pdf.js — MIGRADO A GEMINI AI
 * Ya no llama al Python api/parse-pdf.py
 * Usa Gemini 2.5 Flash directamente para extraer productos del PDF.
 *
 * Variable de entorno requerida: GEMINI_API_KEY
 */
import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = `Eres un extractor de datos para una lista de precios de distribuidora venezolana en formato PDF.

Tu tarea es devolver ÚNICAMENTE un objeto JSON válido (sin markdown, sin comentarios, sin texto adicional) con esta estructura exacta:

{
  "fecha": "YYYY-MM-DD",
  "tasa_bcv": 123.45,
  "productos": [
    {
      "nombre_pdf": "NOMBRE COMPLETO EN MAYÚSCULAS TAL COMO APARECE EN EL PDF",
      "nombre_display": "Nombre Legible Corto",
      "precio_bs": 1234.56
    }
  ]
}

Reglas estrictas:
1. "fecha": Busca la fecha del PDF (formato DD/MM/YYYY) y conviértela a YYYY-MM-DD. Si no existe, usa null.
2. "tasa_bcv": Busca "TASA DEL DIA" o similar y extrae el número decimal. Si no existe, usa null.
3. "nombre_pdf": Copia el nombre del producto EXACTAMENTE como aparece en el PDF, en mayúsculas, incluyendo la cantidad (ej: "DESODORANTE SPEED STICK DUO X 6 UNI", "ACEITE MAZEITE X 12 UNI"). NO truncar ni modificar.
4. "nombre_display": Genera un nombre corto legible en Title Case, eliminando el sufijo de cantidad (ej: "X 12 UNI", "X 6 UNID", "X 24 PACK"). Ejemplos: "ACEITE MAZEITE X 12 UNI" → "Aceite Mazeite", "SHAMPOO HEAD X 6 UNI" → "Shampoo Head".
5. "precio_bs": El precio en Bolívares como número decimal (ej: 30070.00). NO incluir el símbolo "Bs".
6. Ignora filas de cabecera, totales, páginas, fechas de reporte y cualquier texto que no sea un producto con precio.
7. Cada producto debe aparecer UNA sola vez (sin duplicados).
8. Los precios pueden tener separadores de miles con punto (ej: "183.757,20 Bs" = 183757.20) o espacio. Conviértelos siempre a número decimal estándar.

Extrae TODOS los productos del PDF.`;

async function parsePdfWithGemini(pdfBase64) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en variables de entorno');

  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        // Sin thinking: no se necesita razonamiento profundo para extraer datos
        thinkingConfig: { thinkingBudget: 0 },
        // Forzar JSON puro en la respuesta
        responseMimeType: 'application/json',
        // Suficiente para ~900 productos con nombres largos
        maxOutputTokens: 65536,
        // Temperatura 0 = determinístico, mismo PDF → mismo output siempre
        temperature: 0,
      },
    }),
  });

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text();
    throw new Error(`Gemini API error (${geminiRes.status}): ${errBody.slice(0, 300)}`);
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini no devolvió contenido');

  // Limpiar posibles backticks residuales
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const resultado = JSON.parse(cleaned);

  if (!Array.isArray(resultado.productos) || resultado.productos.length === 0) {
    throw new Error('No se encontraron productos en el PDF');
  }

  // Normalizar por si Gemini devuelve precios como strings
  resultado.productos = resultado.productos
    .map((p) => ({
      nombre_pdf: String(p.nombre_pdf || '').trim(),
      nombre_display: String(p.nombre_display || '').trim(),
      precio_bs: typeof p.precio_bs === 'string'
        ? parseFloat(p.precio_bs.replace(/\./g, '').replace(',', '.'))
        : Number(p.precio_bs),
    }))
    .filter((p) => p.nombre_pdf && p.precio_bs > 0);

  return resultado;
}

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

    // 3. Parsear con Gemini AI (reemplaza la antigua llamada al Python)
    let parsed;
    try {
      parsed = await parsePdfWithGemini(pdfBase64);
    } catch (geminiErr) {
      console.error('Error Gemini:', geminiErr);
      return res.status(400).json({ error: geminiErr.message });
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

    // 6. Upsert en lotes dinámicos según cantidad de productos
    // Siempre máximo 10 lotes para mantener velocidad
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
