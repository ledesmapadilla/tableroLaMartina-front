import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { getArchivo, setArchivo, removeArchivo, fileADataURL } from '../../services/archivoPrototipo'

const fmtNro = (n, src) => src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`
const esParaAnalisis = (e) => e === 'Para analisis' || e === 'En analisis' || e === 'Pedido' || e === 'Para revision'

const fmtPrecio = (v) =>
  v === '' || v === null || v === undefined
    ? ''
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

const FORM_ITEM_INIT = { stock: '', proveedor1: '', precio1: '', proveedor2: '', precio2: '', proveedor3: '', precio3: '' }

export default function AnalizarItem() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const esComprador = !!state?.esComprador
  const dropdownRef = useRef(null)

  const [pedidos, setPedidos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [formsMap, setFormsMap] = useState({})
  const [focusMap, setFocusMap] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [archivosMap, setArchivosMap] = useState({}) // itemId -> { name, url }  (prototipo front: aún sin backend)

  useEffect(() => {
    Promise.all([
      api.get('/berdina/pedidos').catch(() => []),
      api.get('/sanpablo/pedidos').catch(() => []),
      api.get('/proveedores').catch(() => []),
    ]).then(([berdina, sanpablo, provs]) => {
      const todos = [
        ...berdina.map(p => ({ ...p, _src: 'berdina' })),
        ...sanpablo.map(p => ({ ...p, _src: 'sanpablo' })),
      ].filter(p => (p.items || []).some(i => esParaAnalisis(i.estado)))
      setPedidos(todos)
      setProveedores(provs)

      const initForms = (pedido) => {
        const mapa = {}
        ;(pedido.items || []).filter(i => esParaAnalisis(i.estado)).forEach(i => {
          mapa[i._id] = {
            stock:      i.stock      != null ? String(i.stock)      : '',
            proveedor1: i.proveedor1 ?? '',
            precio1:    i.precio1    != null ? String(i.precio1)    : '',
            proveedor2: i.proveedor2 ?? '',
            precio2:    i.precio2    != null ? String(i.precio2)    : '',
            proveedor3: i.proveedor3 ?? '',
            precio3:    i.precio3    != null ? String(i.precio3)    : '',
          }
        })
        setFormsMap(mapa)
      }

      if (state?.item) {
        const key = `${state.item._src}-${state.item.nro_pedido}`
        setSelectedKey(key)
        setBusqueda(fmtNro(state.item.nro_pedido, state.item._src))
        const pedido = todos.find(p => `${p._src}-${p.nro_pedido}` === key)
        if (pedido) {
          initForms(pedido)
          const archivos = {}
          ;(pedido.items || []).filter(i => esParaAnalisis(i.estado)).forEach(i => {
            const a = getArchivo(i._id)
            if (a) archivos[i._id] = a
          })
          setArchivosMap(archivos)
        }
      }
    })
  }, [])

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pedidosFiltrados = pedidos.filter(p =>
    fmtNro(p.nro_pedido, p._src).toLowerCase().includes(busqueda.toLowerCase())
  )

  const esMultiple = (p) => (p.items || []).filter(i => esParaAnalisis(i.estado)).length > 1

  const pedidoSeleccionado = pedidos.find(p => `${p._src}-${p.nro_pedido}` === selectedKey)
  const itemsAMostrar = pedidoSeleccionado
    ? (pedidoSeleccionado.items || []).filter(i => esParaAnalisis(i.estado))
    : []

  const calcularMontoTotal = () =>
    itemsAMostrar.reduce((acc, item) => {
      const form = formsMap[item._id] || FORM_ITEM_INIT
      const precios = [form.precio1, form.precio2, form.precio3].map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0)
      const precioMin = precios.length > 0 ? Math.min(...precios) : 0
      return acc + precioMin * (item.cant || 0)
    }, 0)

  const elegirPedido = (p) => {
    const key = `${p._src}-${p.nro_pedido}`
    setSelectedKey(key)
    setBusqueda(fmtNro(p.nro_pedido, p._src))
    setShowDropdown(false)
    const archivos = {}
    ;(p.items || []).filter(i => esParaAnalisis(i.estado)).forEach(i => {
      const a = getArchivo(i._id)
      if (a) archivos[i._id] = a
    })
    setArchivosMap(archivos)
    const mapa = {}
    ;(p.items || []).filter(i => esParaAnalisis(i.estado)).forEach(i => {
      mapa[i._id] = {
        stock:      i.stock      != null ? String(i.stock)      : '',
        proveedor1: i.proveedor1 ?? '',
        precio1:    i.precio1    != null ? String(i.precio1)    : '',
        proveedor2: i.proveedor2 ?? '',
        precio2:    i.precio2    != null ? String(i.precio2)    : '',
        proveedor3: i.proveedor3 ?? '',
        precio3:    i.precio3    != null ? String(i.precio3)    : '',
      }
    })
    setFormsMap(mapa)
  }

  // --- Archivo (prototipo front): se guarda en sessionStorage vía archivoPrototipo ---
  // Cuando conectemos el backend, acá se hará el POST a Cloudinary y se guardará item.archivo = url.
  const subirArchivo = async (itemId, file) => {
    const archivo = await fileADataURL(file)   // { name, dataURL }
    setArchivo(itemId, archivo)
    setArchivosMap(m => ({ ...m, [itemId]: archivo }))
  }

  const quitarArchivo = (itemId) => {
    removeArchivo(itemId)
    setArchivosMap(m => {
      const resto = { ...m }
      delete resto[itemId]
      return resto
    })
  }

  const archivoCell = (item) => {
    const archivo = archivosMap[item._id]
    if (archivo) {
      return (
        <div className="d-flex align-items-center justify-content-center gap-1">
          <a
            href={archivo.dataURL}
            target="_blank"
            rel="noreferrer"
            title={archivo.name}
            className="text-truncate"
            style={{ maxWidth: 80, fontSize: 12 }}
          >
            <i className="bi bi-paperclip" /> {archivo.name}
          </a>
          {!esComprador && (
            <button
              className="btn btn-sm btn-link text-danger p-0"
              style={{ lineHeight: 1 }}
              title="Quitar archivo"
              onClick={() => quitarArchivo(item._id)}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
      )
    }
    return (
      <label className={`btn btn-sm btn-outline-dark mb-0${esComprador ? ' disabled' : ''}`} style={{ fontSize: 12 }}>
        <i className="bi bi-upload" /> Subir
        <input
          type="file"
          accept=".pdf,image/*"
          hidden
          disabled={esComprador}
          onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(item._id, f); e.target.value = '' }}
        />
      </label>
    )
  }

  const setF = (itemId, campo, valor) =>
    setFormsMap(m => ({ ...m, [itemId]: { ...(m[itemId] || FORM_ITEM_INIT), [campo]: valor } }))

  const setFoco = (itemId, campo, val) =>
    setFocusMap(m => ({ ...m, [`${itemId}_${campo}`]: val }))

  const getFoco = (itemId, campo) => !!focusMap[`${itemId}_${campo}`]

  const recargar = async () => {
    const [berdina, sanpablo] = await Promise.all([
      api.get('/berdina/pedidos').catch(() => []),
      api.get('/sanpablo/pedidos').catch(() => []),
    ])
    const todos = [
      ...berdina.map(p => ({ ...p, _src: 'berdina' })),
      ...sanpablo.map(p => ({ ...p, _src: 'sanpablo' })),
    ].filter(p => (p.items || []).some(i => esParaAnalisis(i.estado)))
    setPedidos(todos)
  }

  const procesar = async () => {
    if (!pedidoSeleccionado || itemsAMostrar.length === 0) return
    const monto = calcularMontoTotal()
    const nuevoEstado = monto >= 200000 ? 'Autorizar' : 'Para hacer OC'
    const result = await Swal.fire({
      title: '¿Procesar pedido?',
      html: `Monto total: <b>${fmtPrecio(monto)}</b><br/>Estado → <b>${nuevoEstado}</b>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Procesar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4a0812',
    })
    if (!result.isConfirmed) return
    try {
      const base = pedidoSeleccionado._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
      await Promise.all(itemsAMostrar.map(item => {
        const form = formsMap[item._id] || FORM_ITEM_INIT
        const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? undefined : n }
        return api.put(`${base}/${pedidoSeleccionado._id}/items/${item._id}`, {
          estado:     nuevoEstado,
          usuario:    'Analista',
          stock:      toNum(form.stock),
          proveedor1: form.proveedor1 || undefined,
          precio1:    toNum(form.precio1),
          proveedor2: form.proveedor2 || undefined,
          precio2:    toNum(form.precio2),
          proveedor3: form.proveedor3 || undefined,
          precio3:    toNum(form.precio3),
        })
      }))
      await Swal.fire({ icon: 'success', title: 'Procesado', timer: 1500, showConfirmButton: false })
      navigate(-1)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const precioInput = (item, campo) => {
    const form = formsMap[item._id] || FORM_ITEM_INIT
    const enFoco = getFoco(item._id, campo)
    return (
      <input
        type={enFoco ? 'number' : 'text'}
        min="0"
        className="form-control form-control-sm"
        style={{ minWidth: 90 }}
        value={enFoco ? form[campo] : fmtPrecio(form[campo])}
        onChange={e => setF(item._id, campo, e.target.value)}
        onFocus={() => setFoco(item._id, campo, true)}
        onBlur={() => setFoco(item._id, campo, false)}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        placeholder="$"
        disabled={esComprador}
      />
    )
  }

  const provSelect = (item, campo) => {
    const form = formsMap[item._id] || FORM_ITEM_INIT
    return (
      <select
        className={`form-select form-select-sm${form[campo] ? ' select-activo' : ''}`}
        style={form[campo] ? { backgroundImage: 'none' } : {}}
        value={form[campo]}
        onChange={e => setF(item._id, campo, e.target.value)}
        disabled={esComprador}
      >
        <option value="">—</option>
        {proveedores.map(p => <option key={p._id} value={p._id}>{p.razonsocial}</option>)}
      </select>
    )
  }

  const fecha = pedidoSeleccionado?.fecha?.slice(0, 10).split('-').reverse().join('/') || '—'

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-1">

      <div className="container d-flex justify-content-between align-items-center mb-1">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          Analista
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
      </div>

      <div className="container">
        <h4 className="text-center mb-0" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Analizar ítem</h4>
        <p className="text-center text-muted mb-1" style={{ fontSize: 13 }}>(precios sin IVA)</p>

        <div className="d-flex align-items-end mb-2" style={{ position: 'relative' }}>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label className="form-label form-label-sm mb-1 d-block" style={{ fontSize: 11 }}>N° Pedido</label>
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
                width: 200, maxHeight: 220, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                {pedidosFiltrados.map(p => {
                  const key = `${p._src}-${p.nro_pedido}`
                  const multiple = esMultiple(p)
                  return (
                    <div
                      key={key}
                      onMouseDown={() => elegirPedido(p)}
                      style={{
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontWeight: multiple ? 700 : 400,
                        backgroundColor: key === selectedKey ? 'rgba(13,110,253,0.08)' : 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(13,110,253,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = key === selectedKey ? 'rgba(13,110,253,0.08)' : 'transparent'}
                    >
                      {fmtNro(p.nro_pedido, p._src)}
                      {multiple && <span className="ms-1 text-muted" style={{ fontSize: 11, fontWeight: 400 }}>({(p.items || []).filter(i => esParaAnalisis(i.estado)).length} ítems)</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {!esComprador && (
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0 }}>
              <button
                className="btn btn-sm btn-outline-success"
                disabled={itemsAMostrar.length === 0}
                onClick={procesar}
              >Procesar</button>
            </div>
          )}
        </div>

        <div style={esComprador ? { border: '1px solid #000', borderRadius: 6, padding: '0.75rem' } : {}}>
        <div className="card">
          <div>
            <table className="table table-hover table-striped mb-0" style={{ tableLayout: 'fixed', width: '100%', fontSize: 13 }}>
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead className="thead-blue thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th>Fecha</th>
                  <th>Repuesto</th>
                  <th>Stock</th>
                  <th>Proveedor 1</th>
                  <th>Precio 1</th>
                  <th>Proveedor 2</th>
                  <th>Precio 2</th>
                  <th>Proveedor 3</th>
                  <th>Precio 3</th>
                  <th>Archivo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {itemsAMostrar.map(item => (
                  <tr key={item._id}>
                    <td className="text-nowrap">{fecha}</td>
                    <td>{item.nombre_repuesto}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        value={(formsMap[item._id] || FORM_ITEM_INIT).stock}
                        onChange={e => setF(item._id, 'stock', e.target.value)}
                        placeholder="0"
                        disabled={esComprador}
                      />
                    </td>
                    <td>{provSelect(item, 'proveedor1')}</td>
                    <td>{precioInput(item, 'precio1')}</td>
                    <td>{provSelect(item, 'proveedor2')}</td>
                    <td>{precioInput(item, 'precio2')}</td>
                    <td>{provSelect(item, 'proveedor3')}</td>
                    <td>{precioInput(item, 'precio3')}</td>
                    <td className="text-center">{archivoCell(item)}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>Cancelar</button>
                    </td>
                  </tr>
                ))}
                {itemsAMostrar.length === 0 && (
                  <tr><td colSpan={11} className="text-center text-muted py-3">
                    {selectedKey ? 'Sin ítems para analizar' : 'Seleccioná un pedido'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {itemsAMostrar.length > 0 && (() => {
          const filas = itemsAMostrar.map(item => {
            const form = formsMap[item._id] || FORM_ITEM_INIT
            const precios = [form.precio1, form.precio2, form.precio3]
              .map(v => parseFloat(v))
              .filter(v => !isNaN(v) && v > 0)
            const precioMin = precios.length > 0 ? Math.min(...precios) : null
            const cant = item.cant || 0
            const total = precioMin !== null ? precioMin * cant : null
            return { item, precioMin, cant, total }
          })
          const sumaTotal = filas.reduce((acc, r) => acc + (r.total || 0), 0)

          return (
            <div className="mt-2 d-flex flex-column align-items-center">
              <h6 className="mb-2" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Resumen</h6>
              <div className="card" style={{ width: '50%' }}>
                <table className="table table-striped mb-0" style={{ fontSize: 13 }}>
                  <thead className="thead-blue thead-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Repuesto</th>
                      <th>Cant.</th>
                      <th>Precio Unit.</th>
                      <th>Precio Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(({ item, precioMin, cant, total }) => (
                      <tr key={item._id}>
                        <td className="text-nowrap">{fecha}</td>
                        <td>{item.nombre_repuesto}</td>
                        <td>{cant || '—'}</td>
                        <td>{precioMin !== null ? fmtPrecio(precioMin) : '—'}</td>
                        <td>{total !== null ? fmtPrecio(total) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-1 text-center" style={{ fontWeight: 700, fontSize: 18 }}>
                Precio de mínima pedido {pedidoSeleccionado ? fmtNro(pedidoSeleccionado.nro_pedido, pedidoSeleccionado._src) : ''}:{' '}
                <span style={{ color: 'var(--color-accent)' }}>{fmtPrecio(sumaTotal)}</span>
              </div>

            </div>
          )
        })()}
        </div>

      </div>
    </div>
  )
}
