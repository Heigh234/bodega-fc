import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PUT /api/tienda/reorder - Guardar nuevo orden de los productos
export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { orden } = req.body;

    if (!Array.isArray(orden)) {
      return res.status(400).json({ error: 'Se requiere un array de orden' });
    }

    // Actualizar el orden de cada item
    const updates = orden.map(({ id, orden: nuevoOrden }) =>
      supabase
        .from('tienda_productos')
        .update({ orden: nuevoOrden })
        .eq('id', id)
    );

    await Promise.all(updates);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error guardando orden:', error);
    return res.status(500).json({ error: 'Error al guardar el orden' });
  }
}
