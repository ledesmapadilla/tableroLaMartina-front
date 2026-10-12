import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container, Table, Button } from 'react-bootstrap'
import { exportarPlanilla } from '../../helpers/excel'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonVolver } from './estilos'
import { pesos } from './aceites'
import { fechaCorta } from './accesoResultados'

const TALLERES = { berdina: 'Berdina', sanpablo: 'San Pablo' }

/**
 * El resumen de un valor de Compras › Resultados (11/10/2026): los ítems de
 * las órdenes de pago que lo suman. Viene con ?desde&hasta del período y
 * ?cc&taller del valor tocado (sin cc, todos los CC; sin taller, los dos).
 * Tocar la OP la abre.
 */
export default function ResultadosDetalle() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const consulta = params.toString()
  const cc = params.get('cc') || ''
  const taller = params.get('taller') || ''
  const desde = params.get('desde') || ''
  const hasta = params.get('hasta') || ''

  const [items, setItems] = useState([])
  const [cargadoPara, setCargadoPara] = useState(null)
  const [error, setError] = useState('')
  const cargando = cargadoPara !== consulta

  useEffect(() => {
    let vigente = true
    api
      .get(`/compras/resultados/detalle?${consulta}`)
      .then((data) => {
        if (!vigente) return
        setItems(Array.isArray(data) ? data : [])
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        setItems([])
        setError(err.message)
      })
      .finally(() => vigente && setCargadoPara(consulta))
    return () => {
      vigente = false
    }
  }, [consulta])

  const total = items.reduce((n, it) => n + (it.total || 0), 0)
  const textoPeriodo = desde || hasta ? `${fechaCorta(desde) || 'el inicio'} al ${fechaCorta(hasta) || 'hoy'}` : 'Todo'
  const titulo = `${cc ? `C.C. ${cc}` : 'Todos los C.C.'} · ${taller ? TALLERES[taller] || taller : 'Berdina y San Pablo'}`
  const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

  // Con todos los CC o los dos talleres, la tabla dice de cuál es cada ítem.
  const conCC = !cc
  const conTaller = !taller
  const columnas = 7 + (conCC ? 1 : 0) + (conTaller ? 1 : 0)

  const exportarExcel = () =>
    exportarPlanilla({
      titulo: `Compras — Resultados — ${titulo} — ${textoPeriodo}`,
      columnas: [
        { titulo: 'Fecha', ancho: 12 },
        { titulo: 'O.P.', ancho: 12 },
        ...(conTaller ? [{ titulo: 'Taller', ancho: 12 }] : []),
        ...(conCC ? [{ titulo: 'C.C.', ancho: 10 }] : []),
        { titulo: 'Pedido', ancho: 9 },
        { titulo: 'Repuesto', ancho: 34 },
        { titulo: 'Proveedor', ancho: 26 },
        { titulo: 'Cant.', ancho: 8 },
        { titulo: 'Precio unit.', ancho: 16, moneda: true },
        { titulo: 'Total', ancho: 16, moneda: true },
      ],
      filas: [
        ...items.map((it) => [
          fecha(it.fecha),
          it.op,
          ...(conTaller ? [TALLERES[it.taller] || it.taller] : []),
          ...(conCC ? [it.cc] : []),
          it.nro_pedido ?? '',
          it.nombre_repuesto || '',
          it.proveedor || '',
          it.cant ?? '',
          it.precio_unitario ?? '',
          it.total,
        ]),
        ['TOTAL', ...Array(columnas - 1).fill(''), total],
      ],
      hoja: 'Resumen',
      archivo: `compras_resultados_${cc || 'todos'}_${taller || 'ambos'}_${desde || 'inicio'}_${hasta || 'hoy'}.xlsx`,
    })

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
        style={{ maxWidth: '1180px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <BotonVolver />
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Resultados · {titulo}
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
            disabled={items.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

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
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: 'auto', minWidth: '820px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={thCentro}>O.P.</th>
                {conTaller && <th style={thCentro}>Taller</th>}
                {conCC && <th style={thCentro}>C.C.</th>}
                <th style={thCentro}>Pedido</th>
                <th style={{ ...th, minWidth: '200px' }}>Repuesto</th>
                <th style={{ ...th, minWidth: '140px' }}>Proveedor</th>
                <th style={thCentro}>Cant.</th>
                <th style={{ ...thCentro, width: '110px' }}>Precio unit.</th>
                <th style={{ ...thCentro, width: '120px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cargando || error || items.length === 0 ? (
                <tr>
                  <td colSpan={columnas + 1} className="text-center text-muted py-4" style={td}>
                    {cargando ? 'Cargando…' : error ? `No se pudo cargar: ${error}` : 'No hay órdenes de pago para este valor'}
                  </td>
                </tr>
              ) : (
                <>
                  {items.map((it, i) => (
                    <tr key={`${it.op}-${i}`}>
                      <td style={tdCentro}>{fecha(it.fecha)}</td>
                      <td style={tdCentro}>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-bold"
                          style={{ fontSize: 'inherit', color: BORDO }}
                          onClick={() => navigate(`/compras/op/${encodeURIComponent(it.op)}`)}
                          title="Ver la orden de pago"
                        >
                          {it.op}
                        </button>
                      </td>
                      {conTaller && <td style={tdCentro}>{TALLERES[it.taller] || it.taller}</td>}
                      {conCC && <td style={tdCentro}>{it.cc}</td>}
                      <td style={tdCentro}>{it.nro_pedido ?? <Raya />}</td>
                      <td style={td}>{it.nombre_repuesto || <Raya />}</td>
                      <td style={td}>{it.proveedor || <Raya />}</td>
                      <td style={tdCentro}>{it.cant ?? <Raya />}</td>
                      <td style={tdCentro}>{it.precio_unitario != null ? pesos(it.precio_unitario) : <Raya />}</td>
                      <td style={tdCentro}>{pesos(it.total)}</td>
                    </tr>
                  ))}
                  <tr className="fila-total">
                    <td colSpan={columnas} style={{ ...td, fontWeight: 700, color: BORDO }}>
                      TOTAL
                    </td>
                    <td style={{ ...tdCentro, fontWeight: 700 }}>{pesos(total)}</td>
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
