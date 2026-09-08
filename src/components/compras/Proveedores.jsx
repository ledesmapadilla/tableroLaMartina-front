import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

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
    <div className="container py-4">
      <div className="w-75 mx-auto">

        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Proveedores</h4>
          <button className="btn btn-outline-dark" onClick={abrirNuevo}>
            + Nuevo proveedor
          </button>
        </div>

        <input
          className="form-control mb-3 w-50"
          placeholder="Buscar por razón social, contacto o rubro..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover table-striped mb-0">
              <thead className="table-light">
                <tr>
                  <th>Razón Social</th>
                  <th>Contacto</th>
                  <th>Rubro</th>
                  <th>CUIT</th>
                  <th>Teléfono</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p._id}>
                    <td>{p.razonsocial}</td>
                    <td>{p.contacto}</td>
                    <td>{p.rubro}</td>
                    <td>{p.cuit || '-'}</td>
                    <td>{p.telefono}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => abrirEditar(p)}>Editar</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => borrar(p._id)}>Borrar</button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-3">Sin resultados</td></tr>
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
                <h5 className="modal-title">{editId ? 'Editar proveedor' : 'Nuevo proveedor'}</h5>
                <button type="button" className="btn-close" onClick={cerrar} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Razón Social*</label>
                    <input className="form-control" value={form.razonsocial}
                      onChange={e => setForm({ ...form, razonsocial: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Contacto*</label>
                    <input className="form-control" value={form.contacto}
                      onChange={e => setForm({ ...form, contacto: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rubro*</label>
                    <input className="form-control" value={form.rubro}
                      onChange={e => setForm({ ...form, rubro: e.target.value })} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">CUIT</label>
                    <input className="form-control" value={form.cuit}
                      onChange={e => setForm({ ...form, cuit: e.target.value })}
                      placeholder="11 dígitos sin guiones" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Teléfono*</label>
                    <input className="form-control" value={form.telefono}
                      onChange={e => setForm({ ...form, telefono: e.target.value })} required />
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
