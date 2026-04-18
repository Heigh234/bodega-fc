from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import re

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


def generar_nombre_display(nombre_pdf):
    """Genera un nombre corto y legible desde el nombre del PDF"""
    nombre = re.sub(
        r'\s+X\s+\d+[\s,]*(?:UNI(?:D(?:ADES?)?)?|PQ|PAQUE|DISP(?:LAYS?)?|PACK|KIT)\s*$',
        '', nombre_pdf, flags=re.IGNORECASE
    )
    nombre = re.sub(r'\s+X\d+\s*UNI\s*$', '', nombre, flags=re.IGNORECASE)
    nombre = nombre.strip()
    return nombre.title()


def parsear_pdf(pdf_bytes):
    """
    Parsea el PDF de la distribuidora y extrae productos con precios.
    Retorna: { fecha, tasa_bcv, productos: [{nombre_pdf, nombre_display, precio_bs}] }
    """
    fecha = None
    tasa_bcv = None
    productos = []
    vistos = set()

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        texto_completo = ''
        for page in pdf.pages:
            texto = page.extract_text()
            if texto:
                texto_completo += texto + '\n'

    lineas = [l.strip() for l in texto_completo.split('\n') if l.strip()]

    # Extraer fecha y tasa BCV
    for linea in lineas:
        m_fecha = re.search(r'FECHA[:\s]+(\d{2})/(\d{2})/(\d{4})', linea)
        if m_fecha:
            fecha = f"{m_fecha.group(3)}-{m_fecha.group(2)}-{m_fecha.group(1)}"

        m_tasa = re.search(r'TASA DEL DIA[^:]*:\s*([\d.]+)\s*Bs', linea, re.IGNORECASE)
        if m_tasa:
            tasa_bcv = float(m_tasa.group(1))

    # Palabras que indican que la línea NO es un producto
    ignoradas = [
        'DISTRIBUIDORA', 'LISTA DE PRECIOS', 'DESCRIPCION DEL PRODUCTO',
        'Reporte Generado', 'Pag.:', '*Fin de los Registros', 'Precio en Bs',
        'TASA DEL DIA', 'FECHA:', 'C. A.'
    ]

    # Patrón para extraer el precio del FINAL de la línea.
    # Formato venezolano: hasta 6 dígitos con separador de miles opcional.
    # Ejemplos válidos: 388.00 | 3 841.20 | 59 092.20 | 139 874.00
    # NO debe coincidir con: 18 3 757.20 (18 no es un separador de miles válido)
    # La clave: \d{1,3} + grupo opcional \s\d{3} (exactamente 3 dígitos tras el espacio)
    precio_final = re.compile(r'\s+(\d{1,3}(?:\s\d{3})?\.\d{2})Bs\s*$')

    for linea in lineas:
        # Ignorar líneas de cabecera
        if any(ig in linea for ig in ignoradas):
            continue

        m = precio_final.search(linea)
        if not m:
            continue

        nombre = linea[:m.start()].strip()
        precio_str = m.group(1).replace(' ', '')

        try:
            precio = float(precio_str)
        except ValueError:
            continue

        # Validar: nombre empieza con mayúscula, tiene al menos 4 chars, precio > 0
        if (len(nombre) >= 4
                and re.match(r'^[A-ZÁÉÍÓÚÑ]', nombre)
                and precio > 0
                and nombre not in vistos):
            vistos.add(nombre)
            productos.append({
                'nombre_pdf': nombre,
                'nombre_display': generar_nombre_display(nombre),
                'precio_bs': precio,
            })

    return {
        'fecha': fecha,
        'tasa_bcv': tasa_bcv,
        'productos': productos,
        'total': len(productos),
    }


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            if pdfplumber is None:
                self._error(500, 'pdfplumber no está instalado')
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._error(400, 'No se recibió ningún dato')
                return

            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            pdf_base64 = data.get('pdf_base64')
            if not pdf_base64:
                self._error(400, 'Falta el campo pdf_base64')
                return

            pdf_bytes = base64.b64decode(pdf_base64)
            resultado = parsear_pdf(pdf_bytes)

            if resultado['total'] == 0:
                self._error(400, 'No se encontraron productos en el PDF')
                return

            self._ok(resultado)

        except json.JSONDecodeError:
            self._error(400, 'JSON inválido en el body')
        except Exception as e:
            self._error(500, f'Error al parsear PDF: {str(e)}')

    def _ok(self, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code, mensaje):
        body = json.dumps({'error': mensaje}).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Silenciar logs por defecto
