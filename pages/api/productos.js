import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Obtener la fecha del último PDF cargado
    const { data: ultimoPdf } = await supabase
      .from('pdfs_historial')
      .select('fecha_pdf, tasa_bcv')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!ultimoPdf) {
      return res.status(200).json({ productos: [], infoPdf: null });
    }

    // Traer SOLO los productos del último PDF cargado usando paginación
    let todos = [];
    let desde = 0;
    const POR_PAGINA = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('fecha_pdf', ultimoPdf.fecha_pdf)
        .order('nombre_pdf', { ascending: true })
        .range(desde, desde + POR_PAGINA - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      todos = todos.concat(data);
      if (data.length < POR_PAGINA) break;
      desde += POR_PAGINA;
    }

    return res.status(200).json({
      productos: todos,
      infoPdf: ultimoPdf,
    });
  } catch (error) {
    console.error('Error cargando productos:', error);
    return res.status(500).json({ error: 'Error al cargar productos' });
  }
}
