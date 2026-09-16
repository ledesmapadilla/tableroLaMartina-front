import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { verDetallePedido, verHistorialPedido, conCreacion } from './detallePedido'
import UmbralAutorizacion from './UmbralAutorizacion'
import { exportarPlanilla } from '../../helpers/excel'
import { api } from '../../services/api'
import { GRUPOS_PEDIDO } from '../../utils/equipos'
import { BORDO, BORDO_SUAVE, campo, th, thCentro, td, tdCentro } from './formato'
import { avisarSinOC, idsARetirar } from './avisos'
import {
  Raya,
  BotonAccion,
  BotonLimpiar,
  FiltroTexto,
  FiltroSelect,
  OjoPedido,
  CeldaOP,
} from './estilos'
import { useProveedorDeOP } from './proveedorOP'

const fmtNro = (n, src) => src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const URGENCIAS      = ['Baja', 'Media', 'Alta', 'Crítica']
const ESTADOS        = ['Para analisis', 'Para hacer OP', 'Autorizar', 'Para retirar', 'Rechazado']
// Los grupos salen del catálogo de equipos (utils/equipos.js).
const GRUPOS = GRUPOS_PEDIDO
const ESTABLECIMIENTOS = ['Berdina', 'San Pablo']

const ITEM_INIT = { nombre_repuesto: '', cant: '', unidad: '', descripcion: '', urgencia: 'Media', grupo: 'Tractores', cc: '', estado: 'Pendiente' }

