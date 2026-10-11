import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import { exportarPlanilla } from '../../helpers/excel'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya, FiltroTexto, FiltroSelect, BotonLimpiar } from './estilos'
import { pesos } from './aceites'
import { useAuth } from '../../context/AuthContext'
import Error404 from '../pages/Error404'
import { USUARIO_RESULTADOS, fechaCorta } from './accesoResultados'

// "AAAA-MM-DD" de una fecha, en hora local.
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Los períodos rápidos. "Todo" es sin fechas; tocar Desde o Hasta a mano lo
// pasa a "Personalizado".
const PERIODOS = ['Este mes', 'Mes anterior', 'Últimos 3 meses', 'Este año', 'Personalizado']
const rangoDe = (periodo) => {
  const hoy = new Date()
  const a = hoy.getFullYear()
  const m = hoy.getMonth()
  switch (periodo) {
    case 'Este mes':
      return { desde: iso(new Date(a, m, 1)), hasta: iso(new Date(a, m + 1, 0)) }
    case 'Mes anterior':
      return { desde: iso(new Date(a, m - 1, 1)), hasta: iso(new Date(a, m, 0)) }
    case 'Últimos 3 meses':
      return { desde: iso(new Date(a, m - 2, 1)), hasta: iso(new Date(a, m + 1, 0)) }
    case 'Este año':
      return { desde: iso(new Date(a, 0, 1)), hasta: iso(new Date(a, 11, 31)) }
    default:
      return { desde: '', hasta: '' }
  }
}

const FILTROS_INIT = { periodo: 'Este mes', ...rangoDe('Este mes'), cc: '' }

/**
 * Compras › Resultados (11/10/2026): lo gastado en plata por CC y por taller
 * en un período. El gasto son las órdenes de pago, por su fecha; cada ítem
 * va al CC de su pedido (controllers/resultados.controller.js en el back).
 * Por ahora lo ve solo nacho; después pasa a la tabla de Roles.
 */
export default function Resultados() {
  const { user } = useAuth()
  if (user?.usuario !== USUARIO_RESULTADOS) return <Error404 />
  return <TablaResultados />
}

