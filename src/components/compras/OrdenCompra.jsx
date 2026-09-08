import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

const fmtNro = (n, src) => src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const fmtPrecio = (v) =>
  v === '' || v === null || v === undefined
    ? ''
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

const minPrecioProveedor = (item) => {
  const candidatos = [
    { v: item.precio1, id: item.proveedor1 },
    { v: item.precio2, id: item.proveedor2 },
    { v: item.precio3, id: item.proveedor3 },
  ].filter(x => x.v && x.v > 0)
  if (candidatos.length === 0) return { precio: null, proveedor_id: null }
  const min = candidatos.reduce((a, b) => a.v <= b.v ? a : b)
  return { precio: min.v, proveedor_id: min.id }
}

export default function OrdenCompra() {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  const [pedidos, setPedidos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const [previewItems, setPreviewItems] = useState([])
  const [obsPreview, setObsPreview] = useState({})
  const [focusPrecio, setFocusPrecio] = useState({})
  const [ocItems, setOcItems] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/berdina/pedidos').catch(() => []),
      api.get('/sanpablo/pedidos').catch(() => []),
      api.get('/proveedores').catch(() => []),
    ]).then(([berdina, sanpablo, provs]) => {
      const todos = [
        ...berdina.map(p => ({ ...p, _src: 'berdina' })),
        ...sanpablo.map(p => ({ ...p, _src: 'sanpablo' })),
      ].filter(p => (p.items || []).some(i => i.estado === 'Para hacer OC'))
      setPedidos(todos)
      setProveedores(provs)
    })
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pedidosAceptados = new Set(ocItems.map(i => i.pedidoId))
  const pedidosFiltrados = pedidos.filter(p =>
    fmtNro(p.nro_pedido, p._src).toLowerCase().includes(busqueda.toLowerCase()) &&
    !pedidosAceptados.has(p._id)
  )
  const ocItemCount = (p) => (p.items || []).filter(i => i.estado === 'Para hacer OC').length
  const esMultiple = (p) => ocItemCount(p) > 1

  const pedidoSeleccionado = pedidos.find(p => `${p._src}-${p.nro_pedido}` === selectedKey)

  const elegirPedido = (p) => {
    const key = `${p._src}-${p.nro_pedido}`
    setSelectedKey(key)
    setBusqueda(fmtNro(p.nro_pedido, p._src))
    setShowDropdown(false)
    const items = (p.items || [])
      .filter(i => i.estado === 'Para hacer OC')
      .map(i => {
        const { precio, proveedor_id } = minPrecioProveedor(i)
        return {
          ...i,
          pedidoId: p._id,
          nro_pedido: p.nro_pedido,
          _src: p._src,
          fecha: p.fecha,
          precio_unitario: precio,
          precio_total: precio != null ? precio * (i.cant || 0) : null,
          proveedor_id,
        }
      })
    setPreviewItems(items)
    const obs = {}
    items.forEach(i => { obs[i._id] = '' })
    setObsPreview(prev => ({ ...prev, ...obs }))
  }

  const updatePreviewItem = (id, field, value) => {
    setPreviewItems(prev => prev.map(i => {
      if (i._id !== id) return i
      const updated = { ...i, [field]: value }
      const pu = field === 'precio_unitario' ? Number(value) : i.precio_unitario
      const cant = field === 'cant' ? Number(value) : i.cant
      updated.precio_total = pu != null && !isNaN(pu) && cant ? pu * cant : null
      return updated
    }))
  }

  const provNombre = (id) => {
    if (!id) return '—'
    return proveedores.find(p => p._id === id)?.razonsocial || '—'
  }

  const aceptar = () => {
    if (previewItems.length === 0) return
    setOcItems(prev => [
      ...prev,
      ...previewItems.map(i => ({ ...i, observaciones: obsPreview[i._id] || '' })),
    ])
    setPreviewItems([])
    setSelectedKey(null)
    setBusqueda('')
  }

  const agregarOtroPedido = () => {
    setPreviewItems([])
    setSelectedKey(null)
    setBusqueda('')
  }

  const quitarItem = (itemId) => setOcItems(prev => prev.filter(i => i._id !== itemId))

  const total = ocItems.reduce((acc, i) => acc + (i.precio_total || 0), 0)

  const establecimiento = ocItems.length === 0
    ? null
    : ocItems.every(i => i._src === 'berdina') ? 'berdina'
    : ocItems.every(i => i._src === 'sanpablo') ? 'sanpablo'
    : 'mixto'

  const generarOC = async () => {
    if (ocItems.length === 0) return
    const result = await Swal.fire({
      title: '¿Generar Orden de Compra?',
      html: `<b>${ocItems.length} ítem${ocItems.length > 1 ? 's' : ''}</b><br/>Total: <b>${fmtPrecio(total)}</b>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4a0812',
    })
    if (!result.isConfirmed) return
    try {
      const oc = await api.post('/oc', {
        establecimiento,
        total,
        items: ocItems.map(i => ({
          pedidoId:        i.pedidoId,
          itemId:          i._id,
          nro_pedido:      i.nro_pedido,
          _src:            i._src,
          nombre_repuesto: i.nombre_repuesto,
          cant:            i.cant,
          precio_unitario: i.precio_unitario,
          precio_total:    i.precio_total,
          proveedor:       i.proveedor_id,
          observaciones:   i.observaciones,
          fecha:           i.fecha,
        })),
      })
      await Swal.fire({ icon: 'success', title: `OC generada: ${oc.nro_oc_display}`, timer: 2000, showConfirmButton: false })
      navigate(-1)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-1">

      <div className="container d-flex justify-content-between align-items-center mb-1">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Comprador
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
      </div>

      <div className="container">
        <h4 className="text-center mb-3" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Orden de Compra</h4>

        {/* Selector de pedido */}
        <div className="d-flex align-items-end gap-2 mb-3" style={{ position: 'relative' }}>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>Elegir N° de pedido</label>
            <input
              className={`form-control form-control-sm${selectedKey ? ' select-activo' : ''}`}
              style={{ width: 200 }}
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setShowDropdown(true) }}
              onFocus={() => { setBusqueda(''); setShowDropdown(true) }}
              onBlur={() => { if (pedidoSeleccionado) setBusqueda(fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src)) }}
              placeholder="Buscar pedido..."
              autoComplete="off"
            />
            {showDropdown && pedidosFiltrados.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: '#fff', border: '1px solid #000', borderRadius: 4,
                width: 200, maxHeight: 220, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
                {pedidosFiltrados.map(p => {
                  const key = `${p._src}-${p.nro_pedido}`
                  return (
                    <div
                      key={key}
                      onMouseDown={() => elegirPedido(p)}
                      style={{ padding: '6px 12px', cursor: 'pointer', fontWeight: esMultiple(p) ? 700 : 400, backgroundColor: key === selectedKey ? 'rgba(13,110,253,0.08)' : 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(13,110,253,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = key === selectedKey ? 'rgba(13,110,253,0.08)' : 'transparent'}
                    >
                      {fmtNro(p.nro_pedido, p._src)}
                      {esMultiple(p) && <span className="ms-1 text-muted" style={{ fontSize: 11, fontWeight: 400 }}>({ocItemCount(p)} ítems)</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0 }}>
            <button
              className="btn btn-sm btn-outline-primary"
              disabled={previewItems.length === 0}
              onClick={aceptar}
            >Aceptar</button>
          </div>

        </div>

        {/* Vista previa del pedido seleccionado */}
        {previewItems.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-muted" style={{ fontSize: 12 }}>
              Vista previa — pedido {pedidoSeleccionado ? fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src) : ''}
            </p>
            <div className="card">
              <table className="table table-hover table-striped mb-0" style={{ fontSize: 13 }}>
                <thead className="thead-blue thead-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Repuesto</th>
                    <th>Cant.</th>
                    <th>Precio Unit.</th>
                    <th>Precio Total</th>
                    <th>Proveedor</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map(item => (
                    <tr key={item._id}>
                      <td className="text-nowrap">{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                      <td>{item.nombre_repuesto}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm"
                          style={{ width: 70 }}
                          value={item.cant ?? ''}
                          onChange={e => updatePreviewItem(item._id, 'cant', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type={focusPrecio[item._id] ? 'number' : 'text'}
                          className="form-control form-control-sm"
                          style={{ width: 130 }}
                          value={focusPrecio[item._id]
                            ? (item.precio_unitario ?? '')
                            : (item.precio_unitario != null ? fmtPrecio(item.precio_unitario) : '')}
                          onChange={e => updatePreviewItem(item._id, 'precio_unitario', e.target.value)}
                          onFocus={() => setFocusPrecio(p => ({ ...p, [item._id]: true }))}
                          onBlur={() => setFocusPrecio(p => ({ ...p, [item._id]: false }))}
                          placeholder="$0"
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {item.precio_total != null ? fmtPrecio(item.precio_total) : '—'}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          style={{ minWidth: 160 }}
                          value={item.proveedor_id || ''}
                          onChange={e => updatePreviewItem(item._id, 'proveedor_id', e.target.value)}
                        >
                          <option value="">— Sin proveedor —</option>
                          {proveedores.map(p => (
                            <option key={p._id} value={p._id}>{p.razonsocial}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={obsPreview[item._id] || ''}
                          onChange={e => setObsPreview(prev => ({ ...prev, [item._id]: e.target.value }))}
                          placeholder="Observaciones..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabla acumulada de la OC */}
        {ocItems.length > 0 && (
          <div>
            <h6 className="mb-2" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Ítems en OC</h6>
            <div className="card mb-2">
              <table className="table table-hover table-striped mb-0" style={{ fontSize: 13 }}>
                <thead className="thead-blue thead-light">
                  <tr>
                    <th>N° Pedido</th>
                    <th>Fecha</th>
                    <th>Repuesto</th>
                    <th>Cant.</th>
                    <th>Precio Unit.</th>
                    <th>Precio Total</th>
                    <th>Proveedor</th>
                    <th>Observaciones</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ocItems.map(item => (
                    <tr key={item._id}>
                      <td>{fmtNro(item.nro_pedido, item._src)}</td>
                      <td className="text-nowrap">{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                      <td>{item.nombre_repuesto}</td>
                      <td>{item.cant || '—'}</td>
                      <td>{item.precio_unitario != null ? fmtPrecio(item.precio_unitario) : '—'}</td>
                      <td>{item.precio_total != null ? fmtPrecio(item.precio_total) : '—'}</td>
                      <td>{provNombre(item.proveedor_id)}</td>
                      <td>{item.observaciones || '—'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          style={{ padding: '1px 6px', fontSize: 11 }}
                          onClick={() => quitarItem(item._id)}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-end mb-3" style={{ fontWeight: 700, fontSize: 18 }}>
              Total: <span style={{ color: 'var(--color-accent)' }}>{fmtPrecio(total)}</span>
            </div>

            <div className="text-center">
              <button className="btn btn-outline-danger" onClick={generarOC}>Generar OC</button>
            </div>
          </div>
        )}

        {ocItems.length === 0 && previewItems.length === 0 && (
          <p className="text-center text-muted mt-4" style={{ fontSize: 14 }}>
            Seleccioná un pedido para comenzar la orden de compra.
          </p>
        )}
      </div>
    </div>
  )
}
