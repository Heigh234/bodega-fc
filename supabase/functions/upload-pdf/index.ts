import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ─── Base64 seguro para archivos grandes ──────────────────────────────────────
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un extractor de datos especializado en listas de precios de distribuidoras venezolanas.
Tu única función es leer el PDF y devolver JSON puro, sin texto adicional, sin markdown, sin explicaciones.
Nunca truncues la lista de productos. Extrae el 100% de los productos que aparecen en el PDF.`;

const USER_PROMPT = `Extrae del PDF los siguientes datos y responde ÚNICAMENTE con JSON válido:

{
  "fecha": "YYYY-MM-DD",
  "tasa_bcv": 0.00,
  "productos": [
    {
      "nombre_pdf": "NOMBRE EXACTO COMO APARECE EN EL PDF (en mayúsculas, incluyendo 'X 6 UNI', 'X 12 UNI', el número después de X es CRÍTICO — nunca omitirlo)",
      "nombre_display": "Nombre Legible En Title Case Sin El Sufijo De Cantidad",
      "precio_bs": 0.00
    }
  ]
}

Reglas:
- "fecha": buscá la fecha del reporte (FECHA: DD/MM/YYYY) y convertila a YYYY-MM-DD.
- "tasa_bcv": buscá "TASA DEL DIA" y extraé el número en Bs.
- "nombre_pdf": el nombre EXACTO del producto tal como figura en el PDF. Si dice "X 6 UNI", "X 12 UNI", "X 24 UNI", etc., ese texto VA incluido. NUNCA omitás el número que acompaña a la X.
- "nombre_display": el nombre del producto sin el sufijo de cantidad (quitar la parte "X 6 UNI", "X 12 UNI", etc.) y en Title Case.
- "precio_bs": el precio del producto como número decimal.
- Extraé TODOS los productos sin excepción.
- No incluyas encabezados, pies de página ni líneas que no sean productos.`;

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405);
  }

  try {
    // 1. Recibir el PDF del FormData
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File | null;

    if (!pdfFile) {
      return jsonResponse({ error: 'No se recibió ningún archivo PDF' }, 400);
    }

    console.log(`[upload-pdf] Recibido: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(0)} KB)`);

    // 2. Convertir a base64
    const pdfBuffer = await pdfFile.arrayBuffer();
    const pdfBase64 = toBase64(pdfBuffer);

    // 3. Llamar a Claude Haiku 4.5
    console.log('[upload-pdf] Enviando a Claude Haiku 4.5...');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 48000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: USER_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('[upload-pdf] Error de Anthropic API:', err);
      return jsonResponse({ error: 'Error al llamar a la IA: ' + err }, 500);
    }

    const claudeData = await anthropicRes.json();
    const textoRespuesta: string = claudeData.content?.[0]?.text ?? '';

    // 4. Parsear el JSON que devuelve Claude
    let parsed: { fecha: string; tasa_bcv: number; productos: Array<{ nombre_pdf: string; nombre_display: string; precio_bs: number }> };

    try {
      const limpio = textoRespuesta
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(limpio);
    } catch {
      console.error('[upload-pdf] JSON inválido de Claude:', textoRespuesta.slice(0, 300));
      return jsonResponse({ error: 'Claude devolvió una respuesta inválida. Intentá de nuevo.' }, 500);
    }

    const { fecha, tasa_bcv, productos } = parsed;

    if (!productos || productos.length === 0) {
      return jsonResponse({ error: 'No se encontraron productos en el PDF' }, 400);
    }

    console.log(`[upload-pdf] Claude extrajo ${productos.length} productos. Fecha: ${fecha}, BCV: ${tasa_bcv}`);

    // 5. Cliente de Supabase con service role (disponible automáticamente en Edge Functions)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 6. Obtener precios anteriores para el historial de cambios
    const { data: existentes } = await supabase
      .from('productos')
      .select('nombre_pdf, precio_bs');

    const preciosAnteriores: Record<string, number> = {};
    if (existentes) {
      for (const p of existentes) {
        preciosAnteriores[p.nombre_pdf] = p.precio_bs;
      }
    }

    // 7. Preparar upsert
    const productosParaUpsert = productos.map((prod) => ({
      nombre_pdf:         prod.nombre_pdf,
      nombre_display:     prod.nombre_display,
      precio_bs:          Number(prod.precio_bs) || 0,
      precio_anterior_bs: preciosAnteriores[prod.nombre_pdf] ?? null,
      fecha_pdf:          fecha,
      tasa_bcv:           Number(tasa_bcv) || null,
      updated_at:         new Date().toISOString(),
    }));

    // 8. Upsert en lotes
    const BATCH_SIZE = Math.max(100, Math.ceil(productosParaUpsert.length / 10));
    let totalUpserted = 0;

    for (let i = 0; i < productosParaUpsert.length; i += BATCH_SIZE) {
      const lote = productosParaUpsert.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('productos')
        .upsert(lote, { onConflict: 'nombre_pdf' });

      if (upsertError) {
        console.error('[upload-pdf] Error upsert lote:', upsertError);
      } else {
        totalUpserted += lote.length;
      }
    }

    // 9. Guardar en historial
    await supabase.from('pdfs_historial').insert({
      nombre_archivo:  pdfFile.name || 'lista_precios.pdf',
      fecha_pdf:       fecha,
      tasa_bcv:        Number(tasa_bcv) || null,
      total_productos: productos.length,
    });

    console.log(`[upload-pdf] ✅ ${totalUpserted} productos guardados.`);

    return jsonResponse({
      ok:           true,
      fecha,
      tasaBcv:      tasa_bcv,
      totalEnPdf:   productos.length,
      actualizados: totalUpserted,
    });

  } catch (error) {
    console.error('[upload-pdf] Error inesperado:', error);
    return jsonResponse({ error: (error as Error).message || 'Error interno' }, 500);
  }
});
