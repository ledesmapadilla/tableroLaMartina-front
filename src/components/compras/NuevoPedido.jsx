import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

const URGENCIAS     = ['Baja', 'Media', 'Alta', 'Crítica']
const GRUPOS_SIN_CC = ['Herreria', 'Gomeria', 'Stock', 'Otros']

const getNombreUsuario = () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) return ''
    return JSON.parse(atob(token.split('.')[1])).nombre || ''
  } catch { return '' }
}

const ITEM_INIT = { nombre_repuesto: '', cant: '', unidad: '', descripcion: '', urgencia: 'Media', grupo: '', cc: '', estado: 'Para analisis' }

export default function NuevoPedido() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [itemForm, setItemForm] = useState(ITEM_INIT)
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [centrosCosto, setCentrosCosto] = useState([])
  const [ccSearch, setCcSearch] = useState('')
  const [showCcDrop, setShowCcDrop] = useState(false)

  useEffect(() => {
    api.get('/centros-costo').then(setCentrosCosto).catch(() => {})
  }, [])

  const ccLabel = (cc) => {
    if (!cc || cc === 'Sin CC') return cc || ''
    const c = centrosCosto.find(x => x.cc === cc)
    return cc + (c?.marca ? ` — ${c.marca}` : '')
  }

  const todosGrupos = [...new Set(centrosCosto.map(c => c.grupo)), ...GRUPOS_SIN_CC].sort()

  const handleGrupoChange = (grupo) => {
    if (GRUPOS_SIN_CC.includes(grupo)) {
      setItemForm(prev => ({ ...prev, grupo, cc: 'Sin CC' }))
      setCcSearch('Sin CC')
    } else {
      const ccSigueValido = centrosCosto.find(c => c.cc === itemForm.cc && c.grupo === grupo)
      setItemForm(prev => ({ ...prev, grupo, cc: ccSigueValido ? prev.cc : '' }))
      if (!ccSigueValido) setCcSearch('')
    }
  }

  const seleccionarCc = (val) => {
    const centro = centrosCosto.find(c => c.cc === val)
    setItemForm(prev => ({
      ...prev,
      cc: val,
      grupo: val === 'Sin CC' ? prev.grupo : (centro ? centro.grupo : prev.grupo),
    }))
    setCcSearch(val === 'Sin CC' ? 'Sin CC' : ccLabel(val))
    setShowCcDrop(false)
  }

  const ccsFiltrados = (() => {
    const sinCcGrupo = GRUPOS_SIN_CC.includes(itemForm.grupo)
    if (sinCcGrupo) return []
    let base = itemForm.grupo
      ? centrosCosto.filter(c => c.grupo === itemForm.grupo)
      : centrosCosto
    const conSinCc = itemForm.grupo
      ? base
      : [{ _id: 'sincc', cc: 'Sin CC', marca: '' }, ...base]
    if (!ccSearch) return conSinCc
    const q = ccSearch.toLowerCase()
    return conSinCc.filter(c =>
      c.cc.toLowerCase().includes(q) ||
      (c.marca && c.marca.toLowerCase().includes(q))
    )
  })()

  const agregarFila = (e) => {
    e.preventDefault()
    if (editingId) {
      setItems(items.map(i => i._tmpId === editingId ? { ...itemForm, _tmpId: editingId } : i))
      setEditingId(null)
    } else {
      setItems([...items, { ...itemForm, _tmpId: Date.now() }])
    }
    setItemForm(ITEM_INIT)
    setCcSearch('')
  }

  const editarFila = (item) => {
    const { _tmpId, ...rest } = item
    setItemForm(rest)
    setCcSearch(ccLabel(item.cc))
    setEditingId(_tmpId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicion = () => { setItemForm(ITEM_INIT); setEditingId(null); setCcSearch('') }

  const quitarFila = (tmpId) => {
    setItems(items.filter(i => i._tmpId !== tmpId))
    if (editingId === tmpId) cancelarEdicion()
  }

  const guardar = async () => {
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin ítems', text: 'Agregá al menos un ítem antes de guardar.' })
      return
    }
    try {
      const solicita = getNombreUsuario()
      const itemsLimpios = items.map(({ _tmpId, cant, ...rest }) => ({
        ...rest,
        ...(cant !== '' && cant != null ? { cant: Number(cant) } : {}),
        ...(solicita ? { solicita } : {}),
      }))
      await api.post('/berdina/pedidos', { fecha, items: itemsLimpios })
      Swal.fire({ icon: 'success', title: 'Pedido guardado', timer: 1500, showConfirmButton: false })
      navigate('/compras/berdina/pedidos')
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const badgeUrgencia = (u) => {
    const color = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
    return <span style={{ fontWeight: 600, color: color[u] || '#6c757d' }}>{u}</span>
  }

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-1">

      <div className="container d-flex justify-content-between align-items-center mb-1">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Compras · Berdina · Pedidos
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
      </div>

      <div className="container">
        <h4 className="text-center mb-5" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: '3rem' }}>Nuevo Pedido</h4>

        {/* Formulario ítem */}
        <div className="card mb-3 mx-auto" style={{ maxWidth: 680 }}>
          <div className="card-header fw-semibold d-flex justify-content-between align-items-center" style={{ backgroundColor: editingId ? '#6a4a8a' : '#4a6b8a', color: '#fff' }}>
            <span>{editingId ? 'Editando ítem' : 'Agregar ítem'}</span>
            <div className="d-flex align-items-center gap-2">
              <label className="mb-0" style={{ fontSize: 13 }}>Fecha</label>
              <input type="date" className="form-control form-control-sm" style={{ width: 150 }}
                value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={agregarFila}>
              {/* Fila 1: Nombre · Cant. · C.C. · Urgencia */}
              <div className="row mb-2 g-2">
                <div className="col-4">
                  <label className="form-label form-label-sm w-100 text-center">Nombre repuesto*</label>
                  <input className="form-control form-control-sm" value={itemForm.nombre_repuesto}
                    onChange={e => setItemForm({ ...itemForm, nombre_repuesto: e.target.value })} required />
                </div>
                <div className="col-2">
                  <label className="form-label form-label-sm w-100 text-center">Cant.*</label>
                  <input type="number" min="1" className="form-control form-control-sm" value={itemForm.cant}
                    onChange={e => setItemForm({ ...itemForm, cant: e.target.value })}
                    onKeyDown={e => ['e','E','+','-','.'].includes(e.key) && e.preventDefault()}
                    required />
                </div>
                <div className="col-1">
                  <label className="form-label form-label-sm w-100 text-center">Un.*</label>
                  <input className="form-control form-control-sm" placeholder="Ej: un, kg, mts" style={{ fontSize: 12 }} value={itemForm.unidad}
                    onChange={e => setItemForm({ ...itemForm, unidad: e.target.value })} required />
                </div>
                <div className="col-2" style={{ position: 'relative' }}>
                  <label className="form-label form-label-sm w-100 text-center">C.C.*</label>
                  {GRUPOS_SIN_CC.includes(itemForm.grupo) ? (
                    <input className="form-control form-control-sm" value="Sin CC" readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'default' }} />
                  ) : (
                  <input
                    className="form-control form-control-sm"
                    placeholder={itemForm.cc ? ccLabel(itemForm.cc) : 'Buscar...'}
                    value={ccSearch}
                    onChange={e => { setCcSearch(e.target.value); setShowCcDrop(true) }}
                    onFocus={() => { setCcSearch(''); setShowCcDrop(true) }}
                    onBlur={() => setTimeout(() => setShowCcDrop(false), 150)}
                    required={!itemForm.cc}
                    autoComplete="off"
                  />
                  )}
                  {showCcDrop && ccsFiltrados.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 100,
                      background: '#fff', border: '1px solid #000',
                      borderRadius: 4, maxHeight: 220, overflowY: 'auto', minWidth: 280,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                      {ccsFiltrados.map(c => (
                        <div key={c._id} onMouseDown={() => seleccionarCc(c.cc)}
                          style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <strong>{c.cc}</strong>{c.marca ? ` — ${c.marca}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-3">
                  <label className="form-label form-label-sm w-100 text-center">Urgencia*</label>
                  <select className="form-select form-select-sm" value={itemForm.urgencia}
                    onChange={e => setItemForm({ ...itemForm, urgencia: e.target.value })}>
                    {URGENCIAS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Fila 2: Descripción · Grupo */}
              <div className="row mb-3 g-2">
                <div className="col-8">
                  <label className="form-label form-label-sm w-100 text-center">Descripción</label>
                  <textarea className="form-control form-control-sm" rows={2} value={itemForm.descripcion}
                    onChange={e => setItemForm({ ...itemForm, descripcion: e.target.value })} />
                </div>
                <div className="col-4">
                  <label className="form-label form-label-sm w-100 text-center">Grupo*</label>
                  <select className="form-select form-select-sm" value={itemForm.grupo}
                    onChange={e => handleGrupoChange(e.target.value)} required>
                    <option value="">—</option>
                    {todosGrupos.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-outline-dark btn-sm">
                  {editingId ? '✓ Actualizar' : '+ Agregar fila'}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelarEdicion}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Tabla de ítems cargados */}
        {items.length > 0 && (
          <div className="card mb-3">
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0">
                <thead className="thead-light">
                  <tr>
                    <th>Repuesto</th>
                    <th>Cant.</th>
                    <th>Un.</th>
                    <th>Descripción</th>
                    <th>Urgencia</th>
                    <th>Grupo</th>
                    <th>C.C.</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item._tmpId} style={editingId === item._tmpId ? { backgroundColor: 'rgba(106,74,138,0.08)' } : {}}>
                      <td>{item.nombre_repuesto}</td>
                      <td>{item.cant}</td>
                      <td>{item.unidad}</td>
                      <td>{item.descripcion}</td>
                      <td>{badgeUrgencia(item.urgencia)}</td>
                      <td>{item.grupo}</td>
                      <td>{item.cc}</td>
                      <td><span className="badge bg-primary">Para analisis</span></td>
                      <td className="text-nowrap">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => editarFila(item)}>Editar</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => quitarFila(item._tmpId)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="d-flex justify-content-end gap-2 mb-4">
          <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button className="btn btn-outline-dark" onClick={guardar} disabled={items.length === 0}>
            Guardar pedido{items.length > 0 ? ` (${items.length} ítem${items.length !== 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
