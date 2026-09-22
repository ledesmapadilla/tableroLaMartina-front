import { Modal, Table } from 'react-bootstrap'
import { Raya, BotonAccion } from './estilos'

/**
 * Las entradas y salidas de un artículo del almacén (22/09/2026).
 *
 * Sirve para cualquier rubro: lo único que cambia entre uno y otro es el color
 * (adentro del almacén cada rubro lleva el suyo), así que viene por props.
 * Nació con Filtros y lo reusa Cubiertas y correas.
 *
 * Va en un modal y no en un cartel de SweetAlert como el detalle de un pedido:
 * cada fila se puede corregir o borrar, y eso pide botones de verdad.
 *
 * No trae los datos ni los guarda: la pantalla del rubro es la que sabe mover
 * el saldo, así que acá solo se avisa qué fila se tocó.
 */
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : null)

export default function MovimientosStock({
  abierto,
  articulo,
  movimientos = [],
  cargando = false,
  color,
  acento,
  sinEditar,
  onEditar,
  onBorrar,
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
          <i className="bi bi-arrow-left-right" style={{ color: acento }}></i>
          <span>
            Movimientos · {articulo?.codigo}
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {/* De qué artículo se trata y cuánto hay hoy. */}
        <div className="mb-2" style={{ fontSize: '0.8rem', color: '#334155' }}>
          {/* Cómo se nombra el artículo depende del rubro: Filtros elige el
              tipo de una lista y Cubiertas escribe la descripción a mano. */}
          <span className="fw-bold" style={{ color }}>
            {articulo?.descripcion || articulo?.tipo}
          </span>
          {articulo?.marca ? ` · ${articulo.marca}` : ''}
          {articulo?.codigoFabrica ? ` · ${articulo.codigoFabrica}` : ''}
          <span className="ms-2">
            — en el depósito hay <b>{articulo?.existencia ?? 0}</b>
          </span>
        </div>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{ maxHeight: '340px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thCentro, width: '90px' }}>Fecha</th>
                <th style={{ ...thCentro, width: '90px' }}>Movimiento</th>
                <th style={th}>Quién</th>
                <th style={{ ...thCentro, width: '110px' }}>Grupo</th>
                <th style={{ ...thCentro, width: '80px' }}>C.C.</th>
                <th style={{ ...thCentro, width: '60px' }}>Cant.</th>
                <th style={th}>Observaciones</th>
                <th style={{ ...thCentro, width: '80px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : 'Todavía no se cargó ninguna entrada ni salida'}
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => {
                  const entrada = m.movimiento === 'Entrada'
                  return (
                    <tr key={m._id}>
                      <td style={tdCentro}>{fecha(m.fecha)}</td>
                      <td style={{ ...tdCentro, color: entrada ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                        {m.movimiento}
                      </td>
                      <td style={td}>{m.persona || <Raya />}</td>
                      {/* Una entrada no tiene destino: va al depósito y
                          todavía no es de nadie. Una salida a Berdina va al
                          taller, así que tiene grupo pero no C.C. */}
                      <td style={tdCentro}>{entrada ? <Raya /> : m.grupo || <Raya />}</td>
                      <td style={tdCentro}>{entrada ? <Raya /> : m.cc || <Raya />}</td>
                      <td style={{ ...tdCentro, color: entrada ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                        {entrada ? '+' : '−'}
                        {m.cantidad}
                      </td>
                      <td style={td}>{m.observaciones || <Raya />}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center gap-2">
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Corregir'}
                            variante="primary"
                            deshabilitado={sinEditar}
                            onClick={() => onEditar(m)}
                          />
                          <BotonAccion
                            icono="bi-trash"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Borrar'}
                            variante="danger"
                            deshabilitado={sinEditar}
                            onClick={() => onBorrar(m)}
                          />
                        </div>
                      </td>
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
