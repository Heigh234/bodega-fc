-- ============================================================
-- SEED: MI TIENDA - Productos de la tienda de tu papá
-- IMPORTANTE: Corre este SQL DESPUÉS de haber cargado el
-- primer PDF desde la app (19/03 o más reciente).
-- ============================================================

-- Productos que SÍ están en el PDF (se vinculan automáticamente)
INSERT INTO tienda_productos (producto_id, nombre_personalizado, stock, porcentajes, orden)
SELECT p.id, nombres.display, nombres.stock, nombres.pcts, nombres.orden
FROM (VALUES
  -- (nombre_pdf_exacto, nombre_display, stock, porcentajes, orden)
  ('ARROZ GLORIA CLASICO 1KG X 24UNI',         'Arroz Gloria Clásico 1kg',        24, ARRAY[14]::DECIMAL[], 1),
  ('ARROZ MASIA 1 KG X 24 UNI',                'Arroz Masia 1kg',                 24, ARRAY[13]::DECIMAL[], 2),
  ('ARROZ MARY MOÑITO 900 GRS X 24 UNID',      'Arroz Mary Moñito 900g',          24, ARRAY[14]::DECIMAL[], 3),
  ('HARINA PAN 1KG X 20 UNI',                  'Harina Pan 1kg',                  20, ARRAY[13]::DECIMAL[], 4),
  ('PASTA CAPRI EXTRA ESPECIAL VERMICELLI 1KG X 12 UNI', 'Pasta Vermicelli Capri 1kg', 12, ARRAY[20]::DECIMAL[], 5),
  ('PASTA CAPRI PLUMA EXTRA ESPECIAL 500G X 12 UNI',     'Pasta Pluma Capri 500g',     12, ARRAY[20]::DECIMAL[], 6),
  ('PASTA CAPRI TORNILLO PREMIUM 1KG X 12 UNI',          'Pasta Tornillo Capri 1kg',   12, ARRAY[20]::DECIMAL[], 7),
  ('PASTA CAPRI PLUMA EXTRA ESPECIAL 1KG X 12 UNI',      'Pasta Pluma Capri 1kg',      12, ARRAY[20]::DECIMAL[], 8),
  ('HARINA ROBIN HOOD TODO USO 900 GR X 20 UNI',  'Harina Robinhood Todo Uso 900g',  20, ARRAY[25]::DECIMAL[], 9),
  ('HARINA ROBIN HOOD LEUDANTE 900 GM X 20 UNI',  'Harina Robinhood Leudante 900g',  20, ARRAY[25]::DECIMAL[], 10),
  ('AZUCAR PASTORA 1KG X 20 UNI',              'Azúcar Pastora 1kg',              20, ARRAY[15]::DECIMAL[], 11),
  ('SAL SAN BENITO 1KG X 25 UNI',              'Sal San Benito 1kg',              25, ARRAY[35]::DECIMAL[], 12),
  ('ACEITE VATEL VEGETAL 1L X 12 UNI',         'Aceite Vatel Vegetal 1L',         12, ARRAY[20]::DECIMAL[], 13),
  ('CARAOTA NEGRA DOÑA ALICIA 500 G X 24 UNI', 'Caraotas Negras Doña Alicia 500g',24, ARRAY[30]::DECIMAL[], 14),
  ('SARDINA PTO ALEGRE ( TOMATE) 170G X 24 UNI','Sardina Pto. Alegre Tomate 170g', 24, ARRAY[32]::DECIMAL[], 15),
  ('SARDINA EN ACEITE PTO ALEGRE 170 GT X 24 UNI','Sardina Pto. Alegre Aceite 170g',24, ARRAY[32]::DECIMAL[], 16),
  ('NELLY MARGARINA 250G X 24 UNI',            'Margarina Nelly 250g',            24, ARRAY[15]::DECIMAL[], 17),
  ('NELLY MARGARINA 500G X 12 UNI',            'Margarina Nelly 500g',            12, ARRAY[15]::DECIMAL[], 18),
  ('MAVESA MARGARINA 250GR X 24UN',            'Margarina Mavesa 250g',           24, ARRAY[15]::DECIMAL[], 19),
  ('MAVESA MARGARINA 500 G X 12 UNI',          'Margarina Mavesa 500g',           12, ARRAY[15]::DECIMAL[], 20),
  ('MAYONESA LA CONSTANCIA 85 GM X 12UNI',     'Mayonesa La Constancia 85g',      12, ARRAY[30]::DECIMAL[], 21),
  ('MAVESA MAYONESA 175G X 24 UNI',            'Mayonesa Mavesa 175g',            24, ARRAY[15]::DECIMAL[], 22),
  ('MAVESA MAYONESA 445G X 12UNI',             'Mayonesa Mavesa 445g',            12, ARRAY[15]::DECIMAL[], 23),
  ('SALSA ROJA LA CONSTANCIA 85 GM X 12 UNI',  'Salsa Roja La Constancia 85g',    12, ARRAY[30]::DECIMAL[], 24),
  ('SALSA KETCHUP PAMPERO 198GR X 24UNI',      'Ketchup Pampero 198g',            24, ARRAY[25]::DECIMAL[], 25),
  ('SALSA KETCHUP PAMPERO 397GR X 24UNI',      'Ketchup Pampero 397g',            24, ARRAY[25]::DECIMAL[], 26),
  ('SALSA DE SOYA CHINA 150CC X 24 UNI',       'Salsa Soya China 150cc',          24, ARRAY[32]::DECIMAL[], 27),
  ('CUBITO COMARRICO X 53 UNI',                'Cubito Comarrico',                53, ARRAY[40]::DECIMAL[], 28),
  ('CUBITO MAGGI X 250 UNI',                   'Cubito Maggi x250',              250, ARRAY[40]::DECIMAL[], 29),
  ('ADOBO LA COMADRE 200 G X 24UNI',           'Adobo La Comadre 200g',           24, ARRAY[32]::DECIMAL[], 30),
  ('PANELA 400 GRS X 24 UNID',                 'Panela 400g',                     24, ARRAY[32]::DECIMAL[], 31),
  ('CAFE LA PROTECTORA 50 GM X 20 UNI',        'Café La Protectora 50g',          20, ARRAY[25]::DECIMAL[], 32),
  ('CAFE SELLO ROJO 40 G X 10 UNI',            'Café Sello Rojo 40g',             10, ARRAY[22]::DECIMAL[], 33),
  ('CAFE LA PROTECTORA 200G X 20 UNI',         'Café La Protectora 200g',         20, ARRAY[22]::DECIMAL[], 34),
  ('CHIMON EL TIGRITO AZUL X 12 UNI',          'Chimo El Tigrito',                12, ARRAY[30]::DECIMAL[], 35),
  ('MALTIN POLAR 1.5L X 6UNI',                 'Maltin Polar 1.5L',                6, ARRAY[25]::DECIMAL[], 36),
  ('MALTIN POLAR RET X 36 UNI',                'Maltin Polar Retornable',         36, ARRAY[35]::DECIMAL[], 37),
  ('DISPLAY BOKA SURTIDO X 12 UNI',            'Boka Surtido',                    12, ARRAY[30]::DECIMAL[], 38),
  ('JUGO FRUGY MANZANA 1.5L X 12 UNI',         'Jugo Frugy 1.5L',                 12, ARRAY[30]::DECIMAL[], 39),
  ('JUGOS JUSTY NARANJA 1.5 ML X 12 UNI',      'Jugo Justy Naranja 1.5L',         12, ARRAY[30]::DECIMAL[], 40),
  ('LECHE MONTAÑA FRESCA 125G X 24UNI',        'Leche Montaña Fresca 125g',       24, ARRAY[25]::DECIMAL[], 41),
  ('LECHE COMPLETA SAN SIMON 125G X 24 UNI',   'Leche San Simón Completa 125g',   24, ARRAY[22]::DECIMAL[], 42),
  ('LECHE COMPLETA SAN SIMON 400G X 12 UNI',   'Leche San Simón Completa 400g',   12, ARRAY[17]::DECIMAL[], 43),
  ('LECHE LIQUIDA LATTI (ENTERA UHT ) 900ML X 12 UNI','Leche Latti Entera 900ml', 12, ARRAY[20,25]::DECIMAL[], 44),
  ('LASSIE AVENA HOJUELAS 400G X 24UNI',       'Avena Lassie Hojuelas 400g',      24, ARRAY[32]::DECIMAL[], 45),
  ('FORORO VALLE HONDO 250 GM X 30 UNI',       'Fororo Valle Hondo 250g',         30, ARRAY[33]::DECIMAL[], 46),
  ('CHOCO LISTO 20 GM X 18 UNI',               'ChocoListo 20g',                  18, ARRAY[32]::DECIMAL[], 47),
  ('COMIDA DE GATO MIRRINGO 1 K X 20 UNI',     'Comida Gato Mirringo 1kg',        20, ARRAY[33]::DECIMAL[], 48),
  ('COMIDA PARA PERRO RINGO GRANDE 30 KG',     'Comida Perro Ringo Grande 30kg',  30, ARRAY[35]::DECIMAL[], 49),
  ('VASOS LOS LLANOS V77 25 X 100UNI',         'Vasos Los Llanos V77',           100, ARRAY[35]::DECIMAL[], 50),
  ('CAJA CRONCH FLAKES MAIZO 300G X 12 UNI',   'Cronch Flakes Maizo 300g',        12, ARRAY[28]::DECIMAL[], 51),
  ('LECHE CONDENSADA NATULAC LATA 397G X 24 UNI','Leche Condensada Natulac 397g', 24, ARRAY[32]::DECIMAL[], 52),
  ('MEGA BIT CHOCOLATE 120 GM X 18 UNI',       'Mega Bit Chocolate 120g',         18, ARRAY[32]::DECIMAL[], 53),
  ('MAIZ COTUFA DOÑA ALICIA 500G X 24 UNI',    'Maíz Cotufa Doña Alicia 500g',   24, ARRAY[30]::DECIMAL[], 54),
  ('CAJA MAIZINA AMERICANA 90G X 50 UNI',      'Maizina Americana 90g',           50, ARRAY[32]::DECIMAL[], 55),
  ('CAJA MAIZINA AMERICANA 200G X 40 UNI',     'Maizina Americana 200g',          40, ARRAY[30]::DECIMAL[], 56),
  ('DIABLITO UNDER WOOD LATA 54 GM X 24 UNI',  'Diablito Underwood Lata 54g',     24, ARRAY[32]::DECIMAL[], 57),
  ('SOPA MAGGI POLLO X 12 UNI',                'Sopa Maggi Pollo',                12, ARRAY[30]::DECIMAL[], 58),
  ('VAINILLA TASTY 212ML X 40 UNI',            'Vainilla Tasty 212ml',            40, ARRAY[33]::DECIMAL[], 59),
  ('BEBIDA SPEED MAX 310 ML X 24 UNI',         'Speed Max 310ml',                 24, ARRAY[32]::DECIMAL[], 60)
) AS nombres(pdf_name, display, stock, pcts, orden)
JOIN productos p ON p.nombre_pdf = nombres.pdf_name
ON CONFLICT (producto_id) DO NOTHING;