function TablaResultados() {
  const navigate = useNavigate()
  // Los filtros van en la dirección: al volver del resumen de un valor quedan
  // como estaban. Sin nada en la dirección, los de arranque.
  const [params, setParams] = useSearchParams()
  const filtros = params.has('periodo')
    ? {
        periodo: params.get('periodo'),
        desde: params.get('desde') || '',
        hasta: params.get('hasta') || '',
        cc: params.get('cc') || '',
      }
    : FILTROS_INIT
  const setFiltros = (cambio) => {
    const nuevos = typeof cambio === 'function' ? cambio(filtros) : cambio
    const q = new URLSearchParams({ periodo: nuevos.periodo })
    for (const k of ['desde', 'hasta', 'cc']) if (nuevos[k]) q.set(k, nuevos[k])
    setParams(q, { replace: true })
  }
  const [filas, setFilas] = useState([])
  // El período ya traído: mientras no coincide con el pedido, está cargando.
  const [cargadoPara, setCargadoPara] = useState(null)
  const [error, setError] = useState('')

  const elegirPeriodo = (periodo) =>
    setFiltros((f) => ({ ...f, periodo, ...(periodo === 'Personalizado' ? {} : rangoDe(periodo)) }))
  const cambiarFecha = (k, v) => setFiltros((f) => ({ ...f, [k]: v, periodo: 'Personalizado' }))

  const q = new URLSearchParams()
  if (filtros.desde) q.set('desde', filtros.desde)
  if (filtros.hasta) q.set('hasta', filtros.hasta)
  const consulta = q.toString()
  const cargando = cargadoPara !== consulta

  useEffect(() => {
    let vigente = true
    api
      .get(`/compras/resultados?${consulta}`)
      .then((data) => {
        if (!vigente) return
        setFilas(Array.isArray(data) ? data : [])
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        setFilas([])
        setError(err.message)
      })
      .finally(() => vigente && setCargadoPara(consulta))
    return () => {
      vigente = false
    }
  }, [consulta])

  const lista = filas.filter((f) => !filtros.cc || f.cc.toLowerCase().includes(filtros.cc.toLowerCase()))
  const suma = (k) => lista.reduce((n, f) => n + (f[k] || 0), 0)
  const totales = { berdina: suma('berdina'), sanpablo: suma('sanpablo'), total: suma('total') }

  const textoPeriodo =
    filtros.desde || filtros.hasta
      ? `${fechaCorta(filtros.desde) || 'el inicio'} al ${fechaCorta(filtros.hasta) || 'hoy'}`
      : 'Todo'

  // Un monto en cero va con raya: ese taller no gastó en ese CC. Con monto,
  // tocarlo abre su resumen (las OP que lo suman): sin `cc` es el de todos
  // los CC, sin `taller` el de los dos talleres.
  const monto = (n, { negrita = false, cc, taller, etiqueta } = {}) => {
    if (!n) return <Raya />
    const ir = () => {
      const q = new URLSearchParams()
      if (filtros.desde) q.set('desde', filtros.desde)
      if (filtros.hasta) q.set('hasta', filtros.hasta)
      if (cc) q.set('cc', cc)
      if (taller) q.set('taller', taller)
      navigate(`/compras/resultados/detalle?${q}`)
    }
    return (
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none"
        onClick={ir}
        title={`Ver el resumen${etiqueta ? ` de ${etiqueta}` : ''}`}
        style={{ fontSize: 'inherit', fontWeight: negrita ? 700 : 400, color: '#1e293b' }}
      >
        {pesos(n)}
      </button>
    )
  }

  const exportarExcel = () =>
    exportarPlanilla({
      titulo: `Compras — Resultados por C.C. — ${textoPeriodo}`,
      columnas: [
        { titulo: 'C.C.', ancho: 10 },
        { titulo: 'Descripción', ancho: 32 },
        { titulo: 'Berdina', ancho: 18, moneda: true },
        { titulo: 'San Pablo', ancho: 18, moneda: true },
        { titulo: 'Total', ancho: 18, moneda: true },
      ],
      filas: [
        ...lista.map((f) => [f.cc, f.descripcion || '', f.berdina, f.sanpablo, f.total]),
        ['TOTAL', '', totales.berdina, totales.sanpablo, totales.total],
      ],
      hoja: 'Resultados',
      archivo: `compras_resultados_${filtros.desde || 'inicio'}_${filtros.hasta || 'hoy'}.xlsx`,
    })

  const hayFiltros = filtros.periodo !== FILTROS_INIT.periodo || filtros.cc !== ''

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
        style={{ maxWidth: '900px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Resultados
          </span>
          <span
            className="px-2 py-1 rounded-2 fw-semibold"
            style={{ backgroundColor: BORDO_SUAVE, color: BORDO, fontSize: '0.74rem' }}
          >
            {textoPeriodo}
          </span>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={lista.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtros: el período manda; Desde y Hasta a mano lo dejan en
            Personalizado. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-wrap">
            <FiltroSelect
              etiqueta="Período"
              ancho="170px"
              valor={filtros.periodo}
              vacio="Todo"
              onChange={elegirPeriodo}
              opciones={PERIODOS}
              destacado
            />
            <FiltroTexto etiqueta="Desde" ancho="140px" tipo="date" valor={filtros.desde} onChange={(v) => cambiarFecha('desde', v)} />
            <FiltroTexto etiqueta="Hasta" ancho="140px" tipo="date" valor={filtros.hasta} onChange={(v) => cambiarFecha('hasta', v)} />
            <FiltroTexto etiqueta="C.C." ancho="90px" valor={filtros.cc} onChange={(v) => setFiltros((f) => ({ ...f, cc: v }))} placeholder="C.C." />
            {hayFiltros && <BotonLimpiar onClick={() => setFiltros(FILTROS_INIT)} />}
          </div>
        </Card>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: '0 1 auto',
            minHeight: 0,
            alignSelf: 'center',
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: 'auto', minWidth: '640px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ ...thCentro, width: '70px' }}>C.C.</th>
                <th style={{ ...th, minWidth: '200px' }}>Descripción</th>
                <th style={{ ...thCentro, width: '120px' }}>Berdina</th>
                <th style={{ ...thCentro, width: '120px' }}>San Pablo</th>
                <th style={{ ...thCentro, width: '130px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cargando || error || lista.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : error
                        ? `No se pudo cargar: ${error}`
                        : filas.length
                          ? 'Ningún C.C. coincide con el filtro'
                          : 'No hay órdenes de pago en el período'}
                  </td>
                </tr>
              ) : (
                <>
                  {lista.map((f) => (
                    <tr key={f.cc}>
                      <td style={{ ...tdCentro, fontWeight: 600 }}>{f.cc}</td>
                      <td style={td}>{f.descripcion || <Raya />}</td>
                      <td style={tdCentro}>{monto(f.berdina, { cc: f.cc, taller: 'berdina', etiqueta: `${f.cc} en Berdina` })}</td>
                      <td style={tdCentro}>{monto(f.sanpablo, { cc: f.cc, taller: 'sanpablo', etiqueta: `${f.cc} en San Pablo` })}</td>
                      <td style={tdCentro}>{monto(f.total, { negrita: true, cc: f.cc, etiqueta: f.cc })}</td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td colSpan={2} style={{ ...td, fontWeight: 700, color: BORDO }}>
                      TOTAL
                    </td>
                    {/* Con el filtro de C.C. el total es de algunos CC: el
                        resumen sería de todos, así que no se abre. */}
                    {filtros.cc ? (
                      <>
                        <td style={{ ...tdCentro, fontWeight: 700 }}>{pesos(totales.berdina)}</td>
                        <td style={{ ...tdCentro, fontWeight: 700 }}>{pesos(totales.sanpablo)}</td>
                        <td style={{ ...tdCentro, fontWeight: 700 }}>{pesos(totales.total)}</td>
                      </>
                    ) : (
                      <>
                        <td style={tdCentro}>{monto(totales.berdina, { negrita: true, taller: 'berdina', etiqueta: 'Berdina' })}</td>
                        <td style={tdCentro}>{monto(totales.sanpablo, { negrita: true, taller: 'sanpablo', etiqueta: 'San Pablo' })}</td>
                        <td style={tdCentro}>{monto(totales.total, { negrita: true, etiqueta: 'todo el período' })}</td>
                      </>
                    )}
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  )
}
