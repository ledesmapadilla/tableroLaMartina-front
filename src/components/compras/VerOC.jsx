import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { getArchivo } from '../../services/archivoPrototipo'

const fmtPrecio = (v) =>
  v == null ? '—'
  : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

const fmtNro = (n, src) =>
  src === 'berdina' ? `B-${String(n).padStart(3, '0')}` : `SP-${String(n).padStart(3, '0')}`

const fmtFecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '—'

const establecimientoLabel = (e) =>
  e === 'berdina' ? 'Berdina' : e === 'sanpablo' ? 'San Pablo' : e === 'mixto' ? 'Berdina + San Pablo' : e || '—'

export default function VerOC() {
  const { nro } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const modoAnalisis = !!state?.item || !!state?.items

  const [oc, setOc] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [error, setError] = useState(null)

  const mejorFilaDeItem = (item) => {
    const filas = [1, 2, 3]
      .filter(n => item[`proveedor${n}`])
      .map(n => ({
        nro_pedido:      item.nro_pedido,
        _src:            item._src,
        fecha:           item.fecha,
        nombre_repuesto: item.nombre_repuesto,
        cant:            item.cant,
        precio_unitario: item[`precio${n}`],
        precio_total:    item[`precio${n}`] != null && item.cant ? item[`precio${n}`] * item.cant : null,
        proveedor:       item[`proveedor${n}`],
        observaciones:   '',
        // PROTOTIPO: el adjunto se trae de sessionStorage por _id del ítem.
        // Con backend será item.archivo (URL de Cloudinary).
        archivo:         item.archivo ?? getArchivo(item._id),
      }))
    const conPrecio = filas.filter(f => f.precio_unitario != null && f.precio_unitario > 0)
    return conPrecio.length > 0
      ? conPrecio.reduce((best, f) => f.precio_unitario < best.precio_unitario ? f : best)
      : filas[0] ?? null
  }

  useEffect(() => {
    if (modoAnalisis) {
      const itemsArr = state.items ?? [state.item]
      api.get('/proveedores').catch(() => []).then(provs => {
        setProveedores(provs)
        const mejoresFilas = itemsArr.map(mejorFilaDeItem).filter(Boolean)
        const total = mejoresFilas.reduce((sum, f) => sum + (f.precio_total ?? 0), 0)
        const ref = itemsArr[0]
        setOc({
          nro_oc_display: fmtNro(ref.nro_pedido, ref._src),
          fecha:          ref.fecha,
          establecimiento: ref._src,
          items:          mejoresFilas,
          total,
          _modoAnalisis:  true,
        })
      })
      return
    }

    Promise.all([
      api.get(`/oc/by-display/${encodeURIComponent(nro)}`),
      api.get('/proveedores').catch(() => []),
    ])
      .then(([ocData, provs]) => { setOc(ocData); setProveedores(provs) })
      .catch(err => setError(err.message))
  }, [nro, modoAnalisis])

  const provNombre = (id) =>
    proveedores.find(p => p._id === id)?.razonsocial || id || '—'

  const marcarRetirado = async () => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Marcar como retirado?',
      text: 'Se actualizará el estado de todos los ítems de esta OC.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Retirado',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-success me-2', cancelButton: 'btn btn-outline-secondary' },
    })
    if (!isConfirmed) return
    try {
      await Promise.all((oc.items || []).map(item => {
        const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
        return api.put(`${base}/${item.pedidoId}/items/${item.itemId}`, { estado: 'Retirado', usuario: 'Comprador' })
      }))
      await Swal.fire({ icon: 'success', title: 'Retirado', timer: 1500, showConfirmButton: false })
      navigate(-1)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  if (error) return (
    <div className="container pt-4 text-center">
      <p className="text-danger">{error}</p>
      <button className="btn btn-outline-dark btn-sm" onClick={() => navigate(-1)}>← Volver</button>
    </div>
  )

  if (!oc) return (
    <div className="container-fluid flex-grow-1 d-flex align-items-center justify-content-center">
      <div className="spinner-border text-secondary" role="status" />
    </div>
  )

  return (
    <div className="container-fluid flex-grow-1 d-flex flex-column pt-2">

      <div className="container d-flex justify-content-between align-items-center mb-2">
        <p className="mb-0" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          {oc._modoAnalisis ? 'Análisis' : 'Orden de Compra'}
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-outline-dark btn-sm">← Volver</button>
      </div>

      <div className="container">

        <div className="card mb-3 p-2">
          <div className="d-flex flex-wrap gap-3 align-items-center mb-1">
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {oc._modoAnalisis ? 'N° Pedido' : 'N° OC'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{oc.nro_oc_display}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Fecha</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtFecha(oc.fecha)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {oc._modoAnalisis ? 'Taller' : 'Establecimiento'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{establecimientoLabel(oc.establecimiento)}</div>
            </div>
          </div>
          <div className="text-center" style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {oc._modoAnalisis ? 'Mínimo presupuesto' : 'Total'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-accent)' }}>
              {fmtPrecio(oc.total)}{oc._modoAnalisis && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-muted)', marginLeft: 4 }}>+IVA</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover table-striped mb-0" style={{ fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th>Fecha</th>
                  <th>Repuesto</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-end">Precio Unit.</th>
                  <th className="text-end">Precio Total</th>
                  <th>Proveedor</th>
                  {oc._modoAnalisis && <th className="text-center">Archivo</th>}
                  {!oc._modoAnalisis && <th>Observaciones</th>}
                </tr>
              </thead>
              <tbody>
                {(oc.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="text-nowrap">{fmtFecha(item.fecha)}</td>
                    <td style={{ fontWeight: 500 }}>{item.nombre_repuesto}</td>
                    <td className="text-center">{item.cant ?? '—'}</td>
                    <td className="text-end">{fmtPrecio(item.precio_unitario)}</td>
                    <td className="text-end" style={{ fontWeight: 600 }}>{fmtPrecio(item.precio_total)}</td>
                    <td>{provNombre(item.proveedor)}</td>
                    {oc._modoAnalisis && (
                      <td className="text-center">
                        {item.archivo
                          ? <a
                              href={typeof item.archivo === 'string' ? item.archivo : item.archivo.dataURL}
                              target="_blank"
                              rel="noreferrer"
                              title={typeof item.archivo === 'string' ? 'Ver archivo' : item.archivo.name}
                            >
                              <i className="bi bi-paperclip" /> Ver
                            </a>
                          : <span style={{ color: 'var(--color-muted)' }}>—</span>
                        }
                      </td>
                    )}
                    {!oc._modoAnalisis && (
                      <td style={{ color: item.observaciones ? 'inherit' : 'var(--color-muted)', fontStyle: item.observaciones ? 'normal' : 'italic' }}>
                        {item.observaciones || 'Sin observaciones'}
                      </td>
                    )}
                  </tr>
                ))}
                {(oc.items || []).length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-3">Sin ítems</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f4f6f8' }}>
                  <td colSpan={4} className="text-end" style={{ fontWeight: 700, fontSize: 13 }}>
                    {oc._modoAnalisis ? 'Mínimo presupuesto' : 'Total'}
                  </td>
                  <td className="text-end" style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-accent)' }}>
                    {fmtPrecio(oc.total)}{oc._modoAnalisis && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-muted)', marginLeft: 4 }}>+IVA</span>}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {!oc._modoAnalisis && (
          <div className="d-flex justify-content-center gap-3 mt-3">
            <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>Cancelar</button>
            <button className="btn btn-outline-success" onClick={marcarRetirado}>Retirado ✓</button>
          </div>
        )}

      </div>
    </div>
  )
}
