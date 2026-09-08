import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

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
    <div className="container py-4">
      <div className="w-75 mx-auto">

        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Usuarios</h4>
          <button className="btn btn-outline-dark" onClick={abrirNuevo}>
            + Nuevo usuario
          </button>
        </div>

        <input
          className="form-control mb-3 w-50"
          placeholder="Buscar por nombre o usuario..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover table-striped mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Contraseña</th>
                  <th>Rol</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(u => (
                  <tr key={u._id}>
                    <td>{u.nombre}</td>
                    <td>{u.usuario}</td>
                    <td>{u.password}</td>
                    <td><span className="badge bg-secondary">{u.rol}</span></td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => abrirEditar(u)}>Editar</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => borrar(u._id)}>Borrar</button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-3">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? 'Editar usuario' : 'Nuevo usuario'}</h5>
                <button type="button" className="btn-close" onClick={cerrar} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nombre</label>
                    <input className="form-control" value={form.nombre}
                      onChange={e => setForm({ ...form, nombre: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Usuario</label>
                    <input className="form-control" value={form.usuario}
                      onChange={e => setForm({ ...form, usuario: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Contraseña</label>
                    <input type="text" className="form-control" value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      required={!editId}
                      placeholder={editId ? 'Dejar vacío para no cambiar' : ''} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rol</label>
                    <select className="form-select" value={form.rol}
                      onChange={e => setForm({ ...form, rol: e.target.value })}>
                      <option value="superadmin">Superadministrador</option>
                      <option value="solicitante">Solicitante</option>
                      <option value="analista">Analista</option>
                      <option value="comprador">Comprador</option>
                      <option value="gerente">Gerente</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={cerrar}>Cancelar</button>
                  <button type="submit" className="btn btn-outline-dark">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
