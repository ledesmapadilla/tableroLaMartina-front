import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button, Form } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion } from './estilos'
import { opcionElegida } from './precioElegido'

const fmtNro = (n, src) => src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const fmtPrecio = (v) =>
  v === '' || v === null || v === undefined
    ? ''
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

// Con qué presupuesto se compra: el que eligió el analista, o el más barato
// si no eligió otro. Es el mismo que usa Gerencia para el costo.
const precioElegidoProveedor = (item) => {
  const elegida = opcionElegida(item)
  return elegida
    ? { precio: elegida.precio, proveedor_id: elegida.proveedor || null }
    : { precio: null, proveedor_id: null }
}

// Compra parcial: se compra menos de lo pedido. Lo que falta queda pendiente
// para el comprador o se rechaza con motivo (el backend lo separa en otro ítem).
const esParcial = (i) => i.cant_pedida != null && Number(i.cant) >= 1 && Number(i.cant) < i.cant_pedida
const restoDe = (i) => i.cant_pedida - Number(i.cant)

// Lo que impide sumar un ítem a la orden, o null si está bien.
const problemaDeCompra = (i) => {
  const cant = Number(i.cant)
  if (!Number.isInteger(cant) || cant < 1) {
    return `${i.nombre_repuesto}: indicá cuánto se compra, en unidades enteras. Para no comprar nada, usá Rechazar.`
  }
  if (i.cant_pedida != null && cant > i.cant_pedida) {
    return `${i.nombre_repuesto}: no se puede comprar más de lo pedido (${i.cant_pedida}).`
  }
  if (esParcial(i) && i.resto === 'rechazar' && !String(i.motivo_resto || '').trim()) {
    return `${i.nombre_repuesto}: escribí el motivo del rechazo de las ${restoDe(i)} que no se compran.`
  }
  return null
}

