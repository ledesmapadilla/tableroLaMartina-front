import { useState, useEffect } from 'react'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, campo, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion, BotonLimpiar, FiltroTexto, FiltroSelect } from './estilos'

const FORM_INIT = { cc: '', grupo: '', marca: '', observaciones: '' }

export default function CentrosCosto() {
  const [centros, setCentros] = useState([])
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filtroCc, setFiltroCc] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')

  const cargar = () => api.get('/centros-costo').then(setCentros).catch(() => {})
  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => { setForm(FORM_INIT); setEditId(null); setShowModal(true) }
  const abrirEditar = (c) => {
    setForm({ cc: c.cc, grupo: c.grupo, marca: c.marca, observaciones: c.observaciones || '' })
    setEditId(c._id)
    setShowModal(true)
  }
  const cerrar = () => { setForm(FORM_INIT); setEditId(null); setShowModal(false) }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      if (editId) await api.put(`/centros-costo/${editId}`, form)
      else        await api.post('/centros-costo', form)
      cargar(); cerrar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const borrar = async (id) => {
    const result = await Swal.fire({
      title: '¿Borrar centro de costo?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/centros-costo/${id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const grupos = [...new Set(centros.map(c => c.grupo))].sort()

  const lista = centros
    .filter(c =>
      c.cc.toLowerCase().includes(filtroCc.toLowerCase()) &&
      c.grupo.toLowerCase().includes(filtroGrupo.toLowerCase()) &&
      c.marca.toLowerCase().includes(filtroMarca.toLowerCase())
    )
    .sort((a, b) => a.grupo.localeCompare(b.grupo))

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
              <i className="bi bi-diagram-3-fill"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: BORDO, fontSize: '1rem' }}>
                Centros de costo
              </span>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                {lista.length} {lista.length === 1 ? 'centro' : 'centros'}
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
            <span>Nuevo CC</span>
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-nowrap" style={{ overflowX: 'auto' }}>
            <FiltroTexto etiqueta="CC" ancho="110px" valor={filtroCc} onChange={setFiltroCc} placeholder="CC" />
            <FiltroSelect etiqueta="Grupo" ancho="180px" valor={filtroGrupo} vacio="Todos" onChange={setFiltroGrupo} opciones={grupos} />
            <FiltroTexto etiqueta="Marca" ancho="180px" valor={filtroMarca} onChange={setFiltroMarca} placeholder="Marca" />

            {(filtroCc || filtroGrupo || filtroMarca) && (
              <BotonLimpiar
                onClick={() => {
                  setFiltroCc('')
                  setFiltroGrupo('')
                  setFiltroMarca('')
                }}
              />
            )}
          </div>
        </Card>

        {/* Tabla de centros de costo */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '720px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Centro de costo (CC)</th>
                <th style={th}>Grupo</th>
                <th style={th}>Marca</th>
                <th style={th}>Observaciones</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4" style={td}>
                    {filtroCc || filtroGrupo || filtroMarca
                      ? 'Ningún centro de costo coincide con los filtros'
                      : 'No hay centros de costo cargados'}
                  </td>
                </tr>
              ) : (
                lista.map((c) => (
                  <tr key={c._id}>
                    <td style={tdCentro}>
                      <span className="badge" style={{ backgroundColor: BORDO, fontSize: '0.68rem' }}>
                        {c.cc}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 500 }}>{c.grupo || <Raya />}</td>
                    <td style={td}>{c.marca || <Raya />}</td>
                    <td style={td}>{c.observaciones || <Raya />}</td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                        <BotonAccion icono="bi-pencil" titulo="Editar" variante="primary" onClick={() => abrirEditar(c)} />
                        <BotonAccion icono="bi-trash" titulo="Borrar" variante="danger" onClick={() => borrar(c._id)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Modal Nuevo / Editar CC. Más angosto que el de Bootstrap: los campos
          son pocos y cortos, igual que el de Producción. */}
      <Modal show={showModal} onHide={cerrar} centered dialogClassName="modal-cc" contentClassName="border-0 shadow-lg rounded-4">
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
            <i className="bi bi-diagram-3-fill" style={{ color: '#f59e0b' }}></i>
            <span>{editId ? 'Editar CC' : 'Nuevo CC'}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Centro de costo (CC) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.cc}
                  onChange={(e) => setForm({ ...form, cc: e.target.value.toUpperCase() })}
                  required
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Grupo <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.grupo}
                  onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                  required
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Marca</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  style={campo}
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
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