export default function AnalistaPedidos() {
  const navigate = useNavigate()
  const esComprador = useLocation().pathname === '/compras/comprador'
  const [pedidos, setPedidos] = useState([])
  const [form, setForm] = useState(ITEM_INIT)
  const [editPedidoId, setEditPedidoId] = useState(null)
  const [editItemId, setEditItemId] = useState(null)
  const [editSrc, setEditSrc] = useState(null)
  const [showModal, setShowModal] = useState(false)
  // Pedidos múltiples abiertos con el ojo: sus ítems se muestran debajo, en
  // la misma tabla.
  const [abiertos, setAbiertos] = useState(() => new Set())
  // A qué proveedor se le compró cada ítem, para mostrarlo al lado de la OP.
  const proveedorDeOP = useProveedorDeOP()
  const [selectedId, setSelectedId] = useState(null)
  const FILTROS_INIT = { nro: '', fecha: '', cc: '', repuesto: '', urgencia: '', grupo: '', solicita: '', estado: esComprador ? 'Para hacer OP' : 'Para analisis', establecimiento: '' }
  const [filtros, setFiltros] = useState(FILTROS_INIT)
  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
  // La pantalla arranca filtrada por su etapa, pero la cruz aparece apenas
  // hay algún filtro puesto y los saca todos, como en el resto de Compras:
  // antes se veía con todo en "Todos" y al tocarla volvía a filtrar.
  const limpiar = () => setFiltros(Object.fromEntries(Object.keys(FILTROS_INIT).map((k) => [k, ''])))
  const hayFiltros = Object.values(filtros).some((v) => v !== '')

  // La carga vive adentro del efecto y `cargar()` solo pide una vuelta más:
  // así el que trae los datos es el efecto, que es quien puede cancelarse si
  // la pantalla se cierra antes de que contesten las dos APIs.
  const [recarga, setRecarga] = useState(0)
  const cargar = () => setRecarga(n => n + 1)

  useEffect(() => {
    let vigente = true
    ;(async () => {
      const [berdina, sanpablo] = await Promise.all([
        api.get('/berdina/pedidos').catch(() => []),
        api.get('/sanpablo/pedidos').catch(() => []),
      ])
      if (!vigente) return
      setPedidos([
        ...berdina.map(p => ({ ...p, _src: 'berdina' })),
        ...sanpablo.map(p => ({ ...p, _src: 'sanpablo' })),
      ])
    })()
    return () => { vigente = false }
  }, [recarga])

  const items = pedidos.flatMap(p =>
    (p.items || []).map(item => ({
      ...item,
      nro_pedido: p.nro_pedido,
      fecha: p.fecha,
      pedidoId: p._id,
      _src: p._src,
    }))
  )

  const lista = items.filter(item => {
    const normEstado = (item.estado === 'Pedido' || item.estado === 'En analisis' || item.estado === 'Para revision') ? 'Para analisis' : item.estado
    if (esComprador && normEstado === 'Para analisis') return false
    if (filtros.nro && !fmtNro(item.nro_pedido, item._src).includes(filtros.nro.toUpperCase())) return false
    if (filtros.fecha && item.fecha?.slice(0, 10) !== filtros.fecha) return false
    if (filtros.cc && !item.cc?.toLowerCase().includes(filtros.cc.toLowerCase())) return false
    if (filtros.repuesto && !item.nombre_repuesto?.toLowerCase().includes(filtros.repuesto.toLowerCase())) return false
    if (filtros.urgencia && item.urgencia !== filtros.urgencia) return false
    if (filtros.grupo && item.grupo !== filtros.grupo) return false
    if (filtros.solicita && !item.solicita?.toLowerCase().includes(filtros.solicita.toLowerCase())) return false
    // "Para analisis" muestra solo lo que está para analizar: antes dejaba
    // pasar también los "Para retirar", que tienen su propia opción.
    if (filtros.estado && normEstado !== filtros.estado) return false
    if (filtros.establecimiento && item._src !== filtros.establecimiento.toLowerCase().replace(' ', '')) return false
    return true
  })

  const uniq = (arr) => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ''))]
  const colapsar = (vals) => vals.length === 0 ? '' : vals.length === 1 ? vals[0] : 'Varios'

  const listaAgrupada = Object.values(
    lista.reduce((acc, item) => {
      const k = `${item._src}-${item.nro_pedido}`
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    }, {})
  ).map(items => ({
    _agrupado: true,
    _count: items.length,
    _items: items,
    _key: `${items[0]._src}-${items[0].nro_pedido}`,
    _src: items[0]._src,
    nro_pedido: items[0].nro_pedido,
    fecha: items[0].fecha,
    cc:              colapsar(uniq(items.map(i => i.cc))),
    nombre_repuesto: colapsar(uniq(items.map(i => i.nombre_repuesto))),
    cant:            colapsar(uniq(items.map(i => i.cant?.toString()))),
    unidad:          colapsar(uniq(items.map(i => i.unidad))),
    descripcion:     colapsar(uniq(items.map(i => i.descripcion))),
    urgencia:        colapsar(uniq(items.map(i => i.urgencia))),
    grupo:           colapsar(uniq(items.map(i => i.grupo))),
    solicita:        colapsar(uniq(items.map(i => i.solicita))),
    estado:          colapsar(uniq(items.map(i => i.estado))),
    oc:              colapsar(uniq(items.map(i => i.oc))),
  }))

  // Siempre por pedido: los múltiples se abren con el ojo.
  const listaAMostrar = listaAgrupada
    .slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const alternarAbierto = (clave) =>
    setAbiertos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(clave)) siguiente.delete(clave)
      else siguiente.add(clave)
      return siguiente
    })

  // Las filas de la tabla: cada pedido y, debajo de los abiertos, sus ítems
  // marcados como anidados. Se dibujan con la misma fila que un ítem suelto.
  const filasAMostrar = listaAMostrar.flatMap((f) =>
    f._agrupado && f._count > 1 && abiertos.has(f._key)
      ? [f, ...f._items.map((i) => ({ ...i, _anidada: true }))]
      : [f]
  )

  const abrirEditar = (item) => {
    setForm({
      nombre_repuesto: item.nombre_repuesto,
      cant: item.cant || '',
      unidad: item.unidad || '',
      descripcion: item.descripcion || '',
      urgencia: item.urgencia,
      grupo: item.grupo,
      cc: item.cc || '',
      estado: item.estado,
    })
    setEditPedidoId(item.pedidoId)
    setEditItemId(item._id)
    setEditSrc(item._src)
    setShowModal(true)
  }

  const cerrar = () => { setForm(ITEM_INIT); setEditPedidoId(null); setEditItemId(null); setEditSrc(null); setShowModal(false) }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      const { cant, ...rest } = form
      const payload = { ...rest, usuario: 'Analista', ...(cant !== '' && cant != null ? { cant: Number(cant) } : {}) }
      const base = editSrc === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await api.put(`${base}/${editPedidoId}/items/${editItemId}`, payload)
      cargar()
      cerrar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const rechazar = async (item) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: '¿Rechazar repuesto?',
      html: `<div style="font-weight:600;margin-bottom:8px">${item.nombre_repuesto}</div>`,
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Explicá el motivo...',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-danger me-2', cancelButton: 'btn btn-outline-secondary' },
      preConfirm: (val) => {
        if (!val?.trim()) { Swal.showValidationMessage('El motivo es obligatorio'); return false }
        return val.trim()
      },
    })
    if (!isConfirmed) return
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await api.put(`${base}/${item.pedidoId}/items/${item._id}`, {
        estado: 'Rechazado',
        usuario: esComprador ? 'Comprador' : 'Analista',
        nota: motivo,
      })
      cargar()
      Swal.fire({ icon: 'success', title: 'Rechazado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  // Exporta con exceljs, la unica libreria de Excel del proyecto. El formato
  // (titulo, fecha, encabezado verde y bordes) lo pone el helper compartido.
  const exportarExcel = async () => {
    await exportarPlanilla({
      titulo: "Pedidos — La Martina (Berdina + San Pablo)",
      columnas: [
        { titulo: "Taller", ancho: 14 },
        { titulo: "N° Pedido", ancho: 12 },
        { titulo: "Fecha", ancho: 12 },
        { titulo: "C.C.", ancho: 10 },
        { titulo: "Repuesto", ancho: 26 },
        { titulo: "Cant.", ancho: 8 },
        { titulo: "Un.", ancho: 8 },
        { titulo: "Descripción", ancho: 34 },
        { titulo: "Urgencia", ancho: 12 },
        { titulo: "Grupo", ancho: 16 },
        { titulo: "Solicita", ancho: 18 },
        { titulo: "Estado", ancho: 14 },
        { titulo: "O.P.", ancho: 12 },
      ],
      filas: lista.map((item) => [
        item._src === "berdina" ? "Berdina" : "San Pablo",
        fmtNro(item.nro_pedido, item._src),
        item.fecha?.slice(0, 10).split("-").reverse().join("/"),
        item.cc || "",
        item.nombre_repuesto,
        item.cant ?? "",
        item.unidad || "",
        item.descripcion || "",
        item.urgencia,
        item.grupo,
        item.solicita || "",
        item.estado === "Pedido" ? "Para analisis" : item.estado || "",
        item.oc || "",
      ]),
      hoja: "Pedidos",
      archivo: `Pedidos_Analista_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  }

  const verDetalle = (item) =>
    verDetallePedido({ titulo: `Pedido ${fmtNro(item.nro_pedido, item._src)}`, items: item._items })

  const verMotivoRevision = async (item) => {
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const hist = await api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
      const revision = [...hist].reverse().find(h => h.estado === 'Para revision')
      const fecha = revision?.fecha ? new Date(revision.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
      Swal.fire({
        icon: 'warning',
        title: 'Enviado a revisión',
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Repuesto:</strong> ${item.nombre_repuesto}</div>
          <div style="margin-top:6px"><strong>Enviado por:</strong> ${revision?.usuario || '—'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          ${revision?.nota ? `<div style="margin-top:10px;padding:10px;background:#fffbf0;border-left:3px solid #ffc107;border-radius:2px"><strong>Motivo:</strong> ${revision.nota}</div>` : '<div style="margin-top:6px;color:#888">Sin motivo registrado</div>'}
        </div>`,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const verMotivoRechazo = async (item) => {
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const hist = await api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
      const rechazo = [...hist].reverse().find(h => h.estado === 'Rechazado' || h.estado === 'Cancelado')
      const fecha = rechazo?.fecha ? new Date(rechazo.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
      Swal.fire({
        icon: 'error',
        title: 'Pedido rechazado',
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Repuesto:</strong> ${item.nombre_repuesto}</div>
          <div style="margin-top:6px"><strong>Rechazado por:</strong> ${rechazo?.usuario || '—'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          ${rechazo?.nota ? `<div style="margin-top:10px;padding:10px;background:#fff5f5;border-left:3px solid #dc3545;border-radius:2px"><strong>Motivo:</strong> ${rechazo.nota}</div>` : '<div style="margin-top:6px;color:#888">Sin motivo registrado</div>'}
        </div>`,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const verMotivoRetirado = async (item) => {
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const hist = await api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
      const retirado = [...hist].reverse().find(h => h.estado === 'Retirado')
      const fecha = retirado?.fecha ? new Date(retirado.fecha).toLocaleString('es-AR', { dateStyle: 'short' }) : '—'
      Swal.fire({
        icon: 'success',
        title: 'Retirado',
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Repuesto:</strong> ${item.nombre_repuesto}</div>
          <div style="margin-top:6px"><strong>Retirado por:</strong> ${retirado?.usuario || '—'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          ${retirado?.nota ? `<div style="margin-top:10px;padding:10px;background:#f0fff4;border-left:3px solid #198754;border-radius:2px"><strong>Observaciones:</strong> ${retirado.nota}</div>` : '<div style="margin-top:6px;color:#888">Sin observaciones</div>'}
        </div>`,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const verHistorial = async (item) => {
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const hist = await api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
      verHistorialPedido({
        titulo: `Historial · ${item.nombre_repuesto}`,
        secciones: [{ historial: conCreacion(hist, item) }],
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const varios = () => <span className="text-muted fst-italic" style={{ fontSize: 12 }}>Varios</span>

  const badgeUrgencia = (u) => {
    if (u === 'Varios') return varios()
    const color = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
    return <span style={{ fontWeight: 600, color: color[u] || '#6c757d' }}>{u}</span>
  }

  const badgeEstado = (e) => {
    if (e === 'Varios') return varios()
    if (e === 'Para revision') return <span className="badge bg-warning">Para revision</span>
    const norm = e === 'Pedido' || e === 'En analisis' ? 'Para analisis' : e
    // Se lee como botón: lleva al análisis que hizo el analista.
    if (norm === 'Autorizar') {
      return (
        <span className="badge" style={{ backgroundColor: '#8b2035' }} title="Ver el análisis del analista">
          <i className="bi bi-clipboard-data me-1"></i>Autorizar Gcia.
        </span>
      )
    }
    if (e === 'Retirado') return <span className="badge" style={{ backgroundColor: '#6f42c1' }}>Retirado</span>
    const color = { 'Para analisis': 'primary', 'Para hacer OP': 'info', Pendiente: 'secondary', 'En proceso': 'warning', 'Para retirar': 'success', Completado: 'success', Cancelado: 'danger', Rechazado: 'danger' }
    return <span className={`badge bg-${color[norm] || 'secondary'}`}>{norm}</span>
  }

  const badgeEstablecimiento = (src) => {
    if (src === 'Varios') return varios()
    return (
      <span
        className="badge"
        style={{
          backgroundColor: src === 'berdina' ? BORDO : '#166534',
          fontSize: '0.62rem',
          letterSpacing: 0.3,
        }}
      >
        {src === 'berdina' ? 'Berdina' : 'San Pablo'}
      </span>
    )
  }

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
      {/* La urgencia crítica pinta la fila, y la fila elegida se marca con el
          fondo de edición del formato. Van en un bloque propio porque
          .tabla-informe pinta el fondo sobre los td y un style en el tr no le
          gana. */}
      <style>{`
        .tabla-informe.tabla-analista tbody tr.fila-critica > td { background-color: #fee2e2; }
        .tabla-informe.tabla-analista tbody tr.fila-critica:hover > td { background-color: #fca5a5; }
        .tabla-informe.tabla-analista tbody tr.fila-elegida > td { background-color: #e0f2fe; }
        .tabla-informe.tabla-analista thead th { font-weight: 700; }
      `}</style>

      {/* El ancho de la página lo fija el Container: encabezado, filtros y
          tabla comparten el mismo borde izquierdo y derecho. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1180px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            {esComprador ? 'Compras' : 'Pedidos'}
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
          >
            {esComprador ? 'Para hacer OP' : 'Para análisis'} · {listaAMostrar.length}
          </span>

          {/* El comprador arma la orden; el analista analiza el ítem elegido. */}
          {esComprador ? (
            <Button
              size="sm"
              onClick={() => navigate('/compras/comprador/op')}
              className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
              style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            >
              <i className="bi bi-receipt"></i>
              <span>Generar orden de pago</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                const item = selectedId ? lista.find((i) => i._id === selectedId) : null
                navigate('/compras/analista/analizar', { state: item ? { item } : undefined })
              }}
              className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
              style={{ backgroundColor: '#3730a3', borderColor: '#3730a3', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
              title={selectedId ? 'Analizar el ítem elegido' : 'Sin ítem elegido: abre el análisis vacío'}
            >
              <i className="bi bi-clipboard-data-fill"></i>
              <span>Analizar</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={listaAMostrar.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* El comprador tiene que saber a partir de qué monto hay que pedir
            autorización a Gerencia. */}
        {esComprador && <UmbralAutorizacion />}

        {/* Filtros: los nueve en una sola fila, con el rótulo arriba del campo. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-nowrap" style={{ overflowX: 'auto' }}>
            <FiltroTexto etiqueta="N°" ancho="72px" valor={filtros.nro} onChange={(v) => setF('nro', v)} placeholder="N°" />
            <FiltroTexto etiqueta="Fecha" ancho="130px" tipo="date" valor={filtros.fecha} onChange={(v) => setF('fecha', v)} />
            <FiltroTexto etiqueta="C.C." ancho="82px" valor={filtros.cc} onChange={(v) => setF('cc', v)} placeholder="C.C." />
            <FiltroTexto etiqueta="Repuesto" ancho="140px" valor={filtros.repuesto} onChange={(v) => setF('repuesto', v)} placeholder="Repuesto…" />
            <FiltroSelect etiqueta="Urgencia" ancho="104px" valor={filtros.urgencia} vacio="Todas" onChange={(v) => setF('urgencia', v)} opciones={URGENCIAS} />
            <FiltroSelect etiqueta="Grupo" ancho="120px" valor={filtros.grupo} vacio="Todos" onChange={(v) => setF('grupo', v)} opciones={GRUPOS} />
            <FiltroTexto etiqueta="Solicita" ancho="115px" valor={filtros.solicita} onChange={(v) => setF('solicita', v)} placeholder="Solicitante…" />
            <FiltroSelect etiqueta="Estado" ancho="140px" valor={filtros.estado} vacio="Todos" onChange={(v) => setF('estado', v)} opciones={ESTADOS} />
            <FiltroSelect etiqueta="Taller" ancho="112px" valor={filtros.establecimiento} vacio="Todos" onChange={(v) => setF('establecimiento', v)} opciones={ESTABLECIMIENTOS} />

            {hayFiltros && <BotonLimpiar onClick={limpiar} />}
          </div>
        </Card>

        {/* La tabla ocupa el ancho de la página, el mismo que el encabezado. */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            minHeight: 0,
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table className="mb-0 tabla-informe tabla-compras tabla-analista" style={{ width: '100%', minWidth: '1120px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Taller</th>
                <th style={thCentro}>N° Pedido</th>
                <th style={thCentro}>Fecha</th>
                <th style={thCentro}>C.C.</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Cant.</th>
                <th style={thCentro}>Un.</th>
                <th style={thCentro}>Descripción</th>
                <th style={thCentro}>Urgencia</th>
                <th style={th}>Grupo</th>
                <th style={th}>Solicita</th>
                <th style={thCentro}>Estado</th>
                <th style={thCentro}>O.P. · Proveedor</th>
                <th style={{ ...thCentro, width: 110 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center text-muted py-4" style={td}>
                    {hayFiltros ? 'Ningún pedido coincide con los filtros' : 'No hay pedidos para esta etapa'}
                  </td>
                </tr>
              ) : (
                filasAMostrar.map((item) => {
                  const id = item._agrupado ? item._key : `sub-${item._id}`
                  const multiple = item._agrupado && item._count > 1
                  // El ítem que representa la fila cuando es uno solo: un
                  // pedido de un ítem o un ítem abierto con el ojo. Esas filas
                  // se eligen, se editan, se rechazan y se analizan.
                  const unItem = item._anidada ? item : item._count === 1 ? item._items[0] : null
                  const porItem = Boolean(unItem)
                  const elegida = porItem && selectedId === unItem._id
                  const clickeableEstado =
                    item.estado === 'Autorizar' ||
                    item.estado === 'Para hacer OP' ||
                    item.estado === 'Rechazado' ||
                    item.estado === 'Cancelado' ||
                    item.estado === 'Para revision' ||
                    item.estado === 'Para retirar' ||
                    item.estado === 'Retirado'
                  return (
                    <tr
                      key={id}
                      className={`${item.urgencia === 'Crítica' ? 'fila-critica' : ''}${elegida ? ' fila-elegida' : ''}${item._anidada ? ' fila-anidada' : ' inicio-pedido'}`}
                      style={{ cursor: porItem ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (porItem) setSelectedId(elegida ? null : unItem._id)
                      }}
                    >
                      <td style={tdCentro}>{badgeEstablecimiento(item._src)}</td>
                      {/* El pedido múltiple y sus ítems abiertos comparten la
                          línea bordó de la izquierda: se leen como un bloque. */}
                      <td
                        style={{
                          ...tdCentro,
                          fontWeight: multiple ? 700 : 400,
                          whiteSpace: 'nowrap',
                          borderLeft:
                            (item._agrupado && item._count > 1) || item._anidada ? `3px solid ${BORDO}` : undefined,
                        }}
                      >
                        {item._anidada ? (
                          <span style={{ color: '#94a3b8' }}>↳ {fmtNro(item.nro_pedido, item._src)}</span>
                        ) : (
                          fmtNro(item.nro_pedido, item._src)
                        )}
                        {item._agrupado && item._count > 1 && (
                          <OjoPedido abierto={abiertos.has(item._key)} onClick={() => alternarAbierto(item._key)} />
                        )}
                      </td>
                      <td style={tdCentro}>{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                      <td style={tdCentro}>{item.cc === 'Varios' ? varios() : item.cc || <Raya />}</td>
                      <td style={td}>{item.nombre_repuesto === 'Varios' ? varios() : item.nombre_repuesto}</td>
                      <td style={tdCentro}>{item.cant === 'Varios' ? varios() : item.cant ?? <Raya />}</td>
                      <td style={tdCentro}>{item.unidad === 'Varios' ? varios() : item.unidad || <Raya />}</td>
                      <td style={tdCentro}>
                        {item.descripcion === 'Varios' ? (
                          varios()
                        ) : item.descripcion ? (
                          <div className="d-flex justify-content-center">
                            <BotonAccion
                              icono="bi-eye"
                              titulo="Ver la descripción"
                              onClick={() =>
                                Swal.fire({ title: 'Descripción', text: item.descripcion, confirmButtonText: 'Cerrar' })
                              }
                            />
                          </div>
                        ) : (
                          <Raya />
                        )}
                      </td>
                      <td style={tdCentro}>{badgeUrgencia(item.urgencia)}</td>
                      <td style={td}>{item.grupo === 'Varios' ? varios() : item.grupo}</td>
                      <td style={td}>{item.solicita === 'Varios' ? varios() : item.solicita || <Raya />}</td>
                      <td
                        style={{ ...tdCentro, cursor: clickeableEstado ? 'pointer' : undefined }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (item.estado === 'Autorizar' || item.estado === 'Para hacer OP') {
                            // Abre el análisis ya hecho para verlo; un pedido
                            // múltiple muestra todos sus ítems en ese estado.
                            navigate('/compras/analista/analizar', {
                              state: { item: unItem || item._items[0], esComprador },
                            })
                          } else if (item.estado === 'Rechazado' || item.estado === 'Cancelado') {
                            verMotivoRechazo(item._agrupado ? item._items[0] : item)
                          } else if (item.estado === 'Para revision') {
                            verMotivoRevision(item._agrupado ? item._items[0] : item)
                          } else if (item.estado === 'Para retirar' && item.oc && item.oc !== 'Varios') {
                            navigate(`/compras/op/${encodeURIComponent(item.oc)}`, { state: { retirar: idsARetirar(item) } })
                          } else if (item.estado === 'Para retirar') {
                            avisarSinOC(item)
                          } else if (item.estado === 'Retirado') {
                            verMotivoRetirado(item._agrupado ? item._items[0] : item)
                          }
                        }}
                      >
                        {badgeEstado(item.estado)}
                      </td>
                      <td style={tdCentro}><CeldaOP oc={item.oc} proveedor={proveedorDeOP(item)} /></td>
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                          <BotonAccion
                            icono="bi-clock-history"
                            titulo="Historial"
                            onClick={() => verHistorial(item._agrupado ? item._items[0] : item)}
                            deshabilitado={item._agrupado && item._count > 1}
                          />
                          {porItem && (
                            <BotonAccion icono="bi-pencil" titulo="Editar" variante="primary" onClick={() => abrirEditar(unItem)} />
                          )}
                          {porItem && (
                            <BotonAccion icono="bi-x-lg" titulo="Rechazar" variante="danger" onClick={() => rechazar(unItem)} />
                          )}
                          {item._count > 1 && (
                            <BotonAccion icono="bi-list-ul" titulo="Ver el detalle" onClick={() => verDetalle(item)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Editar ítem */}
      <Modal show={showModal} onHide={cerrar} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: BORDO,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-pencil-square" style={{ color: '#f59e0b' }}></i>
            <span>Editar ítem</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Nombre repuesto <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.nombre_repuesto}
                  onChange={(e) => setForm({ ...form, nombre_repuesto: e.target.value })}
                  required
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Cant.</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  className="rounded-3"
                  style={campo}
                  value={form.cant}
                  onChange={(e) => setForm({ ...form, cant: e.target.value })}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Unidad <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  placeholder="Ej: un, kg, mts"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  required
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">C.C.</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.cc}
                  onChange={(e) => setForm({ ...form, cc: e.target.value })}
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Descripción</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  style={campo}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Grupo <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={campo}
                  value={form.grupo}
                  onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                >
                  {GRUPOS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Urgencia <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={campo}
                  value={form.urgencia}
                  onChange={(e) => setForm({ ...form, urgencia: e.target.value })}
                >
                  {URGENCIAS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Form.Select>
              </Col>

              {/* El estado no se edita a mano: lo mueve el circuito del pedido. */}
              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Estado</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ ...campo, backgroundColor: '#f8f9fa', cursor: 'default' }}
                  value={form.estado === 'Pedido' ? 'Para analisis' : form.estado}
                  readOnly
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrar}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
