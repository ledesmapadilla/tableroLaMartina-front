import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Container, Table, Button, Form } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { subirArchivo, borrarArchivo } from '../../services/archivos'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import { Raya } from './estilos'
import { opcionesDePrecio, opcionMinima, opcionElegida } from './precioElegido'
import { usePermisos } from '../../context/permisos'
import { fmtPresupuesto } from './presupuestos'

const fmtPrecio = (v) =>
  v === '' || v === null || v === undefined
    ? ''
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

// `elegido` vacío es "el más barato"; 1, 2 o 3, el presupuesto elegido a mano.
const FORM_INIT = { stock: '', proveedor1: '', precio1: '', proveedor2: '', precio2: '', proveedor3: '', precio3: '', elegido: '', observaciones: '' }

const formDe = (p) => ({
  stock: p.stock != null ? String(p.stock) : '',
  proveedor1: p.proveedor1 ?? '',
  precio1: p.precio1 != null ? String(p.precio1) : '',
  proveedor2: p.proveedor2 ?? '',
  precio2: p.precio2 != null ? String(p.precio2) : '',
  proveedor3: p.proveedor3 ?? '',
  precio3: p.precio3 != null ? String(p.precio3) : '',
  elegido: p.elegido != null ? String(p.elegido) : '',
  observaciones: p.observaciones ?? '',
})

/**
 * El paso de cotizar de un presupuesto de reparaciones (08/10/2026): la
 * misma carga que el análisis de un pedido (stock, tres proveedores con su
 * precio, observaciones y el adjunto) y el resumen con el proveedor que vale.
 * Cotizar lo deja en "Cotizado"; no va a Gerencia ni a OP. Uno cotizado se
 * abre para verlo y se puede corregir.
 */
