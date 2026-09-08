import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

const fmtPrecio = (n) =>
  n != null && n !== '' && !isNaN(n)
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtNro = (n, src) =>
  src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const URG_ORDER = { 'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3 }

const calcCostoItem = (item) => {
  const precios = [item.precio1, item.precio2, item.precio3].filter(v => v != null && v > 0)
  if (precios.length === 0) return null
  return Math.min(...precios) * (item.cant || 0)
}

const urgenciaMasAlta = (items) =>
  items.reduce((best, i) =>
    (URG_ORDER[i.urgencia] ?? 4) < (URG_ORDER[best] ?? 4) ? i.urgencia : best
  , items[0]?.urgencia)

export default function Gerencia() {
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = async () => {
    setCargando(true)
    const [berdina, sanpablo] = await Promise.all([
      api.get('/berdina/pedidos/por-estado/Autorizar').catch(() => []),
      api.get('/sanpablo/pedidos/por-estado/Autorizar').catch(() => []),
    ])
    const todos = [
      ...berdina.map(i => ({ ...i, _src: 'berdina' })),
      ...sanpablo.map(i => ({ ...i, _src: 'sanpablo' })),
    ]

    const agrupado = Object.values(
      todos.reduce((acc, item) => {
        const key = `${item._src}-${item.nro_pedido}`
        if (!acc[key]) acc[key] = { _src: item._src, nro_pedido: item.nro_pedido, fecha: item.fecha, items: [] }
        acc[key].items.push(item)
        return acc
      }, {})
    ).map(g => ({
      ...g,
      costo: g.items.reduce((sum, i) => sum + (calcCostoItem(i) ?? 0), 0),
      sinPrecio: g.items.every(i => calcCostoItem(i) == null),
      urgencia: urgenciaMasAlta(g.items),
    })).sort((a, b) => {
      const ua = URG_ORDER[a.urgencia] ?? 4
      const ub = URG_ORDER[b.urgencia] ?? 4
      return ua !== ub ? ua - ub : new Date(b.fecha) - new Date(a.fecha)
    })

    setGrupos(agrupado)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const verAnalisis = (grupo) => navigate('/compras/oc/ver', { state: { items: grupo.items } })

  const verHistorial = async (grupo) => {
    try {
      const base = grupo._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const historiales = await Promise.all(
        grupo.items.map(item =>
          api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
            .then(hist => ({ item, hist }))
            .catch(() => ({ item, hist: [] }))
        )
      )
      const seccionesHTML = historiales.map(({ item, hist }) => {
        const tieneInicio = hist.some(h => h.estado === 'Para analisis' || h.estado === 'Pedido' || h.estado === 'En analisis')
        const histToShow = tieneInicio
          ? hist
          : [{ fecha: grupo.fecha, estado: 'Para analisis', usuario: item.solicita || 'Sin especificar', nota: 'Pedido creado' }, ...hist]
        const filas = histToShow.map(h => {
          const fecha = h.fecha ? new Date(h.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
          const label = (h.estado === 'Cancelado' || h.estado === 'Rechazado')
            ? `<span style="color:#dc3545;font-weight:600">${h.estado}</span>`
            : (h.estado || '—')
          return `<tr><td>${fecha}</td><td>${label}</td><td>${h.usuario || '—'}${h.nota ? ` <span style="color:#888;font-size:11px">(${h.nota})</span>` : ''}</td></tr>`
        }).join('')
        const header = grupo.items.length > 1
          ? `<div style="font-weight:600;font-size:13px;margin:10px 0 4px">${item.nombre_repuesto}</div>`
          : ''
        return `${header}<table class="table table-sm table-bordered mb-2" style="font-size:12px;text-align:left">
          <thead><tr><th style="font-weight:400">Fecha</th><th style="font-weight:400">Estado</th><th style="font-weight:400">Usuario</th></tr></thead>
          <tbody>${filas}</tbody></table>`
      }).join('')
      Swal.fire({
        title: `Historial · ${fmtNro(grupo.nro_pedido, grupo._src)}`,
        html: `<div style="overflow-y:auto;max-height:400px;text-align:left">${seccionesHTML}</div>`,
        width: 560,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const aprobar = async (grupo) => {
    const nro = fmtNro(grupo.nro_pedido, grupo._src)
    const { isConfirmed } = await Swal.fire({
      title: '¿Aprobar pedido?',
      html: `<div style="font-weight:600;margin-bottom:6px">${nro}</div>
             <div style="font-size:13px;color:#555">${grupo.items.length > 1 ? `${grupo.items.length} ítems` : grupo.items[0].nombre_repuesto} → <strong>Para hacer OC</strong></div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-success me-2', cancelButton: 'btn btn-outline-secondary' },
    })
    if (!isConfirmed) return
    try {
      const base = grupo._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await Promise.all(grupo.items.map(item =>
        api.put(`${base}/${item.pedidoId}/items/${item._id}`, { estado: 'Para hacer OC', usuario: 'Gerencia' })
      ))
      cargar()
      Swal.fire({ icon: 'success', title: 'Aprobado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const rechazar = async (grupo) => {
    const nro = fmtNro(grupo.nro_pedido, grupo._src)
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: '¿Rechazar pedido?',
      html: `<div style="font-weight:600;margin-bottom:8px">${nro}</div>`,
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
      const base = grupo._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await Promise.all(grupo.items.map(item =>
        api.put(`${base}/${item.pedidoId}/items/${item._id}`, { estado: 'Rechazado', usuario: 'Gerencia', nota: motivo })
      ))
      cargar()
      Swal.fire({ icon: 'success', title: 'Rechazado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const revisar = async (grupo) => {
    const nro = fmtNro(grupo.nro_pedido, grupo._src)
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: '¿Enviar a revisión?',
      html: `<div style="font-weight:600;margin-bottom:8px">${nro}</div>`,
      input: 'textarea',
      inputLabel: 'Motivo de la revisión',
      inputPlaceholder: 'Explicá qué debe revisar el analista...',
      showCancelButton: true,
      confirmButtonText: 'Enviar a revisar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-warning me-2', cancelButton: 'btn btn-outline-secondary' },
      preConfirm: (val) => {
        if (!val?.trim()) { Swal.showValidationMessage('El motivo es obligatorio'); return false }
        return val.trim()
      },
    })
    if (!isConfirmed) return
    try {
      const base = grupo._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await Promise.all(grupo.items.map(item =>
        api.put(`${base}/${item.pedidoId}/items/${item._id}`, { estado: 'Para revision', usuario: 'Gerencia', nota: motivo })
      ))
      cargar()
      Swal.fire({ icon: 'success', title: 'Enviado a revisar', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const badgeUrgencia = (u) => {
    const bg = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', 'Crítica': '#7b0000' }
    return (
      <span className="badge" style={{ backgroundColor: bg[u] || '#6c757d', fontSize: 11, letterSpacing: 0.3 }}>
        {u}
      </span>
    )
  }

  const badgeTaller = (src) => (
    <span
      className="badge"
      style={{
        backgroundColor: src === 'berdina' ? '#1a3326' : '#4a0812',
        fontSize: 13,
        letterSpacing: 0.5,
        minWidth: 32,
      }}
    >
      {src === 'berdina' ? 'B' : 'SP'}
    </span>
  )

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-2">

      <div className="container d-flex justify-content-between align-items-center mb-2">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Gerencia
        </p>
        <div className="d-flex gap-2">
          <button onClick={() => navigate('/compras/gerencia/historial')} className="btn btn-outline-dark btn-sm">Historial</button>
          <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
        </div>
      </div>

      <div className="container">
        <h4 className="text-center mb-4" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>
          Para Autorizar{' '}
          {!cargando && (
            <span style={{ fontWeight: 400, fontSize: '0.75em', letterSpacing: 1, textTransform: 'none' }}>
              ({grupos.length})
            </span>
          )}
        </h4>

        {cargando ? (
          <div className="text-center py-5">
            <div className="spinner-border text-secondary" role="status" />
          </div>
        ) : (
          <div className="card card-gerencia">
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th className="text-center" style={{ width: 48 }}>Taller</th>
                    <th className="text-center">Costo</th>
                    <th className="text-center" style={{ width: 80 }}>Urgencia</th>
                    <th className="text-center" style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        Sin pedidos para autorizar
                      </td>
                    </tr>
                  )}
                  {grupos.map(grupo => (
                    <tr
                      key={`${grupo._src}-${grupo.nro_pedido}`}
                      className={grupo.urgencia === 'Crítica' ? 'row-critica' : ''}
                      style={{ verticalAlign: 'middle' }}
                    >
                      <td className="text-center">
                        {badgeTaller(grupo._src)}
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.3 }}>
                          {fmtNro(grupo.nro_pedido, grupo._src)}
                          {grupo.items.length > 1 && <div>{grupo.items.length} ítems</div>}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                          {grupo.sinPrecio
                            ? <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 13 }}>Sin precio</span>
                            : fmtPrecio(grupo.costo)
                          }
                        </div>
                        <div className="d-flex gap-1 mt-1">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            style={{ fontSize: 11, padding: '1px 8px', lineHeight: 1.6 }}
                            onClick={() => verAnalisis(grupo)}
                          >
                            Ver
                          </button>
                        </div>
                      </td>
                      <td className="text-center">
                        {badgeUrgencia(grupo.urgencia)}
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-center">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            title="Rechazar"
                            style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, padding: '3px 8px' }}
                            onClick={() => rechazar(grupo)}
                          >✕</button>
                          <button
                            className="btn btn-sm btn-outline-warning"
                            title="Revisar"
                            style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, padding: '3px 8px' }}
                            onClick={() => revisar(grupo)}
                          >?</button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            title="Aprobar"
                            style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, padding: '3px 8px' }}
                            onClick={() => aprobar(grupo)}
                          >✓</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
