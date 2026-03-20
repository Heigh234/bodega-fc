import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getTienda(req, res);
  }
  if (req.method === 'POST') {
    return await agregarATienda(req, res);
  }
  return res.status(405).json({ error: 'Método no permitido' });
}

// GET /api/tienda - Obtener todos los productos de Mi Tienda
async function getTienda(req, res) {
  try {
    const { data: items, error } = await supabase
      .from('tienda_productos')
      .select(`
        *,
        productos (
          id,
          nombre_pdf,
          nombre_display,
          precio_bs,
          precio_anterior_bs,
          fecha_pdf,
          tasa_bcv
        )
      `)
      .order('orden', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ items: items || [] });
  } catch (error) {
    console.error('Error cargando tienda:', error);
    return res.status(500).json({ error: 'Error al cargar Mi Tienda' });
  }
}

// POST /api/tienda - Agregar producto a Mi Tienda
async function agregarATienda(req, res) {
  try {
    const { producto_id, nombre_personalizado, stock, porcentajes } = req.body;

    if (!producto_id) {
      return res.status(400).json({ error: 'Se requiere producto_id' });
    }

    // Verificar que no esté ya en tienda
    const { data: existe } = await supabase
      .from('tienda_productos')
      .select('id')
      .eq('producto_id', producto_id)
      .single();

    if (existe) {
      return res.status(400).json({ error: 'Este producto ya está en Mi Tienda' });
    }

    // Obtener el máximo orden actual
    const { data: maxOrden } = await supabase
      .from('tienda_productos')
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
      .single();

    const nuevoOrden = (maxOrden?.orden ?? -1) + 1;

    const { data, error } = await supabase
      .from('tienda_productos')
      .insert({
        producto_id,
        nombre_personalizado: nombre_personalizado || null,
        stock: stock || 1,
        porcentajes: porcentajes || [0],
        orden: nuevoOrden,
        es_pendiente: false,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ item: data });
  } catch (error) {
    console.error('Error agregando a tienda:', error);
    return res.status(500).json({ error: 'Error al agregar producto a Mi Tienda' });
  }
}
