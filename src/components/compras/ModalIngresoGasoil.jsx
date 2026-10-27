import { useEffect, useState } from 'react'
import { Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import SelectBuscador from '../shared/SelectBuscador'
import { hoy } from './aceites'
import { API_GASOIL, TIPOS_GASOIL, conTipos, tiposDeCampo } from './camposGasoil'

/**
 * Cargar o corregir un ingreso de gasoil de un campo (20/10/2026): fecha,
 * litros, quién carga, proveedor, N° remito/ticket y observaciones. En San
 * Pablo, además, a qué tanque entra: Común o Infinia (27/10/2026).
 *
 * Lo usan la planilla de Gasoil (GasoilPlanilla.jsx) y el botón "Carga
 * gasoil" de la certificación de Producción (ProduccionCertificadoMes.jsx).
 * Se monta solo mientras está abierto: `ingreso` es 'nuevo' o el ingreso que
 * se corrige, y el formulario arranca de ahí.
 */
const AZUL = '#1d4ed8'
const campoForm = { fontSize: '0.85rem' }

const unicos = (valores) => [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b))

// `tipoInicial`: el tanque con que arranca un ingreso nuevo. En San Pablo
// arranca sin elegir, así no se carga en el Común sin querer.
const datosDe = (ingreso, tipoInicial) =>
  ingreso === 'nuevo'
    ? { fecha: hoy(), tipo: tipoInicial, proveedor: '', remito: '', litros: '', quienCarga: '', observaciones: '' }
    : {
        fecha: String(ingreso.fecha || '').slice(0, 10),
        tipo: ingreso.tipo || 'comun',
        proveedor: ingreso.proveedor || '',
        remito: ingreso.remito || '',
        litros: ingreso.litros ?? '',
        quienCarga: ingreso.quienCarga || '',
        observaciones: ingreso.observaciones || '',
      }

