import { Modal, Table } from 'react-bootstrap'
import { Raya } from './estilos'

/**
 * Por dónde anduvo una herramienta (22/09/2026).
 *
 * Una fila por préstamo: cuándo salió, a cargo de quién y cuándo volvió. La de
 * arriba sin fecha de devolución es dónde está hoy; si no hay ninguna abierta,
 * está en el almacén.
 *
 * No trae los datos ni los guarda: la pantalla del rubro (StockRubro) es la que
 * entrega y recibe.
 */
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : null)

export default function AsignacionesStock({
  abierto,
  articulo,
  asignaciones = [],
  cargando = false,
  color,
  acento,
  onCerrar,
}) {
  const th = {
    backgroundColor: color,
    color: '#fff',
    fontSize: '0.66rem',
    fontWeight: 600,
    verticalAlign: 'middle',
    padding: '3px 5px',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  }
  const thCentro = { ...th, textAlign: 'center' }
  const td = { fontSize: '0.7rem', padding: '1px 5px', verticalAlign: 'middle' }
  const tdCentro = { ...td, textAlign: 'center' }

  const enAlguien = articulo?.aCargo?.persona

  return (
    <Modal show={!!abierto} onHide={onCerrar} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: color,
          color: '#fff',
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className="bi bi-person-badge" style={{ color: acento }}></i>
          <span>A cargo · {articulo?.codigo}</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {/* De qué herramienta se trata y dónde está hoy, que es lo que se vino
            a ver. */}
        <div className="mb-2" style={{ fontSize: '0.8rem', color: '#334155' }}>
          <span className="fw-bold" style={{ color }}>
            {articulo?.descripcion}
          </span>
          {articulo?.marca ? ` · ${articulo.marca}` : ''}
          <span className="ms-2">
            —{' '}
            {enAlguien ? (
              <>
                la tiene <b>{articulo.aCargo.persona}</b> desde el{' '}
                <b>{fecha(articulo.aCargo.fecha)}</b>
              </>
            ) : (
              <b>está en el almacén</b>
            )}
          </span>
        </div>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{ maxHeight: '340px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thCentro, width: '90px' }}>Salió</th>
                <th style={th}>A cargo de</th>
                <th style={th}>Observaciones</th>
                <th style={{ ...thCentro, width: '90px' }}>Volvió</th>
                <th style={th}>Al devolver</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4" style={td}>
                    {cargando ? 'Cargando…' : 'Nunca salió del almacén'}
                  </td>
                </tr>
              ) : (
                asignaciones.map((a) => {
                  const afuera = !a.devolucion?.fecha
                  return (
                    <tr key={a._id}>
                      <td style={tdCentro}>{fecha(a.fecha)}</td>
                      <td style={{ ...td, fontWeight: afuera ? 700 : 400 }}>{a.persona}</td>
                      <td style={td}>{a.observaciones || <Raya />}</td>
                      {/* La que todavía no volvió es dónde está la herramienta
                          hoy, así que se dice con todas las letras. */}
                      <td style={{ ...tdCentro, color: afuera ? '#b45309' : '#15803d', fontWeight: 600 }}>
                        {afuera ? 'La tiene' : fecha(a.devolucion.fecha)}
                      </td>
                      <td style={td}>{a.devolucion?.observaciones || <Raya />}</td>
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
