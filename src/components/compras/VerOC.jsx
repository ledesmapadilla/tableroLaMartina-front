import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { getArchivo } from '../../services/archivoPrototipo'
import {
  BORDO,
  BORDO_SUAVE,
  thGrande as th,
  thGrandeCentro as thCentro,
  tdGrande as td,
  tdGrandeCentro as tdCentro,
} from './formato'
import { Raya } from './estilos'

/** Un dato suelto de la ficha de la OC: rótulo chico arriba, valor abajo. */
const Dato = ({ etiqueta, valor, destacado = false }) => (
  <div className="d-flex flex-column lh-sm">
    <span className="fw-bold text-uppercase" style={{ fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.5px' }}>
      {etiqueta}
    </span>
    <span
      className={destacado ? 'fw-bold' : 'fw-semibold'}
      style={{ fontSize: destacado ? '1.2rem' : '1rem', color: destacado ? BORDO : '#1e293b' }}
    >
      {valor}
    </span>
  </div>
)

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
    // state no cambia mientras no se navegue: react-router devuelve la misma
    // location, así que ponerlo acá no dispara una recarga de más.
  }, [nro, modoAnalisis, state])

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

  if (error)
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center gap-2"
        style={{ flex: 1, backgroundColor: '#f8f9fa', height: '100%' }}
      >
        <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '1.6rem', color: '#dc2626' }}></i>
        <span style={{ fontSize: '0.9rem', color: '#dc2626' }}>{error}</span>
      </div>
    )

  if (!oc)
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ flex: 1, backgroundColor: '#f8f9fa', height: '100%' }}
      >
        <div className="spinner-border" role="status" style={{ color: BORDO }} />
      </div>
    )

  // En modo análisis la última columna es el presupuesto adjunto; en una OC ya
  // emitida, las observaciones. Siempre son siete.
  const COLUMNAS = 7

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
      {/* El ancho de la página lo fija el Container: encabezado, ficha y tabla
          comparten el mismo borde izquierdo y derecho. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.15rem' }}>
            {oc._modoAnalisis ? 'Análisis de precios' : 'Orden de compra'}
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.82rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 700, letterSpacing: '0.5px' }}
          >
            {oc.nro_oc_display}
          </span>
        </div>

        {/* Ficha de la OC */}
        <Card className="mb-3 px-4 py-3 shadow-sm border-0 rounded-3">
          <div className="d-flex flex-wrap align-items-center gap-4">
            <Dato etiqueta={oc._modoAnalisis ? 'N° Pedido' : 'N° OC'} valor={oc.nro_oc_display} destacado />
            <Dato etiqueta="Fecha" valor={fmtFecha(oc.fecha)} />
            <Dato
              etiqueta={oc._modoAnalisis ? 'Taller' : 'Establecimiento'}
              valor={establecimientoLabel(oc.establecimiento)}
            />

            <div className="ms-auto text-end">
              <div className="fw-bold text-uppercase" style={{ fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.5px' }}>
                {oc._modoAnalisis ? 'Mínimo presupuesto' : 'Total'}
              </div>
              <div className="fw-bold" style={{ fontSize: '1.6rem', color: BORDO, lineHeight: 1.2 }}>
                {fmtPrecio(oc.total)}
                {oc._modoAnalisis && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 400, color: '#64748b', marginLeft: 4 }}>+ IVA</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* La tabla ocupa el ancho de la página, el mismo que el encabezado. */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            minHeight: 0,
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '900px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Cant.</th>
                <th style={thCentro}>Precio unit.</th>
                <th style={thCentro}>Precio total</th>
                <th style={th}>Proveedor</th>
                <th style={oc._modoAnalisis ? thCentro : th}>
                  {oc._modoAnalisis ? 'Presupuesto' : 'Observaciones'}
                </th>
              </tr>
            </thead>
            <tbody>
              {(oc.items || []).length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    Esta orden no tiene ítems
                  </td>
                </tr>
              ) : (
                <>
                  {(oc.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td style={tdCentro}>{fmtFecha(item.fecha)}</td>
                      <td style={{ ...td, fontWeight: 500 }}>{item.nombre_repuesto}</td>
                      <td style={tdCentro}>{item.cant ?? <Raya />}</td>
                      <td style={tdCentro}>{item.precio_unitario == null ? <Raya /> : fmtPrecio(item.precio_unitario)}</td>
                      <td style={{ ...tdCentro, fontWeight: 600 }}>
                        {item.precio_total == null ? <Raya /> : fmtPrecio(item.precio_total)}
                      </td>
                      <td style={td}>{provNombre(item.proveedor)}</td>

                      {oc._modoAnalisis ? (
                        <td style={tdCentro}>
                          {item.archivo ? (
                            <a
                              href={typeof item.archivo === 'string' ? item.archivo : item.archivo.dataURL}
                              target="_blank"
                              rel="noreferrer"
                              className="d-inline-flex align-items-center gap-1 text-decoration-none"
                              style={{ color: BORDO, fontWeight: 600 }}
                              title={typeof item.archivo === 'string' ? 'Ver el archivo' : item.archivo.name}
                            >
                              <i className="bi bi-paperclip"></i>
                              <span>Ver</span>
                            </a>
                          ) : (
                            <Raya />
                          )}
                        </td>
                      ) : (
                        <td style={td}>{item.observaciones || <Raya />}</td>
                      )}
                    </tr>
                  ))}

                  {/* La fila de total va con la clase fila-total, si no el
                      hover le gana al fondo. */}
                  <tr className="fila-total">
                    <td style={{ ...td, fontWeight: 700, color: BORDO }}>
                      {oc._modoAnalisis ? 'MÍNIMO PRESUPUESTO' : 'TOTAL'}
                    </td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                    <td style={{ ...tdCentro, fontWeight: 700, color: BORDO }}>
                      {fmtPrecio(oc.total)}
                      {oc._modoAnalisis && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 400, color: '#64748b', marginLeft: 3 }}>
                          + IVA
                        </span>
                      )}
                    </td>
                    <td style={td} />
                    <td style={td} />
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>

        {/* Solo una OC emitida se puede marcar como retirada: en modo análisis
            todavía no hay nada que retirar. */}
        {!oc._modoAnalisis && (
          <div className="d-flex justify-content-center gap-3 mt-3 flex-shrink-0">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate(-1)}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={marcarRetirado}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Marcar como retirado</span>
            </Button>
          </div>
        )}
      </Container>
    </div>
  )
}
