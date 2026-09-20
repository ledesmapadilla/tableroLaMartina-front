import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Container, Card, Table, Button, Form } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { subirArchivo, borrarArchivo } from '../../services/archivos'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya } from './estilos'
import { opcionesDePrecio, opcionMinima, opcionElegida } from './precioElegido'
import { useMontoAutorizacion } from './montoAutorizacion'
import { usePermisos } from '../../context/permisos'

const fmtNro = (n, src) => src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`
const esParaAnalisis = (e) => e === 'Para analisis' || e === 'En analisis' || e === 'Pedido' || e === 'Para revision'

// Un ítem que ya pasó el análisis (para autorizar, para hacer OP) no se vuelve
// a analizar: se abre para ver lo que cargó el analista, sin editar. Entonces
// se muestran los ítems del pedido que están en ese mismo estado.
const estadoVistoDe = (state) =>
  state?.item && !esParaAnalisis(state.item.estado) ? state.item.estado : null
const itemEnVista = (estadoVisto) => (i) =>
  estadoVisto ? i.estado === estadoVisto : esParaAnalisis(i.estado)
const NOMBRE_ESTADO = { Autorizar: 'Autorizar Gcia.' }

// Un análisis ya hecho se puede corregir mientras no haya orden de pago.
const ESTADOS_EDITABLES = ['Autorizar', 'Para hacer OP']

const fmtPrecio = (v) =>
  v === '' || v === null || v === undefined
    ? ''
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

// `elegido` vacío es "el más barato"; 1, 2 o 3, el presupuesto elegido a mano.
const FORM_ITEM_INIT = { stock: '', proveedor1: '', precio1: '', proveedor2: '', precio2: '', proveedor3: '', precio3: '', elegido: '' }

// Cada proveedor son dos columnas (el proveedor y su precio), y los tres
// bloques seguidos se leían corridos: una línea marcada donde arranca cada
// proveedor deja ver de una cuál precio es de quién. La línea va en index.css
// (`.col-proveedor`) y no acá: el borde de `.tabla-informe` lleva !important y
// le gana a cualquier borde inline.

// `soloVer` lo pone la ruta de los talleres (/compras/pedidos/analisis): el
// solicitante mira el análisis pero nunca lo procesa, aunque llegue sin ítem.
export default function AnalizarItem({ soloVer: soloVerProp = false }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  // Sin "Editar" en Analista (tabla de Roles) el análisis se mira y no se
  // procesa, igual que cuando se entra desde los talleres.
  const { puede } = usePermisos()
  const soloVerForzado = soloVerProp || !puede('compras.analista', 'editar')
  const esComprador = !!state?.esComprador
  const estadoVisto = estadoVistoDe(state)
  const enVista = itemEnVista(estadoVisto)
  // El analista puede reabrir un análisis ya hecho para corregirlo; el
  // comprador y los talleres solo lo miran.
  const [editando, setEditando] = useState(false)
  // Desde este monto el pedido va a Gerencia; lo definen gerente y superadmin.
  const { monto: montoAutorizacion } = useMontoAutorizacion()
  const puedeEditar =
    Boolean(estadoVisto) && ESTADOS_EDITABLES.includes(estadoVisto) && !soloVerForzado && !esComprador
  const soloVer = soloVerForzado || esComprador || (Boolean(estadoVisto) && !editando)
  const dropdownRef = useRef(null)

  const [pedidos, setPedidos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [formsMap, setFormsMap] = useState({})
  const [focusMap, setFocusMap] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  // itemId -> { url, nombre, publicId, tipo }, lo que quedó guardado en el ítem.
  const [archivosMap, setArchivosMap] = useState({})
  const [subiendo, setSubiendo] = useState(null)

  useEffect(() => {
    const enVista = itemEnVista(estadoVistoDe(state))
    Promise.all([
      api.get('/berdina/pedidos').catch(() => []),
      api.get('/sanpablo/pedidos').catch(() => []),
      api.get('/proveedores').catch(() => []),
    ]).then(([berdina, sanpablo, provs]) => {
      const todos = [
        ...berdina.map(p => ({ ...p, _src: 'berdina' })),
        ...sanpablo.map(p => ({ ...p, _src: 'sanpablo' })),
      ].filter(p => (p.items || []).some(i => enVista(i)))
      setPedidos(todos)
      setProveedores(provs)

      const initForms = (pedido) => {
        const mapa = {}
        ;(pedido.items || []).filter(i => enVista(i)).forEach(i => {
          mapa[i._id] = {
            stock:      i.stock      != null ? String(i.stock)      : '',
            proveedor1: i.proveedor1 ?? '',
            precio1:    i.precio1    != null ? String(i.precio1)    : '',
            proveedor2: i.proveedor2 ?? '',
            precio2:    i.precio2    != null ? String(i.precio2)    : '',
            proveedor3: i.proveedor3 ?? '',
            precio3:    i.precio3    != null ? String(i.precio3)    : '',
            elegido:    i.elegido    != null ? String(i.elegido)    : '',
          }
        })
        setFormsMap(mapa)
      }

      if (state?.item) {
        const key = `${state.item._src}-${state.item.nro_pedido}`
        setSelectedKey(key)
        setBusqueda(fmtNro(state.item.nro_pedido, state.item._src))
        const pedido = todos.find(p => `${p._src}-${p.nro_pedido}` === key)
        if (pedido) {
          initForms(pedido)
          const archivos = {}
          ;(pedido.items || []).filter(i => enVista(i)).forEach(i => {
            if (i.archivo?.url) archivos[i._id] = i.archivo
          })
          setArchivosMap(archivos)
        }
      }
    })
    // state no cambia mientras no se navegue: react-router devuelve la misma
    // location, así que ponerlo acá no dispara una recarga de más.
  }, [state])

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pedidosFiltrados = pedidos.filter(p =>
    fmtNro(p.nro_pedido, p._src).toLowerCase().includes(busqueda.toLowerCase())
  )

  const esMultiple = (p) => (p.items || []).filter(i => enVista(i)).length > 1

  const pedidoSeleccionado = pedidos.find(p => `${p._src}-${p.nro_pedido}` === selectedKey)
  const itemsAMostrar = pedidoSeleccionado
    ? (pedidoSeleccionado.items || []).filter(i => enVista(i))
    : []

  const calcularMontoTotal = () =>
    itemsAMostrar.reduce((acc, item) => {
      // El monto que decide si va a autorizar sale del presupuesto elegido.
      const elegida = opcionElegida(formsMap[item._id] || FORM_ITEM_INIT)
      return acc + (elegida ? elegida.precio : 0) * (item.cant || 0)
    }, 0)

  const elegirPedido = (p) => {
    const key = `${p._src}-${p.nro_pedido}`
    setSelectedKey(key)
    setBusqueda(fmtNro(p.nro_pedido, p._src))
    setShowDropdown(false)
    const archivos = {}
    ;(p.items || []).filter(i => enVista(i)).forEach(i => {
      if (i.archivo?.url) archivos[i._id] = i.archivo
    })
    setArchivosMap(archivos)
    const mapa = {}
    ;(p.items || []).filter(i => enVista(i)).forEach(i => {
      mapa[i._id] = {
        stock:      i.stock      != null ? String(i.stock)      : '',
        proveedor1: i.proveedor1 ?? '',
        precio1:    i.precio1    != null ? String(i.precio1)    : '',
        proveedor2: i.proveedor2 ?? '',
        precio2:    i.precio2    != null ? String(i.precio2)    : '',
        proveedor3: i.proveedor3 ?? '',
        precio3:    i.precio3    != null ? String(i.precio3)    : '',
        elegido:    i.elegido    != null ? String(i.elegido)    : '',
      }
    })
    setFormsMap(mapa)
  }

  // Cancelar la edición descarta lo tocado: se vuelve a cargar lo guardado.
  const cancelarEdicion = () => {
    setEditando(false)
    if (pedidoSeleccionado) elegirPedido(pedidoSeleccionado)
  }

  // --- Adjuntos ---
  // El archivo se sube a Cloudinary (services/archivos.js) y en el ítem queda
  // guardada su URL, así se ve desde cualquier computadora. Se guarda en el
  // momento, sin esperar a procesar el análisis.
  const rutaDelPedido = () =>
    pedidoSeleccionado?._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'

  const adjuntar = async (itemId, file) => {
    if (!pedidoSeleccionado) return
    setSubiendo(itemId)
    try {
      const archivo = await subirArchivo(file)
      await api.put(`${rutaDelPedido()}/${pedidoSeleccionado._id}/items/${itemId}`, { archivo })
      setArchivosMap(m => ({ ...m, [itemId]: archivo }))
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo adjuntar', text: err.message })
    } finally {
      setSubiendo(null)
    }
  }

  const quitarArchivo = async (itemId) => {
    if (!pedidoSeleccionado) return
    const archivo = archivosMap[itemId]
    try {
      // Primero se lo saca del ítem: si después falla el borrado en Cloudinary,
      // lo que queda es un archivo suelto y no un link roto en pantalla.
      await api.put(`${rutaDelPedido()}/${pedidoSeleccionado._id}/items/${itemId}`, { archivo: null })
      setArchivosMap(m => {
        const resto = { ...m }
        delete resto[itemId]
        return resto
      })
      await borrarArchivo(archivo || {})
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo quitar el archivo', text: err.message })
    }
  }

  const archivoCell = (item) => {
    const archivo = archivosMap[item._id]
    if (archivo) {
      return (
        <div className="d-flex align-items-center justify-content-center gap-1">
          <a
            href={archivo.url}
            target="_blank"
            rel="noreferrer"
            title={archivo.nombre || 'Ver el adjunto'}
            className="text-truncate"
            style={{ maxWidth: 80, fontSize: 12 }}
          >
            <i className="bi bi-paperclip" /> {archivo.nombre || 'Ver'}
          </a>
          {!soloVer && (
            <button
              className="btn btn-sm btn-link text-danger p-0"
              style={{ lineHeight: 1 }}
              title="Quitar archivo"
              onClick={() => quitarArchivo(item._id)}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
      )
    }
    const estaSubiendo = subiendo === item._id
    return (
      <label
        className={`btn btn-sm btn-outline-dark mb-0${soloVer || estaSubiendo ? ' disabled' : ''}`}
        style={{ fontSize: 12 }}
        title={soloVer ? 'Sin permiso para editar' : 'Adjuntar un PDF o una foto'}
      >
        {estaSubiendo ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" role="status" /> Subiendo…
          </>
        ) : (
          <>
            <i className="bi bi-upload" /> Subir
          </>
        )}
        <input
          type="file"
          accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx"
          hidden
          disabled={soloVer || estaSubiendo}
          onChange={e => { const f = e.target.files?.[0]; if (f) adjuntar(item._id, f); e.target.value = '' }}
        />
      </label>
    )
  }

  const setF = (itemId, campo, valor) =>
    setFormsMap(m => ({ ...m, [itemId]: { ...(m[itemId] || FORM_ITEM_INIT), [campo]: valor } }))

  const setFoco = (itemId, campo, val) =>
    setFocusMap(m => ({ ...m, [`${itemId}_${campo}`]: val }))

  const getFoco = (itemId, campo) => !!focusMap[`${itemId}_${campo}`]

  const procesar = async () => {
    if (!pedidoSeleccionado || itemsAMostrar.length === 0) return
    const monto = calcularMontoTotal()
    const nuevoEstado = monto >= montoAutorizacion ? 'Autorizar' : 'Para hacer OP'
    // Al corregir un análisis el estado se recalcula con la misma regla: si
    // ahora supera el monto, vuelve a Gerencia para autorizar.
    const cambiaEstado = editando && nuevoEstado !== estadoVisto
    const result = await Swal.fire({
      title: editando ? '¿Guardar los cambios del análisis?' : '¿Procesar pedido?',
      html:
        `Monto total: <b>${fmtPrecio(monto)}</b><br/>Estado → <b>${NOMBRE_ESTADO[nuevoEstado] || nuevoEstado}</b>` +
        (cambiaEstado ? '<br/><small style="color:#b45309">El pedido cambia de estado.</small>' : ''),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Procesar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4a0812',
    })
    if (!result.isConfirmed) return
    try {
      const base = pedidoSeleccionado._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await Promise.all(itemsAMostrar.map(item => {
        const form = formsMap[item._id] || FORM_ITEM_INIT
        // Vacío va como null y no como undefined: undefined no viaja en el
        // JSON, y al corregir un análisis un precio o proveedor borrado
        // quedaba con el valor viejo.
        const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n }
        return api.put(`${base}/${pedidoSeleccionado._id}/items/${item._id}`, {
          estado:     nuevoEstado,
          usuario:    'Analista',
          // El historial tiene que distinguir la corrección del primer análisis.
          ...(editando ? { nota: 'Análisis editado' } : {}),
          stock:      toNum(form.stock),
          proveedor1: form.proveedor1 || null,
          precio1:    toNum(form.precio1),
          proveedor2: form.proveedor2 || null,
          precio2:    toNum(form.precio2),
          proveedor3: form.proveedor3 || null,
          precio3:    toNum(form.precio3),
          elegido:    toNum(form.elegido),
        })
      }))
      await Swal.fire({ icon: 'success', title: 'Procesado', timer: 1500, showConfirmButton: false })
      navigate(-1)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const precioInput = (item, campo) => {
    const form = formsMap[item._id] || FORM_ITEM_INIT
    const enFoco = getFoco(item._id, campo)
    return (
      <input
        type={enFoco ? 'number' : 'text'}
        min="0"
        className="form-control form-control-sm"
        style={{ minWidth: 90 }}
        value={enFoco ? form[campo] : fmtPrecio(form[campo])}
        onChange={e => setF(item._id, campo, e.target.value)}
        onFocus={() => setFoco(item._id, campo, true)}
        onBlur={() => setFoco(item._id, campo, false)}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        placeholder="$"
        disabled={soloVer}
      />
    )
  }

  const provSelect = (item, campo) => {
    const form = formsMap[item._id] || FORM_ITEM_INIT
    return (
      <select
        className={`form-select form-select-sm${form[campo] ? ' select-activo' : ''}`}
        style={form[campo] ? { backgroundImage: 'none' } : {}}
        value={form[campo]}
        onChange={e => setF(item._id, campo, e.target.value)}
        disabled={soloVer}
      >
        <option value="">—</option>
        {proveedores.map(p => <option key={p._id} value={p._id}>{p.razonsocial}</option>)}
      </select>
    )
  }

  // En el resumen, el proveedor con el que se cuenta cada ítem. Por defecto el
  // más barato; el analista puede elegir cualquiera que tenga precio. Elegir
  // el más barato lo deja en automático, así sigue al mínimo si cambian los
  // precios.
  const nombreProveedor = (id) => proveedores.find((p) => p._id === id)?.razonsocial || ''
  const selectorProveedor = (item, opciones, elegida) => {
    if (!elegida) return <Raya />
    const etiqueta = (o) => nombreProveedor(o.proveedor) || `Proveedor ${o.n}`
    if (soloVer) {
      return (
        <span>
          {etiqueta(elegida)}
          {!elegida.esMinima && (
            <span className="text-muted" style={{ fontSize: '0.66rem' }}> · elegido, no es el más bajo</span>
          )}
        </span>
      )
    }
    const minima = opcionMinima(opciones)
    return (
      <select
        className="form-select form-select-sm"
        style={{ fontSize: '0.74rem', minWidth: 180 }}
        value={String(elegida.n)}
        onChange={(e) => setF(item._id, 'elegido', Number(e.target.value) === minima.n ? '' : e.target.value)}
      >
        {opciones.map((o) => (
          <option key={o.n} value={o.n}>
            {etiqueta(o)} — {fmtPrecio(o.precio)}
            {o.n === minima.n ? ' (más bajo)' : ''}
          </option>
        ))}
      </select>
    )
  }

  const fecha = pedidoSeleccionado?.fecha?.slice(0, 10).split('-').reverse().join('/') || '—'

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', overflowY: 'auto' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap flex-shrink-0">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            {editando ? 'Editar análisis' : soloVer ? 'Análisis del pedido' : 'Analizar ítem'}
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
          >
            precios sin IVA
          </span>
          {estadoVisto && (
            <span className="badge" style={{ backgroundColor: '#8b2035', fontSize: '0.72rem' }}>
              {NOMBRE_ESTADO[estadoVisto] || estadoVisto}
            </span>
          )}

          {/* Solo el analista procesa. Un análisis ya hecho se abre para verlo
              y, mientras no haya orden de pago, se puede reabrir y corregir. */}
          {puedeEditar && !editando && (
            <Button
              size="sm"
              disabled={itemsAMostrar.length === 0}
              onClick={() => setEditando(true)}
              className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
              style={{ backgroundColor: '#b45309', borderColor: '#b45309', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            >
              <i className="bi bi-pencil-square"></i>
              <span>Editar análisis</span>
            </Button>
          )}
          {editando && (
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={cancelarEdicion}
              className="rounded-3 px-3 ms-auto"
              style={{ fontSize: '0.78rem', height: '30px' }}
            >
              Cancelar
            </Button>
          )}
          {!soloVer && (
            <Button
              size="sm"
              disabled={itemsAMostrar.length === 0}
              onClick={procesar}
              className={`rounded-3 px-3 d-flex align-items-center gap-2${editando ? '' : ' ms-auto'}`}
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>{editando ? 'Guardar cambios' : 'Procesar'}</span>
            </Button>
          )}
        </div>

        {/* Buscador del pedido a analizar */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div ref={dropdownRef} className="d-flex flex-column" style={{ position: 'relative', width: '220px' }}>
            <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
              N° Pedido
            </span>
            <Form.Control
              className={`rounded-3 ${selectedKey ? 'fw-bold filtro-activo' : ''}`}
              style={{
                fontSize: '0.82rem',
                height: '32px',
                padding: '3px 8px',
                color: selectedKey ? '#dc2626' : '#1e293b',
                fontWeight: selectedKey ? '700' : 'normal',
              }}
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => {
                setBusqueda('')
                setShowDropdown(true)
              }}
              onBlur={() => {
                if (pedidoSeleccionado) setBusqueda(fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src))
              }}
              placeholder="Buscar pedido…"
              autoComplete="off"
            />

            {showDropdown && pedidosFiltrados.length > 0 && (
              <div
                className="shadow-lg"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 100,
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  width: 220,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {pedidosFiltrados.map((p) => {
                  const key = `${p._src}-${p.nro_pedido}`
                  const multiple = esMultiple(p)
                  const elegido = key === selectedKey
                  return (
                    <div
                      key={key}
                      onMouseDown={() => elegirPedido(p)}
                      style={{
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: multiple ? 700 : 500,
                        color: elegido ? BORDO : '#334155',
                        backgroundColor: elegido ? BORDO_SUAVE : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = BORDO_SUAVE
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = elegido ? BORDO_SUAVE : 'transparent'
                      }}
                    >
                      {fmtNro(p.nro_pedido, p._src)}
                      {multiple && (
                        <span className="ms-1 text-muted" style={{ fontSize: '0.72rem', fontWeight: 400 }}>
                          ({(p.items || []).filter((i) => enVista(i)).length} ítems)
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Carga de los tres presupuestos */}
        <div
          className="shadow-sm rounded-3 bg-white mb-3 flex-shrink-0"
          style={{ maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1180px' }}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Stock</th>
                <th style={thCentro}>Proveedor 1</th>
                <th style={thCentro}>Precio 1</th>
                <th className="col-proveedor" style={thCentro}>Proveedor 2</th>
                <th style={thCentro}>Precio 2</th>
                <th className="col-proveedor" style={thCentro}>Proveedor 3</th>
                <th style={thCentro}>Precio 3</th>
                <th style={thCentro}>Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              {itemsAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-muted py-4" style={td}>
                    {selectedKey ? 'Este pedido no tiene ítems para analizar' : 'Elegí un pedido para empezar'}
                  </td>
                </tr>
              ) : (
                itemsAMostrar.map((item) => (
                  <tr key={item._id}>
                    <td style={{ ...tdCentro, padding: '4px 5px' }}>{fecha}</td>
                    <td style={{ ...td, padding: '4px 5px', fontWeight: 500 }}>{item.nombre_repuesto}</td>
                    <td style={{ ...td, padding: '4px 5px' }}>
                      <Form.Control
                        type="number"
                        min="0"
                        size="sm"
                        className="rounded-3"
                        style={{ fontSize: '0.8rem', height: '30px' }}
                        value={(formsMap[item._id] || FORM_ITEM_INIT).stock}
                        onChange={(e) => setF(item._id, 'stock', e.target.value)}
                        placeholder="0"
                        disabled={soloVer}
                      />
                    </td>
                    <td style={{ ...td, padding: '4px 5px' }}>{provSelect(item, 'proveedor1')}</td>
                    <td style={{ ...td, padding: '4px 5px' }}>{precioInput(item, 'precio1')}</td>
                    <td className="col-proveedor" style={{ ...td, padding: '4px 5px' }}>{provSelect(item, 'proveedor2')}</td>
                    <td style={{ ...td, padding: '4px 5px' }}>{precioInput(item, 'precio2')}</td>
                    <td className="col-proveedor" style={{ ...td, padding: '4px 5px' }}>{provSelect(item, 'proveedor3')}</td>
                    <td style={{ ...td, padding: '4px 5px' }}>{precioInput(item, 'precio3')}</td>
                    <td style={{ ...tdCentro, padding: '4px 5px' }}>{archivoCell(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        {/* Resumen: qué sale el pedido con el presupuesto que vale para cada
            ítem (el más barato, salvo que se elija otro). */}
        {itemsAMostrar.length > 0 &&
          (() => {
            const filas = itemsAMostrar.map((item) => {
              const form = formsMap[item._id] || FORM_ITEM_INIT
              const opciones = opcionesDePrecio(form)
              const elegida = opcionElegida(form)
              const cant = item.cant || 0
              const total = elegida ? elegida.precio * cant : null
              return { item, opciones, elegida, cant, total }
            })
            const sumaTotal = filas.reduce((acc, r) => acc + (r.total || 0), 0)

            return (
              <div className="d-flex flex-column align-items-center flex-shrink-0 pb-3">
                <div className="fw-bold mb-2" style={{ color: BORDO, fontSize: '0.9rem' }}>
                  Resumen
                </div>

                <div
                  className="shadow-sm rounded-3 bg-white"
                  style={{ width: '820px', maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}
                >
                  <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={thCentro}>Fecha</th>
                        <th style={th}>Repuesto</th>
                        <th style={thCentro}>Cant.</th>
                        <th style={th}>Proveedor</th>
                        <th style={thCentro}>Precio unit.</th>
                        <th style={thCentro}>Precio total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map(({ item, opciones, elegida, cant, total }) => (
                        <tr key={item._id}>
                          <td style={tdCentro}>{fecha}</td>
                          <td style={{ ...td, fontWeight: 500 }}>{item.nombre_repuesto}</td>
                          <td style={tdCentro}>{cant || <Raya />}</td>
                          <td style={{ ...td, padding: '2px 5px' }}>{selectorProveedor(item, opciones, elegida)}</td>
                          <td style={tdCentro}>{elegida ? fmtPrecio(elegida.precio) : <Raya />}</td>
                          <td style={{ ...tdCentro, fontWeight: 600 }}>
                            {total !== null ? fmtPrecio(total) : <Raya />}
                          </td>
                        </tr>
                      ))}

                      {/* La fila de total va con la clase fila-total, si no el
                          hover le gana al fondo. */}
                      <tr className="fila-total">
                        <td style={{ ...td, fontWeight: 700, color: BORDO }}>TOTAL</td>
                        <td style={td} />
                        <td style={td} />
                        <td style={td} />
                        <td style={td} />
                        <td style={{ ...tdCentro, fontWeight: 700, color: BORDO }}>{fmtPrecio(sumaTotal)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>

                <div className="mt-2 text-center" style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Total del pedido{' '}
                  <span className="fw-bold" style={{ color: BORDO }}>
                    {pedidoSeleccionado ? fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src) : ''}
                  </span>
                  {filas.some((f) => f.elegida && !f.elegida.esMinima)
                    ? ', con proveedores elegidos a mano'
                    : ', con el precio más bajo de cada ítem'}
                </div>
              </div>
            )
          })()}
      </Container>
    </div>
  )
}
