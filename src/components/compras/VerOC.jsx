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
import { opcionElegida } from './precioElegido'

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

const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const escaparHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const establecimientoLabel = (e) =>
  e === 'berdina' ? 'Berdina' : e === 'sanpablo' ? 'San Pablo' : e === 'mixto' ? 'Berdina + San Pablo' : e || '—'

/**
 * En modo análisis, la fila de cada ítem: el presupuesto que eligió el
 * analista (el más barato si no eligió otro). Es el mismo con el que se
 * decidió si iba a Gerencia y con el que se arma la orden de compra; antes
 * acá se tomaba siempre el mínimo. Sin ningún precio, el primer proveedor.
 */
const filaElegidaDeItem = (item) => {
  const elegida = opcionElegida(item)
  const n = elegida ? elegida.n : [1, 2, 3].find((k) => item[`proveedor${k}`])
  if (!n) return null
  const precio = item[`precio${n}`]
  return {
    nro_pedido:      item.nro_pedido,
    _src:            item._src,
    fecha:           item.fecha,
    nombre_repuesto: item.nombre_repuesto,
    cant:            item.cant,
    precio_unitario: precio,
    precio_total:    precio != null && item.cant ? precio * item.cant : null,
    proveedor:       item[`proveedor${n}`],
    observaciones:   '',
    esMinima:        elegida ? elegida.esMinima : true,
    // PROTOTIPO: el adjunto se trae de sessionStorage por _id del ítem.
    // Con backend será item.archivo (URL de Cloudinary).
    archivo:         item.archivo ?? getArchivo(item._id),
  }
}

