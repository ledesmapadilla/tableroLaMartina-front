import { useState, useEffect } from 'react'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, campo, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion, Buscador } from './estilos'

const FORM_INIT = { razonsocial: '', contacto: '', rubro: '', cuit: '', email: '', telefono: '' }

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const cargar = () => api.get('/proveedores').then(setProveedores).catch(() => {})
  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => {
    setForm(FORM_INIT)
    setEditId(null)
    setShowModal(true)
  }

  const abrirEditar = (p) => {
    setForm({ razonsocial: p.razonsocial, contacto: p.contacto, rubro: p.rubro, cuit: p.cuit || '', email: p.email || '', telefono: p.telefono })
    setEditId(p._id)
    setShowModal(true)
  }

  const cerrar = () => {
    setForm(FORM_INIT)
    setEditId(null)
    setShowModal(false)
  }

  const guardar = async (e) => {
    e.preventDefault()
    const duplicadoRazon = proveedores.some(p => p.razonsocial.toLowerCase().trim() === form.razonsocial.toLowerCase().trim() && p._id !== editId)
    if (duplicadoRazon) {
      Swal.fire({ icon: 'warning', title: 'Razón social duplicada', text: 'Ya existe un proveedor con esa razón social.' })
      return
    }
    const duplicadoTel = proveedores.some(p => p.telefono?.trim() === form.telefono?.trim() && p._id !== editId)
    if (duplicadoTel) {
      Swal.fire({ icon: 'warning', title: 'Teléfono duplicado', text: 'Ya existe un proveedor con ese teléfono.' })
      return
    }
    if (form.cuit && !/^[0-9]{11}$/.test(form.cuit)) {
      Swal.fire({ icon: 'warning', title: 'CUIT inválido', text: 'El CUIT debe tener 11 dígitos numéricos.' })
      return
    }
    try {
      if (editId) {
        await api.put(`/proveedores/${editId}`, form)
      } else {
        await api.post('/proveedores', form)
      }
      cargar()
      cerrar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const borrar = async (id) => {
    const result = await Swal.fire({
      title: '¿Borrar proveedor?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/proveedores/${id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const lista = proveedores.filter(p =>
    p.razonsocial.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.contacto.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rubro.toLowerCase().includes(busqueda.toLowerCase())
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
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: '34px',
                height: '34px',
                backgroundColor: '#f59e0b',
                color: '#fff',
                fontSize: '1.1rem',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              <i className="bi bi-truck"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: BORDO, fontSize: '1rem' }}>
                Proveedores
              </span>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                {lista.length} {lista.length === 1 ? 'proveedor' : 'proveedores'}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={abrirNuevo}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-2"
            style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.82rem', fontWeight: 600 }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo proveedor</span>
          </Button>
        </div>

        {/* Buscador */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div style={{ width: '340px' }}>
            <Buscador
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar por razón social, contacto o rubro…"
            />
          </div>
        </Card>

        {/* Tabla de proveedores */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '760px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={th}>Razón social</th>
                <th style={th}>Contacto</th>
                <th style={th}>Rubro</th>
                <th style={thCentro}>CUIT</th>
                <th style={thCentro}>Teléfono</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    {busqueda ? 'Ningún proveedor coincide con la búsqueda' : 'No hay proveedores cargados'}
                  </td>
                </tr>
              ) : (
                lista.map((p) => (
                  <tr key={p._id}>
                    <td style={{ ...td, fontWeight: 500 }}>{p.razonsocial}</td>
                    <td style={td}>{p.contacto || <Raya />}</td>
                    <td style={td}>{p.rubro || <Raya />}</td>
                    <td style={tdCentro}>{p.cuit || <Raya />}</td>
                    <td style={tdCentro}>{p.telefono || <Raya />}</td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                        <BotonAccion icono="bi-pencil" titulo="Editar" variante="primary" onClick={() => abrirEditar(p)} />
                        <BotonAccion icono="bi-trash" titulo="Borrar" variante="danger" onClick={() => borrar(p._id)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar proveedor */}
      <Modal show={showModal} onHide={cerrar} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: BORDO,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-truck" style={{ color: '#f59e0b' }}></i>
            <span>{editId ? 'Editar proveedor' : 'Nuevo proveedor'}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Razón social <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.razonsocial}
                  onChange={(e) => setForm({ ...form, razonsocial: e.target.value })}
                  required
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Contacto <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  required
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Rubro <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.rubro}
                  onChange={(e) => setForm({ ...form, rubro: e.target.value })}
                  required
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">CUIT</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.cuit}
                  onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                  placeholder="11 dígitos sin guiones"
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Teléfono <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  required
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Email</Form.Label>
                <Form.Control
                  type="email"
                  className="rounded-3"
                  style={campo}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              onClick={cerrar}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
