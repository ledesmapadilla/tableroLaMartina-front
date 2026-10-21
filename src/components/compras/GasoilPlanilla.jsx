import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Container, Card, Table, Button, Form, Modal } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { exportarPlanilla } from '../../helpers/excel'
import { usePermisos } from '../../context/permisos'
import { Raya, BotonAccion, BotonLimpiar, FiltroSelect, FiltroTexto } from './estilos'
import { litros } from './aceites'
import { API_GASOIL, ROLES_EDITAR_INGRESO, ROLES_SIN_CONSUMOS, campoGasoil, camposVisibles } from './camposGasoil'
import { useAuth } from '../../context/AuthContext'
import ModalIngresoGasoil from './ModalIngresoGasoil'
import Error404 from '../pages/Error404'

// El sombreado del día de cada auditoría en los consumos: otro color que el
// del stock inicial, igual en los dos campos.
const FONDO_AUDITORIA = '#ede9fe'

/**
 * El gasoil de un campo (20/10/2026), en dos solapas:
 *
 * - Consumos: un renglón por día, del más nuevo al más viejo. El consumo no se
 *   carga acá: es lo anotado en los partes de Producción de ese campo (los
 *   datos de certificación), Comb. + Comb. turbo de todas las jornadas del
 *   día; para corregirlo se corrige el parte. El saldo se dejó de mostrar
 *   (20/10/2026): el back lo sigue calculando, por si vuelve.
 * - Ingresos: el gasoil que entra al tanque, con proveedor y quién lo cargó.
 *
 * Arriba, los filtros: el período vale para las dos solapas; proveedor y
 * quién carga son de los ingresos.
 */
// Una solapa de la tabla, como las de una carpeta: la elegida es blanca, con
// el borde de arriba en el color del campo, y se funde con el marco de la
// tabla; la otra queda gris, detrás.
const Solapa = ({ activa, color, onClick, titulo, icono }) => (
  <button
    type="button"
    onClick={onClick}
    className="d-inline-flex align-items-center gap-1 px-3"
    style={{
      height: '32px',
      fontSize: '0.8rem',
      fontWeight: activa ? 700 : 500,
      color: activa ? color : '#64748b',
      backgroundColor: activa ? '#fff' : '#e2e8f0',
      border: '1px solid #cbd5e1',
      borderTop: activa ? `3px solid ${color}` : '1px solid #cbd5e1',
      borderBottom: activa ? '1px solid #fff' : '1px solid #cbd5e1',
      borderRadius: '10px 10px 0 0',
      marginBottom: '-1px',
      position: 'relative',
      zIndex: activa ? 2 : 1,
      cursor: activa ? 'default' : 'pointer',
    }}
  >
    <i className={`bi ${icono}`}></i>
    <span>{titulo}</span>
  </button>
)

// Un total al lado de los filtros, con la misma altura que ellos. Con borde
// y letra del color; `relleno`, pintado entero (el saldo).
const Total = ({ etiqueta, valor, color, titulo, relleno = false }) => (
  <div className="d-flex flex-column" style={{ minWidth: '120px' }}>
    <span className="fw-bold text-dark mb-1 text-center" style={{ fontSize: '0.72rem' }}>
      {etiqueta}
    </span>
    <div
      className="rounded-3 d-flex align-items-center justify-content-center px-2 fw-bold"
      style={{
        height: '32px',
        fontSize: '0.82rem',
        color: relleno ? '#fff' : color,
        backgroundColor: relleno ? color : '#fff',
        border: `1.5px solid ${color}`,
        whiteSpace: 'nowrap',
      }}
      title={titulo}
    >
      {litros(valor)} lts
    </div>
  </div>
)

