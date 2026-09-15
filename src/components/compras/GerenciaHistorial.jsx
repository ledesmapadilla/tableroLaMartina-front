import { useState, useEffect } from 'react'
import { Container, Card, Table } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion, BotonLimpiar, FiltroTexto, FiltroSelect, OjoPedido } from './estilos'
import { verHistorialPedido, conCreacion } from './detallePedido'
import { opcionElegida } from './precioElegido'

const fmtNro = (n, src) =>
  src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const fmtFecha = (f) =>
  new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' })

const fmtPrecio = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// El costo sale del presupuesto que eligió el analista (el más barato si no
// eligió otro), igual que en Gerencia.
const calcCostoItem = (item) => {
  const elegida = opcionElegida(item)
  return elegida ? elegida.precio * (item.cant || 0) : null
}

// Lo que decidió Gerencia, según el estado en que dejó el pedido. "Para
// analisis" es como quedaban los mandados a revisar antes de "Para revision".
const DECISION = {
  'Para hacer OP': 'Aprobado',
  'Para revision': 'A revisar',
  'Para analisis': 'A revisar',
  Rechazado:       'Rechazado',
  Cancelado:       'Rechazado',
}
const DECISIONES = ['Aprobado', 'A revisar', 'Rechazado']
const COLOR_DECISION = { Aprobado: 'success', 'A revisar': 'warning', Rechazado: 'danger' }

const TALLERES = { berdina: 'Berdina', sanpablo: 'San Pablo' }