export default function VerOC() {
  const { nro } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const modoAnalisis = !!state?.item || !!state?.items
  // Desde una tabla de pedidos la OC se abre para retirar un ítem, o los de
  // un pedido: solo esos se marcan. Sin esa lista se retira la OC entera.
  const retirar = state?.retirar

  const [oc, setOc] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (modoAnalisis) {
      const itemsArr = state.items ?? [state.item]
      api.get('/proveedores').catch(() => []).then(provs => {
        setProveedores(provs)
        const filas = itemsArr.map(filaElegidaDeItem).filter(Boolean)
        const total = filas.reduce((sum, f) => sum + (f.precio_total ?? 0), 0)
        const ref = itemsArr[0]
        setOc({
          nro_oc_display: fmtNro(ref.nro_pedido, ref._src),
          fecha:          ref.fecha,
          establecimiento: ref._src,
          items:          filas,
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

  const aRetirar = (oc?.items || []).filter((it) => !retirar || retirar.includes(String(it.itemId)))
  const retiroParcial = aRetirar.length < (oc?.items || []).length

  /**
   * Pide quién retiró, cuándo y alguna observación, y pasa a Retirado los
   * ítems que se retiran. Queda en el historial de cada ítem como usuario,
   * fecha y nota: es lo que muestra el badge "Retirado" en las tablas.
   */
  const marcarRetirado = async () => {
    const hoy = hoyLocal()
    const aviso = retiroParcial
      ? `Solo se marca${aRetirar.length === 1 ? '' : 'n'}: <strong>${escaparHtml(aRetirar.map((i) => i.nombre_repuesto).join(', '))}</strong>`
      : 'Se actualizará el estado de todos los ítems de esta OC.'
    const rotulo = 'display:block;font-weight:600;font-size:0.8rem;color:#475569;margin:12px 0 4px'
    const campo = 'width:100%;margin:0;font-size:0.9rem;box-sizing:border-box'
    const { value: retiro, isConfirmed } = await Swal.fire({
      title: 'Marcar como retirado',
      html: `
        <div style="text-align:left">
          <div style="font-size:0.84rem;color:#64748b">${aviso}</div>
          <label for="ret-nombre" style="${rotulo}">Nombre de quien retira</label>
          <input id="ret-nombre" class="swal2-input" style="${campo}" autocomplete="off">
          <label for="ret-fecha" style="${rotulo}">Fecha</label>
          <input id="ret-fecha" type="date" class="swal2-input" style="${campo}" value="${hoy}" max="${hoy}">
          <label for="ret-obs" style="${rotulo}">Observaciones</label>
          <textarea id="ret-obs" class="swal2-textarea" style="${campo};min-height:80px" placeholder="Opcional"></textarea>
        </div>`,
      width: 440,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Retirado',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-success me-2', cancelButton: 'btn btn-outline-secondary' },
      didOpen: (popup) => popup.querySelector('#ret-nombre')?.focus(),
      preConfirm: () => {
        const popup = Swal.getPopup()
        const nombre = popup.querySelector('#ret-nombre').value.trim()
        const fecha = popup.querySelector('#ret-fecha').value
        const observaciones = popup.querySelector('#ret-obs').value.trim()
        if (!nombre) { Swal.showValidationMessage('Indicá el nombre de quien retira'); return false }
        if (!fecha) { Swal.showValidationMessage('Indicá la fecha del retiro'); return false }
        if (fecha > hoy) { Swal.showValidationMessage('La fecha no puede ser posterior a hoy'); return false }
        return { nombre, fecha, observaciones }
      },
    })
    if (!isConfirmed) return
    // Mediodía local: con la medianoche UTC el día se correría para atrás.
    const fechaHistorial = new Date(`${retiro.fecha}T12:00:00`).toISOString()
    try {
      await Promise.all(aRetirar.map(item => {
        const base = item._src === 'berdina' ? '/berdina/pedidos' : '/sanpablo/pedidos'
        return api.put(`${base}/${item.pedidoId}/items/${item.itemId}`, {
          estado: 'Retirado',
          usuario: retiro.nombre,
          fechaHistorial,
          ...(retiro.observaciones ? { nota: retiro.observaciones } : {}),
        })
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

  // Los ítems que se retiran, por proveedor, para el recuadro de "Dónde retirar".
  const porProveedor = Object.values(
    aRetirar.reduce((acc, it) => {
      const id = it.proveedor || ''
      if (!acc[id]) {
        const datos = id ? proveedores.find((p) => p._id === id) || null : null
        acc[id] = {
          id,
          nombre: id ? datos?.razonsocial || 'Proveedor' : 'Sin proveedor asignado',
          datos,
          items: [],
        }
      }
      acc[id].items.push(it)
      return acc
    }, {})
  )

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
        // Una OC emitida va más angosta: son pocos ítems y lo que importa es
        // dónde retirarlos. El análisis de precios conserva el ancho completo.
        style={{ maxWidth: oc._modoAnalisis ? '1280px' : '960px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
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
                {oc._modoAnalisis ? 'Total presupuestado' : 'Total'}
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

        {/* Dónde retirar: un recuadro por proveedor con cómo contactarlo y qué
            hay que buscar. Es lo que necesita quien va a retirar la compra. */}
        {/* Va con marco verde, el color de retirar, para que se separe del
            bordó del resto de la pantalla. */}
        {!oc._modoAnalisis && porProveedor.length > 0 && (
          <div
            className="mb-3 flex-shrink-0 rounded-3 px-3 py-2"
            style={{ border: '2px solid #16a34a', backgroundColor: '#f0fdf4' }}
          >
            <div className="fw-bold mb-2" style={{ color: '#15803d', fontSize: '0.92rem' }}>
              <i className="bi bi-geo-alt-fill me-1"></i>
              Dónde retirar
              {retiroParcial && (
                <span className="fw-normal" style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 6 }}>
                  · {aRetirar.length} de {(oc.items || []).length} ítems de la OC
                </span>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {porProveedor.map((g) => (
                <div
                  key={g.id || 'sin-proveedor'}
                  className="bg-white shadow-sm rounded-3 px-3 py-2"
                  style={{ borderLeft: `5px solid ${g.id ? '#16a34a' : '#94a3b8'}`, flex: '1 1 260px', minWidth: 220 }}
                >
                  <div className="fw-bold" style={{ color: g.id ? BORDO : '#64748b', fontSize: '1.05rem' }}>
                    <i className="bi bi-shop me-1"></i>
                    {g.nombre}
                  </div>
                  {g.datos && (g.datos.contacto || g.datos.telefono) && (
                    <div style={{ fontSize: '0.84rem', color: '#334155' }}>
                      {g.datos.contacto}
                      {g.datos.contacto && g.datos.telefono && ' · '}
                      {/* El teléfono se ve destacado pero no es un enlace. */}
                      {g.datos.telefono && (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          <i className="bi bi-telephone-fill me-1"></i>
                          {g.datos.telefono}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                    {g.items.length} {g.items.length === 1 ? 'ítem' : 'ítems'}:{' '}
                    {g.items.map((i) => `${i.nombre_repuesto}${i.cant ? ` (${i.cant})` : ''}`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* En el celular, una tarjeta por ítem en lugar de la tabla: el análisis
            de precios lo mira Gerencia desde el teléfono y siete columnas no
            entran. La tabla queda para pantallas medianas en adelante. */}
        <div className="d-md-none flex-grow-1 d-flex flex-column gap-2" style={{ minHeight: 0, overflowY: 'auto' }}>
          {(oc.items || []).length === 0 ? (
            <div className="text-center text-muted py-4" style={{ fontSize: '0.85rem' }}>
              Esta orden no tiene ítems
            </div>
          ) : (
            <>
              {(oc.items || []).map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white shadow-sm rounded-3 px-3 py-2 flex-shrink-0"
                  style={{ border: '1px solid #e2e8f0', opacity: aRetirar.includes(item) ? 1 : 0.4 }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <span className="fw-semibold" style={{ fontSize: '0.92rem', color: '#1e293b' }}>
                      {item.nombre_repuesto}
                    </span>
                    <span className="fw-bold" style={{ color: BORDO, whiteSpace: 'nowrap' }}>
                      {item.precio_total == null ? <Raya /> : fmtPrecio(item.precio_total)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {item.cant ?? <Raya />} ×{' '}
                    {item.precio_unitario == null ? <Raya /> : fmtPrecio(item.precio_unitario)}
                  </div>
                  <div style={{ fontSize: '0.84rem', marginTop: 2 }}>
                    <span style={oc._modoAnalisis ? { color: '#334155' } : { color: BORDO, fontWeight: 700 }}>
                      <i className="bi bi-shop me-1"></i>
                      {provNombre(item.proveedor)}
                    </span>
                    {oc._modoAnalisis && item.esMinima === false && (
                      <div style={{ fontSize: '0.74rem', color: '#b45309' }}>elegido, no es el más bajo</div>
                    )}
                  </div>
                  {oc._modoAnalisis && item.archivo && (
                    <a
                      href={typeof item.archivo === 'string' ? item.archivo : item.archivo.dataURL}
                      target="_blank"
                      rel="noreferrer"
                      className="d-inline-flex align-items-center gap-1 text-decoration-none mt-1"
                      style={{ color: BORDO, fontWeight: 600, fontSize: '0.84rem' }}
                    >
                      <i className="bi bi-paperclip"></i>
                      <span>Ver presupuesto</span>
                    </a>
                  )}
                  {!oc._modoAnalisis && item.observaciones && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>{item.observaciones}</div>
                  )}
                </div>
              ))}

              <div
                className="rounded-3 px-3 py-2 d-flex justify-content-between align-items-center flex-shrink-0"
                style={{ backgroundColor: BORDO_SUAVE, borderTop: `2px solid ${BORDO}` }}
              >
                <span className="fw-bold" style={{ color: BORDO, fontSize: '0.84rem' }}>
                  {oc._modoAnalisis ? 'TOTAL PRESUPUESTADO' : 'TOTAL'}
                </span>
                <span className="fw-bold" style={{ color: BORDO }}>
                  {fmtPrecio(oc.total)}
                  {oc._modoAnalisis && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748b', marginLeft: 3 }}>+ IVA</span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        {/* La tabla ocupa el ancho de la página, el mismo que el encabezado. */}
        <div
          className="d-none d-md-block flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{
            minHeight: 0,
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table
            className="mb-0 tabla-informe tabla-compras"
            style={{ width: '100%', minWidth: oc._modoAnalisis ? '900px' : '720px' }}
          >
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
                  {/* Los ítems de la OC que no se retiran ahora quedan atenuados. */}
                  {(oc.items || []).map((item, idx) => (
                    <tr
                      key={idx}
                      style={aRetirar.includes(item) ? undefined : { opacity: 0.4 }}
                      title={aRetirar.includes(item) ? undefined : 'Este ítem no se retira ahora'}
                    >
                      <td style={tdCentro}>{fmtFecha(item.fecha)}</td>
                      <td style={{ ...td, fontWeight: 500 }}>{item.nombre_repuesto}</td>
                      <td style={tdCentro}>{item.cant ?? <Raya />}</td>
                      <td style={tdCentro}>{item.precio_unitario == null ? <Raya /> : fmtPrecio(item.precio_unitario)}</td>
                      <td style={{ ...tdCentro, fontWeight: 600 }}>
                        {item.precio_total == null ? <Raya /> : fmtPrecio(item.precio_total)}
                      </td>
                      {/* En una OC emitida el proveedor es a dónde hay que ir a
                          retirar: va destacado. */}
                      <td style={oc._modoAnalisis ? td : { ...td, fontWeight: 700, color: BORDO }}>
                        {provNombre(item.proveedor)}
                        {/* El gerente tiene que ver que no es el presupuesto más barato. */}
                        {oc._modoAnalisis && item.esMinima === false && (
                          <span style={{ fontSize: '0.72rem', color: '#b45309', marginLeft: 6 }}>
                            elegido, no es el más bajo
                          </span>
                        )}
                      </td>

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
                      {oc._modoAnalisis ? 'TOTAL PRESUPUESTADO' : 'TOTAL'}
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
              disabled={aRetirar.length === 0}
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