export default function ModalIngresoGasoil({ ingreso, campo, onCerrar, onGuardado }) {
  const eligeTipo = conTipos(campo.id)
  const [datos, setDatos] = useState(() => datosDe(ingreso, eligeTipo ? '' : 'comun'))
  const [guardando, setGuardando] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [nombres, setNombres] = useState([])

  // El padrón de proveedores y los que ya cargaron gasoil en el campo (para
  // sugerir en "Quién carga"): se piden al abrir.
  useEffect(() => {
    api
      .get('/proveedores')
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => setProveedores([]))
    api
      .get(`${API_GASOIL}/ingresos?campo=${campo.id}`)
      .then((data) => setNombres(unicos((Array.isArray(data) ? data : []).map((i) => i.quienCarga))))
      .catch(() => setNombres([]))
  }, [campo.id])

  const setCampo = (k, v) => setDatos((d) => ({ ...d, [k]: v }))
  const opcionesProveedor = unicos(proveedores.map((p) => p.razonsocial)).map((p) => ({ valor: p, texto: p }))
  const opcionesQuien = nombres.map((q) => ({ valor: q, texto: q }))

  const guardar = async (e) => {
    e.preventDefault()
    if (!datos.fecha || !(Number(datos.litros) > 0)) {
      Swal.fire({ icon: 'error', title: 'Faltan datos', text: 'La fecha y los litros son obligatorios.', width: '300px' })
      return
    }
    if (!datos.tipo) {
      Swal.fire({ icon: 'error', title: 'Faltan datos', text: 'Elegí si es gasoil Común o Infinia.', width: '300px' })
      return
    }
    setGuardando(true)
    try {
      if (ingreso === 'nuevo') await api.post(`${API_GASOIL}/ingresos`, { ...datos, campo: campo.id })
      else await api.put(`${API_GASOIL}/ingresos/${ingreso._id}`, datos)
      onGuardado?.()
      onCerrar()
      Swal.fire({ icon: 'success', title: 'Ingreso guardado', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message, width: '300px' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal show onHide={onCerrar} centered contentClassName="border-0 shadow-lg rounded-4">
      <Modal.Header
        closeButton
        closeVariant="white"
        style={{ backgroundColor: AZUL, color: '#fff', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
      >
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
          <i className="bi bi-box-arrow-in-down"></i>
          <span>
            {ingreso === 'nuevo' ? 'Cargar ingreso de gasoil' : 'Editar ingreso de gasoil'} · {campo.titulo}
          </span>
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={guardar}>
        <Modal.Body className="p-3 p-md-4">
          <Row className="g-3">
            {/* El tanque, arriba y a la vista: Común o Infinia. */}
            {eligeTipo && (
              <Col xs={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Gasoil <span className="text-danger">*</span>
                </Form.Label>
                <div className="d-flex gap-2">
                  {tiposDeCampo(campo.id).map((t) => {
                    const elegido = datos.tipo === t
                    return (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        onClick={() => setCampo('tipo', t)}
                        className="rounded-3 px-3 d-flex align-items-center gap-1"
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          minWidth: '110px',
                          justifyContent: 'center',
                          backgroundColor: elegido ? campo.color : '#fff',
                          borderColor: campo.color,
                          color: elegido ? '#fff' : campo.color,
                        }}
                      >
                        {elegido && <i className="bi bi-check-lg"></i>}
                        <span>{TIPOS_GASOIL[t]}</span>
                      </Button>
                    )
                  })}
                </div>
              </Col>
            )}
            <Col xs={6} md={4}>
              <Form.Label className="fw-semibold text-dark small mb-1">Fecha</Form.Label>
              <Form.Control
                type="date"
                value={datos.fecha}
                onChange={(e) => setCampo('fecha', e.target.value)}
                className="rounded-3"
                style={campoForm}
                required
              />
            </Col>
            <Col xs={6} md={4}>
              <Form.Label className="fw-semibold text-dark small mb-1">Litros</Form.Label>
              <Form.Control
                type="number"
                min="0.01"
                step="any"
                value={datos.litros}
                onChange={(e) => setCampo('litros', e.target.value)}
                className="rounded-3"
                style={campoForm}
                required
              />
            </Col>
            <Col xs={12} md={4}>
              <Form.Label className="fw-semibold text-dark small mb-1">Quién carga</Form.Label>
              {/* Texto libre, con los nombres que ya se usaron. */}
              <SelectBuscador
                opciones={opcionesQuien}
                valor={datos.quienCarga}
                onChange={(v) => setCampo('quienCarga', v)}
                libre
                vacio={null}
                placeholder="Nombre…"
                className="rounded-3"
                style={campoForm}
              />
            </Col>
            <Col xs={12} md={8}>
              <Form.Label className="fw-semibold text-dark small mb-1">Proveedor</Form.Label>
              <SelectBuscador
                opciones={opcionesProveedor}
                valor={datos.proveedor}
                onChange={(v) => setCampo('proveedor', v)}
                vacio="Sin proveedor"
                placeholder="Buscar proveedor…"
                className="rounded-3"
                style={campoForm}
              />
            </Col>
            <Col xs={12} md={4}>
              <Form.Label className="fw-semibold text-dark small mb-1">N° remito/ticket</Form.Label>
              <Form.Control
                maxLength={40}
                value={datos.remito}
                onChange={(e) => setCampo('remito', e.target.value)}
                className="rounded-3"
                style={campoForm}
              />
            </Col>
            <Col xs={12}>
              <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                maxLength={300}
                value={datos.observaciones}
                onChange={(e) => setCampo('observaciones', e.target.value)}
                className="rounded-3"
                style={campoForm}
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer
          className="bg-light border-0 py-2 px-4"
          style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
        >
          <Button variant="outline-secondary" size="sm" onClick={onCerrar} className="rounded-3 px-3" style={{ fontSize: '0.84rem' }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={guardando}
            className="rounded-3 px-3 shadow-sm"
            style={{ fontSize: '0.84rem', backgroundColor: AZUL, borderColor: AZUL }}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