// El día de la decisión como AAAA-MM-DD en hora local: es lo que devuelve el
// filtro de fecha.
const diaLocal = (f) => {
  const d = new Date(f)
  if (!f || isNaN(d)) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const conCant = (i) => `${i.nombre_repuesto}${i.cant ? ` (${i.cant})` : ''}`

const FILTROS_INIT = { buscar: '', taller: '', decision: '', fecha: '' }
const COLUMNAS = 4

const badgeTaller = (src) => (
  <span
    className="badge"
    style={{ backgroundColor: src === 'berdina' ? BORDO : '#166534', fontSize: '0.62rem', letterSpacing: 0.3 }}
  >
    {TALLERES[src]}
  </span>
)

/**
 * Lo que resolvió Gerencia. Se usa en el celular, como toda la sección: cuatro
 * columnas con los datos apilados en cada celda para que entre sin scroll
 * lateral, y los filtros se acomodan en varias líneas.
 */
export default function GerenciaHistorial() {
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState(FILTROS_INIT)
  // Pedidos múltiples abiertos con el ojo: sus ítems van debajo, en la misma tabla.
  const [abiertos, setAbiertos] = useState(() => new Set())
  const setF = (k, v) => setFiltros((f) => ({ ...f, [k]: v }))
  const hayFiltros = Object.values(filtros).some((v) => v !== '')

  useEffect(() => {
    let vigente = true
    ;(async () => {
      const [berdina, sanpablo] = await Promise.all([
        api.get('/berdina/pedidos/historial-gerencia').catch(() => []),
        api.get('/sanpablo/pedidos/historial-gerencia').catch(() => []),
      ])
      if (!vigente) return
      const todas = [
        ...berdina.map((i) => ({ ...i, _src: 'berdina' })),
        ...sanpablo.map((i) => ({ ...i, _src: 'sanpablo' })),
      ]
      const agrupado = Object.values(
        todas.reduce((acc, item) => {
          const key = `${item._src}-${item.nro_pedido}`
          if (!acc[key]) acc[key] = { _src: item._src, _key: key, nro_pedido: item.nro_pedido, fecha: item.fecha, items: [] }
          acc[key].items.push(item)
          return acc
        }, {})
      )
        .map((g) => {
          // Gerencia decide sobre el pedido entero: vale la acción más reciente
          // entre sus ítems. Las anteriores están en el historial.
          const accion = g.items
            .map((i) => (i.accionesGerencia || []).at(-1))
            .filter(Boolean)
            .reduce((a, b) => (!a || new Date(b.fecha) > new Date(a.fecha) ? b : a), null)
          const sinPrecio = g.items.every((i) => calcCostoItem(i) == null)
          return {
            ...g,
            accion,
            decision: DECISION[accion?.estado] ?? accion?.estado ?? '',
            monto: sinPrecio ? null : g.items.reduce((sum, i) => sum + (calcCostoItem(i) ?? 0), 0),
          }
        })
        .sort((a, b) => new Date(b.accion?.fecha) - new Date(a.accion?.fecha))
      setGrupos(agrupado)
      setCargando(false)
    })()
    return () => { vigente = false }
  }, [])

  const lista = grupos.filter((g) => {
    // Un solo buscador para el número y el repuesto: en el celular no entran dos.
    if (filtros.buscar) {
      const q = filtros.buscar.trim()
      const porNro = fmtNro(g.nro_pedido, g._src).includes(q.toUpperCase())
      const porRepuesto = g.items.some((i) => i.nombre_repuesto?.toLowerCase().includes(q.toLowerCase()))
      if (!porNro && !porRepuesto) return false
    }
    if (filtros.taller && TALLERES[g._src] !== filtros.taller) return false
    if (filtros.decision && g.decision !== filtros.decision) return false
    if (filtros.fecha && diaLocal(g.accion?.fecha) !== filtros.fecha) return false
    return true
  })

  const alternarAbierto = (clave) =>
    setAbiertos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(clave)) siguiente.delete(clave)
      else siguiente.add(clave)
      return siguiente
    })

  // Cada pedido y, debajo de los abiertos, sus ítems marcados como anidados.
  const filas = lista.flatMap((g) =>
    g.items.length > 1 && abiertos.has(g._key)
      ? [g, ...g.items.map((i) => ({ ...i, _anidada: true, _key: `${g._key}-${i._id}` }))]
      : [g]
  )

  const verHistorial = async (grupo) => {
    try {
      const base = grupo._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      const historiales = await Promise.all(
        grupo.items.map((item) =>
          api.get(`${base}/${item.pedidoId}/items/${item._id}/historial`)
            .then((hist) => ({ item, hist }))
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
      {/* El mismo ancho que Para autorizar, la otra pantalla de Gerencia. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '820px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Historial de Gerencia
          </span>
          {!cargando && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
            >
              {lista.length} {lista.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          )}
        </div>

        {/* Filtros: en el celular se acomodan en varias líneas. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-wrap">
            <FiltroTexto etiqueta="Buscar" ancho="150px" valor={filtros.buscar} onChange={(v) => setF('buscar', v)} placeholder="N° o repuesto" />
            <FiltroSelect etiqueta="Taller" ancho="116px" valor={filtros.taller} vacio="Todos" onChange={(v) => setF('taller', v)} opciones={Object.values(TALLERES)} />
            <FiltroSelect etiqueta="Decisión" ancho="116px" valor={filtros.decision} vacio="Todas" onChange={(v) => setF('decision', v)} opciones={DECISIONES} />
            <FiltroTexto etiqueta="Fecha" ancho="136px" tipo="date" valor={filtros.fecha} onChange={(v) => setF('fecha', v)} />

            {hayFiltros && <BotonLimpiar onClick={() => setFiltros(FILTROS_INIT)} />}
          </div>
        </Card>

        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Pedido</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Monto</th>
                <th style={thCentro}>Decisión</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : hayFiltros
                        ? 'Ningún pedido coincide con los filtros'
                        : 'Todavía no hay pedidos resueltos por Gerencia'}
                  </td>
                </tr>
              ) : (
                filas.map((f) => {
                  // Un ítem de un pedido múltiple abierto: solo lo propio del ítem.
                  if (f._anidada) {
                    const costo = calcCostoItem(f)
                    return (
                      <tr key={f._key} className="fila-anidada">
                        <td style={{ ...tdCentro, borderLeft: `3px solid ${BORDO}`, color: '#94a3b8' }}>↳</td>
                        <td style={td}>{conCant(f)}</td>
                        <td style={{ ...tdCentro, whiteSpace: 'nowrap' }}>{costo == null ? <Raya /> : fmtPrecio(costo)}</td>
                        <td style={td} />
                      </tr>
                    )
                  }

                  const multiple = f.items.length > 1
                  return (
                    <tr key={f._key} className="inicio-pedido">
                      {/* Taller, número y día de la decisión, apilados. El
                          pedido múltiple y sus ítems abiertos comparten la
                          línea bordó de la izquierda. */}
                      <td
                        style={{
                          ...tdCentro,
                          padding: '6px 5px',
                          borderLeft: multiple ? `3px solid ${BORDO}` : undefined,
                        }}
                      >
                        {badgeTaller(f._src)}
                        <div style={{ fontWeight: multiple ? 700 : 400, whiteSpace: 'nowrap', marginTop: 3 }}>
                          {fmtNro(f.nro_pedido, f._src)}
                          {multiple && (
                            <OjoPedido abierto={abiertos.has(f._key)} onClick={() => alternarAbierto(f._key)} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                          {f.accion?.fecha ? fmtFecha(f.accion.fecha) : <Raya />}
                        </div>
                      </td>

                      {/* El repuesto y, debajo, el motivo que dejó Gerencia al
                          rechazar o mandar a revisar. */}
                      <td style={{ ...td, padding: '6px 5px' }}>
                        {multiple ? (
                          <span className="text-muted fst-italic">{f.items.length} ítems</span>
                        ) : (
                          conCant(f.items[0])
                        )}
                        {f.accion?.nota && (
                          <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: 2 }}>
                            <span className="fw-semibold">Motivo:</span> {f.accion.nota}
                          </div>
                        )}
                      </td>

                      <td style={{ ...tdCentro, padding: '6px 5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {f.monto == null ? <Raya /> : fmtPrecio(f.monto)}
                      </td>

                      <td style={{ ...tdCentro, padding: '6px 5px' }}>
                        <div className="d-flex flex-column align-items-center gap-1">
                          {f.decision ? (
                            <span className={`badge bg-${COLOR_DECISION[f.decision] || 'secondary'}`}>{f.decision}</span>
                          ) : (
                            <Raya />
                          )}
                          <BotonAccion icono="bi-clock-history" titulo="Historial" onClick={() => verHistorial(f)} grande />
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
