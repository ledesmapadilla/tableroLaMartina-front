import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { avisarSinOC } from './avisos'
import { Raya, BotonAccion, BotonLimpiar, FiltroTexto, FiltroSelect, SwitchAgrupar } from './estilos'

const URGENCIAS = ['Baja', 'Media', 'Alta', 'Crítica']
const GRUPOS    = ['Pulverizadora', 'Chancho', 'Nodriza', 'Desmalezadora', 'Herbicida', 'Abonadora', 'Riego', 'Arquito', 'Tractores', 'Camioneta', 'Manitou', 'Colectivos', 'Herreria', 'Gomeria', 'Stock', 'Otros']

const ESTADOS_VISIBLES = new Set(['Pedido', 'En analisis', 'Para analisis', 'Para revision', 'Para retirar'])

const fmtNro = (n, src) => src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

export default function AnalistaPendientes() {
  const navigate = useNavigate()
  const [items, setItems]       = useState([])
  const [agrupado, setAgrupado] = useState(true)
  const FILTROS_INIT = { nro: '', fecha: '', cc: '', repuesto: '', urgencia: '', grupo: '', solicita: '' }
  const [filtros, setFiltros]   = useState(FILTROS_INIT)
  const setF     = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
  const limpiar  = () => setFiltros(FILTROS_INIT)
  const hayFiltros = Object.values(filtros).some(v => v !== '')

  useEffect(() => {
    const cargar = async () => {
      const [berdina, sanpablo] = await Promise.all([
        api.get('/berdina/pedidos').catch(() => []),
        api.get('/sanpablo/pedidos').catch(() => []),
      ])
      const todos = [
        ...berdina.flatMap(p => (p.items || []).map(i => ({ ...i, nro_pedido: p.nro_pedido, fecha: p.fecha, pedidoId: p._id, _src: 'berdina' }))),
        ...sanpablo.flatMap(p => (p.items || []).map(i => ({ ...i, nro_pedido: p.nro_pedido, fecha: p.fecha, pedidoId: p._id, _src: 'sanpablo' }))),
      ].filter(i => ESTADOS_VISIBLES.has(i.estado))
      setItems(todos)
    }
    cargar()
  }, [])

  const lista = items.filter(item => {
    if (filtros.nro      && !fmtNro(item.nro_pedido, item._src).includes(filtros.nro.toUpperCase())) return false
    if (filtros.fecha    && item.fecha?.slice(0, 10) !== filtros.fecha) return false
    if (filtros.cc       && !item.cc?.toLowerCase().includes(filtros.cc.toLowerCase())) return false
    if (filtros.repuesto && !item.nombre_repuesto?.toLowerCase().includes(filtros.repuesto.toLowerCase())) return false
    if (filtros.urgencia && item.urgencia !== filtros.urgencia) return false
    if (filtros.grupo    && item.grupo !== filtros.grupo) return false
    if (filtros.solicita && !item.solicita?.toLowerCase().includes(filtros.solicita.toLowerCase())) return false
    return true
  })

  const uniq     = (arr) => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ''))]
  const colapsar = (vals) => vals.length === 0 ? '' : vals.length === 1 ? vals[0] : 'Varios'

  const listaAgrupada = Object.values(
    lista.reduce((acc, item) => {
      const k = `${item._src}-${item.nro_pedido}`
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    }, {})
  ).map(its => ({
    _agrupado:       true,
    _count:          its.length,
    _items:          its,
    _key:            `${its[0]._src}-${its[0].nro_pedido}`,
    _src:            its[0]._src,
    nro_pedido:      its[0].nro_pedido,
    fecha:           its[0].fecha,
    pedidoId:        its[0].pedidoId,
    cc:              colapsar(uniq(its.map(i => i.cc))),
    nombre_repuesto: colapsar(uniq(its.map(i => i.nombre_repuesto))),
    cant:            colapsar(uniq(its.map(i => i.cant?.toString()))),
    unidad:          colapsar(uniq(its.map(i => i.unidad))),
    descripcion:     colapsar(uniq(its.map(i => i.descripcion))),
    urgencia:        colapsar(uniq(its.map(i => i.urgencia))),
    grupo:           colapsar(uniq(its.map(i => i.grupo))),
    solicita:        colapsar(uniq(its.map(i => i.solicita))),
    estado:          colapsar(uniq(its.map(i => i.estado))),
    oc:              colapsar(uniq(its.map(i => i.oc))),
  }))

  const listaAMostrar = (agrupado ? listaAgrupada : lista)
    .slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const varios = () => <span className="text-muted fst-italic" style={{ fontSize: 12 }}>Varios</span>

  const badgeTaller = (src) => (
    <span className="badge" style={{ backgroundColor: src === 'berdina' ? '#7a1828' : '#166534', fontSize: 11, letterSpacing: 0.5, minWidth: 24 }}>
      {src === 'berdina' ? 'B' : 'SP'}
    </span>
  )

  const badgeUrgencia = (u) => {
    if (u === 'Varios') return varios()
    const color = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
    return <span style={{ fontWeight: 600, color: color[u] || '#6c757d' }}>{u}</span>
  }

  const badgeEstado = (e) => {
    if (e === 'Varios') return varios()
    if (e === 'Para revision') return <span className="badge bg-warning">Para revision</span>
    const norm = e === 'Pedido' || e === 'En analisis' ? 'Para analisis' : e
    const color = { 'Para analisis': 'primary', 'Para retirar': 'success' }
    return <span className={`badge bg-${color[norm] || 'secondary'}`}>{norm}</span>
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
        <td>${i.solicita || '—'}</td>
        <td>${i.estado === 'Pedido' ? 'Para analisis' : (i.estado || '—')}</td>
      </tr>`
    ).join('')
    Swal.fire({
      title: `Pedido ${fmtNro(item.nro_pedido, item._src)}`,
      html: `<div style="overflow-x:auto">
        <table class="table table-sm table-bordered" style="font-size:13px;text-align:left">
          <thead><tr><th style="font-weight:normal">Repuesto</th><th style="font-weight:normal">Cant.</th><th style="font-weight:normal">Un.</th><th style="font-weight:normal">C.C.</th><th style="font-weight:normal">Urgencia</th><th style="font-weight:normal">Grupo</th><th style="font-weight:normal">Solicita</th><th style="font-weight:normal">Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>`,
      width: 750,
      confirmButtonText: 'Cerrar',
    })
  }

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

  const verHistorial = async (item) => {
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const hist = await api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
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
        .tabla-informe.tabla-analista-pend tbody tr.fila-critica > td { background-color: #fee2e2; }
        .tabla-informe.tabla-analista-pend tbody tr.fila-critica:hover > td { background-color: #fca5a5; }
      `}</style>

      {/* El ancho de la página lo fija el Container: encabezado, filtros y
          tabla comparten el mismo borde izquierdo y derecho. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1120px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Pendientes
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
          >
            {listaAMostrar.length} {agrupado ? 'pedidos' : 'ítems'}
          </span>

          <SwitchAgrupar id="switchAgruparAP" valor={agrupado} onChange={setAgrupado} />
        </div>

        {/* Filtros: los siete en una sola fila, con el rótulo arriba del campo. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-nowrap" style={{ overflowX: 'auto' }}>
            <FiltroTexto etiqueta="N°" ancho="72px" valor={filtros.nro} onChange={(v) => setF('nro', v)} placeholder="N°" />
            <FiltroTexto etiqueta="Fecha" ancho="132px" tipo="date" valor={filtros.fecha} onChange={(v) => setF('fecha', v)} />
            <FiltroTexto etiqueta="C.C." ancho="84px" valor={filtros.cc} onChange={(v) => setF('cc', v)} placeholder="C.C." />
            <FiltroTexto etiqueta="Repuesto" ancho="150px" valor={filtros.repuesto} onChange={(v) => setF('repuesto', v)} placeholder="Repuesto…" />
            <FiltroSelect etiqueta="Urgencia" ancho="104px" valor={filtros.urgencia} vacio="Todas" onChange={(v) => setF('urgencia', v)} opciones={URGENCIAS} />
            <FiltroSelect etiqueta="Grupo" ancho="128px" valor={filtros.grupo} vacio="Todos" onChange={(v) => setF('grupo', v)} opciones={GRUPOS} />
            <FiltroTexto etiqueta="Solicita" ancho="120px" valor={filtros.solicita} onChange={(v) => setF('solicita', v)} placeholder="Solicitante…" />

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
          <Table className="mb-0 tabla-informe tabla-compras tabla-analista-pend" style={{ width: '100%', minWidth: '1060px' }}>
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
                <th style={thCentro}>O.C.</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center text-muted py-4" style={td}>
                    {hayFiltros ? 'Ningún pendiente coincide con los filtros' : 'No hay pendientes'}
                  </td>
                </tr>
              ) : (
                listaAMostrar.map((item) => {
                  const multiple = item._agrupado && item._count > 1
                  const clickeable =
                    item.estado === 'Para revision' || item.estado === 'Para retirar'
                  return (
                    <tr
                      key={item._agrupado ? item._key : item._id}
                      className={item.urgencia === 'Crítica' ? 'fila-critica' : ''}
                    >
                      <td style={tdCentro}>{badgeTaller(item._src)}</td>
                      <td
                        style={{
                          ...tdCentro,
                          fontWeight: multiple ? 700 : 400,
                          borderLeft: item._agrupado && item._count > 1 ? `3px solid ${BORDO}` : undefined,
                        }}
                      >
                        {fmtNro(item.nro_pedido, item._src)}
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
                        style={{ ...tdCentro, cursor: clickeable ? 'pointer' : undefined }}
                        onClick={() => {
                          if (item.estado === 'Para revision') {
                            verMotivoRevision(item._agrupado ? item._items[0] : item)
                          } else if (item.estado === 'Para retirar' && item.oc && item.oc !== 'Varios') {
                            navigate(`/compras/oc/${encodeURIComponent(item.oc)}`)
                          } else if (item.estado === 'Para retirar') {
                            avisarSinOC(item)
                          }
                        }}
                      >
                        {badgeEstado(item.estado)}
                      </td>
                      <td style={tdCentro}>{item.oc || <Raya />}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                          <BotonAccion
                            icono="bi-clock-history"
                            titulo="Historial"
                            onClick={() => verHistorial(item._agrupado ? item._items[0] : item)}
                            deshabilitado={item._agrupado && item._count > 1}
                          />
                          {item._agrupado && item._count > 1 && (
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
    </div>
  )
}
