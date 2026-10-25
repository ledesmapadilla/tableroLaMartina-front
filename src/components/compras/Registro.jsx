import { useEffect, useMemo, useState } from 'react'
import { Container, Card, Table, Modal } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, th, thCentro, td, tdCentro } from './formato'
import { Raya, FiltroTexto, FiltroSelect, BotonAccion } from './estilos'
import { nombreRol } from '../../utils/permisosCatalogo'

// Lo que sigue a /api en la ruta, con el nombre que se lee en pantalla.
const SECCIONES = {
  auth: 'Login',
  partes: 'Partes diarios',
  periodos: 'Períodos',
  gasoil: 'Gasoil',
  op: 'Órdenes de pago',
  berdina: 'Pedidos Berdina',
  sanpablo: 'Pedidos San Pablo',
  'presupuestos-reparaciones': 'Presupuestos reparaciones',
  stock: 'Almacén',
  'centros-costo': 'Centros de costo',
  personal: 'Personal',
  tareas: 'Tareas',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  usuarios: 'Usuarios',
  roles: 'Roles',
  variables: 'Variables',
  lotes: 'Lotes',
  admisibles: 'Admisibles',
  descuentos: 'Descuentos',
  cambios: 'Cambios de certificación',
  'ingresos-sanpablo': 'Ingresos San Pablo',
  tractores: 'Tractores',
  camionetas: 'Camionetas',
  colectivos: 'Colectivos',
  visitas: 'Visitas',
  archivos: 'Archivos',
}
const nombreSeccion = (s) => SECCIONES[s] || s || ''

const ACCIONES = { alta: 'Alta', cambio: 'Cambio', baja: 'Baja', login: 'Entrada' }
const COLOR_ACCION = { Alta: '#15803d', Cambio: '#1d4ed8', Baja: '#b91c1c', Entrada: '#475569' }

/**
 * Qué hizo el renglón. Un PUT que crea o borra (las observaciones de gasoil,
 * por ejemplo) dice lo que de verdad pasó, si el back anotó el antes y el
 * después.
 */
const accionDe = (f) => {
  if (f.accion === 'login') return ACCIONES.login
  const tipos = [...new Set((f.cambios || []).map((c) => c.tipo))]
  return ACCIONES[tipos.length === 1 ? tipos[0] : f.accion]
}

