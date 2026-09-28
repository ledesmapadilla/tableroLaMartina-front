import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { Raya, BotonAccion, BotonLimpiar, BotonVolver, Buscador } from './estilos'
import { A, litros, normalizar } from './aceites'

/**
 * El alta de aceites (28/09/2026).
 *
 * Copiada de Altas › Aceites del Sistema de Gestión Lepa: los mismos cuatro
 * campos —tipo, marca, denominación comercial y uso— y la misma tabla. Se le
 * sumó la columna de lo que hay, que allá estaba solo en la pantalla de
 * movimientos. Se llega desde el botón "Alta de aceites" de esa pantalla.
 */
const VACIO = { tipo: '', marca: '', denominacion: '', uso: '' }

const COLUMNAS = 6

export default function StockAceitesAlta() {
  const th = {
    backgroundColor: A.color,
    color: '#fff',
    fontSize: '0.66rem',
    fontWeight: 600,
    verticalAlign: 'middle',
    padding: '3px 5px',
    whiteSpace: 'nowrap',
  }
  const thCentro = { ...th, textAlign: 'center' }
  const td = { fontSize: '0.7rem', padding: '1px 5px', verticalAlign: 'middle' }
  const tdCentro = { ...td, textAlign: 'center' }

  const { puede } = usePermisos()
  const sinEditar = !puede('compras.stock', 'editar')

  const [aceites, setAceites] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: VACIO })

  // Con .then y no con async/await: así el compilador de React ve que el
  // estado se toca en la respuesta y no adentro del efecto que la pide.
  const cargar = () =>
    api
      .get(A.API)
      .then((data) => setAceites(Array.isArray(data) ? data : []))
      .catch((error) =>
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudieron traer los aceites' })
      )
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const busq = normalizar(busqueda.trim())
  const lista = aceites.filter((a) =>
    [a.tipo, a.marca, a.denominacion, a.uso].some((v) => normalizar(v).includes(busq))
  )

  const abrirNuevo = () => {
    setEditando(null)
    reset(VACIO)
    setShowModal(true)
  }

  const abrirEditar = (a) => {
    setEditando(a)
    reset({ tipo: a.tipo || '', marca: a.marca || '', denominacion: a.denominacion || '', uso: a.uso || '' })
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
  }

  const onSubmit = async (datos) => {
    setGuardando(true)
    try {
      if (editando) await api.put(`${A.API}/${editando._id}`, datos)
      else await api.post(A.API, datos)
      cerrarModal()
      cargar()
      Swal.fire({
        icon: 'success',
        title: editando ? 'Aceite actualizado' : 'Aceite registrado',
        timer: 1200,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo guardar' })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (a) => {
    const resultado = await Swal.fire({
      title: '¿Eliminar aceite?',
      text: `Se quitará ${[a.tipo, a.marca].join(' · ')} junto con todas sus compras y consumos`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) return
    try {
      await api.delete(`${A.API}/${a._id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Aceite eliminado', timer: 1200, showConfirmButton: false })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo eliminar' })
    }
  }

  // Un campo del formulario, con su rótulo y su error. `requerido` es el
  // mensaje que sale si queda vacío.
  const campo = (nombre, rotulo, { requerido, placeholder, md = 12 } = {}) => (
    <Col md={md}>
      <Form.Label className="fw-semibold text-dark small mb-1">
        {rotulo} {requerido && <span className="text-danger">*</span>}
      </Form.Label>
      <Form.Control
        className="rounded-3"
        placeholder={placeholder}
        style={{ fontSize: '0.85rem' }}
        {...register(nombre, requerido ? { required: requerido } : {})}
        isInvalid={!!errors[nombre]}
      />
      <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
        {errors[nombre]?.message}
      </Form.Control.Feedback>
    </Col>
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
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1000px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado, con su Volver como en el Sistema de Gestión. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <BotonVolver />
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: '34px',
              height: '34px',
              backgroundColor: A.acento,
              color: '#fff',
              fontSize: '1.05rem',
              boxShadow: `0 2px 8px ${A.acento}55`,
            }}
          >
            <i className={A.icono}></i>
          </div>
          <span className="fw-bold" style={{ color: A.color, fontSize: '1.05rem' }}>
            Alta de aceites
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: A.colorSuave, color: A.color, fontWeight: 600 }}
          >
            {lista.length} {lista.length === 1 ? 'aceite' : 'aceites'}
          </span>

          <Button
            size="sm"
            onClick={abrirNuevo}
            disabled={sinEditar}
            className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm ms-auto"
            style={{ backgroundColor: A.color, borderColor: A.color, fontSize: '0.82rem', fontWeight: 600 }}
            title={sinEditar ? 'Sin permiso para editar' : 'Cargar un aceite'}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo aceite</span>
          </Button>
        </div>

        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <div className="d-flex flex-column" style={{ width: '380px', maxWidth: '100%' }}>
              <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
                Buscar
              </span>
              <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Tipo, marca, denominación, uso…" />
            </div>
            {busqueda && <BotonLimpiar onClick={() => setBusqueda('')} />}
          </div>
        </Card>

        {/* La tabla va del ancho del encabezado y del buscador, no del de su
            contenido, así quedan alineados. Si la pantalla es angosta, el
            scroll queda adentro del marco. */}
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: '0 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '760px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={th}>Tipo de aceite</th>
                <th style={th}>Marca</th>
                <th style={th}>Denominación comercial</th>
                <th style={th}>Uso</th>
                <th style={thCentro}>Existencia</th>
                <th style={{ ...thCentro, width: '80px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : busqueda
                        ? 'Ningún aceite coincide con la búsqueda'
                        : 'No hay aceites cargados'}
                  </td>
                </tr>
              ) : (
                lista.map((a) => (
                  <tr key={a._id}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.tipo}</td>
                    <td style={td}>{a.marca || <Raya />}</td>
                    <td style={td}>{a.denominacion || <Raya />}</td>
                    <td style={td}>{a.uso || <Raya />}</td>
                    <td style={{ ...tdCentro, whiteSpace: 'nowrap' }}>{litros(a.existencia)} L</td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center gap-2">
                        <BotonAccion
                          icono="bi-pencil"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Editar'}
                          variante="primary"
                          deshabilitado={sinEditar}
                          onClick={() => abrirEditar(a)}
                        />
                        <BotonAccion
                          icono="bi-trash"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Eliminar'}
                          variante="danger"
                          deshabilitado={sinEditar}
                          onClick={() => eliminar(a)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: A.color,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className={A.icono} style={{ color: '#fde047' }}></i>
            <span>{editando ? 'Editar aceite' : 'Nuevo aceite'}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              {campo('tipo', 'Tipo de aceite', {
                requerido: 'El tipo es requerido',
                placeholder: 'Motor, Hidráulico, Grasa…',
                md: 6,
              })}
              {campo('marca', 'Marca', { requerido: 'La marca es requerida', placeholder: 'Shell, YPF, Total…', md: 6 })}
              {campo('denominacion', 'Denominación comercial', { placeholder: 'Rimula R4 15W40' })}
              {campo('uso', 'Uso', { requerido: 'El uso es requerido', placeholder: 'Motor de maquinaria pesada' })}
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarModal}
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
              style={{ backgroundColor: A.color, borderColor: A.color, fontSize: '0.84rem', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>{guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Guardar'}</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
