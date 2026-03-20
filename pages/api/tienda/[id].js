import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Se requiere el ID' });
  }

  if (req.method === 'PUT') {
    return await editarItem(req, res, id);
  }

  if (req.method === 'DELETE') {
    return await eliminarItem(req, res, id);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// PUT /api/tienda/[id] - Editar un producto de Mi Tienda
async function editarItem(req, res, id) {
  try {
    const { nombre_personalizado, precio_manual, stock, porcentajes } = req.body;

    const updates = {};

    if (nombre_personalizado !== undefined) {
      updates.nombre_personalizado = nombre_personalizado;
    }

    if (precio_manual !== undefined) {
      updates.precio_manual = precio_manual || null;
    }

    if (stock !== undefined) {
      updates.stock = parseInt(stock) || 1;
    }

    if (porcentajes !== undefined) {
      updates.porcentajes = porcentajes.map((p) => parseFloat(p) || 0);
    }

    const { data, error } = await supabase
      .from('tienda_productos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ item: data });
  } catch (error) {
    console.error('Error editando producto:', error);
    return res.status(500).json({ error: 'Error al guardar cambios' });
  }
}

// DELETE /api/tienda/[id] - Quitar un producto de Mi Tienda
async function eliminarItem(req, res, id) {
  try {
    const { error } = await supabase
      .from('tienda_productos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    return res.status(500).json({ error: 'Error al eliminar el producto' });
  }
}
