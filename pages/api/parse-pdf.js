/**
 * parse-pdf.js
 * Reemplaza el anterior api/parse-pdf.py
 * Usa Gemini 2.5 Flash (free tier) para extraer productos del PDF de precios.
 *
 * Variables de entorno requeridas:
 *   GEMINI_API_KEY  →  tu API Key de Google AI Studio
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb', // PDFs pueden pesar bastante
    },
  },
};

const GEMINI_MODEL = 'gemini-2.5-flash';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en variables de entorno' });
  }

  try {
    const { pdf_base64 } = req.body;

    if (!pdf_base64) {
      return res.status(400).json({ error: 'Falta el campo pdf_base64' });
    }

    // Llamada a Gemini 2.5 Flash con el PDF como documento inline
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdf_base64,
                },
              },
              {
                text: PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          // Sin thinking: no se necesita razonamiento profundo para extracción de datos
          // Esto reduce latencia y costo
          thinkingConfig: {
            thinkingBudget: 0,
          },
          // Forzar respuesta en JSON puro
          responseMimeType: 'application/json',
          // Suficiente para ~900 productos con nombres largos
          maxOutputTokens: 65536,
          temperature: 0, // Determinístico: siempre el mismo output para el mismo PDF
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({
        error: `Error de Gemini API (${geminiRes.status}): ${errBody.slice(0, 200)}`,
      });
    }

    const geminiData = await geminiRes.json();

    // Extraer el texto de la respuesta
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error('Gemini respuesta vacía:', JSON.stringify(geminiData));
      return res.status(502).json({ error: 'Gemini no devolvió contenido' });
    }

    // Parsear el JSON (por si acaso viene con backticks residuales)
    let resultado;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      resultado = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Error parseando JSON de Gemini:', parseErr, '\nRaw:', rawText.slice(0, 500));
      return res.status(502).json({ error: 'Gemini devolvió JSON inválido' });
    }

    // Validación básica de estructura
    if (!Array.isArray(resultado.productos) || resultado.productos.length === 0) {
      return res.status(400).json({ error: 'No se encontraron productos en el PDF' });
    }

    // Normalizar precios por si Gemini devuelve strings en lugar de números
    resultado.productos = resultado.productos.map((p) => ({
      nombre_pdf: String(p.nombre_pdf || '').trim(),
      nombre_display: String(p.nombre_display || '').trim(),
      precio_bs: typeof p.precio_bs === 'string'
        ? parseFloat(p.precio_bs.replace(/\./g, '').replace(',', '.'))
        : Number(p.precio_bs),
    })).filter((p) => p.nombre_pdf && p.precio_bs > 0);

    return res.status(200).json({
      fecha: resultado.fecha || null,
      tasa_bcv: resultado.tasa_bcv ? Number(resultado.tasa_bcv) : null,
      productos: resultado.productos,
      total: resultado.productos.length,
    });

  } catch (error) {
    console.error('Error en parse-pdf:', error);
    return res.status(500).json({ error: `Error interno: ${error.message}` });
  }
}
