import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// ============================================================
// UTILIDADES
// ============================================================

function calcPrecioUnitario(precioBs, porcentaje, stock) {
  if (!precioBs || !stock || stock === 0) return null;
  return (precioBs * (1 + porcentaje / 100)) / stock;
}

function formatBs(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return (
    new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor) + ' Bs'
  );
}

function indicadorCambio(precioActual, precioAnterior) {
  if (!precioAnterior || precioAnterior === 0) return null;
  const diff = precioActual - precioAnterior;
  const pct = ((diff / precioAnterior) * 100).toFixed(1);
  if (Math.abs(diff) < 0.01) return { tipo: 'igual', texto: '= Sin cambio' };
  if (diff > 0) return { tipo: 'subio', texto: `▲ +${pct}%` };
  return { tipo: 'bajo', texto: `▼ ${pct}%` };
}

// ============================================================
// ICONS (SVG inline para no depender de librerías)
// ============================================================

const IconoMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const IconoLupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

const IconoEditar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconoEliminar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const IconoPDF = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

const IconoMas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ============================================================
// TOAST
// ============================================================

function Toast({ mensaje, tipo, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`toast ${tipo}`} onClick={onClose}>
      {mensaje}
    </div>
  );
}

// ============================================================
// MODAL DE EDICIÓN
// ============================================================

