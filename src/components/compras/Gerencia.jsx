import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Table, Button } from 'react-bootstrap'
import { BORDO, BORDO_SUAVE, thCentro, td, tdCentro } from './formato'
import { BotonAccion } from './estilos'
import { verHistorialPedido, conCreacion } from './detallePedido'
import { opcionElegida } from './precioElegido'
import UmbralAutorizacion from './UmbralAutorizacion'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

const fmtPrecio = (n) =>
  n != null && n !== '' && !isNaN(n)
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
    : '—'

const fmtNro = (n, src) =>
  src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const URG_ORDER = { 'Crítica': 0, 'Alta': 1, 'Media': 2, 'Baja': 3 }

// El costo sale del presupuesto que eligió el analista (el más barato si no
// eligió otro): es el mismo con el que después se arma la orden de pago.
const calcCostoItem = (item) => {
  const elegida = opcionElegida(item)
  return elegida ? elegida.precio * (item.cant || 0) : null
}

const urgenciaMasAlta = (items) =>
  items.reduce((best, i) =>
    (URG_ORDER[i.urgencia] ?? 4) < (URG_ORDER[best] ?? 4) ? i.urgencia : best
  , items[0]?.urgencia)

export default function Gerencia() {
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)

  // La carga vive adentro del efecto y `cargar()` solo pide una vuelta más:
  // así el que trae los datos es el efecto, que es quien puede cancelarse si
  // la pantalla se cierra antes de que contesten las dos APIs.
  const [recarga, setRecarga] = useState(0)
  const cargar = () => {
    setCargando(true)
    setRecarga(n => n + 1)
  }

  useEffect(() => {
    let vigente = true
    ;(async () => {
      const [berdina, sanpablo] = await Promise.all([
        api.get('/berdina/pedidos/por-estado/Autorizar').catch(() => []),
        api.get('/sanpablo/pedidos/por-estado/Autorizar').catch(() => []),
      ])
      if (!vigente) return

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
    })()
    return () => { vigente = false }
  }, [recarga])

  const verAnalisis = (grupo) => navigate('/compras/op/ver', { state: { items: grupo.items } })

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
      // Una tabla por ítem; con varios, cada una lleva el nombre del repuesto.
      verHistorialPedido({
        titulo: `Historial · ${fmtNro(grupo.nro_pedido, grupo._src)}`,
        secciones: historiales.map(({ item, hist }) => ({
          subtitulo: grupo.items.length > 1 ? item.nombre_repuesto : '',
          historial: conCreacion(hist, { fecha: grupo.fecha, solicita: item.solicita }),
        })),
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
             <div style="font-size:13px;color:#555">${grupo.items.length > 1 ? `${grupo.items.length} ítems` : grupo.items[0].nombre_repuesto} → <strong>Para hacer OP</strong></div>`,
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
        api.put(`${base}/${item.pedidoId}/items/${item._id}`, { estado: 'Para hacer OP', usuario: 'Gerencia' })
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
        backgroundColor: src === 'berdina' ? BORDO : '#166534',
        fontSize: '0.7rem',
        letterSpacing: 0.5,
        minWidth: 32,
      }}
    >
      {src === 'berdina' ? 'B' : 'SP'}
    </span>
  )

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
      {/* La urgencia crítica pinta la fila. Va en un bloque propio porque
          .tabla-informe pinta el fondo sobre los td y un style en el tr no le
          gana. */}
      <style>{`
        .tabla-informe.tabla-gerencia tbody tr.fila-critica > td { background-color: #fee2e2; }
        .tabla-informe.tabla-gerencia tbody tr.fila-critica:hover > td { background-color: #fca5a5; }
      `}</style>

      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '820px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Para autorizar
          </span>
          {!cargando && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
            >
              {grupos.length} {grupos.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          )}

          <Button
            size="sm"
            onClick={() => navigate('/compras/gerencia/historial')}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
          >
            <i className="bi bi-clock-history"></i>
            <span>Historial</span>
          </Button>
        </div>

        {/* Desde qué monto un pedido llega acá. Es el mismo valor que ve el
            comprador: se cambia desde cualquiera de las dos pantallas. */}
        <UmbralAutorizacion />
        {cargando ? (
          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <div className="spinner-border" role="status" style={{ color: BORDO }} />
          </div>
        ) : (
          <div
            className="flex-grow-1 shadow-sm rounded-3 bg-white"
            style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
          >
            {/* Gerencia decide desde el celular: tres columnas con los datos
                apilados en cada celda, para que entre sin scroll lateral, y
                botones de tamaño dedo. */}
            <Table className="mb-0 tabla-informe tabla-compras tabla-gerencia" style={{ width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={thCentro}>Pedido</th>
                  <th style={thCentro}>Costo</th>
                  <th style={thCentro}>Decisión</th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-4" style={td}>
                      No hay pedidos esperando autorización
                    </td>
                  </tr>
                ) : (
                  grupos.map((grupo) => (
                    <tr
                      key={`${grupo._src}-${grupo.nro_pedido}`}
                      className={grupo.urgencia === 'Crítica' ? 'fila-critica' : ''}
                    >
                      <td style={{ ...tdCentro, padding: '6px 5px' }}>
                        {badgeTaller(grupo._src)}
                        <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>
                          {fmtNro(grupo.nro_pedido, grupo._src)}
                          {grupo.items.length > 1 && <div>{grupo.items.length} ítems</div>}
                        </div>
                        <div style={{ marginTop: 4 }}>{badgeUrgencia(grupo.urgencia)}</div>
                      </td>

                      <td style={{ ...tdCentro, padding: '6px 5px' }}>
                        <div className="fw-bold" style={{ fontSize: '1rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                          {grupo.sinPrecio ? (
                            <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.8rem', fontStyle: 'italic' }}>
                              Sin precio
                            </span>
                          ) : (
                            fmtPrecio(grupo.costo)
                          )}
                        </div>
                        <div className="d-flex gap-2 justify-content-center mt-1">
                          <BotonAccion
                            icono="bi-eye"
                            titulo="Ver el análisis de precios"
                            onClick={() => verAnalisis(grupo)}
                            grande
                          />
                          {/* El historial ya estaba escrito pero no tenía
                              botón: es el mismo que en Pedidos y Pendientes. */}
                          <BotonAccion
                            icono="bi-clock-history"
                            titulo="Historial"
                            onClick={() => verHistorial(grupo)}
                            grande
                          />
                        </div>
                      </td>

                      <td style={{ ...tdCentro, padding: '6px 5px' }}>
                        <div className="d-flex gap-2 justify-content-center">
                          <BotonAccion icono="bi-x-lg" titulo="Rechazar" variante="danger" onClick={() => rechazar(grupo)} grande />
                          <BotonAccion icono="bi-question-lg" titulo="Mandar a revisar" variante="warning" onClick={() => revisar(grupo)} grande />
                          <BotonAccion icono="bi-check-lg" titulo="Aprobar" variante="success" onClick={() => aprobar(grupo)} grande />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Container>
    </div>
  )
}
