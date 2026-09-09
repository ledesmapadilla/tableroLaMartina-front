import { useState, useEffect, useRef } from 'react'
import { Container, Table } from 'react-bootstrap'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, thCentro, td, tdCentro } from './formato'

/** La flechita que abre el filtro de una columna. Llena cuando está puesto. */
const FlechaFiltro = ({ activo, onClick }) => (
  <button
    className="btn btn-link p-0 ms-1"
    style={{
      fontSize: '0.62rem',
      lineHeight: 1,
      verticalAlign: 'middle',
      color: activo ? '#fcd34d' : 'rgba(255,255,255,0.75)',
      textDecoration: 'none',
    }}
    onClick={onClick}
    title={activo ? 'Filtro puesto' : 'Filtrar'}
  >
    {activo ? '▼' : '▽'}
  </button>
)

const fmtNro = (n, src) =>
  src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const fmtFecha = (f) =>
  f ? new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '—'

const fmtPrecio = (n) =>
  n != null && !isNaN(n)
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
    : null

const calcCostoItem = (item) => {
  const precios = [item.precio1, item.precio2, item.precio3].filter(v => v != null && v > 0)
  if (precios.length === 0) return null
  return Math.min(...precios) * (item.cant || 0)
}

const DECISION = {
  'Para hacer OC': 'Aprobado',
  'Cancelado':     'Rechazado',
  'Rechazado':     'Rechazado',
  'Para analisis': 'A revisar',
}

const DEC_COLOR = {
  'Aprobado':      '#198754',
  'Rechazado':     '#dc3545',
  'A revisar':     '#c87800',
  'Para revision': '#d39e00',
}

