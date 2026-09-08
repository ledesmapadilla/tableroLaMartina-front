import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

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
  const navigate = useNavigate()
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

  const FlechaFiltro = ({ col, opciones }) => (
    <button
      className="btn btn-link p-0 ms-1"
      style={{ fontSize: 11, lineHeight: 1, verticalAlign: 'middle', color: filtros[col] ? '#0d6efd' : 'inherit', textDecoration: 'none' }}
      onClick={(e) => abrirFiltro(col, e.currentTarget, opciones)}
    >
      {filtros[col] ? '▼' : '▽'}
    </button>
  )

  const badgeTaller = (src) => (
    <span className="badge" style={{ backgroundColor: src === 'berdina' ? '#1a3326' : '#4a0812', fontSize: 12, letterSpacing: 0.5, minWidth: 28 }}>
      {src === 'berdina' ? 'B' : 'SP'}
    </span>
  )

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-2">

      <div className="container d-flex justify-content-between align-items-center mb-2">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Gerencia · Historial
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
      </div>

      <div className="container">
        <h4 className="text-center mb-4" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>
          Historial
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
                    <th className="text-center" style={{ width: 80 }}>
                      Taller <FlechaFiltro col="taller" opciones={opcionesTaller} />
                    </th>
                    <th className="text-center">Monto</th>
                    <th className="text-center" style={{ width: 110 }}>
                      Decisión <FlechaFiltro col="decision" opciones={opcionesDecision} />
                    </th>
                    <th className="text-center" style={{ width: 130 }}>
                      Fecha <FlechaFiltro col="fecha" opciones={opcionesFecha} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gruposFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        {grupos.length === 0 ? 'Sin registros de Gerencia todavía' : 'Sin resultados para los filtros aplicados'}
                      </td>
                    </tr>
                  )}
                  {gruposFiltrados.map((grupo) => {
                    const dec   = getDecision(grupo)
                    const monto = getMonto(grupo)
                    return (
                      <tr key={`${grupo._src}-${grupo.nro_pedido}`} style={{ verticalAlign: 'middle' }}>
                        <td className="text-center">
                          {badgeTaller(grupo._src)}
                          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 3 }}>
                            {fmtNro(grupo.nro_pedido, grupo._src)}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>
                          {monto != null
                            ? fmtPrecio(monto)
                            : <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 11 }}>Sin precio</span>
                          }
                        </td>
                        <td className="text-center" style={{ fontWeight: 700, fontSize: 11, color: DEC_COLOR[dec] ?? 'inherit' }}>
                          {dec}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          {getFecha(grupo)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dropdown de filtro — fuera del table para evitar clipping por overflow */}
      {filtroAbierto && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            ...(dropdownPos.left != null ? { left: dropdownPos.left } : { right: dropdownPos.right }),
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #000',
            borderRadius: 4,
            minWidth: 140,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          <div
            className="px-3 py-2"
            style={{ cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #eee', fontWeight: filtros[filtroAbierto] ? 400 : 600 }}
            onMouseDown={(e) => { e.preventDefault(); aplicarFiltro(null) }}
          >
            Todos
          </div>
          {dropdownOpciones.map(op => (
            <div
              key={op}
              className="px-3 py-2"
              style={{ cursor: 'pointer', fontSize: 13, fontWeight: filtros[filtroAbierto] === op ? 600 : 400, background: filtros[filtroAbierto] === op ? '#f0f0f0' : 'transparent' }}
              onMouseDown={(e) => { e.preventDefault(); aplicarFiltro(op) }}
            >
              {op}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
