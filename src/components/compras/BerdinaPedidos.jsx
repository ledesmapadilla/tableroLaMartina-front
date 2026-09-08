import { useState, useEffect } from 'react'
import { exportarPlanilla } from "../../helpers/excel";

const fmtNro = (n) => `B-${String(n).padStart(3, '0')}`
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

const URGENCIAS = ['Baja', 'Media', 'Alta', 'Crítica']
const ESTADOS   = ['Para analisis', 'Para hacer OC', 'Autorizar', 'Para retirar', 'Rechazado']
const GRUPOS    = ['Pulverizadora', 'Chancho', 'Nodriza', 'Desmalezadora', 'Herbicida', 'Abonadora', 'Riego', 'Arquito', 'Tractores', 'Camioneta', 'Manitou', 'Colectivos', 'Herreria', 'Gomeria', 'Stock', 'Otros']

const ITEM_INIT = { nombre_repuesto: '', cant: '', unidad: '', descripcion: '', urgencia: 'Media', grupo: 'Tractores', cc: '', estado: 'Pendiente' }

const estiloX = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  cursor: 'pointer', fontSize: 13, fontWeight: 900, color: 'var(--color-muted)',
  zIndex: 5, userSelect: 'none', lineHeight: 1,
}

export default function BerdinaPedidos() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [form, setForm] = useState(ITEM_INIT)
  const [editPedidoId, setEditPedidoId] = useState(null)
  const [editItemId, setEditItemId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [agrupado, setAgrupado] = useState(true)
  const FILTROS_INIT = { nro: '', fecha: '', cc: '', repuesto: '', urgencia: '', grupo: '', solicita: '', estado: '' }
  const [filtros, setFiltros] = useState(FILTROS_INIT)
  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
  const limpiar = () => setFiltros(FILTROS_INIT)
  const hayFiltros = Object.values(filtros).some(v => v !== '')

  const cargar = () => api.get('/berdina/pedidos').then(setPedidos).catch(() => {})
  useEffect(() => { cargar() }, [])

  const items = pedidos.flatMap(p =>
    (p.items || []).map(item => ({ ...item, nro_pedido: p.nro_pedido, fecha: p.fecha, pedidoId: p._id }))
  )

  const lista = items.filter(item => {
    if (filtros.nro && !fmtNro(item.nro_pedido).includes(filtros.nro.toUpperCase())) return false
    if (filtros.fecha && item.fecha?.slice(0, 10) !== filtros.fecha) return false
    if (filtros.cc && !item.cc?.toLowerCase().includes(filtros.cc.toLowerCase())) return false
    if (filtros.repuesto && !item.nombre_repuesto?.toLowerCase().includes(filtros.repuesto.toLowerCase())) return false
    if (filtros.urgencia && item.urgencia !== filtros.urgencia) return false
    if (filtros.grupo && item.grupo !== filtros.grupo) return false
    if (filtros.solicita && !item.solicita?.toLowerCase().includes(filtros.solicita.toLowerCase())) return false
    if (filtros.estado) { const ne = (item.estado === 'Pedido' || item.estado === 'En analisis' || item.estado === 'Para revision') ? 'Para analisis' : item.estado; if (ne !== filtros.estado) return false }
    return true
  })

  const uniq = (arr) => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ''))]
  const colapsar = (vals) => vals.length === 0 ? '' : vals.length === 1 ? vals[0] : 'Varios'

  const listaAgrupada = Object.values(
    lista.reduce((acc, item) => {
      const k = item.nro_pedido
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    }, {})
  ).map(items => ({
    _agrupado: true,
    _count: items.length,
    _items: items,
    _key: items[0].nro_pedido,
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

  const conteosPedido = lista.reduce((acc, i) => {
    acc[i.nro_pedido] = (acc[i.nro_pedido] || 0) + 1
    return acc
  }, {})

  const listaAMostrar = (agrupado ? listaAgrupada : lista)
    .slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

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
    setShowModal(true)
  }

  const cerrar = () => { setForm(ITEM_INIT); setEditPedidoId(null); setEditItemId(null); setShowModal(false) }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      const { cant, estado, ...rest } = form
      const payload = { ...rest, usuario: 'Berdina', ...(cant !== '' && cant != null ? { cant: Number(cant) } : {}) }
      await api.put(`/berdina/pedidos/${editPedidoId}/items/${editItemId}`, payload)
      cargar()
      cerrar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const borrar = async (item) => {
    const result = await Swal.fire({
      title: '¿Borrar ítem?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4a0812',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/berdina/pedidos/${item.pedidoId}/items/${item._id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  // Exporta con exceljs, la unica libreria de Excel del proyecto. El formato
  // (titulo, fecha, encabezado verde y bordes) lo pone el helper compartido.
  const exportarExcel = async () => {
    await exportarPlanilla({
      titulo: "Pedidos Berdina — La Martina",
      columnas: [
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
      { titulo: "O.C.", ancho: 12 },
    ],
      filas: lista.map((item) => [
      fmtNro(item.nro_pedido),
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
      archivo: `Pedidos_Berdina_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  }

  const verDetalle = (item) => {
    const filas = item._items.map(i =>
      `<tr>
        <td>${i.nombre_repuesto}</td>
        <td>${i.cant ?? '—'}</td>
        <td>${i.unidad || '—'}</td>
        <td>${i.cc || '—'}</td>
        <td>${i.urgencia}</td>
        <td>${i.grupo}</td>
        <td>${i.descripcion || '—'}</td>
        <td>${i.solicita || '—'}</td>
        <td>${i.estado === 'Pedido' ? 'Para analisis' : (i.estado || '—')}</td>
      </tr>`
    ).join('')
    Swal.fire({
      title: `Pedido ${fmtNro(item.nro_pedido)}`,
      html: `<div style="overflow-x:auto">
        <table class="table table-sm table-bordered" style="font-size:13px;text-align:left">
          <thead><tr><th style="font-weight:normal">Repuesto</th><th style="font-weight:normal">Cant.</th><th style="font-weight:normal">Un.</th><th style="font-weight:normal">C.C.</th><th style="font-weight:normal">Urgencia</th><th style="font-weight:normal">Grupo</th><th style="font-weight:normal">Descripción</th><th style="font-weight:normal">Solicita</th><th style="font-weight:normal">Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>`,
      width: 750,
      confirmButtonText: 'Cerrar',
    })
  }

  const verMotivoRetirado = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
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

  const verMotivoRevision = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
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
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
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

  const verHistorial = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
      const tieneInicio = hist.some(h => h.estado === 'Para analisis' || h.estado === 'Pedido' || h.estado === 'En analisis')
      const histToShow = tieneInicio
        ? hist
        : [{ fecha: item.fecha, estado: 'Para analisis', usuario: item.solicita || 'Sin especificar', nota: 'Pedido creado' }, ...hist]
      const filas = histToShow.map(h => {
        const fecha = h.fecha ? new Date(h.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
        const estadoLabel = (h.estado === 'Cancelado' || h.estado === 'Rechazado') ? `<span style="color:#dc3545;font-weight:600">Rechazado</span>` : (h.estado || '—')
        return `<tr><td>${fecha}</td><td>${estadoLabel}</td><td>${h.usuario || '—'}${h.nota ? ` <span class="text-muted" style="font-size:11px">(${h.nota})</span>` : ''}</td></tr>`
      }).join('')
      Swal.fire({
        title: `Historial - ${item.nombre_repuesto}`,
        html: `<div style="overflow-x:auto;overflow-y:auto;max-height:400px">
          <table class="table table-sm table-bordered" style="font-size:13px;text-align:left">
            <thead><tr><th style="font-weight:400;text-align:center">Fecha</th><th style="font-weight:400;text-align:center">Estado</th><th style="font-weight:400;text-align:center">Usuario</th></tr></thead>
            <tbody>${filas}</tbody>
          </table></div>`,
        width: 560,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const varios = (v) => <span className="text-muted fst-italic" style={{ fontSize: 12 }}>Varios</span>

  const badgeUrgencia = (u) => {
    if (u === 'Varios') return varios()
    const color = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
    return <span style={{ fontWeight: 600, color: color[u] || '#6c757d' }}>{u}</span>
  }

  const badgeEstado = (e) => {
    if (e === 'Varios') return varios()
    if (e === 'Para revision') return <span className="badge bg-warning">Para revision</span>
    const norm = e === 'Pedido' || e === 'En analisis' ? 'Para analisis' : e
    if (norm === 'Autorizar') return <span className="badge" style={{ backgroundColor: '#8b2035' }}>Para autorizar</span>
    if (e === 'Retirado') return <span className="badge" style={{ backgroundColor: '#6f42c1' }}>Retirado</span>
    const color = { 'Para analisis': 'primary', 'Para hacer OC': 'info', Pendiente: 'secondary', 'En proceso': 'warning', 'Para retirar': 'success', Completado: 'success', Cancelado: 'danger', Rechazado: 'danger' }
    return <span className={`badge bg-${color[norm] || 'secondary'}`}>{norm}</span>
  }

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-2">

      <div className="container d-flex justify-content-between align-items-center mb-2">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Compras · Berdina
        </p>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success btn-sm" onClick={exportarExcel}>Excel</button>
          <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
        </div>
      </div>

      <div className="container">
        <h4 className="text-center mb-2" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Pedidos</h4>

        <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
          {/* N° Pedido */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>N° Pedido</label>
            <div style={{ position: 'relative' }}>
              <input className="form-control form-control-sm" style={{ width: 80 }} value={filtros.nro} onChange={e => setF('nro', e.target.value)} placeholder="N°" />
              {filtros.nro && <span onClick={() => setF('nro', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* Fecha */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Fecha</label>
            <div style={{ position: 'relative' }}>
              <input type="date" className="form-control form-control-sm" value={filtros.fecha} onChange={e => setF('fecha', e.target.value)} />
              {filtros.fecha && <span onClick={() => setF('fecha', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* C.C. */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>C.C.</label>
            <div style={{ position: 'relative' }}>
              <input className="form-control form-control-sm" style={{ width: 80 }} value={filtros.cc} onChange={e => setF('cc', e.target.value)} placeholder="C.C." />
              {filtros.cc && <span onClick={() => setF('cc', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* Repuesto */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Repuesto</label>
            <div style={{ position: 'relative' }}>
              <input className="form-control form-control-sm" style={{ width: 160 }} value={filtros.repuesto} onChange={e => setF('repuesto', e.target.value)} placeholder="Repuesto..." />
              {filtros.repuesto && <span onClick={() => setF('repuesto', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* Urgencia */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Urgencia</label>
            <div style={{ position: 'relative' }}>
              <select className={`form-select form-select-sm${filtros.urgencia ? ' select-activo' : ''}`} style={{ width: 110, ...(filtros.urgencia ? { backgroundImage: 'none' } : {}) }} value={filtros.urgencia} onChange={e => setF('urgencia', e.target.value)}>
                <option value="">Todas</option>
                {URGENCIAS.map(u => <option key={u}>{u}</option>)}
              </select>
              {filtros.urgencia && <span onClick={() => setF('urgencia', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* Grupo */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Grupo</label>
            <div style={{ position: 'relative' }}>
              <select className={`form-select form-select-sm${filtros.grupo ? ' select-activo' : ''}`} style={{ width: 140, ...(filtros.grupo ? { backgroundImage: 'none' } : {}) }} value={filtros.grupo} onChange={e => setF('grupo', e.target.value)}>
                <option value="">Todos</option>
                {GRUPOS.map(g => <option key={g}>{g}</option>)}
              </select>
              {filtros.grupo && <span onClick={() => setF('grupo', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* Solicita */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Solicita</label>
            <div style={{ position: 'relative' }}>
              <input className="form-control form-control-sm" style={{ width: 130 }} value={filtros.solicita} onChange={e => setF('solicita', e.target.value)} placeholder="Solicitante..." />
              {filtros.solicita && <span onClick={() => setF('solicita', '')} style={estiloX}>✕</span>}
            </div>
          </div>
          {/* Estado */}
          <div>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Estado</label>
            <div style={{ position: 'relative' }}>
              <select className={`form-select form-select-sm${filtros.estado ? ' select-activo' : ''}`} style={{ width: 130, ...(filtros.estado ? { backgroundImage: 'none' } : {}) }} value={filtros.estado} onChange={e => setF('estado', e.target.value)}>
                <option value="">Todos</option>
                {ESTADOS.map(s => <option key={s}>{s}</option>)}
              </select>
              {filtros.estado && <span onClick={() => setF('estado', '')} style={estiloX}>✕</span>}
            </div>
          </div>

          <div className="ms-auto d-flex gap-2 align-items-end">
            {hayFiltros && <button className="btn btn-sm btn-outline-secondary" onClick={limpiar}>Limpiar</button>}
            <button className="btn btn-outline-dark btn-sm" onClick={() => navigate('/compras/berdina/pedidos/nuevo')}>+ Nuevo pedido</button>
          </div>
        </div>

        <div className="d-flex align-items-center mb-2">
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="switchAgrupar"
              checked={agrupado}
              onChange={e => setAgrupado(e.target.checked)}
              style={{ width: 40, height: 22, cursor: 'pointer' }}
            />
            <label className="form-check-label ms-1" htmlFor="switchAgrupar" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
              Agrupar pedidos múltiples
            </label>
          </div>
        </div>

        <div className="card">
          <div className="table-responsive" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <table className="table table-hover table-striped mb-0">
              <thead className="thead-blue thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th>N° Pedido</th>
                  <th>Fecha</th>
                  <th>C.C.</th>
                  <th>Repuesto</th>
                  <th>Cant.</th>
                  <th>Un.</th>
                  <th>Descripción</th>
                  <th>Urgencia</th>
                  <th>Grupo</th>
                  <th>Solicita</th>
                  <th>Estado</th>
                  <th>O.C.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaAMostrar.map(item => (
                  <tr
                    key={item._agrupado ? item._key : item._id}
                    className={item.urgencia === 'Crítica' ? 'row-critica' : ''}
                    style={item._agrupado && item._count > 1 ? { borderLeft: '3px solid #0d6efd', backgroundColor: 'rgba(13,110,253,0.06)' } : {}}
                  >
                    <td style={(item._agrupado ? item._count > 1 : conteosPedido[item.nro_pedido] > 1) ? { fontWeight: 700 } : {}}>{fmtNro(item.nro_pedido)}</td>
                    <td>{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                    <td>{item.cc === 'Varios' ? varios() : item.cc}</td>
                    <td>{item.nombre_repuesto === 'Varios' ? varios() : item.nombre_repuesto}</td>
                    <td>{item.cant === 'Varios' ? varios() : item.cant}</td>
                    <td>{item.unidad === 'Varios' ? varios() : (item.unidad || '—')}</td>
                    <td>
                      {item.descripcion === 'Varios'
                        ? varios()
                        : item.descripcion
                          ? <button className="btn btn-sm btn-outline-secondary" onClick={() => Swal.fire({ title: 'Descripción', text: item.descripcion, confirmButtonText: 'Cerrar' })}>Ver</button>
                          : <span className="text-muted">—</span>}
                    </td>
                    <td>{badgeUrgencia(item.urgencia)}</td>
                    <td>{item.grupo === 'Varios' ? varios() : item.grupo}</td>
                    <td>{item.solicita === 'Varios' ? varios() : (item.solicita || '')}</td>
                    <td
                      onClick={() => {
                        if (item.estado === 'Rechazado' || item.estado === 'Cancelado') {
                          verMotivoRechazo(item._agrupado ? item._items[0] : item)
                        } else if (item.estado === 'Para revision') {
                          verMotivoRevision(item._agrupado ? item._items[0] : item)
                        } else if (item.estado === 'Para retirar' && item.oc && item.oc !== 'Varios') {
                          navigate(`/compras/oc/${encodeURIComponent(item.oc)}`)
                        } else if (item.estado === 'Retirado') {
                          verMotivoRetirado(item._agrupado ? item._items[0] : item)
                        }
                      }}
                      style={(item.estado === 'Rechazado' || item.estado === 'Cancelado' || item.estado === 'Para revision' || item.estado === 'Para retirar' || item.estado === 'Retirado') ? { cursor: 'pointer' } : {}}
                    >{badgeEstado(item.estado)}</td>
                    <td>{item.oc || '—'}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary me-1" disabled={item._agrupado && item._count > 1} onClick={e => { e.stopPropagation(); verHistorial(item._agrupado ? item._items[0] : item) }}>Historial</button>
                      {!agrupado && <>
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => abrirEditar(item)}>Editar</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => borrar(item)}>Borrar</button>
                      </>}
                      {agrupado && item._count > 1 &&
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => verDetalle(item)}>Ver</button>
                      }
                    </td>
                  </tr>
                ))}
                {listaAMostrar.length === 0 && (
                  <tr><td colSpan={12} className="text-center text-muted py-3">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Editar ítem</h5>
                <button type="button" className="btn-close" onClick={cerrar} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nombre repuesto*</label>
                    <input className="form-control" value={form.nombre_repuesto}
                      onChange={e => setForm({ ...form, nombre_repuesto: e.target.value })} required />
                  </div>
                  <div className="row mb-3">
                    <div className="col">
                      <label className="form-label">Cant.</label>
                      <input type="number" min="1" className="form-control" value={form.cant}
                        onChange={e => setForm({ ...form, cant: e.target.value })} />
                    </div>
                    <div className="col">
                      <label className="form-label">Unidad*</label>
                      <input className="form-control" placeholder="Ej: un, kg, mts" style={{ fontSize: 12 }} value={form.unidad}
                        onChange={e => setForm({ ...form, unidad: e.target.value })} required />
                    </div>
                    <div className="col">
                      <label className="form-label">C.C.</label>
                      <input className="form-control" value={form.cc}
                        onChange={e => setForm({ ...form, cc: e.target.value })} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea className="form-control" rows={2} value={form.descripcion}
                      onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                  </div>
                  <div className="row mb-3">
                    <div className="col">
                      <label className="form-label">Grupo*</label>
                      <select className="form-select" value={form.grupo}
                        onChange={e => setForm({ ...form, grupo: e.target.value })}>
                        {GRUPOS.map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label">Urgencia*</label>
                      <select className="form-select" value={form.urgencia}
                        onChange={e => setForm({ ...form, urgencia: e.target.value })}>
                        {URGENCIAS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label">Estado</label>
                      <input className="form-control" value={form.estado === 'Pedido' ? 'Para analisis' : form.estado} readOnly style={{ backgroundColor: '#f8f9fa', cursor: 'default' }} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={cerrar}>Cancelar</button>
                  <button type="submit" className="btn btn-outline-dark">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
