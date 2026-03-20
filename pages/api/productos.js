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
    // Obtener todos los productos ordenados alfabéticamente
    const { data: productos, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre_display', { ascending: true });

    if (error) throw error;

    // Obtener info del último PDF cargado
    const { data: ultimoPdf } = await supabase
      .from('pdfs_historial')
      .select('fecha_pdf, tasa_bcv')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return res.status(200).json({
      productos: productos || [],
      infoPdf: ultimoPdf || null,
    });
  } catch (error) {
    console.error('Error cargando productos:', error);
    return res.status(500).json({ error: 'Error al cargar productos' });
  }
}
