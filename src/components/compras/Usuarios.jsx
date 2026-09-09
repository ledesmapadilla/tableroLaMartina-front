import { useState, useEffect } from 'react'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, campo, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion, Buscador } from './estilos'

const FORM_INIT = { nombre: '', usuario: '', password: '', rol: 'solicitante' }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const cargar = () => api.get('/usuarios').then(setUsuarios).catch(() => {})
  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => {
    setForm(FORM_INIT)
    setEditId(null)
    setShowModal(true)
  }

  const abrirEditar = (u) => {
    setForm({ nombre: u.nombre, usuario: u.usuario, password: u.password ?? '', rol: u.rol })
    setEditId(u._id)
    setShowModal(true)
  }

  const cerrar = () => {
    setForm(FORM_INIT)
    setEditId(null)
    setShowModal(false)
  }

  const guardar = async (e) => {
    e.preventDefault()
    const duplicadoUsuario = usuarios.some(u => u.usuario === form.usuario && u._id !== editId)
    if (duplicadoUsuario) {
      Swal.fire({ icon: 'warning', title: 'Usuario duplicado', text: 'Ya existe un usuario con ese nombre de usuario.' })
      return
    }
    const duplicadoNombre = usuarios.some(u => u.nombre.toLowerCase() === form.nombre.toLowerCase() && u._id !== editId)
    if (duplicadoNombre) {
      Swal.fire({ icon: 'warning', title: 'Nombre duplicado', text: 'Ya existe un usuario con ese nombre.' })
      return
    }
    try {
      if (editId) {
        const data = { nombre: form.nombre, usuario: form.usuario, rol: form.rol }
        if (form.password) data.password = form.password
        await api.put(`/usuarios/${editId}`, data)
      } else {
        await api.post('/usuarios', form)
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
      title: '¿Borrar usuario?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/usuarios/${id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const lista = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.usuario.toLowerCase().includes(busqueda.toLowerCase())
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
        style={{ maxWidth: '860px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
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
              <i className="bi bi-person-badge-fill"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: BORDO, fontSize: '1rem' }}>
                Usuarios
              </span>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                {lista.length} {lista.length === 1 ? 'usuario' : 'usuarios'}
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
            <span>Nuevo usuario</span>
          </Button>
        </div>

        {/* Buscador */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div style={{ width: '320px' }}>
            <Buscador
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar por nombre o usuario…"
            />
          </div>
        </Card>

        {/* Tabla de usuarios */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '620px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Usuario</th>
                <th style={th}>Contraseña</th>
                <th style={thCentro}>Rol</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4" style={td}>
                    {busqueda ? 'Ningún usuario coincide con la búsqueda' : 'No hay usuarios cargados'}
                  </td>
                </tr>
              ) : (
                lista.map((u) => (
                  <tr key={u._id}>
                    <td style={{ ...td, fontWeight: 500 }}>{u.nombre}</td>
                    <td style={td}>{u.usuario}</td>
                    <td style={td}>{u.password || <Raya />}</td>
                    <td style={tdCentro}>
                      <span className="badge" style={{ backgroundColor: '#334155', fontSize: '0.62rem' }}>
                        {u.rol}
                      </span>
                    </td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                        <BotonAccion icono="bi-pencil" titulo="Editar" variante="primary" onClick={() => abrirEditar(u)} />
                        <BotonAccion icono="bi-trash" titulo="Borrar" variante="danger" onClick={() => borrar(u._id)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar usuario */}
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
            <i className="bi bi-person-badge-fill" style={{ color: '#f59e0b' }}></i>
            <span>{editId ? 'Editar usuario' : 'Nuevo usuario'}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Nombre <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Usuario <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.usuario}
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  required
                />
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Contraseña {!editId && <span className="text-danger">*</span>}
                </Form.Label>
                <Form.Control
                  type="text"
                  className="rounded-3"
                  style={campo}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editId}
                  placeholder={editId ? 'Dejar vacío para no cambiar' : ''}
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Rol</Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={campo}
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                >
                  <option value="superadmin">Superadministrador</option>
                  <option value="solicitante">Solicitante</option>
                  <option value="analista">Analista</option>
                  <option value="comprador">Comprador</option>
                  <option value="gerente">Gerente</option>
                </Form.Select>
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