export default function GasoilPlanilla() {
  const { campo: idCampo } = useParams()
  const { user } = useAuth()
  // Un campo que no es el suyo (el encargado de taller solo ve el de su
  // taller) da lo mismo que uno que no existe: 404.
  const campo = camposVisibles(user).find((c) => c.id === idCampo) ? campoGasoil(idCampo) : null

  const { puede } = usePermisos()
  const sinEditar = !puede('compras.gasoil', 'editar')
  // El lápiz de un ingreso, además, solo para el comprador, gerencia y el superadmin.
  const sinEditarIngreso = sinEditar || !ROLES_EDITAR_INGRESO.includes(user?.rol)
  // El encargado de taller ve solo los ingresos: ni la solapa de consumos ni
  // el pedido al back.
  const sinConsumos = ROLES_SIN_CONSUMOS.includes(user?.rol)

  const [solapa, setSolapa] = useState(sinConsumos ? 'ingresos' : 'consumos')
  const [filas, setFilas] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [cargando, setCargando] = useState(true)

  // Filtros.
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [fProveedor, setFProveedor] = useState('')
  const [fQuien, setFQuien] = useState('')

  // Observaciones de un día: null cerrado o la fila.
  const [editandoDia, setEditandoDia] = useState(null)
  const [observaciones, setObservaciones] = useState('')

  // Ingreso: null cerrado o el ingreso que se corrige.
  const [editandoIngreso, setEditandoIngreso] = useState(null)

  const [guardando, setGuardando] = useState(false)

  // El detalle del consumo de un día (se abre tocando la fecha): los partes
  // de ese día con combustible. null cerrado.
  const [detalle, setDetalle] = useState(null)

  const cargar = () =>
    Promise.all([
      sinConsumos ? [] : api.get(`${API_GASOIL}?campo=${idCampo}`),
      api.get(`${API_GASOIL}/ingresos?campo=${idCampo}`),
    ])
      .then(([lista, listaIngresos]) => {
        setFilas(Array.isArray(lista) ? lista : [])
        setIngresos(Array.isArray(listaIngresos) ? listaIngresos : [])
      })
      .catch((error) =>
        Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: error.message, width: '300px' })
      )
      .finally(() => setCargando(false))

  useEffect(() => {
    if (campo) cargar()
  }, [idCampo])

  if (!campo) return <Error404 />

  const th = {
    backgroundColor: campo.color,
    color: '#fff',
    fontSize: '0.66rem',
    fontWeight: 600,
    verticalAlign: 'middle',
    padding: '3px 5px',
    whiteSpace: 'nowrap',
  }
  const thCentro = { ...th, textAlign: 'center' }
  const td = { fontSize: '0.7rem', padding: '1px 5px', verticalAlign: 'middle' }
  const tdNumero = { ...td, textAlign: 'center', whiteSpace: 'nowrap' }

  // Las fechas vienen como "AAAA-MM-DD" (o ISO): se dan vuelta sin pasar por
  // Date, así no se corren de día.
  const aDia = (f) => (f ? String(f).slice(0, 10) : '')
  const fecha = (f) => aDia(f).split('-').reverse().join('/')
  const numeroOVacio = (n) => (n === null || n === undefined ? <Raya /> : litros(n))

  // Cuánto fue de la máquina y cuánto del turbo, al pasar el mouse.
  const detalleConsumo = (f) =>
    f.consumo === null ? undefined : `Comb. ${litros(f.combustible)} + Comb. turbo ${litros(f.combTurbo)}`

  // ── Filtros ──
  const enPeriodo = (f) => (!desde || aDia(f) >= desde) && (!hasta || aDia(f) <= hasta)
  const unicos = (valores) => [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const opcionesProveedor = unicos(ingresos.map((i) => i.proveedor))
  const opcionesQuien = unicos(ingresos.map((i) => i.quienCarga))

  const filasFiltradas = filas.filter((f) => enPeriodo(f.fecha))
  const ingresosFiltrados = ingresos.filter(
    (i) =>
      enPeriodo(i.fecha) &&
      (!fProveedor || i.proveedor === fProveedor) &&
      (!fQuien || i.quienCarga === fQuien)
  )
  const hayFiltros = !!(desde || hasta || fProveedor || fQuien)
  const limpiar = () => {
    setDesde('')
    setHasta('')
    setFProveedor('')
    setFQuien('')
  }

  const totalIngresos = ingresosFiltrados.reduce((s, i) => s + (i.litros || 0), 0)
  const totalConsumo = filasFiltradas.reduce((s, f) => s + (f.consumo || 0), 0)
  // Los ingresos de la solapa de consumos salen de sus mismos días (sin los
  // filtros de proveedor y quién carga, que son de la otra solapa).
  const totalIngresosDias = filasFiltradas.reduce((s, f) => s + (f.ingreso || 0), 0)
  const saldo = Math.round((totalIngresosDias - totalConsumo) * 100) / 100

  // ── Excel: la solapa que se está viendo, con los filtros puestos ──
  const exportarExcel = () => {
    const hoy = new Date().toISOString().slice(0, 10)
    const archivo = (que) => `Gasoil_${campo.titulo.replace(/\s+/g, '')}_${que}_${hoy}.xlsx`
    const vacio = (n) => (n === null || n === undefined ? '' : n)
    // El período filtrado va en el título, así se sabe de qué fechas es.
    const periodo = desde || hasta ? ` (${desde ? fecha(desde) : '…'} al ${hasta ? fecha(hasta) : '…'})` : ''
    if (solapa === 'consumos') {
      return exportarPlanilla({
        titulo: `Gasoil · ${campo.titulo} — Consumos${periodo}`,
        // Las mismas columnas que la tabla; abajo, los totales de los recuadros.
        columnas: [
          { titulo: 'Fecha', ancho: 12 },
          { titulo: 'Ingreso (lts)', ancho: 14 },
          { titulo: 'Consumo (lts)', ancho: 14 },
          { titulo: 'Observaciones', ancho: 40 },
        ],
        filas: [
          ...filasFiltradas.map((f) => [fecha(f.fecha), vacio(f.ingreso), vacio(f.consumo), f.observaciones || '']),
          ['TOTAL', totalIngresosDias, totalConsumo, ''],
          ['SALDO', saldo, '', 'Total ingresos − total consumo'],
        ],
        hoja: 'Consumos',
        archivo: archivo('Consumos'),
      })
    }
    return exportarPlanilla({
      titulo: `Gasoil · ${campo.titulo} — Ingresos${periodo}`,
      columnas: [
        { titulo: 'Fecha', ancho: 12 },
        { titulo: 'Proveedor', ancho: 30 },
        { titulo: 'N° remito/ticket', ancho: 16 },
        { titulo: 'Litros', ancho: 12 },
        { titulo: 'Quién carga', ancho: 20 },
        { titulo: 'Observaciones', ancho: 40 },
      ],
      filas: [
        ...ingresosFiltrados.map((i) => [
          fecha(i.fecha),
          i.proveedor || '',
          i.remito || '',
          vacio(i.litros),
          i.quienCarga || '',
          i.observaciones || '',
        ]),
        ['TOTAL', '', '', totalIngresos, '', ''],
      ],
      hoja: 'Ingresos',
      archivo: archivo('Ingresos'),
    })
  }

  // ── Detalle del consumo ──
  const verDetalle = (f) => {
    setDetalle({ fila: f, partes: null })
    api
      .get(`${API_GASOIL}/detalle?campo=${idCampo}&fecha=${f.fecha}`)
      .then((lista) => setDetalle({ fila: f, partes: Array.isArray(lista) ? lista : [] }))
      .catch((error) => {
        setDetalle(null)
        Swal.fire({ icon: 'error', title: 'No se pudo traer el detalle', text: error.message, width: '300px' })
      })
  }

  // ── Observaciones de un día ──
  const abrirDia = (f) => {
    setObservaciones(f.observaciones || '')
    setEditandoDia(f)
  }
  const guardarDia = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await api.put(API_GASOIL, { campo: idCampo, fecha: editandoDia.fecha, observaciones })
      setEditandoDia(null)
      cargar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message, width: '300px' })
    } finally {
      setGuardando(false)
    }
  }

  // ── Ingresos ──
  // El formulario es ModalIngresoGasoil, el mismo de la certificación. Acá
  // solo se corrigen: se cargan desde la certificación (20/10/2026).
  const editarIngreso = (i) => setEditandoIngreso(i)
  const borrarIngreso = async (i) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: '¿Borrar el ingreso?',
      text: `${litros(i.litros)} lts del ${fecha(i.fecha)}. Esta acción no se puede deshacer.`,
      width: '320px',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
    })
    if (!isConfirmed) return
    try {
      await api.delete(`${API_GASOIL}/ingresos/${i._id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrado', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo borrar', text: error.message, width: '300px' })
    }
  }

  const cabeceraModal = {
    backgroundColor: campo.color,
    color: '#fff',
    borderTopLeftRadius: '1rem',
    borderTopRightRadius: '1rem',
  }
  const pieModal = { borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }
  const campoForm = { fontSize: '0.85rem' }

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
        style={{ maxWidth: '820px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: '34px',
                height: '34px',
                background: campo.colores.fondo,
                color: '#fff',
                fontSize: '1.05rem',
              }}
            >
              <i className="bi bi-fuel-pump-fill"></i>
            </div>
            <span className="fw-bold" style={{ color: campo.color, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
              Gasoil · {campo.titulo}
            </span>
          </div>

          {/* Baja la solapa que se está viendo, con los filtros puestos. */}
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={solapa === 'consumos' ? filasFiltradas.length === 0 : ingresosFiltrados.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            title={`Exportar ${solapa === 'consumos' ? 'los consumos' : 'los ingresos'} a Excel`}
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        <Card className="mb-2 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <FiltroTexto etiqueta="Desde" ancho="150px" tipo="date" valor={desde} onChange={setDesde} />
            <FiltroTexto etiqueta="Hasta" ancho="150px" tipo="date" valor={hasta} onChange={setHasta} />
            {/* Proveedor y quién carga son de los ingresos. */}
            {solapa === 'ingresos' && (
              <>
                <FiltroSelect
                  etiqueta="Proveedor"
                  ancho="220px"
                  valor={fProveedor}
                  vacio="Todos"
                  onChange={setFProveedor}
                  opciones={opcionesProveedor}
                />
                <FiltroSelect
                  etiqueta="Quién carga"
                  ancho="180px"
                  valor={fQuien}
                  vacio="Todos"
                  onChange={setFQuien}
                  opciones={opcionesQuien}
                />
              </>
            )}
            {hayFiltros && <BotonLimpiar onClick={limpiar} />}
            {/* Ingresos, consumo y saldo de los días que se ven: con el período
                filtrado, los de esas fechas. Pegados a la derecha. Solo en la
                solapa de consumos, que el encargado de taller no tiene. */}
            {solapa === 'consumos' && (
              <div className="d-flex align-items-end gap-2 ms-auto">
                <Total
                  etiqueta="Total ingresos"
                  valor={totalIngresosDias}
                  color="#1d4ed8"
                  titulo={hayFiltros ? 'Ingresos del período filtrado' : 'Ingresos de todos los días'}
                />
                <Total
                  etiqueta="Total consumo"
                  valor={totalConsumo}
                  color={campo.color}
                  titulo={hayFiltros ? 'Consumo del período filtrado' : 'Consumo de todos los días'}
                />
                <Total
                  etiqueta="Saldo"
                  valor={saldo}
                  color={saldo < 0 ? '#dc2626' : '#334155'}
                  relleno
                  titulo="Total ingresos − total consumo"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Las solapas, pegadas al borde de arriba de la tabla. */}
        <div className="d-flex align-items-end gap-1 ps-2 flex-shrink-0">
          {!sinConsumos && (
            <Solapa
              activa={solapa === 'consumos'}
              color={campo.color}
              onClick={() => setSolapa('consumos')}
              titulo="Consumos"
              icono="bi-droplet-half"
            />
          )}
          <Solapa
            activa={solapa === 'ingresos'}
            color={campo.color}
            onClick={() => setSolapa('ingresos')}
            titulo="Ingresos"
            icono="bi-box-arrow-in-down"
          />
        </div>
        <div
          className="shadow-sm bg-white"
          style={{
            flex: '0 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
            borderRadius: '0 10px 10px 10px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {solapa === 'consumos' ? (
            <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '640px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ ...thCentro, width: '100px' }}>Fecha</th>
                  <th style={{ ...thCentro, width: '100px' }}>Ingreso (lts)</th>
                  <th style={{ ...thCentro, width: '110px' }}>Consumo (lts)</th>
                  <th style={th}>Observaciones</th>
                  <th style={{ ...thCentro, width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4" style={td}>
                      {cargando ? 'Cargando…' : hayFiltros ? 'Ningún día en el período' : 'No hay consumos ni ingresos'}
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((f) => (
                    <tr
                      key={f.fecha}
                      // El día del stock inicial (color del campo) y los de
                      // las auditorías (violeta), sombreados: de uno a otro
                      // va cada cuenta. Si caen el mismo día, manda el stock.
                      className={f.stockInicial != null || f.auditoria != null ? 'fila-stock-inicial' : undefined}
                      style={
                        f.stockInicial != null
                          ? { '--fondo-stock': campo.filaStock }
                          : f.auditoria != null
                            ? { '--fondo-stock': FONDO_AUDITORIA }
                            : undefined
                      }
                    >
                      <td style={tdNumero}>
                        {/* Con consumo, la fecha abre de qué partes sale. */}
                        {f.consumo === null ? (
                          fecha(f.fecha)
                        ) : (
                          <button
                            type="button"
                            onClick={() => verDetalle(f)}
                            className="btn btn-link p-0 border-0 fw-semibold"
                            style={{ fontSize: '0.7rem', color: campo.color }}
                            title="Ver el detalle del consumo"
                          >
                            {fecha(f.fecha)}
                          </button>
                        )}
                      </td>
                      <td style={{ ...tdNumero, color: f.ingreso ? '#1d4ed8' : undefined }}>{numeroOVacio(f.ingreso)}</td>
                      <td style={tdNumero} title={detalleConsumo(f)}>
                        {numeroOVacio(f.consumo)}
                      </td>
                      <td style={{ ...td, wordBreak: 'break-word' }}>
                        {f.stockInicial != null && (
                          <span className="fw-semibold me-2" style={{ color: campo.color }}>
                            <i className="bi bi-flag-fill" /> Stock inicial: {numeroOVacio(f.stockInicial)} lts
                          </span>
                        )}
                        {f.auditoria != null && (
                          <span className="fw-semibold me-2" style={{ color: '#6d28d9' }}>
                            <i className="bi bi-clipboard-check-fill" /> Auditoría: {numeroOVacio(f.auditoria)} lts
                          </span>
                        )}
                        {f.observaciones || (f.stockInicial == null && f.auditoria == null && <Raya />)}
                      </td>
                      <td style={tdNumero}>
                        <div className="d-flex justify-content-center align-items-center gap-2">
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Observaciones'}
                            variante="primary"
                            deshabilitado={sinEditar}
                            onClick={() => abrirDia(f)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          ) : (
            <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '700px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ ...thCentro, width: '100px' }}>Fecha</th>
                  <th style={th}>Proveedor</th>
                  <th style={{ ...thCentro, width: '110px' }}>N° remito/ticket</th>
                  <th style={{ ...thCentro, width: '100px' }}>Litros</th>
                  <th style={th}>Quién carga</th>
                  <th style={th}>Observaciones</th>
                  <th style={{ ...thCentro, width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {ingresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4" style={td}>
                      {cargando
                        ? 'Cargando…'
                        : hayFiltros
                          ? 'Ningún ingreso coincide con los filtros'
                          : 'No hay ingresos cargados'}
                    </td>
                  </tr>
                ) : (
                  <>
                    {ingresosFiltrados.map((i) => (
                      <tr key={i._id}>
                        <td style={tdNumero}>{fecha(i.fecha)}</td>
                        <td style={td}>{i.proveedor || <Raya />}</td>
                        <td style={tdNumero}>{i.remito || <Raya />}</td>
                        <td style={tdNumero}>{litros(i.litros)}</td>
                        <td style={td}>{i.quienCarga || <Raya />}</td>
                        <td style={{ ...td, wordBreak: 'break-word' }}>{i.observaciones || <Raya />}</td>
                        <td style={tdNumero}>
                          <div className="d-flex justify-content-center align-items-center gap-2">
                            <BotonAccion
                              icono="bi-pencil"
                              titulo={sinEditarIngreso ? 'Solo compras, gerencia y el superadmin editan ingresos' : 'Editar'}
                              variante="primary"
                              deshabilitado={sinEditarIngreso}
                              onClick={() => editarIngreso(i)}
                            />
                            <BotonAccion
                              icono="bi-trash"
                              titulo={sinEditar ? 'Sin permiso para editar' : 'Borrar'}
                              variante="danger"
                              deshabilitado={sinEditar}
                              onClick={() => borrarIngreso(i)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="fila-total">
                      <td colSpan={3} style={{ ...td, fontWeight: 700, color: campo.color }}>
                        TOTAL
                      </td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{litros(totalIngresos)}</td>
                      <td colSpan={3} style={td}></td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          )}
        </div>
      </Container>

      {/* Detalle del consumo: un renglón por parte del día con combustible. */}
      <Modal
        show={detalle !== null}
        onHide={() => setDetalle(null)}
        centered
        size="lg"
        scrollable
        contentClassName="border-0 shadow-lg rounded-4"
      >
        <Modal.Header closeButton closeVariant="white" style={cabeceraModal}>
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-fuel-pump-fill"></i>
            <span>
              Consumo del {detalle && fecha(detalle.fila.fecha)} · {campo.titulo}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="rounded-3 bg-white" style={{ border: '1px solid #cbd5e1', overflow: 'auto' }}>
            <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={th}>Persona</th>
                  <th style={thCentro}>C.C.</th>
                  <th style={th}>Tarea</th>
                  <th style={thCentro}>Comb.</th>
                  <th style={thCentro}>Turbo</th>
                  <th style={thCentro}>Comb. turbo</th>
                </tr>
              </thead>
              <tbody>
                {!detalle?.partes ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4" style={td}>
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  <>
                    {detalle.partes.map((p) => (
                      <tr key={p._id}>
                        <td style={td}>
                          {p.persona || <Raya />}
                          {p.provisorio && (
                            <span className="ms-1 text-secondary" style={{ fontSize: '0.6rem' }}>
                              (provisorio)
                            </span>
                          )}
                        </td>
                        <td style={tdNumero} title={p.descripcionCC || undefined}>
                          {p.cc || <Raya />}
                        </td>
                        <td style={td}>{p.tarea || <Raya />}</td>
                        <td style={tdNumero}>{numeroOVacio(p.combustible)}</td>
                        <td style={tdNumero}>{p.turbo || <Raya />}</td>
                        <td style={tdNumero}>{numeroOVacio(p.combTurbo)}</td>
                      </tr>
                    ))}
                    <tr className="fila-total">
                      <td colSpan={3} style={{ ...td, fontWeight: 700, color: campo.color }}>
                        TOTAL
                      </td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{litros(detalle.fila.combustible)}</td>
                      <td style={tdNumero}></td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{litros(detalle.fila.combTurbo)}</td>
                    </tr>
                    <tr className="fila-total">
                      <td colSpan={5} style={{ ...td, fontWeight: 700, color: campo.color }}>
                        Consumo del día (Comb. + Comb. turbo)
                      </td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{litros(detalle.fila.consumo)} lts</td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>

      {/* Observaciones de un día de la planilla de consumos. */}
      <Modal show={editandoDia !== null} onHide={() => setEditandoDia(null)} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header closeButton closeVariant="white" style={cabeceraModal}>
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-chat-left-text"></i>
            <span>
              Observaciones del {editandoDia && fecha(editandoDia.fecha)} · {campo.titulo}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardarDia}>
          <Modal.Body className="p-3 p-md-4">
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={300}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="rounded-3"
              style={campoForm}
            />
          </Modal.Body>
          <Modal.Footer className="bg-light border-0 py-2 px-4" style={pieModal}>
            <Button variant="outline-secondary" size="sm" onClick={() => setEditandoDia(null)} className="rounded-3 px-3" style={{ fontSize: '0.84rem' }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={guardando}
              className="rounded-3 px-3 shadow-sm"
              style={{ fontSize: '0.84rem', backgroundColor: campo.color, borderColor: campo.color }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Corregir un ingreso de gasoil. */}
      {editandoIngreso !== null && (
        <ModalIngresoGasoil
          ingreso={editandoIngreso}
          campo={campo}
          onCerrar={() => setEditandoIngreso(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}
