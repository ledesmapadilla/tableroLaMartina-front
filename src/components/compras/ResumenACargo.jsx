import { Fragment } from 'react'
import { Modal, Table } from 'react-bootstrap'
import { Raya } from './estilos'

/**
 * Dónde está cada herramienta, todas juntas (22/09/2026).
 *
 * La tabla del rubro ya lo dice fila por fila, pero para salir a buscar una
 * hace falta verlo de corrido: primero las que están afuera, agrupadas por
 * quién las tiene, y abajo las que están en el almacén.
 *
 * No pide nada al servidor: sale de la misma lista que ya tiene la pantalla.
 */
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : null)

const nombreDe = (a) => a.descripcion || a.tipo || ''

// Ordena por texto sin distinguir mayúsculas ni acentos, como en el resto del
// Tablero.
const comparar = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })

export default function ResumenACargo({ abierto, articulos = [], color, acento, onCerrar }) {
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

  const afuera = articulos.filter((a) => a.aCargo?.persona)
  const enAlmacen = articulos.filter((a) => !a.aCargo?.persona)

  // Las que están afuera, juntas por persona y ordenadas por nombre: así se le
  // pide a uno solo todo lo que tiene.
  const porPersona = [...new Set(afuera.map((a) => a.aCargo.persona))]
    .sort(comparar)
    .map((persona) => ({
      persona,
      herramientas: afuera
        .filter((a) => a.aCargo.persona === persona)
        .sort((x, y) => comparar(nombreDe(x), nombreDe(y))),
    }))

  const ordenadas = [...enAlmacen].sort((x, y) => comparar(nombreDe(x), nombreDe(y)))

  // El renglón que separa cada grupo, con el nombre y cuántas tiene. Es una
  // función y no un componente: uno declarado acá adentro se rearma en cada
  // render y React lo trata como nuevo cada vez.
  const titulo = (texto, cuantas, fondo, letra) => (
    <tr>
      <td colSpan={4} style={{ ...td, backgroundColor: fondo, padding: '3px 6px' }}>
        <span className="fw-bold" style={{ fontSize: '0.72rem', color: letra }}>
          {texto}
        </span>
        <span className="ms-2" style={{ fontSize: '0.68rem', color: letra, opacity: 0.75 }}>
          {cuantas} {cuantas === 1 ? 'herramienta' : 'herramientas'}
        </span>
      </td>
    </tr>
  )

  const fila = (a, desde) => (
    <tr key={a._id}>
      <td style={{ ...tdCentro, fontWeight: 600, color }}>{a.codigo}</td>
      <td style={td}>{nombreDe(a)}</td>
      <td style={td}>{a.marca || <Raya />}</td>
      <td style={tdCentro}>{desde}</td>
    </tr>
  )

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
          <i className="bi bi-clipboard-check" style={{ color: acento }}></i>
          <span>Resumen · dónde está cada herramienta</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thCentro, width: '80px' }}>Código</th>
                <th style={th}>Herramienta</th>
                <th style={{ ...th, width: '130px' }}>Marca</th>
                <th style={{ ...thCentro, width: '90px' }}>Desde</th>
              </tr>
            </thead>
            <tbody>
              {articulos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4" style={td}>
                    No hay herramientas cargadas
                  </td>
                </tr>
              ) : (
                <>
                  {/* Primero las que están afuera: son las que hay que salir a
                      buscar. */}
                  {porPersona.map(({ persona, herramientas }) => (
                    <Fragment key={persona}>
                      {titulo(persona, herramientas.length, '#fdf0e4', '#b45309')}
                      {herramientas.map((a) => fila(a, fecha(a.aCargo.fecha)))}
                    </Fragment>
                  ))}

                  {enAlmacen.length > 0 && (
                    <>
                      {titulo('En el almacén', enAlmacen.length, '#f1f5f9', '#334155')}
                      {ordenadas.map((a) => fila(a, <Raya />))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  )
}
