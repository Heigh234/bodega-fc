-- ============================================================
-- BODEGA FC - SCHEMA SUPABASE
-- Ejecuta este archivo en el SQL Editor de Supabase
-- ============================================================

-- Tabla principal de productos (viene del PDF)
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_pdf TEXT NOT NULL UNIQUE,
  nombre_display TEXT,
  precio_bs DECIMAL(12,2) DEFAULT 0,
  precio_anterior_bs DECIMAL(12,2),
  fecha_pdf DATE,
  tasa_bcv DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de PDFs cargados (historial)
CREATE TABLE IF NOT EXISTS pdfs_historial (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_archivo TEXT,
  fecha_pdf DATE,
  tasa_bcv DECIMAL(10,2),
  total_productos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de productos de "Mi Tienda"
CREATE TABLE IF NOT EXISTS tienda_productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  nombre_personalizado TEXT,
  precio_manual DECIMAL(12,2),
  stock INTEGER DEFAULT 1,
  porcentajes DECIMAL[] DEFAULT ARRAY[0::DECIMAL],
  orden INTEGER DEFAULT 999,
  es_pendiente BOOLEAN DEFAULT FALSE,
  nombre_pendiente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producto_id)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_productos_nombre_pdf ON productos(nombre_pdf);
CREATE INDEX IF NOT EXISTS idx_tienda_orden ON tienda_productos(orden);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tienda_updated_at
  BEFORE UPDATE ON tienda_productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- NOTA: Después de cargar el primer PDF desde la app,
-- corre el archivo seed_tienda.sql para poblar "Mi Tienda"
-- con los productos de la tienda de tu papá.
-- ============================================================