function ModalEditar({ item, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(
    item.nombre_personalizado || item.nombre_pendiente || ''
  );
  const [precioManual, setPrecioManual] = useState(
    item.precio_manual ? String(item.precio_manual) : ''
  );
  const [stock, setStock] = useState(String(item.stock || 1));
  const [porcentajes, setPorcentajes] = useState(
    item.porcentajes && item.porcentajes.length > 0
      ? item.porcentajes.map(String)
      : ['0']
  );
  const [guardando, setGuardando] = useState(false);

  const agregarPct = () => setPorcentajes([...porcentajes, '0']);
  const quitarPct = (i) => {
    if (porcentajes.length === 1) return;
    setPorcentajes(porcentajes.filter((_, idx) => idx !== i));
  };
  const cambiarPct = (i, val) => {
    const nueva = [...porcentajes];
    nueva[i] = val;
    setPorcentajes(nueva);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    await onGuardar({
      nombre_personalizado: nombre,
      precio_manual: precioManual ? parseFloat(precioManual) : null,
      stock: parseInt(stock) || 1,
      porcentajes: porcentajes.map((p) => parseFloat(p) || 0),
    });
    setGuardando(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal">
        <div className="modal-handle" />
        <h2 className="modal-titulo">✏️ Editar Producto</h2>

        <div className="campo">
          <label>Nombre en pantalla</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del producto"
          />
        </div>

        <div className="campo">
          <label>Precio manual en Bs (opcional — sobrescribe el del PDF)</label>
          <input
            type="number"
            value={precioManual}
            onChange={(e) => setPrecioManual(e.target.value)}
            placeholder="Dejar vacío para usar precio del PDF"
            step="0.01"
            min="0"
          />
        </div>

        <div className="campo">
          <label>Cantidad (Stock / unidades por caja)</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Ej: 24"
            min="1"
          />
        </div>

        <div className="campo">
          <label>% de Ganancia</label>
          <div className="porcentajes-lista">
            {porcentajes.map((pct, i) => (
              <div key={i} className="porcentaje-fila">
                <input
                  type="number"
                  value={pct}
                  onChange={(e) => cambiarPct(i, e.target.value)}
                  placeholder="Ej: 20"
                  step="0.5"
                  min="0"
                  max="200"
                />
                <button className="btn-quitar-pct" onClick={() => quitarPct(i)}>
                  −
                </button>
              </div>
            ))}
            <button className="btn-agregar-pct" onClick={agregarPct}>
              + Agregar otro porcentaje
            </button>
          </div>
        </div>

        <div className="modal-acciones">
          <button className="btn-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn-guardar" onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : '✓ Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CARD MI TIENDA
// ============================================================

function TiendaCard({ item, index, onEditar, onEliminar, provided }) {
  const precio = item.precio_manual || item.productos?.precio_bs || 0;
  const cambio =
    item.productos?.precio_anterior_bs
      ? indicadorCambio(item.productos.precio_bs, item.productos.precio_anterior_bs)
      : null;

  const nombre =
    item.nombre_personalizado || item.nombre_pendiente || 'Sin nombre';

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`tienda-card${item.es_pendiente ? ' pendiente' : ''}`}
    >
      <div className="card-header">
        <div className="drag-handle" {...provided.dragHandleProps}>
          <IconoMenu />
        </div>
        <span className="card-nombre">{nombre}</span>
        <div className="card-acciones">
          <button className="btn-accion btn-editar" onClick={() => onEditar(item)}>
            <IconoEditar />
          </button>
          <button className="btn-accion btn-eliminar" onClick={() => onEliminar(item)}>
            <IconoEliminar />
          </button>
        </div>
      </div>

      {item.es_pendiente && (
        <div className="badge-pendiente">
          ⏳ Pendiente — no está en el PDF actual
        </div>
      )}

      <div className="card-precios">
        <div className="precio-base">
          <span className="precio-base-label">Precio PDF (caja/bulto)</span>
          <span className="precio-base-valor">
            {formatBs(precio)}
            {cambio && (
              <span className={`precio-cambio ${cambio.tipo}`}>{cambio.texto}</span>
            )}
          </span>
        </div>

        {precio > 0 &&
          item.porcentajes &&
          item.porcentajes.map((pct, i) => {
            const unitario = calcPrecioUnitario(precio, pct, item.stock);
            return (
              <div key={i}>
                <div className="divisor" />
                <div className="precio-calculo">
                  <span className="precio-calculo-label">
                    +{pct}% · {item.stock} unid.
                  </span>
                  <span className="precio-calculo-valor">
                    {formatBs(unitario)} / unid.
                  </span>
                </div>
              </div>
            );
          })}

        {precio === 0 && (
          <>
            <div className="divisor" />
            <div className="precio-calculo">
              <span className="precio-calculo-label">Sin precio aún</span>
              <span className="precio-calculo-valor" style={{ color: 'var(--texto-muted)' }}>
                Carga un PDF
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CARD TODOS LOS PRODUCTOS
// ============================================================

function TodosCard({ producto, yaEnTienda, onAgregar }) {
  const cambio = producto.precio_anterior_bs
    ? indicadorCambio(producto.precio_bs, producto.precio_anterior_bs)
    : null;

  return (
    <div className="todos-card">
      <div className="todos-card-info">
        <div className="todos-card-nombre">{producto.nombre_display || producto.nombre_pdf}</div>
        <div className="todos-card-precio">
          {formatBs(producto.precio_bs)}
          {cambio && (
            <span className={`precio-cambio ${cambio.tipo}`} style={{ marginLeft: 8 }}>
              {cambio.texto}
            </span>
          )}
        </div>
      </div>
      <button
        className={`btn-agregar${yaEnTienda ? ' ya-esta' : ''}`}
        onClick={() => !yaEnTienda && onAgregar(producto)}
        disabled={yaEnTienda}
      >
        {yaEnTienda ? (
          <>
            <IconoCheck /> En tienda
          </>
        ) : (
          <>
            <IconoMas /> Agregar
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function Home() {
  const [tab, setTab] = useState('tienda');
  const [busqueda, setBusqueda] = useState('');
  const [tiendaItems, setTiendaItems] = useState([]);
  const [todosProductos, setTodosProductos] = useState([]);
  const [cargandoTienda, setCargandoTienda] = useState(true);
  const [cargandoTodos, setCargandoTodos] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [infoPdf, setInfoPdf] = useState(null);
  const fileInputRef = useRef(null);

  // ---- Cargar datos ----

  const cargarTienda = useCallback(async () => {
    setCargandoTienda(true);
    try {
      const res = await fetch('/api/tienda');
      const data = await res.json();
      if (data.items) setTiendaItems(data.items);
    } catch (e) {
      mostrarToast('Error al cargar Mi Tienda', 'error');
    } finally {
      setCargandoTienda(false);
    }
  }, []);

  const cargarTodos = useCallback(async () => {
    setCargandoTodos(true);
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();
      if (data.productos) setTodosProductos(data.productos);
      if (data.infoPdf) setInfoPdf(data.infoPdf);
    } catch (e) {
      mostrarToast('Error al cargar productos', 'error');
    } finally {
      setCargandoTodos(false);
    }
  }, []);

  useEffect(() => {
    cargarTienda();
    cargarTodos();
  }, [cargarTienda, cargarTodos]);

  // ---- Toast ----

  const mostrarToast = (mensaje, tipo = 'exito') => {
    setToast({ mensaje, tipo });
  };

  // ---- Upload PDF ----

  const handleFileChange = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setSubiendo(true);
    mostrarToast('⏳ Procesando PDF...');

    const formData = new FormData();
    formData.append('pdf', archivo);

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        mostrarToast(
          `✅ PDF cargado — ${data.actualizados} productos actualizados`,
          'exito'
        );
        await Promise.all([cargarTienda(), cargarTodos()]);
      } else {
        mostrarToast(data.error || 'Error al procesar el PDF', 'error');
      }
    } catch (err) {
      mostrarToast('Error de conexión', 'error');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  // ---- Drag and Drop ----

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const nuevaLista = Array.from(tiendaItems);
    const [removed] = nuevaLista.splice(source.index, 1);
    nuevaLista.splice(destination.index, 0, removed);
    setTiendaItems(nuevaLista);

    // Guardar nuevo orden
    try {
      await fetch('/api/tienda/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orden: nuevaLista.map((item, i) => ({ id: item.id, orden: i })),
        }),
      });
    } catch (e) {
      mostrarToast('Error al guardar el orden', 'error');
    }
  };

  // ---- Editar ----

  const handleGuardarEdicion = async (datos) => {
    if (!modalItem) return;
    try {
      const res = await fetch(`/api/tienda/${modalItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (res.ok) {
        mostrarToast('✅ Cambios guardados');
        setModalItem(null);
        await cargarTienda();
      } else {
        const d = await res.json();
        mostrarToast(d.error || 'Error al guardar', 'error');
      }
    } catch (e) {
      mostrarToast('Error de conexión', 'error');
    }
  };

  // ---- Eliminar de tienda ----

  const handleEliminar = async (item) => {
    if (!confirm(`¿Quitar "${item.nombre_personalizado || item.nombre_pendiente}" de Mi Tienda?`))
      return;
    try {
      const res = await fetch(`/api/tienda/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        mostrarToast('Producto quitado de Mi Tienda');
        await Promise.all([cargarTienda(), cargarTodos()]);
      }
    } catch (e) {
      mostrarToast('Error al eliminar', 'error');
    }
  };

  // ---- Agregar a tienda ----

  const handleAgregar = async (producto) => {
    try {
      const res = await fetch('/api/tienda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.id,
          nombre_personalizado: producto.nombre_display,
          stock: 1,
          porcentajes: [0],
        }),
      });
      if (res.ok) {
        mostrarToast('✅ Agregado a Mi Tienda');
        await Promise.all([cargarTienda(), cargarTodos()]);
      }
    } catch (e) {
      mostrarToast('Error al agregar', 'error');
    }
  };

  // ---- Filtros de búsqueda ----

  const tiendaFiltrada = tiendaItems.filter((item) => {
    const nombre = (
      item.nombre_personalizado ||
      item.nombre_pendiente ||
      ''
    ).toLowerCase();
    return nombre.includes(busqueda.toLowerCase());
  });

  const tiendaIds = new Set(tiendaItems.map((i) => i.producto_id).filter(Boolean));

  const todosFiltrados = todosProductos.filter((p) => {
    const nombre = (p.nombre_display || p.nombre_pdf || '').toLowerCase();
    return nombre.includes(busqueda.toLowerCase());
  });

  // ---- Render ----

  return (
    <>
      <Head>
        <title>Bodega FC — Lista de Precios</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#166534" />
      </Head>

      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-top">
            <div>
              <h1>
                🏪 Bodega <span>FC</span>
              </h1>
              <div className="header-sub">Lista de Precios Actualizada</div>
            </div>
            <button
              className="btn-pdf"
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendo}
            >
              <IconoPDF />
              {subiendo ? 'Cargando...' : 'Cargar PDF'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </header>

        {/* Banner info PDF */}
        {infoPdf && (
          <div className="pdf-banner">
            <span>📄 PDF del {infoPdf.fecha_pdf}</span>
            <span>Tasa BCV: {infoPdf.tasa_bcv} Bs</span>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab${tab === 'tienda' ? ' activo' : ''}`}
            onClick={() => setTab('tienda')}
          >
            🏪 Mi Tienda
            <span className="tab-badge">{tiendaItems.length}</span>
          </button>
          <button
            className={`tab${tab === 'todos' ? ' activo' : ''}`}
            onClick={() => setTab('todos')}
          >
            📋 Todos los Productos
            <span className="tab-badge">{todosProductos.length}</span>
          </button>
        </div>

        {/* Buscador */}
        <div className="search-wrapper">
          <div className="search-input-wrap">
            <IconoLupa />
            <input
              className="search-input"
              type="text"
              placeholder={
                tab === 'tienda'
                  ? 'Buscar en mi tienda...'
                  : 'Buscar en todos los productos...'
              }
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="search-clear" onClick={() => setBusqueda('')}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Contenido */}
        {tab === 'tienda' ? (
          <>
            {cargandoTienda ? (
              <div className="loading">
                <div className="spinner" />
                <span>Cargando productos...</span>
              </div>
            ) : tiendaFiltrada.length === 0 ? (
              <div className="lista-vacia">
                <div className="icono-vacio">🛒</div>
                <h3>
                  {busqueda
                    ? 'No se encontraron productos'
                    : 'Mi Tienda está vacía'}
                </h3>
                <p>
                  {busqueda
                    ? 'Intenta con otro término de búsqueda.'
                    : 'Ve a "Todos los Productos" y agrega los productos que vendes.'}
                </p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="tienda">
                  {(provided) => (
                    <div
                      className="lista-container"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {tiendaFiltrada.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={String(item.id)}
                          index={index}
                        >
                          {(provided) => (
                            <TiendaCard
                              item={item}
                              index={index}
                              onEditar={setModalItem}
                              onEliminar={handleEliminar}
                              provided={provided}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </>
        ) : (
          <>
            {cargandoTodos ? (
              <div className="loading">
                <div className="spinner" />
                <span>Cargando todos los productos...</span>
              </div>
            ) : todosFiltrados.length === 0 ? (
              <div className="lista-vacia">
                <div className="icono-vacio">📋</div>
                <h3>
                  {busqueda ? 'No se encontraron productos' : 'Sin productos aún'}
                </h3>
                <p>
                  {busqueda
                    ? 'Intenta con otro término.'
                    : 'Carga un PDF de la distribuidora para ver los productos.'}
                </p>
              </div>
            ) : (
              <div className="lista-container">
                {todosFiltrados.map((producto) => (
                  <TodosCard
                    key={producto.id}
                    producto={producto}
                    yaEnTienda={tiendaIds.has(producto.id)}
                    onAgregar={handleAgregar}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de edición */}
      {modalItem && (
        <ModalEditar
          item={modalItem}
          onGuardar={handleGuardarEdicion}
          onCerrar={() => setModalItem(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