export default function OrdenPago() {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  const [pedidos, setPedidos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const [previewItems, setPreviewItems] = useState([])
  // De qué pedido es la vista previa: puede quedar a la vista mientras en el
  // buscador ya se marcó otro.
  const [previewKey, setPreviewKey] = useState(null)
  // Alto que ocupó la vista previa: al sumarla a la orden su lugar queda
  // reservado con ese alto, así la tabla de la orden no salta para arriba.
  const refVista = useRef(null)
  const [altoVista, setAltoVista] = useState(0)
  const [obsPreview, setObsPreview] = useState({})
  const [focusPrecio, setFocusPrecio] = useState({})
  const [opItems, setOpItems] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/berdina/pedidos').catch(() => []),
      api.get('/sanpablo/pedidos').catch(() => []),
      api.get('/proveedores').catch(() => []),
    ]).then(([berdina, sanpablo, provs]) => {
      const todos = [
        ...berdina.map(p => ({ ...p, _src: 'berdina' })),
        ...sanpablo.map(p => ({ ...p, _src: 'sanpablo' })),
      ].filter(p => (p.items || []).some(i => i.estado === 'Para hacer OP'))
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

  const pedidosAceptados = new Set(opItems.map(i => i.pedidoId))
  const pedidosFiltrados = pedidos.filter(p =>
    fmtNro(p.nro_pedido, p._src).toLowerCase().includes(busqueda.toLowerCase()) &&
    !pedidosAceptados.has(p._id) &&
    // Un pedido cuyos ítems se rechazaron todos ya no tiene nada para comprar.
    (p.items || []).some(i => i.estado === 'Para hacer OP')
  )
  const opItemCount = (p) => (p.items || []).filter(i => i.estado === 'Para hacer OP').length
  const esMultiple = (p) => opItemCount(p) > 1

  const pedidoSeleccionado = pedidos.find(p => `${p._src}-${p.nro_pedido}` === selectedKey)
  const pedidoEnVista = pedidos.find(p => `${p._src}-${p.nro_pedido}` === previewKey)

  // Buscar un pedido solo lo marca: "Elegir" lo pasa a la vista previa.
  const marcarPedido = (p) => {
    setSelectedKey(`${p._src}-${p.nro_pedido}`)
    setBusqueda(fmtNro(p.nro_pedido, p._src))
    setShowDropdown(false)
  }

  // "Elegir": los ítems del pedido marcado van a la vista previa, todavía
  // editables. Recién "Sumar a OP" los pasa a la orden.
  const elegirPedido = () => {
    const p = pedidoSeleccionado
    if (!p) return
    setPreviewKey(selectedKey)
    const items = (p.items || [])
      .filter(i => i.estado === 'Para hacer OP')
      .map(i => {
        const { precio, proveedor_id } = precioElegidoProveedor(i)
        return {
          ...i,
          pedidoId: p._id,
          nro_pedido: p.nro_pedido,
          _src: p._src,
          fecha: p.fecha,
          precio_unitario: precio,
          precio_total: precio != null ? precio * (i.cant || 0) : null,
          proveedor_id,
          // Lo pedido queda fijo: "cant" es lo que se compra y puede bajar.
          cant_pedida: typeof i.cant === 'number' ? i.cant : null,
          resto: 'pendiente',
          motivo_resto: '',
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
    const problema = previewItems.map(problemaDeCompra).find(Boolean)
    if (problema) {
      Swal.fire({ icon: 'warning', title: 'Revisá la vista previa', text: problema })
      return
    }
    setAltoVista(refVista.current?.offsetHeight || 0)
    setOpItems(prev => [
      ...prev,
      ...previewItems.map(i => ({ ...i, observaciones: obsPreview[i._id] || '' })),
    ])
    setPreviewItems([])
    setPreviewKey(null)
    setSelectedKey(null)
    setBusqueda('')
  }

  // Rechazo total de un ítem, sin orden de pago: queda "Rechazado" con el
  // motivo (el taller lo ve al tocar el estado) y sale de la vista previa.
  const rechazarItem = async (item) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: 'Rechazar ítem',
      text: `${item.nombre_repuesto}${item.cant_pedida != null ? ` · ${item.cant_pedida} ${item.unidad || ''}` : ''}`,
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Explicá el motivo…',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      inputValidator: (v) => (!v?.trim() ? 'El motivo es obligatorio' : undefined),
    })
    if (!isConfirmed) return
    try {
      const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await api.put(`${base}/${item.pedidoId}/items/${item._id}`, {
        estado: 'Rechazado',
        usuario: 'Comprador',
        nota: motivo.trim(),
      })
      // Ya no está para comprar: sale de la vista previa y del pedido en pantalla.
      const quedan = previewItems.filter((i) => i._id !== item._id)
      setPreviewItems(quedan)
      if (quedan.length === 0) {
        setPreviewKey(null)
        setSelectedKey(null)
        setBusqueda('')
      }
      setPedidos((prev) =>
        prev.map((p) =>
          p._id !== item.pedidoId
            ? p
            : { ...p, items: p.items.map((i) => (i._id === item._id ? { ...i, estado: 'Rechazado' } : i)) }
        )
      )
      Swal.fire({ icon: 'success', title: 'Ítem rechazado', timer: 1400, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const quitarItem = (itemId) => setOpItems(prev => prev.filter(i => i._id !== itemId))

  const total = opItems.reduce((acc, i) => acc + (i.precio_total || 0), 0)

  const establecimiento = opItems.length === 0
    ? null
    : opItems.every(i => i._src === 'berdina') ? 'berdina'
    : opItems.every(i => i._src === 'sanpablo') ? 'sanpablo'
    : 'mixto'

  const generarOP = async () => {
    if (opItems.length === 0) return
    const result = await Swal.fire({
      title: '¿Generar Orden de Pago?',
      html: `<b>${opItems.length} ítem${opItems.length > 1 ? 's' : ''}</b><br/>Total: <b>${fmtPrecio(total)}</b>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4a0812',
    })
    if (!result.isConfirmed) return
    try {
      const op = await api.post('/op', {
        establecimiento,
        total,
        items: opItems.map(i => ({
          pedidoId:        i.pedidoId,
          itemId:          i._id,
          nro_pedido:      i.nro_pedido,
          _src:            i._src,
          nombre_repuesto: i.nombre_repuesto,
          cant:            Number(i.cant),
          // Compra parcial: qué hacer con lo que no se compra (el backend lo
          // separa en otro ítem del pedido).
          resto:           esParcial(i) ? { accion: i.resto, motivo: i.motivo_resto } : null,
          precio_unitario: i.precio_unitario,
          precio_total:    i.precio_total,
          proveedor:       i.proveedor_id,
          observaciones:   i.observaciones,
          fecha:           i.fecha,
        })),
      })
      await Swal.fire({ icon: 'success', title: `OP generada: ${op.nro_oc_display}`, timer: 2000, showConfirmButton: false })
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
            Orden de pago
          </span>
          {opItems.length > 0 && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
            >
              {opItems.length} {opItems.length === 1 ? 'ítem' : 'ítems'} · {fmtPrecio(total)}
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
                        onMouseDown={() => marcarPedido(p)}
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
                            ({opItemCount(p)} ítems)
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pasa el pedido marcado a la vista previa; no lo suma todavía. */}
            <Button
              size="sm"
              disabled={!pedidoSeleccionado || previewKey === selectedKey}
              onClick={elegirPedido}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.8rem', height: '32px', fontWeight: 600 }}
              title="Ver los ítems del pedido en la vista previa"
            >
              <i className="bi bi-check2"></i>
              <span>Elegir</span>
            </Button>
          </div>
        </Card>

        {/* Vista previa: lo que se va a sumar, todavía editable. Su lugar queda
            reservado aunque se vacíe: así la tabla de la orden no salta para
            arriba al tocar "Sumar a OP". */}
        {(previewItems.length > 0 || opItems.length > 0) && (
          <div ref={refVista} className="mb-3 flex-shrink-0" style={{ minHeight: altoVista }}>
            {previewItems.length > 0 ? (
            <>
            {/* Se revisa y se corrige acá; "Sumar a OP" lo pasa a la orden. */}
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="fw-bold" style={{ color: BORDO, fontSize: '0.82rem' }}>
                Vista previa — pedido{' '}
                {pedidoEnVista ? fmtNro(pedidoEnVista.nro_pedido, pedidoEnVista._src) : ''}
              </span>
              <Button
                size="sm"
                onClick={aceptar}
                className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
                style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.8rem', height: '30px', fontWeight: 600 }}
                title="Pasar estos ítems al listado de la orden"
              >
                <i className="bi bi-plus-lg"></i>
                <span>Sumar a OP</span>
              </Button>
            </div>
            <div
              className="shadow-sm rounded-3 bg-white"
              style={{ maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}
            >
              <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '1250px' }}>
                <thead>
                  <tr>
                    <th style={thCentro}>Fecha</th>
                    <th style={th}>Repuesto</th>
                    <th style={thCentro}>Comprar</th>
                    <th style={thCentro}>Precio unit.</th>
                    <th style={thCentro}>Precio total</th>
                    <th style={thCentro}>Proveedor</th>
                    <th style={th}>Resto</th>
                    <th style={th}>Observaciones</th>
                    <th style={{ ...thCentro, width: 70 }}>Rechazar</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item) => (
                    <tr key={item._id}>
                      <td style={{ ...tdCentro, padding: '4px 5px' }}>
                        {item.fecha?.slice(0, 10).split('-').reverse().join('/')}
                      </td>
                      <td style={{ ...td, padding: '4px 5px', fontWeight: 500 }}>{item.nombre_repuesto}</td>
                      {/* Cuánto se compra; arranca en lo pedido y puede bajar. */}
                      <td style={{ ...td, padding: '4px 5px' }}>
                        <div className="d-flex align-items-center gap-1">
                          <Form.Control
                            type="number"
                            min="1"
                            max={item.cant_pedida ?? undefined}
                            step="1"
                            size="sm"
                            className="rounded-3"
                            style={{ width: 70, fontSize: '0.8rem', height: '30px' }}
                            value={item.cant ?? ''}
                            onChange={(e) => updatePreviewItem(item._id, 'cant', e.target.value)}
                          />
                          {item.cant_pedida != null && (
                            <span className="text-muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                              de {item.cant_pedida}
                            </span>
                          )}
                        </div>
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
                      {/* Si se compra menos de lo pedido: qué pasa con el resto. */}
                      <td style={{ ...td, padding: '4px 5px' }}>
                        {esParcial(item) ? (
                          <div className="d-flex flex-column gap-1">
                            <Form.Select
                              size="sm"
                              className="rounded-3"
                              style={{ minWidth: 170, fontSize: '0.78rem', height: '30px' }}
                              value={item.resto}
                              onChange={(e) => updatePreviewItem(item._id, 'resto', e.target.value)}
                            >
                              <option value="pendiente">Dejar {restoDe(item)} pendientes</option>
                              <option value="rechazar">Rechazar {restoDe(item)}</option>
                            </Form.Select>
                            {item.resto === 'rechazar' && (
                              <Form.Control
                                size="sm"
                                className="rounded-3"
                                style={{ fontSize: '0.78rem', height: '30px' }}
                                value={item.motivo_resto}
                                onChange={(e) => updatePreviewItem(item._id, 'motivo_resto', e.target.value)}
                                placeholder="Motivo del rechazo…"
                              />
                            )}
                          </div>
                        ) : (
                          <Raya />
                        )}
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
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center">
                          <BotonAccion
                            icono="bi-x-lg"
                            titulo="Rechazar el ítem entero, sin comprarlo"
                            variante="danger"
                            onClick={() => rechazarItem(item)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            </>
            ) : (
              <div
                className="d-flex align-items-center justify-content-center rounded-3 text-muted"
                style={{ minHeight: altoVista || 90, border: '1px dashed #cbd5e1', fontSize: '0.82rem' }}
              >
                Vista previa vacía: buscá otro pedido y tocá «Elegir».
              </div>
            )}
          </div>
        )}

        {/* Lo que ya entró en la orden: más abajo y separado de la vista
            previa, para que no se confunda lo que se revisa con lo que ya entró. */}
        {opItems.length > 0 && (
          <div className="flex-shrink-0 pb-3 mt-3 pt-3" style={{ borderTop: '2px solid #e2e8f0' }}>
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
                  {/* Donde cambia el pedido respecto de la fila anterior, la
                      línea es más marcada (clase inicio-pedido, en index.css). */}
                  {opItems.map((item, idx) => (
                    <tr
                      key={item._id}
                      className={
                        idx > 0 &&
                        `${item._src}-${item.nro_pedido}` !==
                          `${opItems[idx - 1]._src}-${opItems[idx - 1].nro_pedido}`
                          ? 'inicio-pedido'
                          : undefined
                      }
                    >
                      <td style={tdCentro}>{fmtNro(item.nro_pedido, item._src)}</td>
                      <td style={tdCentro}>{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                      <td style={{ ...td, fontWeight: 500 }}>{item.nombre_repuesto}</td>
                      <td style={tdCentro}>
                        {item.cant || <Raya />}
                        {esParcial(item) && (
                          <div style={{ fontSize: '0.66rem', color: item.resto === 'rechazar' ? '#dc2626' : '#b45309' }}>
                            de {item.cant_pedida} · {restoDe(item)} {item.resto === 'rechazar' ? 'rechazadas' : 'pendientes'}
                          </div>
                        )}
                      </td>
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
                onClick={generarOP}
                className="rounded-3 px-4 py-1 shadow-sm d-flex align-items-center gap-2"
                style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.86rem', fontWeight: 600 }}
              >
                <i className="bi bi-receipt"></i>
                <span>Generar orden de pago</span>
              </Button>
            </div>
          </div>
        )}

        {opItems.length === 0 && previewItems.length === 0 && (
          <div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>
              {pedidoSeleccionado
                ? 'Tocá «Elegir» para ver los ítems del pedido.'
                : 'Buscá un pedido para empezar la orden de pago.'}
            </span>
          </div>
        )}
      </Container>
    </div>
  )
}
