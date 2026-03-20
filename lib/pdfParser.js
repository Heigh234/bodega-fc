/**
 * Parser para los PDFs de Distribuidora y Comercializadora FC
 * Extrae productos y precios del texto del PDF
 */

/**
 * Genera un nombre display corto a partir del nombre completo del PDF
 * Ej: "ARROZ GLORIA CLASICO 1KG X 24UNI" → "Arroz Gloria Clásico 1kg"
 */
function generarNombreDisplay(nombrePdf) {
  let nombre = nombrePdf
    // Remover cantidad de unidades al final: "X 24 UNI", "X 12 UNID", etc.
    .replace(/\s+X\s+\d+[\s,]*(?:UNI(?:D(?:ADES?)?)?|PQ|PAQUE|DISP(?:LAYS?)?|PACK|KIT)\s*$/i, '')
    // Remover "X 24UNI" sin espacio
    .replace(/\s+X\d+\s*UNI\s*$/i, '')
    // Remover "X 100 UNI" variantes
    .replace(/\s+X\s+\d+\s*UNI\s*$/i, '')
    .trim();

  // Convertir a Title Case
  return nombre
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parsea el texto extraído de un PDF de la distribuidora
 * Retorna: { fecha, tasaBcv, productos: [{nombre, precio}] }
 */
function parsearTextoPDF(texto) {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let fecha = null;
  let tasaBcv = null;
  const productos = [];

  // Líneas que NO son productos
  const lineasIgnoradas = [
    'DISTRIBUIDORA Y COMERCIALIZADORA',
    'LISTA DE PRECIOS',
    'DESCRIPCION DEL PRODUCTO',
    'Reporte Generado',
    'Pag.:',
    '*Fin de los Registros*',
    'Precio en Bs',
    'FECHA:',
    'TASA DEL DIA',
  ];

  for (const linea of lineas) {
    // Extraer fecha
    const matchFecha = linea.match(/FECHA:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (matchFecha) {
      const [dia, mes, anio] = matchFecha[1].split('/');
      fecha = `${anio}-${mes}-${dia}`;
      continue;
    }

    // Extraer tasa BCV
    const matchTasa = linea.match(/TASA DEL DIA \(BCV\):\s*([\d.]+)Bs/);
    if (matchTasa) {
      tasaBcv = parseFloat(matchTasa[1]);
      continue;
    }

    // Ignorar líneas de cabecera/pie
    if (lineasIgnoradas.some((ig) => linea.includes(ig))) continue;

    // Intentar extraer producto y precio
    // El precio tiene formato: "3 643.20Bs" o "30 820.00Bs" (con espacios como separador de miles)
    const matchProducto = linea.match(/^(.+?)\s+((?:\d[\d ]*)\.\d{2})Bs\s*$/);
    if (matchProducto) {
      const nombre = matchProducto[1].trim();
      const precioStr = matchProducto[2].replace(/\s/g, ''); // Remover espacios
      const precio = parseFloat(precioStr);

      if (nombre && !isNaN(precio) && precio > 0 && nombre.length > 3) {
        productos.push({
          nombre_pdf: nombre,
          nombre_display: generarNombreDisplay(nombre),
          precio_bs: precio,
        });
      }
    }
  }

  return { fecha, tasaBcv, productos };
}

module.exports = { parsearTextoPDF, generarNombreDisplay };
