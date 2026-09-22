import { useEffect, useState } from 'react'
import { Button, Form, Modal, Row, Col } from 'react-bootstrap'
import { api } from '../../services/api'
import SelectBuscador from '../shared/SelectBuscador'
import { compararCC } from '../../utils/ordenCC'
import { GRUPOS_PEDIDO } from '../../utils/equipos'

/**
 * Cargar una entrada o una salida (22/09/2026).
 *
 * Casi los mismos campos para las dos: la entrada no lleva C.C. —va al
 * depósito, todavía no es de nadie— y "quién" se lee distinto, el que retira en
 * una salida y el que entrega en una entrada.
 *
 * Lo usan la pantalla del rubro y el catálogo general; el color viene por
 * props, que es lo único que cambia entre una y otra. La lógica de mover el
 * saldo está en `useMovimientos`.
 *
 * El padrón de centros de costo se pide desde acá: hace falta para este
 * formulario y para nada más, así que no lo tiene que traer cada pantalla.
 */
// Lo que sale puede ir al taller en vez de a un equipo: ahí no hay CC. Va como
// un grupo más, igual que "Taller" o "Stock" en los pedidos de Compras.
const BERDINA = 'Berdina'

// Cómo se nombra el artículo: los rubros que eligen de una lista lo guardan en
// `tipo` y los que escriben a mano, en `descripcion`.
const nombreDe = (a) => a?.descripcion || a?.tipo || ''

export default function ModalMovimiento({
  mov,
  datos,
  guardando,
  color,
  colorSuave,
  onCampo,
  onGrupo,
  onGuardar,
  onCerrar,
}) {
  const [centrosCosto, setCentrosCosto] = useState([])

  useEffect(() => {
    api
      .get('/centros-costo')
      .then((data) => setCentrosCosto(Array.isArray(data) ? data : []))
      .catch(() => setCentrosCosto([]))
  }, [])

  // Los grupos que ofrece la salida: los que de verdad tienen algún CC en el
  // padrón —ofrecer uno vacío es mandar a una lista sin opciones—, en el orden
  // de Compras, y Berdina arriba de todo.
  const opcionesGrupo = [
    { valor: BERDINA, texto: `${BERDINA} (va al taller, sin C.C.)`, destacada: true },
    ...GRUPOS_PEDIDO.filter((g) => centrosCosto.some((c) => c.grupo === g)).map((g) => ({
      valor: g,
      texto: g,
    })),
  ]

  // Los CC del grupo elegido, en el orden del padrón (los numéricos primero y
  // en orden numérico) y con la marca al lado, que es como se los reconoce.
  const opcionesCC = centrosCosto
    .filter((c) => c.grupo === datos.grupo)
    .sort((a, b) => compararCC(a.cc, b.cc))
    .map((c) => ({
      valor: c.cc,
      texto: [c.cc, c.marca || c.descripcion].filter(Boolean).join(' — '),
    }))

  const entrada = mov?.movimiento === 'Entrada'
  const fondo = entrada ? '#15803d' : '#9d2235'

  return (
    <Modal show={!!mov} onHide={onCerrar} centered contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{
          backgroundColor: fondo,
          color: '#fff',
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className={`bi ${entrada ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up'}`}></i>
          <span>
            {mov?.editando ? 'Corregir ' : ''}
            {entrada ? 'Entrada' : 'Salida'} · {mov?.articulo.codigo}
          </span>
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={onGuardar}>
        <Modal.Body className="p-4">
          {/* De qué artículo se trata y cuánto hay hoy: el que carga la salida
              necesita ver el saldo antes de escribir la cantidad. */}
          <div
            className="rounded-3 px-3 py-2 mb-3"
            style={{ backgroundColor: colorSuave, fontSize: '0.8rem', color }}
          >
            <span className="fw-bold">{nombreDe(mov?.articulo)}</span>
            {mov?.articulo.marca ? ` · ${mov.articulo.marca}` : ''}
            {mov?.articulo.codigoFabrica ? ` · ${mov.articulo.codigoFabrica}` : ''}
            <span className="ms-2">
              — en el depósito hay <b>{mov?.articulo.existencia ?? 0}</b>
            </span>
          </div>

          <Row className="g-3">
            <Col md={6}>
              <Form.Label className="fw-semibold text-dark small mb-1">
                Fecha <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                required
                className="rounded-3"
                style={{ fontSize: '0.85rem' }}
                value={datos.fecha}
                onChange={(e) => onCampo('fecha', e.target.value)}
              />
            </Col>

            <Col md={6}>
              <Form.Label className="fw-semibold text-dark small mb-1">
                Cantidad <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={
                  // Al corregir no se topea: lo que ya se había sacado vuelve
                  // al saldo, y de que alcance se encarga el servidor.
                  !entrada && !mov?.editando ? (mov?.articulo.existencia ?? 0) : undefined
                }
                required
                className="rounded-3"
                style={{ fontSize: '0.85rem' }}
                value={datos.cantidad}
                onChange={(e) => onCampo('cantidad', e.target.value)}
              />
            </Col>

            <Col md={12}>
              <Form.Label className="fw-semibold text-dark small mb-1">
                {entrada ? 'Quién entrega' : 'Quién retira'}
              </Form.Label>
              <Form.Control
                className="rounded-3"
                style={{ fontSize: '0.85rem' }}
                value={datos.persona}
                onChange={(e) => onCampo('persona', e.target.value)}
              />
            </Col>

            {/* A dónde va, y solo en las salidas: lo que entra queda en el
                depósito y todavía no se le imputa a nadie.

                Primero el grupo y después el C.C.: los centros de costo son
                muchos y elegir el grupo deja a la vista nada más que los de
                esa clase de equipo. Si va a Berdina no hay C.C. que elegir. */}
            {mov?.movimiento === 'Salida' && (
              <>
                <Col md={6}>
                  <Form.Label className="fw-semibold text-dark small mb-1">Grupo</Form.Label>
                  <SelectBuscador
                    opciones={opcionesGrupo}
                    valor={datos.grupo}
                    onChange={onGrupo}
                    vacio="Elegir…"
                    placeholder="Tractores, Camioneta…"
                    className="rounded-3"
                    style={{ fontSize: '0.85rem' }}
                  />
                </Col>

                <Col md={6}>
                  <Form.Label className="fw-semibold text-dark small mb-1">C.C.</Form.Label>
                  {datos.grupo === BERDINA ? (
                    <Form.Control
                      readOnly
                      value="Va a Berdina"
                      className="rounded-3"
                      style={{ fontSize: '0.85rem', backgroundColor: '#f1f5f9', cursor: 'default' }}
                    />
                  ) : (
                    <SelectBuscador
                      opciones={opcionesCC}
                      valor={datos.cc}
                      onChange={(v) => onCampo('cc', v)}
                      vacio="Sin C.C."
                      disabled={!datos.grupo}
                      placeholder={datos.grupo ? 'Buscar por número o marca…' : 'Elegí el grupo primero'}
                      className="rounded-3"
                      style={{ fontSize: '0.85rem' }}
                    />
                  )}
                </Col>
              </>
            )}

            <Col md={12}>
              <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                className="rounded-3"
                style={{ fontSize: '0.85rem' }}
                value={datos.observaciones}
                onChange={(e) => onCampo('observaciones', e.target.value)}
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
        >
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onCerrar}
            className="rounded-3 px-3 py-1"
            style={{ fontSize: '0.84rem' }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={guardando}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{
              backgroundColor: fondo,
              borderColor: fondo,
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            <i className="bi bi-check-lg"></i>
            <span>{guardando ? 'Guardando…' : 'Registrar'}</span>
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