export default function CotizarPresupuesto() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { puede } = usePermisos()
  const sinEditar = !puede('compras.analista', 'editar')

  const [presupuesto, setPresupuesto] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [form, setForm] = useState(FORM_INIT)
  const [foco, setFoco] = useState(null)
  const [editando, setEditando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([api.get(`/presupuestos-reparaciones/${id}`), api.get('/proveedores').catch(() => [])])
      .then(([p, provs]) => {
        setPresupuesto(p)
        setForm(formDe(p))
        setProveedores(Array.isArray(provs) ? provs : [])
      })
      .catch((err) => Swal.fire({ icon: 'error', title: 'No se pudo abrir', text: err.message, width: '300px' }))
  }, [id])

  if (!presupuesto) {
    return <div className="text-center text-muted py-5">Cargando…</div>
  }

  const cotizado = presupuesto.estado === 'Cotizado'
  const soloVer = sinEditar || (cotizado && !editando)
  const setF = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const opciones = opcionesDePrecio(form)
  const elegida = opcionElegida(form)
  const total = elegida ? elegida.precio * (presupuesto.cant || 0) : null
  const sinCargar = opciones.length === 0 && !form.observaciones.trim()
  const nombreProveedor = (pid) => proveedores.find((p) => p._id === pid)?.razonsocial || ''

  const datos = () => {
    const toNum = (v) => {
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    }
    return {
      stock: toNum(form.stock),
      proveedor1: form.proveedor1 || null,
      precio1: toNum(form.precio1),
      proveedor2: form.proveedor2 || null,
      precio2: toNum(form.precio2),
      // Internet no lleva proveedor.
      proveedor3: null,
      precio3: toNum(form.precio3),
      elegido: toNum(form.elegido),
      observaciones: form.observaciones.trim() || null,
    }
  }

  // Guardar deja lo cargado sin cotizarlo; Cotizar lo pasa a "Cotizado". Sin
  // confirmación: se aprieta y avisa.
  const guardar = async (cotizar) => {
    setGuardando(true)
    try {
      const p = await api.put(`/presupuestos-reparaciones/${id}`, { ...datos(), ...(cotizar ? { cotizar: true } : {}) })
      setPresupuesto(p)
      setForm(formDe(p))
      setEditando(false)
      await Swal.fire({
        icon: 'success',
        title: cotizar ? (editando ? 'Cotización corregida' : 'Cotizado') : 'Guardado',
        text: cotizar && total !== null ? `Total: ${fmtPrecio(total)}` : undefined,
        timer: 1600,
        showConfirmButton: false,
        width: '300px',
      })
      if (cotizar) navigate('/compras/analista/presupuestos-reparaciones')
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.message, width: '300px' })
    } finally {
      setGuardando(false)
    }
  }

  const cancelarEdicion = () => {
    setEditando(false)
    setForm(formDe(presupuesto))
  }

  // --- Adjunto --- Se guarda en el momento, como en el análisis de un pedido.
  const adjuntar = async (file) => {
    setSubiendo(true)
    try {
      const archivo = await subirArchivo(file)
      setPresupuesto(await api.put(`/presupuestos-reparaciones/${id}`, { archivo }))
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo adjuntar', text: err.message, width: '300px' })
    } finally {
      setSubiendo(false)
    }
  }

  const quitarArchivo = async () => {
    const archivo = presupuesto.archivo
    try {
      setPresupuesto(await api.put(`/presupuestos-reparaciones/${id}`, { archivo: null }))
      await borrarArchivo(archivo || {})
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo quitar el archivo', text: err.message, width: '300px' })
    }
  }

  const celdaArchivo = () => {
    const archivo = presupuesto.archivo
    if (archivo?.url) {
      return (
        <div className="d-flex align-items-center justify-content-center gap-1">
          <a href={archivo.url} target="_blank" rel="noreferrer" title={archivo.nombre || 'Ver el adjunto'} className="text-truncate" style={{ maxWidth: 80, fontSize: 12 }}>
            <i className="bi bi-paperclip" /> {archivo.nombre || 'Ver'}
          </a>
          {!soloVer && (
            <button className="btn btn-sm btn-link text-danger p-0" style={{ lineHeight: 1 }} title="Quitar archivo" onClick={quitarArchivo}>
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
      )
    }
    return (
      <label
        className={`btn btn-sm btn-outline-dark mb-0${soloVer || subiendo ? ' disabled' : ''}`}
        style={{ fontSize: 12 }}
        title={soloVer ? 'Sin permiso para editar' : 'Adjuntar un PDF o una foto'}
      >
        {subiendo ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" role="status" /> Subiendo…
          </>
        ) : (
          <>
            <i className="bi bi-upload" /> Subir
          </>
        )}
        <input
          type="file"
          accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx"
          hidden
          disabled={soloVer || subiendo}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) adjuntar(f)
            e.target.value = ''
          }}
        />
      </label>
    )
  }

  const precioInput = (campo) => {
    const enFoco = foco === campo
    return (
      <input
        type={enFoco ? 'number' : 'text'}
        min="0"
        className="form-control form-control-sm"
        style={{ fontSize: '0.8rem', height: '30px' }}
        value={enFoco ? form[campo] : fmtPrecio(form[campo])}
        onChange={(e) => setF(campo, e.target.value)}
        onFocus={() => setFoco(campo)}
        onBlur={() => setFoco(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
        }}
        placeholder="$"
        disabled={soloVer}
      />
    )
  }

  const provSelect = (campo) => (
    <select
      className={`form-select form-select-sm${form[campo] ? ' select-activo' : ''}`}
      style={form[campo] ? { backgroundImage: 'none' } : {}}
      value={form[campo]}
      onChange={(e) => setF(campo, e.target.value)}
      disabled={soloVer}
    >
      <option value="">—</option>
      {proveedores.map((p) => (
        <option key={p._id} value={p._id}>
          {p.razonsocial}
        </option>
      ))}
    </select>
  )

  // El proveedor con el que se cuenta: el más barato salvo que se elija otro.
  const selectorProveedor = () => {
    if (!elegida) return <Raya />
    // El tercero es la compra por internet (08/10/2026).
    const etiqueta = (o) => (o.n === 3 ? 'INTERNET' : nombreProveedor(o.proveedor) || `Proveedor ${o.n}`)
    if (soloVer) {
      return (
        <span>
          {etiqueta(elegida)}
          {!elegida.esMinima && <span className="text-muted" style={{ fontSize: '0.66rem' }}> · elegido, no es el más bajo</span>}
        </span>
      )
    }
    const minima = opcionMinima(opciones)
    return (
      <select
        className="form-select form-select-sm"
        style={{ fontSize: '0.74rem', minWidth: 180 }}
        value={String(elegida.n)}
        onChange={(e) => setF('elegido', Number(e.target.value) === minima.n ? '' : e.target.value)}
      >
        {opciones.map((o) => (
          <option key={o.n} value={o.n}>
            {etiqueta(o)} — {fmtPrecio(o.precio)}
            {o.n === minima.n ? ' (más bajo)' : ''}
          </option>
        ))}
      </select>
    )
  }

  const fecha = presupuesto.fecha ? new Date(presupuesto.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  const tdCarga = { ...td, padding: '4px 5px', verticalAlign: 'top' }
  const tdCargaCentro = { ...tdCarga, textAlign: 'center' }
  const tdCargaTexto = { ...tdCarga, padding: '9px 5px 4px' }
  const boton = { fontSize: '0.78rem', height: '30px', fontWeight: 600 }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa', height: '100%', overflow: 'hidden' }}>
      <Container fluid className="px-3 py-2 d-flex flex-column flex-grow-1" style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', overflowY: 'auto' }}>
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap flex-shrink-0">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            {editando ? 'Editar cotización' : soloVer ? 'Cotización' : 'Cotizar'} · {fmtPresupuesto(presupuesto.nro)}
          </span>
          <span className="px-2 py-1 rounded-3" style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}>
            precios sin IVA
          </span>

          <div className="ms-auto" />
          {cotizado && !editando && !sinEditar && (
            <Button size="sm" onClick={() => setEditando(true)} className="rounded-3 px-3 d-flex align-items-center gap-2" style={{ ...boton, backgroundColor: '#b45309', borderColor: '#b45309' }}>
              <i className="bi bi-pencil-square"></i>
              <span>Editar cotización</span>
            </Button>
          )}
          {editando && (
            <Button size="sm" variant="outline-secondary" onClick={cancelarEdicion} className="rounded-3 px-3" style={{ fontSize: '0.78rem', height: '30px' }}>
              Cancelar
            </Button>
          )}
          {!soloVer && !cotizado && (
            <Button size="sm" onClick={() => guardar(false)} disabled={guardando} className="rounded-3 px-3 d-flex align-items-center gap-2" style={{ ...boton, backgroundColor: '#1e293b', borderColor: '#1e293b' }} title="Guardar lo cargado sin cotizarlo todavía">
              <i className="bi bi-floppy-fill"></i>
              <span>Guardar</span>
            </Button>
          )}
          {!soloVer && (
            <Button
              size="sm"
              onClick={() => guardar(true)}
              disabled={guardando || sinCargar}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ ...boton, backgroundColor: '#15803d', borderColor: '#15803d' }}
              title={sinCargar ? 'Cargá un precio o una observación' : undefined}
            >
              <i className="bi bi-check-lg"></i>
              <span>{editando ? 'Guardar cambios' : 'Cotizar'}</span>
            </Button>
          )}
        </div>

        {/* Carga de los tres presupuestos */}
        <div className="shadow-sm rounded-3 bg-white mb-3 flex-shrink-0" style={{ maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}>
          <Table className="mb-0 tabla-informe tabla-compras" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1080px' }}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Stock</th>
                <th style={thCentro}>Proveedor 1</th>
                <th style={thCentro}>Precio 1</th>
                <th className="col-proveedor" style={thCentro}>Proveedor 2</th>
                <th style={thCentro}>Precio 2</th>
                <th className="col-proveedor" style={thCentro}>INTERNET</th>
                <th style={thCentro}>Observaciones</th>
                <th style={thCentro}>Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdCargaTexto, textAlign: 'center' }}>{fecha}</td>
                <td style={{ ...tdCargaTexto, fontWeight: 500 }}>{presupuesto.nombre_repuesto}</td>
                <td style={tdCarga}>
                  <Form.Control
                    type="number"
                    min="0"
                    size="sm"
                    className="rounded-3"
                    style={{ fontSize: '0.8rem', height: '30px' }}
                    value={form.stock}
                    onChange={(e) => setF('stock', e.target.value)}
                    placeholder="0"
                    disabled={soloVer}
                  />
                </td>
                <td style={tdCarga}>{provSelect('proveedor1')}</td>
                <td style={tdCarga}>{precioInput('precio1')}</td>
                <td className="col-proveedor" style={tdCarga}>{provSelect('proveedor2')}</td>
                <td style={tdCarga}>{precioInput('precio2')}</td>
                {/* Internet: solo el precio, sin proveedor. */}
                <td className="col-proveedor" style={tdCarga}>{precioInput('precio3')}</td>
                <td style={tdCarga}>
                  <textarea
                    rows={1}
                    className="form-control form-control-sm"
                    style={{ fontSize: '0.8rem', height: '30px', minHeight: '30px', width: '100%', resize: 'vertical' }}
                    value={form.observaciones}
                    onChange={(e) => setF('observaciones', e.target.value)}
                    title={form.observaciones}
                    disabled={soloVer}
                  />
                </td>
                <td style={tdCargaCentro}>{celdaArchivo()}</td>
              </tr>
            </tbody>
          </Table>
        </div>

        {/* Resumen: qué sale con el presupuesto que vale. */}
        <div className="d-flex flex-column align-items-center flex-shrink-0 pb-3">
          <div className="fw-bold mb-2" style={{ color: BORDO, fontSize: '0.9rem' }}>
            Resumen
          </div>
          <div className="shadow-sm rounded-3 bg-white" style={{ width: '820px', maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}>
            <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={thCentro}>Fecha</th>
                  <th style={th}>Repuesto</th>
                  <th style={thCentro}>Cant.</th>
                  <th style={th}>Proveedor</th>
                  <th style={thCentro}>Precio unit.</th>
                  <th style={thCentro}>Precio total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdCentro}>{fecha}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{presupuesto.nombre_repuesto}</td>
                  <td style={tdCentro}>
                    {presupuesto.cant ?? <Raya />} {presupuesto.unidad || ''}
                  </td>
                  <td style={{ ...td, padding: '2px 5px' }}>{selectorProveedor()}</td>
                  <td style={tdCentro}>{elegida ? fmtPrecio(elegida.precio) : <Raya />}</td>
                  <td style={{ ...tdCentro, fontWeight: 700, color: BORDO }}>{total !== null ? fmtPrecio(total) : <Raya />}</td>
                </tr>
              </tbody>
            </Table>
          </div>
          {elegida && (
            <div className="mt-2 text-center" style={{ fontSize: '0.82rem', color: '#64748b' }}>
              {elegida.esMinima ? 'Con el precio más bajo' : 'Con el proveedor elegido a mano'}
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}
