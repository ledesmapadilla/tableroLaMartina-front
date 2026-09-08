import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

const FORM_INIT = { cc: '', grupo: '', marca: '', observaciones: '' }

export default function CentrosCosto() {
  const navigate = useNavigate()
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

  const estiloX = {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    cursor: 'pointer', fontSize: 13, fontWeight: 900, color: 'var(--color-muted)',
    zIndex: 5, userSelect: 'none', lineHeight: 1,
  }

  const lista = centros
    .filter(c =>
      c.cc.toLowerCase().includes(filtroCc.toLowerCase()) &&
      c.grupo.toLowerCase().includes(filtroGrupo.toLowerCase()) &&
      c.marca.toLowerCase().includes(filtroMarca.toLowerCase())
    )
    .sort((a, b) => a.grupo.localeCompare(b.grupo))

  return (
    <div className="container py-4">
      <div className="w-75 mx-auto">

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>Altas</p>
            <div className="d-flex gap-2">
              <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
              <button className="btn btn-outline-dark btn-sm" onClick={abrirNuevo}>+ Nuevo CC</button>
            </div>
          </div>
          <h4 className="mb-0 text-center" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Centros de Costo (CC)</h4>
        </div>

        <div className="d-flex gap-2 mb-3">
          <div style={{ position: 'relative', width: '13%' }}>
            <input
              className="form-control form-control-sm"
              placeholder="CC"
              value={filtroCc}
              onChange={e => setFiltroCc(e.target.value)}
            />
            {filtroCc && <span onClick={() => setFiltroCc('')} style={estiloX}>✕</span>}
          </div>
          <div style={{ position: 'relative', width: '18%' }}>
            <select
              className="form-select form-select-sm"
              style={filtroGrupo ? { backgroundImage: 'none' } : {}}
              value={filtroGrupo}
              onChange={e => setFiltroGrupo(e.target.value)}
            >
              <option value="">Grupo</option>
              {grupos.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {filtroGrupo && <span onClick={() => setFiltroGrupo('')} style={estiloX}>✕</span>}
          </div>
          <div style={{ position: 'relative', width: '18%' }}>
            <input
              className="form-control form-control-sm"
              placeholder="Marca"
              value={filtroMarca}
              onChange={e => setFiltroMarca(e.target.value)}
            />
            {filtroMarca && <span onClick={() => setFiltroMarca('')} style={estiloX}>✕</span>}
          </div>
        </div>

        <div className="card">
          <div className="table-responsive" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <table className="table table-hover table-striped mb-0">
              <thead className="thead-blue" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th className="text-center">Centro de costo (CC)</th>
                  <th>Grupo</th>
                  <th>Marca</th>
                  <th>Observaciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(c => (
                  <tr key={c._id}>
                    <td className="text-center"><span className="badge bg-secondary" style={{ fontSize: '0.85rem' }}>{c.cc}</span></td>
                    <td>{c.grupo}</td>
                    <td>{c.marca}</td>
                    <td>{c.observaciones}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => abrirEditar(c)}>Editar</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => borrar(c._id)}>Borrar</button>
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
            <div className="modal-content" style={{ border: '1.5px solid var(--color-primary)' }}>
              <div className="modal-header" style={{ backgroundColor: 'var(--color-primary)' }}>
                <h5 className="modal-title" style={{ color: '#fff' }}>{editId ? 'Editar CC' : 'Nuevo CC'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrar} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Centro de costo (CC)*</label>
                    <input className="form-control" value={form.cc}
                      onChange={e => setForm({ ...form, cc: e.target.value.toUpperCase() })}
                      required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Grupo*</label>
                    <input className="form-control" value={form.grupo}
                      onChange={e => setForm({ ...form, grupo: e.target.value })}
                      required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Marca</label>
                    <input className="form-control" value={form.marca}
                      onChange={e => setForm({ ...form, marca: e.target.value })} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Observaciones</label>
                    <textarea className="form-control" rows={2} value={form.observaciones}
                      onChange={e => setForm({ ...form, observaciones: e.target.value })}
                       />
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
