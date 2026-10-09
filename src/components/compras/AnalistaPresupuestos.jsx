import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { verHistorialPedido } from './detallePedido'
import { exportarPlanilla } from '../../helpers/excel'
import { api } from '../../services/api'
import { BORDO, th, thCentro, td, tdCentro, COLOR_NRO_SIMPLE } from './formato'
import { Raya, BotonAccion, FiltroTexto, FiltroSelect } from './estilos'
import { ESTADOS_PRESUPUESTO, fmtPresupuesto } from './presupuestos'
import { SISTEMAS_MANITOU } from '../../utils/sistemasManitou'
import { opcionElegida } from './precioElegido'
import { usePermisos } from '../../context/permisos'

const tituloSistema = (id) => SISTEMAS_MANITOU.find((s) => s.id === id)?.titulo || id || ''

const fmtPrecio = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

// El precio que vale (el elegido o el más barato), o null si no tiene.
const precioDe = (p) => opcionElegida(p)?.precio ?? null

/**
 * El precio cargado directo en la tabla: con el foco es un número; sin el
 * foco se lee como importe. Se guarda al salir del campo o con Enter, solo si
 * cambió.
 */
function CeldaPrecio({ presupuesto, onGuardar, deshabilitado }) {
  const actual = precioDe(presupuesto)
  const [enFoco, setEnFoco] = useState(false)
  const [valor, setValor] = useState('')

  const salir = () => {
    setEnFoco(false)
    const n = valor.trim() === '' ? null : Number(valor)
    if (n !== null && (!Number.isFinite(n) || n < 0)) return
    if (n === actual) return
    onGuardar(presupuesto, n)
  }

  return (
    <input
      type={enFoco ? 'number' : 'text'}
      className={`form-control form-control-sm text-center${actual === null ? ' precio-sin-cotizar' : ''}`}
      className="form-control form-control-sm text-center"
      // Sin precio se destaca en ámbar: es lo que falta cotizar.
      style={{
        fontSize: '0.7rem',
        height: '22px',
        padding: '0 4px',
        width: '110px',
        margin: '0 auto',
        fontWeight: actual !== null ? 600 : 400,
        ...(actual === null && !enFoco ? { backgroundColor: '#fde68a', borderColor: '#d97706', color: '#92400e' } : {}),
      }}
      value={enFoco ? valor : actual !== null ? fmtPrecio(actual) : ''}
      onFocus={() => {
        setValor(actual !== null ? String(actual) : '')
        setEnFoco(true)
      }}
      onChange={(e) => setValor(e.target.value)}
      onBlur={salir}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur()
      }}
      placeholder="Cotizar"
      disabled={deshabilitado}
      title={deshabilitado ? 'Sin permiso para editar' : 'Precio unitario sin IVA'}
    />
  )
}

/**
 * Presupuestos reparaciones (08/10/2026): la tabla de Pedidos del analista
 * para lo que el taller manda a cotizar desde Manitous › General. Acá hay un
 * solo paso, el de cotizar (el análisis): sin taller, urgencia, O.P. ni apuro.
 * Cada fila es un repuesto; tocarla abre su cotización.
 */
