import { useNavigate } from 'react-router-dom'
import { Button, Modal, Table } from 'react-bootstrap'
import { Raya } from './estilos'
import { litros } from './aceites'
import { TIPOS_GASOIL, campoGasoil, conTipos } from './camposGasoil'

/**
 * El historial de las auditorías de gasoil (27/10/2026): un resumen de todas
 * las que tienen resultado, una fila por tanque y auditoría, con la cuenta
 * entera (de dónde parte, ingresos, consumos, lo que tendría que haber, lo
 * medido y el resultado). El botón Gráfico lleva a su página
 * (GasoilGraficos.jsx).
 *
 * `lista` son las auditorías como las trae la pantalla (con `resultado` en
 * cada carga); `orden` los tanques en el orden de la pantalla.
 */
const COLOR = '#334155'
const VERDE = '#15803d'
const ROJO = '#dc2626'
const COLOR_INFINIA = '#c026d3'

const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const textoResultado = (n) => (n === 0 ? 'Justo' : `${n > 0 ? 'Sobran' : 'Faltan'} ${litros(Math.abs(n))} lts`)
const colorResultado = (n) => (n === 0 ? COLOR : n > 0 ? VERDE : ROJO)
// La desviación en %, como en la pantalla de auditorías.
const desviacion = (r) => {
  if (!r.teorico) return ''
  const pct = (r.resultado / Math.abs(r.teorico)) * 100
  return `${pct > 0 ? '+' : ''}${pct.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const nombreTanque = (idCampo, tipo) => {
  const titulo = campoGasoil(idCampo)?.titulo || idCampo
  if (!conTipos(idCampo)) return titulo
  return (
    <>
      {titulo} · <span style={tipo === 'infinia' ? { color: COLOR_INFINIA } : undefined}>{TIPOS_GASOIL[tipo]}</span>
    </>
  )
}

export default function HistorialAuditoriasGasoil({ show, onHide, lista, orden }) {
  const navigate = useNavigate()

  // Una fila por tanque y auditoría con resultado, de la más nueva a la más
  // vieja y en el orden de los tanques.
  const filas = lista.flatMap((a) =>
    a.cargas.filter((c) => c.resultado).map((c) => ({ auditoria: a, carga: c, r: c.resultado }))
  )
  const posicion = (c) => orden.findIndex((t) => t.campo === c.campo && t.tipo === c.tipo)
  const filasOrdenadas = [...filas].sort(
    (a, b) => new Date(b.auditoria.fechaPedido) - new Date(a.auditoria.fechaPedido) || posicion(a.carga) - posicion(b.carga)
  )
  // Cada auditoría con su número (27/10/2026): la más vieja es la 1. El # y la
  // fecha van una sola vez, en celdas unidas sobre las filas de sus tanques.
  const ids = [...new Set(filasOrdenadas.map((f) => String(f.auditoria._id)))]
  const numero = (a) => ids.length - ids.indexOf(String(a._id))
  const filasDe = (a) => filasOrdenadas.filter((f) => String(f.auditoria._id) === String(a._id)).length

  const th = { backgroundColor: COLOR, color: '#fff', fontSize: '0.66rem', fontWeight: 600, padding: '3px 5px', whiteSpace: 'nowrap', textAlign: 'center' }
  const td = { fontSize: '0.7rem', padding: '2px 5px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }

  return (
    <Modal show={show} onHide={onHide} centered size="xl" scrollable contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header closeButton closeVariant="white" style={{ backgroundColor: COLOR, color: '#fff', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}>
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className="bi bi-clock-history"></i>
          <span>Historial de auditorías</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Las auditorías con resultado, de la más nueva a la más vieja.
          </span>
          <Button
            size="sm"
            onClick={() => navigate('/compras/gasoil/auditorias/grafico')}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
          >
            <i className="bi bi-bar-chart-fill"></i>
            <span>Gráfico</span>
          </Button>
        </div>

        <div className="bg-white rounded-3 shadow-sm" style={{ border: '1px solid #cbd5e1', overflow: 'auto' }}>
          <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '820px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ ...th, width: '40px' }}>#</th>
                <th style={th}>Fecha</th>
                <th style={th}>Taller</th>
                <th style={th}>Parte de</th>
                <th style={th}>Partida (lts)</th>
                <th style={th}>Ingresos</th>
                <th style={th}>Consumos</th>
                <th style={th}>Tendría que haber</th>
                <th style={th}>Medido</th>
                <th style={th}>Resultado</th>
                <th style={th}>Desvío</th>
              </tr>
            </thead>
            <tbody>
              {filasOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-muted py-4" style={td}>
                    Todavía no hay auditorías con resultado
                  </td>
                </tr>
              ) : (
                filasOrdenadas.map(({ auditoria, carga, r }, i) => {
                  // La primera fila de cada auditoría lleva el # y la fecha, y la
                  // línea que la separa de la anterior.
                  const primera = i === 0 || String(filasOrdenadas[i - 1].auditoria._id) !== String(auditoria._id)
                  return (
                  <tr key={`${auditoria._id}-${carga.campo}-${carga.tipo}`} style={primera ? { borderTop: '2px solid #94a3b8' } : undefined}>
                    {primera && (
                      <>
                        <td style={{ ...td, fontWeight: 700, color: COLOR }} rowSpan={filasDe(auditoria)}>
                          {numero(auditoria)}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }} rowSpan={filasDe(auditoria)}>
                          {fecha(auditoria.fechaPedido)}
                        </td>
                      </>
                    )}
                    <td style={{ ...td, fontWeight: 600, color: campoGasoil(carga.campo)?.color }}>{nombreTanque(carga.campo, carga.tipo)}</td>
                    <td style={td}>{r.origen === 'stock inicial' ? 'Stock inicial' : 'Auditoría anterior'}</td>
                    <td style={td}>{litros(r.partida)}</td>
                    <td style={{ ...td, color: '#1d4ed8' }}>+ {litros(r.ingresos)}</td>
                    <td style={td}>− {litros(r.consumos)}</td>
                    <td style={td}>{litros(r.teorico)}</td>
                    <td style={td}>{litros(r.medido)}</td>
                    <td style={{ ...td, fontWeight: 700, color: colorResultado(r.resultado) }}>{textoResultado(r.resultado)}</td>
                    <td style={{ ...td, color: colorResultado(r.resultado) }}>{desviacion(r) || <Raya />}</td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  )
}