-- Productos PENDIENTES (no están en el PDF todavía, se agregan manualmente)
INSERT INTO tienda_productos (producto_id, nombre_personalizado, stock, porcentajes, orden, es_pendiente, nombre_pendiente)
VALUES
  (NULL, 'Harina Nieve 1kg',            20, ARRAY[14]::DECIMAL[], 61, TRUE, 'Harina Nieve 1kg'),
  (NULL, 'Harina Arepa Arepa 1kg',      20, ARRAY[14]::DECIMAL[], 62, TRUE, 'Harina Arepa Arepa 1kg'),
  (NULL, 'Pasta Vermicelli Capri 500g', 24, ARRAY[20]::DECIMAL[], 63, TRUE, 'Pasta Vermicelli Capri 500g'),
  (NULL, 'Pasta Tornillo Capri 500g',   12, ARRAY[20]::DECIMAL[], 64, TRUE, 'Pasta Tornillo Capri 500g'),
  (NULL, 'Café Adriani 100g',           50, ARRAY[25]::DECIMAL[], 65, TRUE, 'Café Adriani 100g'),
  (NULL, 'Jugo Pulp Manzana 250ml',     24, ARRAY[27]::DECIMAL[], 66, TRUE, 'Jugo Pulp Manzana 250ml');

-- Verificación
SELECT 
  COALESCE(tp.nombre_personalizado, tp.nombre_pendiente) AS nombre,
  p.precio_bs,
  tp.stock,
  tp.porcentajes,
  tp.es_pendiente,
  tp.orden
FROM tienda_productos tp
LEFT JOIN productos p ON p.id = tp.producto_id
ORDER BY tp.orden;