export default function AnalistaPresupuestos() {
  const navigate = useNavigate()
  const { puede } = usePermisos()
  const sinEditar = !puede('compras.analista', 'editar')
  const [presupuestos, setPresupuestos] = useState([])
  const [cargando, setCargando] = useState(true)
  const FILTROS_INIT = { nro: '', fecha: '', cc: '', repuesto: '', grupo: '', solicita: '', estado: '' }
  const [filtros, setFiltros] = useState(FILTROS_INIT)
  const setF = (k, v) => setFiltros((f) => ({ ...f, [k]: v }))
  const hayFiltros = Object.values(filtros).some((v) => v !== '')

  useEffect(() => {
    api
      .get('/presupuestos-reparaciones')
      .then((data) => setPresupuestos(Array.isArray(data) ? data : []))
      .catch(() => setPresupuestos([]))
      .finally(() => setCargando(false))
  }, [])

  const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

  const lista = presupuestos.filter((p) => {
    if (filtros.nro && !fmtPresupuesto(p.nro).includes(filtros.nro.toUpperCase())) return false
    if (filtros.fecha && new Date(p.fecha).toLocaleDateString('en-CA') !== filtros.fecha) return false
    if (filtros.cc && !p.cc?.toLowerCase().includes(filtros.cc.toLowerCase())) return false
    if (filtros.repuesto && !p.nombre_repuesto?.toLowerCase().includes(filtros.repuesto.toLowerCase())) return false
    if (filtros.grupo && p.grupo !== filtros.grupo) return false
    if (filtros.solicita && !p.solicita?.toLowerCase().includes(filtros.solicita.toLowerCase())) return false
    if (filtros.estado && p.estado !== filtros.estado) return false
    return true
  })

  const grupos = [...new Set(presupuestos.map((p) => p.grupo).filter(Boolean))].sort()

  const reemplazar = (nuevo) => setPresupuestos((prev) => prev.map((p) => (p._id === nuevo._id ? nuevo : p)))
  const error = (titulo, err) => Swal.fire({ icon: 'error', title: titulo, text: err.message, width: '300px' })

  // El precio escrito en la tabla queda como el presupuesto 1 elegido y lo
  // deja cotizado. Borrarlo saca los tres precios: sin precio ni observación
  // vuelve a "Para cotizar" (lo decide el back).
  const guardarPrecio = async (p, precio) => {
    try {
      reemplazar(
        await api.put(
          `/presupuestos-reparaciones/${p._id}`,
          precio !== null
            ? { precio1: precio, elegido: 1, cotizar: true }
            : { precio1: null, precio2: null, precio3: null, elegido: null }
        )
      )
    } catch (err) {
      error('No se pudo guardar el precio', err)
    }
  }

  // Las observaciones: el + las escribe; el ojo las muestra y, con permiso,
  // las deja corregir.
  const abrirObservaciones = async (p) => {
    if (sinEditar) {
      Swal.fire({ title: 'Observaciones', text: p.observaciones, width: '440px', confirmButtonText: 'Cerrar', confirmButtonColor: '#1e293b' })
      return
    }
    const { value, isConfirmed } = await Swal.fire({
      title: 'Observaciones',
      text: p.nombre_repuesto,
      input: 'textarea',
      inputValue: p.observaciones || '',
      width: '440px',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1e293b',
      cancelButtonColor: '#64748b',
    })
    if (!isConfirmed || (value || '').trim() === (p.observaciones || '')) return
    try {
      reemplazar(await api.put(`/presupuestos-reparaciones/${p._id}`, { observaciones: value }))
      Swal.fire({ icon: 'success', title: 'Observación guardada', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (err) {
      error('No se pudo guardar', err)
    }
  }

  const cotizar = (p) => navigate(`/compras/analista/presupuestos-reparaciones/${p._id}`)

  const exportarExcel = () =>
    exportarPlanilla({
      titulo: 'Presupuestos reparaciones — La Martina',
      columnas: [
        { titulo: 'N°', ancho: 10 },
        { titulo: 'Fecha', ancho: 12 },
        { titulo: 'C.C.', ancho: 10 },
        { titulo: 'Repuesto', ancho: 28 },
        { titulo: 'Cant.', ancho: 8 },
        { titulo: 'Un.', ancho: 8 },
        { titulo: 'Descripción', ancho: 34 },
        { titulo: 'Grupo', ancho: 14 },
        { titulo: 'Origen', ancho: 34 },
        { titulo: 'Solicita', ancho: 18 },
        { titulo: 'Precio unit. sin IVA', ancho: 18 },
        { titulo: 'Observaciones', ancho: 40 },
        { titulo: 'Estado', ancho: 14 },
      ],
      filas: lista.map((p) => [
        fmtPresupuesto(p.nro),
        fechaCorta(p.fecha),
        p.cc || '',
        p.nombre_repuesto,
        p.cant ?? '',
        p.unidad || '',
        p.descripcion || '',
        p.grupo || '',
        origenDe(p),
        p.solicita || '',
        precioDe(p) ?? '',
        p.observaciones || '',
        p.estado,
      ]),
      hoja: 'Presupuestos',
      archivo: `Presupuestos_Reparaciones_${new Date().toISOString().slice(0, 10)}.xlsx`,
    })

  // De qué fila del chequeo salió: el sistema, el ítem y la cosecha.
  const origenDe = (p) =>
    [tituloSistema(p.sistema), p.item, p.cosecha && `Cosecha ${p.cosecha}`].filter(Boolean).join(' · ')

  const verHistorial = (p) =>
    verHistorialPedido({
      titulo: `Historial · ${p.nombre_repuesto}`,
      secciones: [{ historial: p.historial || [] }],
    })


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
      <style>{`
        .tabla-informe.tabla-analista thead th { font-weight: 700; }
        .precio-sin-cotizar::placeholder { color: #92400e; font-weight: 600; opacity: 1; }
      `}</style>

      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1180px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Presupuestos reparaciones
          </span>

          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={lista.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        {/* Filtros, con el rótulo arriba del campo. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-nowrap" style={{ overflowX: 'auto' }}>
            <FiltroTexto etiqueta="N°" ancho="80px" valor={filtros.nro} onChange={(v) => setF('nro', v)} placeholder="N°" />
            <FiltroTexto etiqueta="Fecha" ancho="130px" tipo="date" valor={filtros.fecha} onChange={(v) => setF('fecha', v)} />
            <FiltroTexto etiqueta="C.C." ancho="82px" valor={filtros.cc} onChange={(v) => setF('cc', v)} placeholder="C.C." />
            <FiltroTexto etiqueta="Repuesto" ancho="150px" valor={filtros.repuesto} onChange={(v) => setF('repuesto', v)} placeholder="Repuesto…" />
            <FiltroSelect etiqueta="Grupo" ancho="120px" valor={filtros.grupo} vacio="Todos" onChange={(v) => setF('grupo', v)} opciones={grupos} />
            <FiltroTexto etiqueta="Solicita" ancho="120px" valor={filtros.solicita} onChange={(v) => setF('solicita', v)} placeholder="Solicitante…" />
            <FiltroSelect etiqueta="Estado" ancho="150px" valor={filtros.estado} vacio="Todos" onChange={(v) => setF('estado', v)} opciones={ESTADOS_PRESUPUESTO} destacado />
          </div>
        </Card>

        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, maxWidth: '100%', overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras tabla-analista" style={{ width: '100%', minWidth: '1080px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>N°</th>
                <th style={thCentro}>Fecha</th>
                <th style={thCentro}>C.C.</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Cant.</th>
                <th style={thCentro}>Un.</th>
                <th style={thCentro}>Descripción</th>
                <th style={th}>Grupo</th>
                <th style={th}>Solicita</th>
                <th style={{ ...thCentro, width: 140 }}>Precio unit. sin IVA</th>
                <th style={thCentro}>Observaciones</th>
                <th style={thCentro}>Adjunto</th>
                <th style={{ ...thCentro, width: 90 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={13} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center text-muted py-4" style={td}>
                    {hayFiltros ? 'Ningún presupuesto coincide con los filtros' : 'No hay presupuestos'}
                  </td>
                </tr>
              ) : (
                lista.map((p) => {
                  return (
                    <tr
                      key={p._id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => cotizar(p)}
                      title={p.estado === 'Cotizado' ? 'Ver la cotización' : 'Cotizar'}
                    >
                      <td style={{ ...tdCentro, fontWeight: 700, color: COLOR_NRO_SIMPLE, whiteSpace: 'nowrap' }} title={origenDe(p)}>
                        {fmtPresupuesto(p.nro)}
                      </td>
                      <td style={tdCentro}>{fechaCorta(p.fecha)}</td>
                      <td style={tdCentro}>{p.cc || <Raya />}</td>
                      <td style={td} title={origenDe(p)}>{p.nombre_repuesto}</td>
                      <td style={tdCentro}>{p.cant ?? <Raya />}</td>
                      <td style={tdCentro}>{p.unidad || <Raya />}</td>
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>
                        {p.descripcion ? (
                          <div className="d-flex justify-content-center">
                            <BotonAccion
                              icono="bi-eye"
                              titulo="Ver la descripción"
                              onClick={() => Swal.fire({ title: 'Descripción', text: p.descripcion, width: '320px', confirmButtonText: 'Cerrar', confirmButtonColor: '#1e293b' })}
                            />
                          </div>
                        ) : (
                          <Raya />
                        )}
                      </td>
                      <td style={td}>{p.grupo || <Raya />}</td>
                      <td style={td}>{p.solicita || <Raya />}</td>
                      {/* El precio se carga acá mismo, sin abrir la cotización. */}
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>
                        <CeldaPrecio presupuesto={p} onGuardar={guardarPrecio} deshabilitado={sinEditar} />
                      </td>
                      {/* Observaciones: + para escribirlas, el ojo para verlas. */}
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-center">
                          {p.observaciones ? (
                            <BotonAccion icono="bi-eye" titulo="Ver las observaciones" variante="primary" onClick={() => abrirObservaciones(p)} />
                          ) : (
                            <BotonAccion
                              icono="bi-plus-lg"
                              titulo={sinEditar ? 'Sin permiso para editar' : 'Agregar una observación'}
                              variante="success"
                              onClick={() => abrirObservaciones(p)}
                              deshabilitado={sinEditar}
                            />
                          )}
                        </div>
                      </td>
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>
                        {p.archivo?.url ? (
                          <a
                            href={p.archivo.url}
                            target="_blank"
                            rel="noreferrer"
                            title={p.archivo.nombre || 'Ver el adjunto'}
                            className="d-inline-flex align-items-center gap-1 text-decoration-none"
                            style={{ color: BORDO, fontWeight: 600, fontSize: '0.7rem' }}
                          >
                            <i className="bi bi-paperclip"></i>
                            <span>Ver</span>
                          </a>
                        ) : (
                          <Raya />
                        )}
                      </td>
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                          <BotonAccion icono="bi-clock-history" titulo="Historial" onClick={() => verHistorial(p)} />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </div>
      </Container>
    </div>
  )
}