const resumenDe = (f) => {
  if (f.accion === 'login') return f.ok ? 'Entró al sistema' : 'Intento de entrar'
  if (!f.cambios?.length) return f.ruta.replace(/^\/api\//, '')
  return f.cambios
    .map((c) => (c.tipo === 'cambio' ? `${c.modelo}: ${c.campos.map((x) => x.campo).join(', ')}` : `${ACCIONES[c.tipo]} de ${c.modelo.toLowerCase()}`))
    .join(' · ')
}

const ZONA = 'America/Argentina/Buenos_Aires'
const fechaHora = (iso) => {
  const d = new Date(iso)
  return {
    fecha: d.toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}
const hoy = (menosDias = 0) => {
  const d = new Date(Date.now() - menosDias * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

// Un valor guardado como texto JSON, para leer.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const Valor = ({ texto }) => {
  if (texto === null || texto === undefined) return <Raya />
  let v
  try {
    v = JSON.parse(texto)
  } catch {
    v = texto
  }
  if (v === null || v === '') return <Raya />
  if (typeof v === 'string' && ISO.test(v)) {
    const { fecha, hora } = fechaHora(v)
    return <span>{v.endsWith('T00:00:00.000Z') ? new Date(v).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : `${fecha} ${hora}`}</span>
  }
  if (typeof v === 'object') return <code style={{ fontSize: '0.66rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(v)}</code>
  if (typeof v === 'boolean') return <span>{v ? 'Sí' : 'No'}</span>
  return <span>{String(v)}</span>
}

// El documento entero de un alta o una baja, campo por campo.
const camposDeDoc = (texto) => {
  try {
    return Object.entries(JSON.parse(texto) || {})
      .filter(([k]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(k))
      .map(([campo, v]) => ({ campo, valor: JSON.stringify(v) }))
  } catch {
    return []
  }
}

/**
 * El registro de cambios (25/10/2026): quién hizo qué y cuándo. Solo el
 * superadmin. Cada alta, cambio o baja del sistema, y cada intento de entrar;
 * en los partes y en gasoil, además, el antes y el después de cada campo.
 * Se guarda un año.
 *
 * El back filtra por días; usuario, sección y acción se filtran acá, con las
 * opciones de todo el período.
 */
export default function Registro() {
  const [desde, setDesde] = useState(hoy(7))
  const [hasta, setHasta] = useState(hoy())
  const [filas, setFilas] = useState([])
  const [recortado, setRecortado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [usuario, setUsuario] = useState('')
  const [seccion, setSeccion] = useState('')
  const [accion, setAccion] = useState('')
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    let vigente = true
    api
      .get(`/registro?desde=${desde}&hasta=${hasta}`)
      .then((r) => {
        if (!vigente) return
        setFilas(r.filas || [])
        setRecortado(Boolean(r.recortado))
      })
      .catch((err) => {
        if (vigente) Swal.fire({ icon: 'error', title: 'No se pudo cargar el registro', text: err.message })
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [desde, hasta])

  // Cambiar las fechas vuelve a pedir el registro.
  const cambiarDesde = (v) => {
    setCargando(true)
    setDesde(v || hoy(7))
  }
  const cambiarHasta = (v) => {
    setCargando(true)
    setHasta(v || hoy())
  }

  const quien = (f) => f.nombre || f.usuario || 'Sin usuario'
  const opciones = useMemo(
    () => ({
      usuarios: [...new Set(filas.map(quien))].sort((a, b) => a.localeCompare(b)),
      secciones: [...new Set(filas.map((f) => nombreSeccion(f.seccion)))].sort((a, b) => a.localeCompare(b)),
      acciones: Object.values(ACCIONES).filter((a) => filas.some((f) => accionDe(f) === a)),
    }),
    [filas]
  )
  const lista = filas.filter(
    (f) =>
      (!usuario || quien(f) === usuario) &&
      (!seccion || nombreSeccion(f.seccion) === seccion) &&
      (!accion || accionDe(f) === accion)
  )
  const hayFiltro = Boolean(usuario || seccion || accion)

  const abrir = (id) =>
    api
      .get(`/registro/${id}`)
      .then(setDetalle)
      .catch((err) => Swal.fire({ icon: 'error', title: 'No se pudo abrir el detalle', text: err.message }))

  const datosEnviados = detalle?.datos ? camposDeDoc(detalle.datos) : []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa', height: '100%', overflow: 'hidden' }}>
      <Container
        fluid
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Registro de cambios
          </span>
          <span className="text-muted" style={{ fontSize: '0.78rem' }}>
            Quién cargó, cambió o borró qué, y cuándo. Se guarda un año.
          </span>
        </div>

        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex flex-wrap align-items-end gap-2">
            <FiltroTexto etiqueta="Desde" ancho="150px" tipo="date" valor={desde} onChange={cambiarDesde} />
            <FiltroTexto etiqueta="Hasta" ancho="150px" tipo="date" valor={hasta} onChange={cambiarHasta} />
            <FiltroSelect etiqueta="Usuario" ancho="190px" valor={usuario} vacio="Todos" onChange={setUsuario} opciones={opciones.usuarios} />
            <FiltroSelect etiqueta="Sección" ancho="190px" valor={seccion} vacio="Todas" onChange={setSeccion} opciones={opciones.secciones} />
            <FiltroSelect etiqueta="Acción" ancho="130px" valor={accion} vacio="Todas" onChange={setAccion} opciones={opciones.acciones} />
            <span className="ms-auto text-muted" style={{ fontSize: '0.75rem' }}>
              {lista.length} {lista.length === 1 ? 'renglón' : 'renglones'}
              {recortado && ' · se muestran los 2000 más nuevos: acortá las fechas'}
            </span>
          </div>
        </Card>

        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '900px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={thCentro}>Hora</th>
                <th style={th}>Usuario</th>
                <th style={thCentro}>Acción</th>
                <th style={th}>Sección</th>
                <th style={th}>Qué</th>
                <th style={th}>Resultado</th>
                <th style={thCentro}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4" style={td}>
                    {cargando ? 'Cargando…' : hayFiltro ? 'Ningún renglón coincide con los filtros' : 'No hay nada anotado en esas fechas'}
                  </td>
                </tr>
              ) : (
                lista.map((f) => {
                  const { fecha, hora } = fechaHora(f.fecha)
                  const a = accionDe(f)
                  return (
                    <tr key={f._id}>
                      <td style={tdCentro}>{fecha}</td>
                      <td style={tdCentro}>{hora}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 500 }}>{quien(f)}</span>
                        {f.rol && <span className="text-muted"> · {nombreRol(f.rol)}</span>}
                      </td>
                      <td style={tdCentro}>
                        <span className="badge" style={{ backgroundColor: COLOR_ACCION[a] || '#334155', fontSize: '0.62rem' }}>
                          {a}
                        </span>
                      </td>
                      <td style={td}>{nombreSeccion(f.seccion)}</td>
                      <td style={{ ...td, maxWidth: '360px' }}>{resumenDe(f)}</td>
                      <td style={td}>
                        {f.ok ? (
                          <span style={{ color: '#15803d' }}>Bien</span>
                        ) : (
                          <span style={{ color: '#b91c1c' }}>{f.error || `Error ${f.estado}`}</span>
                        )}
                      </td>
                      <td style={tdCentro}>
                        {f.accion === 'login' ? (
                          <Raya />
                        ) : (
                          <BotonAccion icono="bi-eye" titulo="Ver el detalle" onClick={() => abrir(f._id)} />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      <Modal show={Boolean(detalle)} onHide={() => setDetalle(null)} centered size="lg" contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: BORDO, color: '#fff', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <Modal.Title className="fs-6 fw-bold text-white">
            {detalle && `${accionDe(detalle)} en ${nombreSeccion(detalle.seccion)} · ${quien(detalle)}`}
          </Modal.Title>
        </Modal.Header>
        {detalle && (
          <Modal.Body className="p-3" style={{ fontSize: '0.8rem' }}>
            <div className="text-muted mb-3">
              {(() => {
                const { fecha, hora } = fechaHora(detalle.fecha)
                return `${fecha} ${hora}`
              })()}{' '}
              · {detalle.metodo} {detalle.ruta}
              {detalle.ip && ` · IP ${detalle.ip}`}
            </div>

            {detalle.cambios.map((c, i) => {
              const filasCambio = c.tipo === 'cambio' ? c.campos : camposDeDoc(c.doc)
              return (
                <div key={i} className="mb-3">
                  <div className="fw-bold mb-1" style={{ color: BORDO }}>
                    {ACCIONES[c.tipo]} de {c.modelo.toLowerCase()}
                  </div>
                  <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: '180px' }}>Campo</th>
                        {c.tipo === 'cambio' ? (
                          <>
                            <th style={th}>Antes</th>
                            <th style={th}>Después</th>
                          </>
                        ) : (
                          <th style={th}>{c.tipo === 'alta' ? 'Cómo quedó' : 'Cómo estaba'}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filasCambio.map((x) => (
                        <tr key={x.campo}>
                          <td style={{ ...td, fontWeight: 500 }}>{x.campo}</td>
                          {c.tipo === 'cambio' ? (
                            <>
                              <td style={td}><Valor texto={x.antes} /></td>
                              <td style={td}><Valor texto={x.despues} /></td>
                            </>
                          ) : (
                            <td style={td}><Valor texto={x.valor} /></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )
            })}

            <div className="fw-bold mb-1" style={{ color: BORDO }}>
              Lo que se mandó
            </div>
            {datosEnviados.length ? (
              <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%' }}>
                <tbody>
                  {datosEnviados.map((x) => (
                    <tr key={x.campo}>
                      <td style={{ ...td, fontWeight: 500, width: '180px' }}>{x.campo}</td>
                      <td style={td}><Valor texto={x.valor} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-muted">Nada (solo la dirección)</div>
            )}
            {!detalle.ok && (
              <div className="mt-3" style={{ color: '#b91c1c' }}>
                No se guardó: {detalle.error || `error ${detalle.estado}`}
              </div>
            )}
          </Modal.Body>
        )}
      </Modal>
    </div>
  )
}