export default function GerenciaHistorial() {
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtros, setFiltros] = useState({ taller: null, decision: null, fecha: null })
  const [filtroAbierto, setFiltroAbierto] = useState(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [dropdownOpciones, setDropdownOpciones] = useState([])
  const dropdownRef = useRef()

  useEffect(() => {
    const cargar = async () => {
      const [berdina, sanpablo] = await Promise.all([
        api.get('/berdina/pedidos/historial-gerencia').catch(() => []),
        api.get('/sanpablo/pedidos/historial-gerencia').catch(() => []),
      ])
      const todas = [
        ...berdina.map(i => ({ ...i, _src: 'berdina' })),
        ...sanpablo.map(i => ({ ...i, _src: 'sanpablo' })),
      ]
      const agrupado = Object.values(
        todas.reduce((acc, item) => {
          const key = `${item._src}-${item.nro_pedido}`
          if (!acc[key]) acc[key] = { _src: item._src, nro_pedido: item.nro_pedido, items: [] }
          acc[key].items.push(item)
          return acc
        }, {})
      ).sort((a, b) => {
        const fa = a.items[0]?.accionesGerencia.at(-1)?.fecha
        const fb = b.items[0]?.accionesGerencia.at(-1)?.fecha
        return new Date(fb) - new Date(fa)
      })
      setGrupos(agrupado)
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    if (!filtroAbierto) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setFiltroAbierto(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filtroAbierto])

  const getDecision = (grupo) => {
    const estado = grupo.items[0]?.accionesGerencia.at(-1)?.estado
    return DECISION[estado] ?? estado ?? '—'
  }
  const getTaller = (grupo) => grupo._src === 'berdina' ? 'Berdina' : 'San Pablo'
  const getFecha  = (grupo) => fmtFecha(grupo.items[0]?.accionesGerencia.at(-1)?.fecha)
  const getMonto  = (grupo) => {
    const sinPrecio = grupo.items.every(i => calcCostoItem(i) == null)
    if (sinPrecio) return null
    return grupo.items.reduce((sum, i) => sum + (calcCostoItem(i) ?? 0), 0)
  }

  const abrirFiltro = (col, btnEl, opciones) => {
    if (filtroAbierto === col) { setFiltroAbierto(null); return }
    const rect = btnEl.getBoundingClientRect()
    const pos = col === 'fecha'
      ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      : { top: rect.bottom + 4, left: rect.left }
    setDropdownPos(pos)
    setDropdownOpciones(opciones)
    setFiltroAbierto(col)
  }

  const aplicarFiltro = (val) => {
    setFiltros(f => ({ ...f, [filtroAbierto]: val }))
    setFiltroAbierto(null)
  }

  const gruposFiltrados = grupos.filter(g => {
    if (filtros.taller   && getTaller(g)   !== filtros.taller)   return false
    if (filtros.decision && getDecision(g) !== filtros.decision) return false
    if (filtros.fecha    && getFecha(g)    !== filtros.fecha)    return false
    return true
  })

  const opcionesTaller   = [...new Set(grupos.map(getTaller))]
  const opcionesDecision = [...new Set(grupos.map(getDecision))]
  const opcionesFecha    = [...new Set(grupos.map(getFecha))]

  const badgeTaller = (src) => (
    <span
      className="badge"
      style={{
        backgroundColor: src === 'berdina' ? BORDO : '#166534',
        fontSize: '0.66rem',
        letterSpacing: 0.5,
        minWidth: 28,
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
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '820px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Historial
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
          >
            {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>

        {cargando ? (
          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <div className="spinner-border" role="status" style={{ color: BORDO }} />
          </div>
        ) : (
          <div
            className="flex-grow-1 shadow-sm rounded-3 bg-white"
            style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
          >
            <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '560px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ ...thCentro, width: 110 }}>
                    Taller
                    <FlechaFiltro
                      activo={!!filtros.taller}
                      onClick={(e) => abrirFiltro('taller', e.currentTarget, opcionesTaller)}
                    />
                  </th>
                  <th style={thCentro}>Monto</th>
                  <th style={{ ...thCentro, width: 130 }}>
                    Decisión
                    <FlechaFiltro
                      activo={!!filtros.decision}
                      onClick={(e) => abrirFiltro('decision', e.currentTarget, opcionesDecision)}
                    />
                  </th>
                  <th style={{ ...thCentro, width: 140 }}>
                    Fecha
                    <FlechaFiltro
                      activo={!!filtros.fecha}
                      onClick={(e) => abrirFiltro('fecha', e.currentTarget, opcionesFecha)}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {gruposFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-4" style={td}>
                      {grupos.length === 0
                        ? 'Todavía no hay pedidos resueltos por Gerencia'
                        : 'Ningún pedido coincide con los filtros'}
                    </td>
                  </tr>
                ) : (
                  gruposFiltrados.map((grupo) => {
                    const dec = getDecision(grupo)
                    const monto = getMonto(grupo)
                    return (
                      <tr key={`${grupo._src}-${grupo.nro_pedido}`}>
                        <td style={tdCentro}>
                          {badgeTaller(grupo._src)}
                          <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: 3 }}>
                            {fmtNro(grupo.nro_pedido, grupo._src)}
                          </div>
                        </td>
                        <td style={{ ...tdCentro, fontWeight: 700 }}>
                          {monto != null ? (
                            fmtPrecio(monto)
                          ) : (
                            <span style={{ color: '#94a3b8', fontWeight: 400, fontStyle: 'italic' }}>Sin precio</span>
                          )}
                        </td>
                        <td style={{ ...tdCentro, fontWeight: 700, color: DEC_COLOR[dec] ?? 'inherit' }}>{dec}</td>
                        <td style={{ ...tdCentro, color: '#64748b' }}>{getFecha(grupo)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Container>

      {/* El desplegable del filtro va fuera de la tabla: adentro lo recortaría
          el overflow del marco. */}
      {filtroAbierto && (
        <div
          ref={dropdownRef}
          className="shadow-lg"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            ...(dropdownPos.left != null ? { left: dropdownPos.left } : { right: dropdownPos.right }),
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            minWidth: 150,
            overflow: 'hidden',
          }}
        >
          <div
            className="px-3 py-2"
            style={{
              cursor: 'pointer',
              fontSize: '0.85rem',
              borderBottom: '1px solid #e2e8f0',
              color: filtros[filtroAbierto] ? '#334155' : BORDO,
              fontWeight: filtros[filtroAbierto] ? 500 : 600,
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              aplicarFiltro(null)
            }}
          >
            Todos
          </div>
          {dropdownOpciones.map((op) => {
            const elegida = filtros[filtroAbierto] === op
            return (
              <div
                key={op}
                className="px-3 py-2"
                style={{
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: elegida ? 600 : 500,
                  color: elegida ? BORDO : '#334155',
                  backgroundColor: elegida ? BORDO_SUAVE : 'transparent',
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  aplicarFiltro(op)
                }}
              >
                {op}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
