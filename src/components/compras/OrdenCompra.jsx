import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button, Form } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion } from './estilos'

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
        style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', overflowY: 'auto' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap flex-shrink-0">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Orden de compra
          </span>
          {ocItems.length > 0 && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
            >
              {ocItems.length} {ocItems.length === 1 ? 'ítem' : 'ítems'} · {fmtPrecio(total)}
            </span>
          )}
        </div>

        {/* Elegir el pedido que se suma a la orden */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end gap-3 flex-wrap">
            <div ref={dropdownRef} className="d-flex flex-column" style={{ position: 'relative', width: '220px' }}>
              <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
                Elegir N° de pedido
              </span>
              <Form.Control
                className={`rounded-3 ${selectedKey ? 'fw-bold filtro-activo' : ''}`}
                style={{
                  fontSize: '0.82rem',
                  height: '32px',
                  padding: '3px 8px',
                  color: selectedKey ? '#dc2626' : '#1e293b',
                  fontWeight: selectedKey ? '700' : 'normal',
                }}
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => {
                  setBusqueda('')
                  setShowDropdown(true)
                }}
                onBlur={() => {
                  if (pedidoSeleccionado) setBusqueda(fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src))
                }}
                placeholder="Buscar pedido…"
                autoComplete="off"
              />

              {showDropdown && pedidosFiltrados.length > 0 && (
                <div
                  className="shadow-lg"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    width: 220,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {pedidosFiltrados.map((p) => {
                    const key = `${p._src}-${p.nro_pedido}`
                    const elegido = key === selectedKey
                    return (
                      <div
                        key={key}
                        onMouseDown={() => elegirPedido(p)}
                        style={{
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: esMultiple(p) ? 700 : 500,
                          color: elegido ? BORDO : '#334155',
                          backgroundColor: elegido ? BORDO_SUAVE : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = BORDO_SUAVE
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = elegido ? BORDO_SUAVE : 'transparent'
                        }}
                      >
                        {fmtNro(p.nro_pedido, p._src)}
                        {esMultiple(p) && (
                          <span className="ms-1 text-muted" style={{ fontSize: '0.72rem', fontWeight: 400 }}>
                            ({ocItemCount(p)} ítems)
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Button
              size="sm"
              disabled={previewItems.length === 0}
              onClick={aceptar}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.8rem', height: '32px', fontWeight: 600 }}
              title="Sumar estos ítems a la orden"
            >
              <i className="bi bi-plus-lg"></i>
              <span>Sumar a la orden</span>
            </Button>
          </div>
        </Card>

        {/* Vista previa: lo que se va a sumar, todavía editable */}
        {previewItems.length > 0 && (
          <div className="mb-3 flex-shrink-0">
            <div className="fw-bold mb-1" style={{ color: BORDO, fontSize: '0.82rem' }}>
              Vista previa — pedido{' '}
              {pedidoSeleccionado ? fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src) : ''}
            </div>
            <div
              className="shadow-sm rounded-3 bg-white"
              style={{ maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}
            >
              <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th style={thCentro}>Fecha</th>
                    <th style={th}>Repuesto</th>
                    <th style={thCentro}>Cant.</th>
                    <th style={thCentro}>Precio unit.</th>
                    <th style={thCentro}>Precio total</th>
                    <th style={thCentro}>Proveedor</th>
                    <th style={th}>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item) => (
                    <tr key={item._id}>
                      <td style={{ ...tdCentro, padding: '4px 5px' }}>
                        {item.fecha?.slice(0, 10).split('-').reverse().join('/')}
                      </td>
                      <td style={{ ...td, padding: '4px 5px', fontWeight: 500 }}>{item.nombre_repuesto}</td>
                      <td style={{ ...td, padding: '4px 5px' }}>
                        <Form.Control
                          type="number"
                          min="0"
                          size="sm"
                          className="rounded-3"
                          style={{ width: 70, fontSize: '0.8rem', height: '30px' }}
                          value={item.cant ?? ''}
                          onChange={(e) => updatePreviewItem(item._id, 'cant', e.target.value)}
                        />
                      </td>
                      <td style={{ ...td, padding: '4px 5px' }}>
                        <Form.Control
                          type={focusPrecio[item._id] ? 'number' : 'text'}
                          size="sm"
                          className="rounded-3"
                          style={{ width: 130, fontSize: '0.8rem', height: '30px' }}
                          value={
                            focusPrecio[item._id]
                              ? item.precio_unitario ?? ''
                              : item.precio_unitario != null
                                ? fmtPrecio(item.precio_unitario)
                                : ''
                          }
                          onChange={(e) => updatePreviewItem(item._id, 'precio_unitario', e.target.value)}
                          onFocus={() => setFocusPrecio((p) => ({ ...p, [item._id]: true }))}
                          onBlur={() => setFocusPrecio((p) => ({ ...p, [item._id]: false }))}
                          placeholder="$0"
                        />
                      </td>
                      <td style={{ ...tdCentro, fontWeight: 600 }}>
                        {item.precio_total != null ? fmtPrecio(item.precio_total) : <Raya />}
                      </td>
                      <td style={{ ...td, padding: '4px 5px' }}>
                        <Form.Select
                          size="sm"
                          className="rounded-3"
                          style={{ minWidth: 160, fontSize: '0.8rem', height: '30px' }}
                          value={item.proveedor_id || ''}
                          onChange={(e) => updatePreviewItem(item._id, 'proveedor_id', e.target.value)}
                        >
                          <option value="">— Sin proveedor —</option>
                          {proveedores.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.razonsocial}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td style={{ ...td, padding: '4px 5px' }}>
                        <Form.Control
                          size="sm"
                          className="rounded-3"
                          style={{ fontSize: '0.8rem', height: '30px' }}
                          value={obsPreview[item._id] || ''}
                          onChange={(e) => setObsPreview((prev) => ({ ...prev, [item._id]: e.target.value }))}
                          placeholder="Observaciones…"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}

        {/* Lo que ya entró en la orden */}
        {ocItems.length > 0 && (
          <div className="flex-shrink-0 pb-3">
            <div className="fw-bold mb-1" style={{ color: BORDO, fontSize: '0.82rem' }}>
              Ítems en la orden
            </div>
            <div
              className="shadow-sm rounded-3 bg-white mb-3"
              style={{ maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}
            >
              <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th style={thCentro}>N° Pedido</th>
                    <th style={thCentro}>Fecha</th>
                    <th style={th}>Repuesto</th>
                    <th style={thCentro}>Cant.</th>
                    <th style={thCentro}>Precio unit.</th>
                    <th style={thCentro}>Precio total</th>
                    <th style={th}>Proveedor</th>
                    <th style={th}>Observaciones</th>
                    <th style={{ ...thCentro, width: 70 }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {ocItems.map((item) => (
                    <tr key={item._id}>
                      <td style={tdCentro}>{fmtNro(item.nro_pedido, item._src)}</td>
                      <td style={tdCentro}>{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                      <td style={{ ...td, fontWeight: 500 }}>{item.nombre_repuesto}</td>
                      <td style={tdCentro}>{item.cant || <Raya />}</td>
                      <td style={tdCentro}>
                        {item.precio_unitario != null ? fmtPrecio(item.precio_unitario) : <Raya />}
                      </td>
                      <td style={{ ...tdCentro, fontWeight: 600 }}>
                        {item.precio_total != null ? fmtPrecio(item.precio_total) : <Raya />}
                      </td>
                      <td style={td}>{provNombre(item.proveedor_id)}</td>
                      <td style={td}>{item.observaciones || <Raya />}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center">
                          <BotonAccion
                            icono="bi-x-lg"
                            titulo="Quitar de la orden"
                            variante="danger"
                            onClick={() => quitarItem(item._id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* La fila de total va con la clase fila-total, si no el
                      hover le gana al fondo. */}
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: BORDO }}>TOTAL</td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                    <td style={{ ...tdCentro, fontWeight: 700, color: BORDO }}>{fmtPrecio(total)}</td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                  </tr>
                </tbody>
              </Table>
            </div>

            <div className="d-flex justify-content-center">
              <Button
                size="sm"
                onClick={generarOC}
                className="rounded-3 px-4 py-1 shadow-sm d-flex align-items-center gap-2"
                style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.86rem', fontWeight: 600 }}
              >
                <i className="bi bi-receipt"></i>
                <span>Generar orden de compra</span>
              </Button>
            </div>
          </div>
        )}

        {ocItems.length === 0 && previewItems.length === 0 && (
          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>
              Elegí un pedido para empezar la orden de compra.
            </span>
          </div>
        )}
      </Container>
    </div>
  )
}
