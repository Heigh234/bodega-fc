/**
 * Parser para los PDFs de Distribuidora y Comercializadora FC
 * Versión robusta que maneja múltiples formatos de extracción de texto
 */

function generarNombreDisplay(nombrePdf) {
  let nombre = nombrePdf
    .replace(/\s+X\s+\d+[\s,]*(?:UNI(?:D(?:ADES?)?)?|PQ|PAQUE|DISP(?:LAYS?)?|PACK|KIT)\s*$/i, '')
    .replace(/\s+X\d+\s*UNI\s*$/i, '')
    .replace(/\s+X\s+\d+\s*UNI\s*$/i, '')
    .trim();

  return nombre
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function esPrecioValido(str) {
  // Detecta patrones como: "3 643.20", "30820.00", "3643.20"
  return /^\d[\d\s]*\.\d{2}$/.test(str.trim());
}

function parsearPrecio(str) {
  return parseFloat(str.replace(/\s/g, ''));
}

function esLineaIgnorada(linea) {
  const ignoradas = [
    'DISTRIBUIDORA Y COMERCIALIZADORA',
    'LISTA DE PRECIOS',
    'DESCRIPCION DEL PRODUCTO',
    'Reporte Generado',
    'Pag.:',
    '*Fin de los Registros',
    'Precio en Bs',
    'TASA DEL DIA',
    'C. A.',
  ];
  return ignoradas.some((ig) => linea.includes(ig));
}

function esFecha(linea) {
  return /FECHA:\s*\d{2}\/\d{2}\/\d{4}/.test(linea);
}

function esTasa(linea) {
  return /TASA DEL DIA/.test(linea);
}

/**
 * Parsea el texto extraído de un PDF de la distribuidora
 * Maneja 3 formatos distintos que pdf-parse puede producir:
 *  1. "PRODUCTO  PRECIO_BS" en una sola línea
 *  2. Nombre y precio en líneas separadas
 *  3. Texto mezclado de tabla con columnas
 */
function parsearTextoPDF(texto) {
  let fecha = null;
  let tasaBcv = null;
  const productos = [];
  const vistos = new Set();

  // Limpiar y separar en líneas
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- Extraer fecha y tasa ---
  for (const linea of lineas) {
    const mFecha = linea.match(/FECHA[:\s]+(\d{2})\/(\d{2})\/(\d{4})/);
    if (mFecha) {
      fecha = `${mFecha[3]}-${mFecha[2]}-${mFecha[1]}`;
    }
    const mTasa = linea.match(/TASA DEL DIA[^:]*:\s*([\d.,]+)\s*Bs/i);
    if (mTasa) {
      tasaBcv = parseFloat(mTasa[1].replace(',', '.'));
    }
  }

  // --- MÉTODO 1: precio al final de la misma línea con "Bs" ---
  // Formato: "NOMBRE DEL PRODUCTO 3 643.20Bs"
  const regexMismo = /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,()\/\-'%+]{2,}?)\s+((?:\d[\d ]{0,6})\.\d{2})Bs\s*$/;

  for (const linea of lineas) {
    if (esLineaIgnorada(linea) || esFecha(linea) || esTasa(linea)) continue;

    const m = linea.match(regexMismo);
    if (m) {
      const nombre = m[1].trim();
      const precio = parsearPrecio(m[2]);
      if (nombre.length >= 4 && precio > 0 && !vistos.has(nombre)) {
        vistos.add(nombre);
        productos.push({
          nombre_pdf: nombre,
          nombre_display: generarNombreDisplay(nombre),
          precio_bs: precio,
        });
      }
    }
  }

  // --- MÉTODO 2: si el método 1 no encontró nada, buscar precio en línea siguiente ---
  if (productos.length === 0) {
    for (let i = 0; i < lineas.length - 1; i++) {
      const linea = lineas[i];
      const siguiente = lineas[i + 1];

      if (esLineaIgnorada(linea) || esFecha(linea) || esTasa(linea)) continue;

      // El nombre es todo en mayúsculas y la siguiente línea es un precio
      const esNombre = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,()\/\-'%+]{3,}$/.test(linea);
      const esPrecioSig = /^[\d][\d\s]*\.\d{2}\s*Bs?\s*$/.test(siguiente);

      if (esNombre && esPrecioSig) {
        const nombre = linea.trim();
        const precio = parsearPrecio(siguiente.replace(/Bs/g, '').trim());
        if (precio > 0 && !vistos.has(nombre)) {
          vistos.add(nombre);
          productos.push({
            nombre_pdf: nombre,
            nombre_display: generarNombreDisplay(nombre),
            precio_bs: precio,
          });
        }
      }
    }
  }

  // --- MÉTODO 3: búsqueda por regex global en todo el texto (último recurso) ---
  if (productos.length === 0) {
    // Buscar patrón: MAYUSCULAS seguido de precio con Bs
    const regexGlobal = /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,()\/\-'%+]{3,?})\s+([\d][\d ]{0,8}\.\d{2})Bs/g;
    let match;
    while ((match = regexGlobal.exec(texto)) !== null) {
      const nombre = match[1].trim();
      const precio = parsearPrecio(match[2]);
      if (
        nombre.length >= 4 &&
        precio > 0 &&
        !esLineaIgnorada(nombre) &&
        !vistos.has(nombre)
      ) {
        vistos.add(nombre);
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
