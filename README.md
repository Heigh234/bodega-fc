# 🏪 Bodega FC — App de Lista de Precios

App web para gestionar los precios de la tienda. Carga el PDF de la distribuidora y calcula el precio unitario de cada producto automáticamente.

---

## 📱 Funcionalidades

- **Cargar PDF** de la distribuidora → precios se actualizan solos
- **Mi Tienda**: solo los productos que vendes, con precio unitario calculado
- **Todos los Productos**: lista completa del PDF para referencia
- **Búsqueda en tiempo real**
- **Reordenar** arrastrando los productos (con el dedo en el celular)
- **Editar** nombre, precio, stock y % de ganancia de cada producto
- **Historial** de cambios de precios (↑ subió / ↓ bajó)

---

## 🧮 Fórmula del Precio Unitario

```
Precio Unitario = (Precio Bs × (1 + % / 100)) ÷ Stock
```

**Ejemplo:**
- Arroz Gloria Clásico 1kg: `12.880 Bs` (por caja de 24 unidades), `14%` ganancia
- `(12.880 × 1.14) / 24 = 14.683,20 / 24 = **611,80 Bs por unidad**`

---

## 🚀 Cómo instalar y desplegar

### Paso 1 — Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratis
2. Crea un nuevo proyecto
3. Ve a **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`
4. Copia la **URL del proyecto** y la **Anon Key** (están en Settings → API)

---

### Paso 2 — Desplegar en Vercel

1. Sube esta carpeta a un repositorio en [GitHub](https://github.com)
2. Ve a [vercel.com](https://vercel.com), crea una cuenta y conecta el repo
3. En Vercel, antes de desplegar, agrega las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu Anon Key de Supabase
4. Haz clic en **Deploy**

---

### Paso 3 — Primera vez: Cargar el PDF

1. Abre la app en tu celular
2. Toca **"Cargar PDF"** y selecciona el PDF de la distribuidora
3. La app procesará todos los productos y los cargará automáticamente
4. Los productos aparecerán en la sección **"Todos los Productos"**

---

### Paso 4 — Poblar "Mi Tienda" (primera vez)

Después de cargar el primer PDF, ve al **SQL Editor de Supabase** y ejecuta el contenido de `supabase/seed_tienda.sql`.

Esto cargará automáticamente los 60+ productos de la tienda con su stock y porcentaje configurado.

---

### Para desarrollo local (opcional)

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.local.example .env.local
# Edita .env.local con tus credenciales de Supabase

# Iniciar servidor de desarrollo
npm run dev

# Abrir en el navegador: http://localhost:3000
```

---

## 📋 Estructura del proyecto

```
bodega-fc/
├── pages/
│   ├── index.js              # Página principal (toda la UI)
│   └── api/
│       ├── upload-pdf.js     # Sube y parsea el PDF
│       ├── productos.js      # Lista todos los productos
│       └── tienda/
│           ├── index.js      # Ver/Agregar productos a Mi Tienda
│           ├── [id].js       # Editar/Eliminar un producto
│           └── reorder.js    # Guardar nuevo orden
├── lib/
│   ├── supabase.js           # Cliente de Supabase
│   └── pdfParser.js          # Parser del PDF
├── styles/
│   └── globals.css           # Estilos de la app
├── supabase/
│   ├── schema.sql            # Esquema de la base de datos
│   └── seed_tienda.sql       # Datos iniciales de Mi Tienda
├── .env.local.example        # Variables de entorno de ejemplo
└── package.json
```

---

## 📊 Tablas de la base de datos

| Tabla | Descripción |
|-------|-------------|
| `productos` | Todos los productos del PDF con sus precios |
| `tienda_productos` | Los productos de Mi Tienda (con stock, %, orden) |
| `pdfs_historial` | Registro de PDFs cargados |

---

## ❓ Preguntas frecuentes

**¿Cada vez que llega un PDF nuevo tengo que hacer algo especial?**
No. Solo toca "Cargar PDF", selecciona el nuevo PDF y listo. Los precios se actualizan solos.

**¿Si reorganizo los productos, se mantiene el orden?**
Sí. El orden se guarda en la base de datos automáticamente.

**¿Puedo agregar productos que no están en el PDF?**
Por ahora no directamente desde la app. Los productos pendientes (que no están en el PDF) aparecen señalados con "⏳ Pendiente".

**¿Funciona sin internet?**
No, necesita conexión para cargar y guardar datos. Pero funciona bien con internet móvil.
