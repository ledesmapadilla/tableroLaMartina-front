import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Container, Table, Button, Form, Modal } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { subirArchivo, borrarArchivo } from '../../services/archivos'
import { usePermisos } from '../../context/permisos'
import { useAuth } from '../../context/AuthContext'
import { Raya, BotonAccion } from './estilos'
import { litros } from './aceites'
import { API_GASOIL, TIPOS_GASOIL, campoGasoil, conTipos, tituloTanque } from './camposGasoil'
import HistorialAuditoriasGasoil from './HistorialAuditoriasGasoil'

/**
 * Compras › Gasoil › Auditorías (20/10/2026).
 *
 * Alguien de Compras toca "Pedir auditoría" y queda un renglón con la fecha
 * del pedido y una fila por tanque: Berdina y, en San Pablo, Común e Infinia
 * (27/10/2026). En cada una, el
 * encargado de ese taller (Kevin en Berdina; Victor y Pablo en San Pablo)
 * carga los litros que tiene en el tanque y sube la foto del nivel. El
 * encargado ve solo la fila de su campo: el back no le manda la otra.
 *
 * Arriba, el stock inicial de cada tanque (21/10/2026): los litros con los
 * que arranca el tanque, la fecha de la medición y la foto del nivel.
 */
const COLOR = '#334155'
// La palabra "Infinia" en la caja del stock inicial: un fucsia, que salte al
// lado del verde de San Pablo.
const COLOR_INFINIA = '#c026d3'
// Las alturas mínimas de la tabla de auditorías. La del resultado, aparte a
// la derecha, copia la altura real de cada fila (igualarFilas).
const ALTO_ENCABEZADO = '26px'
const ALTO_FILA = '30px'

export default function GasoilAuditorias() {
  const { puede } = usePermisos()
  const { user } = useAuth()
  const sinEditar = !puede('compras.gasoil', 'editar')
  const esEncargado = user?.rol === 'solicitante'
  // Pide (y borra) Compras; carga el encargado. El superadmin, las dos cosas.
  const puedePedir = !sinEditar && !esEncargado
  const puedeCargar = !sinEditar && (esEncargado || user?.rol === 'superadmin')
  // La tabla del resultado (27/10/2026): la ve el que tiene Ver y Editar en
  // Gasoil, sea cual sea su rol. El back no lo manda a los demás.
  const verResultado = puede('compras.gasoil', 'ver') && !sinEditar

  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [pidiendo, setPidiendo] = useState(false)

  // La carga de un campo: null cerrado o { auditoria, carga }.
  const [editando, setEditando] = useState(null)
  const [litrosForm, setLitrosForm] = useState('')
  const [archivo, setArchivo] = useState(null)
  // La x de la foto que ya estaba: se borra recién al guardar.
  const [fotoQuitada, setFotoQuitada] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // El stock inicial: [{ campo, tipo, stock }] con stock null si no se cargó.
  const [stocks, setStocks] = useState([])
  // El del modal: null cerrado o { campo, tipo, stock }. Usa los litros y el
  // archivo de arriba: los dos modales no se abren juntos.
  const [editandoStock, setEditandoStock] = useState(null)
  const [fechaForm, setFechaForm] = useState('')

  // El resumen del resultado: null cerrado o { auditoria, carga }.
  const [resumen, setResumen] = useState(null)
  // El historial con el gráfico (27/10/2026).
  const [verHistorial, setVerHistorial] = useState(false)

  const cargar = () =>
    api
      .get(`${API_GASOIL}/auditorias`)
      .then((data) => setLista(Array.isArray(data) ? data : []))
      .catch((error) => Swal.fire({ icon: 'error', title: 'No se pudo cargar', text: error.message, width: '300px' }))
      .finally(() => setCargando(false))

  const cargarStocks = () =>
    api
      .get(`${API_GASOIL}/stock-inicial`)
      .then((data) => setStocks(Array.isArray(data) ? data : []))
      .catch((error) => Swal.fire({ icon: 'error', title: 'No se pudo cargar el stock inicial', text: error.message, width: '300px' }))

  useEffect(() => {
    cargar()
    cargarStocks()
  }, [])

  const th = {
    backgroundColor: COLOR,
    color: '#fff',
    fontSize: '0.66rem',
    fontWeight: 600,
    verticalAlign: 'middle',
    padding: '3px 5px',
    whiteSpace: 'nowrap',
  }
  const thCentro = { ...th, textAlign: 'center' }
  const td = { fontSize: '0.7rem', padding: '2px 5px', verticalAlign: 'middle' }
  const tdCentro = { ...td, textAlign: 'center', whiteSpace: 'nowrap' }

  const fechaHora = (f) =>
    f
      ? new Date(f).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
  const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
  // La del stock inicial es un día (medianoche UTC): con la hora local
  // daría el día anterior.
  const fechaDia = (f) => (f ? f.slice(0, 10).split('-').reverse().join('/') : '')

  // ── Pedido ──
  const pedir = async () => {
    setPidiendo(true)
    try {
      await api.post(`${API_GASOIL}/auditorias`, {})
      cargar()
      Swal.fire({ icon: 'success', title: 'Auditoría pedida', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo pedir', text: error.message, width: '300px' })
    } finally {
      setPidiendo(false)
    }
  }

  const borrar = async (a) => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: '¿Borrar la auditoría?',
      text: `La pedida el ${fecha(a.fechaPedido)}, con lo que se haya cargado. Esta acción no se puede deshacer.`,
      width: '320px',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
    })
    if (!isConfirmed) return
    try {
      await api.delete(`${API_GASOIL}/auditorias/${a._id}`)
      a.cargas.forEach((c) => c.foto && borrarArchivo(c.foto))
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrada', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo borrar', text: error.message, width: '300px' })
    }
  }

  // ── Carga del encargado ──
  const abrirCarga = async (auditoria, carga) => {
    // El stock medido se compara con lo que dan los partes: si falta cargar
    // algún consumo, la auditoría da una diferencia que no es tal.
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: '¿Están cargados todos los consumos?',
      text: 'Antes de medir la existencia en los tanques tienen que estar cargados todos los consumos en las planillas.',
      width: '320px',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1e293b',
      cancelButtonColor: '#64748b',
    })
    if (!isConfirmed) return
    setLitrosForm(carga.litros ?? '')
    setArchivo(null)
    setFotoQuitada(false)
    setEditando({ auditoria, carga })
  }

  const guardarCarga = async (e) => {
    e.preventDefault()
    const { auditoria, carga } = editando
    if (litrosForm === '' || Number(litrosForm) < 0) {
      Swal.fire({ icon: 'error', title: 'Faltan datos', text: 'Los litros son obligatorios.', width: '300px' })
      return
    }
    const fotoAnterior = fotoQuitada ? null : carga.foto
    if (!archivo && !fotoAnterior) {
      Swal.fire({ icon: 'error', title: 'Faltan datos', text: 'Falta la foto del nivel.', width: '300px' })
      return
    }
    setGuardando(true)
    try {
      const foto = archivo ? await subirArchivo(archivo, { achicar: true }) : fotoAnterior
      await api.put(`${API_GASOIL}/auditorias/${auditoria._id}/${carga.campo}?tipo=${carga.tipo}`, { litros: litrosForm, foto })
      // La foto que se reemplazó ya no la usa nadie.
      if (archivo && carga.foto) borrarArchivo(carga.foto)
      setEditando(null)
      cargar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message, width: '300px' })
    } finally {
      setGuardando(false)
    }
  }

  // ── Stock inicial ──
  // Un stock ya cargado, el inicial o los litros de una auditoría, lo corrige
  // solo el comprador (27/10/2026), y Nacho (el superadmin "nacho"), que puede
  // todo. Los demás cambian solo la foto. Copia de corrigeStock en
  // TableroBack/src/controllers/gasoil.controller.js.
  const puedeCorregirStock =
    !sinEditar && (user?.rol === 'comprador' || (user?.rol === 'superadmin' && user?.usuario === 'nacho'))

  const abrirStock = (s) => {
    setLitrosForm(s.stock?.litros ?? '')
    setFechaForm(s.stock?.fecha ? s.stock.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setArchivo(null)
    setEditandoStock(s)
  }

  const guardarStock = async (e) => {
    e.preventDefault()
    const { campo, tipo, stock } = editandoStock
    if (litrosForm === '' || Number(litrosForm) < 0 || !fechaForm) {
      Swal.fire({ icon: 'error', title: 'Faltan datos', text: 'Los litros y la fecha son obligatorios.', width: '300px' })
      return
    }
    // Al corregir, sin archivo nuevo queda la foto que estaba.
    if (!archivo && !stock?.foto?.url) {
      Swal.fire({ icon: 'error', title: 'Faltan datos', text: 'Falta la foto del nivel.', width: '300px' })
      return
    }
    setGuardando(true)
    try {
      const foto = archivo ? await subirArchivo(archivo, { achicar: true }) : stock.foto
      await api.put(`${API_GASOIL}/stock-inicial/${campo}?tipo=${tipo}`, { litros: litrosForm, fecha: fechaForm, foto })
      // La foto que se reemplazó ya no la usa nadie.
      if (archivo && stock?.foto) borrarArchivo(stock.foto)
      setEditandoStock(null)
      cargarStocks()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false, width: '300px' })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error.message, width: '300px' })
    } finally {
      setGuardando(false)
    }
  }

  // La foto de la caja: la x la saca y "Subir" pone otra. Los litros y la
  // fecha no se tocan.
  const subirFotoStock = async (s, file) => {
    setSubiendo(`stock-${s.campo}-${s.tipo}`)
    try {
      const foto = await subirArchivo(file, { achicar: true })
      await api.put(`${API_GASOIL}/stock-inicial/${s.campo}/foto?tipo=${s.tipo}`, { foto })
      cargarStocks()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo subir la foto', text: error.message, width: '300px' })
    } finally {
      setSubiendo(null)
    }
  }

  const quitarFotoStock = async (s) => {
    try {
      // Como en las auditorías: primero se la saca del stock y después de
      // Cloudinary.
      await api.put(`${API_GASOIL}/stock-inicial/${s.campo}/foto?tipo=${s.tipo}`, { foto: null })
      cargarStocks()
      await borrarArchivo(s.stock.foto || {})
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo quitar la foto', text: error.message, width: '300px' })
    }
  }

  // ── La foto en la tabla ──
  // Como los adjuntos de los pedidos: el nombre del archivo con el clip (abre
  // la foto) y la x para sacarla; sin foto, "Subir".
  const [subiendo, setSubiendo] = useState(null)
  const urlFoto = (a, c) => `${API_GASOIL}/auditorias/${a._id}/${c.campo}/foto?tipo=${c.tipo}`

  const subirFoto = async (a, c, file) => {
    setSubiendo(`${a._id}-${c.campo}-${c.tipo}`)
    try {
      const foto = await subirArchivo(file, { achicar: true })
      await api.put(urlFoto(a, c), { foto })
      cargar()
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo subir la foto', text: error.message, width: '300px' })
    } finally {
      setSubiendo(null)
    }
  }

  const quitarFoto = async (a, c) => {
    try {
      // Primero se la saca de la auditoría: si después falla el borrado en
      // Cloudinary, queda un archivo suelto y no un link roto en pantalla.
      await api.put(urlFoto(a, c), { foto: null })
      cargar()
      await borrarArchivo(c.foto || {})
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo quitar la foto', text: error.message, width: '300px' })
    }
  }

  const celdaFoto = (a, c, cargada) => {
    if (c.foto?.url) {
      return (
        <div className="d-flex align-items-center justify-content-center gap-1">
          <a
            href={c.foto.url}
            target="_blank"
            rel="noreferrer"
            title={c.foto.nombre || 'Ver la foto del nivel'}
            className="text-truncate"
            style={{ maxWidth: 110, fontSize: '0.7rem' }}
          >
            <i className="bi bi-paperclip" /> {c.foto.nombre || 'Ver'}
          </a>
          {puedeCargar && (
            <button
              type="button"
              className="btn btn-sm btn-link text-danger p-0"
              style={{ lineHeight: 1 }}
              title="Quitar la foto"
              onClick={() => quitarFoto(a, c)}
            >
              <i className="bi bi-x-lg" style={{ fontSize: '0.7rem' }} />
            </button>
          )}
        </div>
      )
    }
    // Sin cargar todavía, la foto va con los litros, en el formulario.
    if (!cargada || !puedeCargar) return <Raya />
    const estaSubiendo = subiendo === `${a._id}-${c.campo}-${c.tipo}`
    return (
      <label
        className={`btn btn-outline-dark mb-0${estaSubiendo ? ' disabled' : ''}`}
        style={{ fontSize: '0.66rem', lineHeight: 1, padding: '1px 6px', borderRadius: '4px' }}
        title="Subir la foto del nivel"
      >
        {estaSubiendo ? 'Subiendo…' : <><i className="bi bi-upload" /> Subir</>}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={estaSubiendo}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) subirFoto(a, c, file); e.target.value = '' }}
        />
      </label>
    )
  }

  // El resultado (21/10/2026): lo medido menos lo que tendría que haber, del
  // stock inicial (o la auditoría anterior) para acá. Lo calcula el back y
  // no se lo manda al encargado. Positivo sobra, negativo falta. Tocándolo
  // se abre el resumen de la cuenta.
  const textoResultado = (n) => (n === 0 ? 'Justo' : `${n > 0 ? 'Sobran' : 'Faltan'} ${litros(Math.abs(n))} lts`)
  const colorResultado = (n) => (n === 0 ? '#334155' : n > 0 ? '#15803d' : '#dc2626')
  // La desviación en %: el resultado sobre lo que tendría que haber, con el
  // signo del resultado (+ sobra, − falta). Si lo que tendría que haber da
  // negativo (se consumió más de lo que había) se toma su valor absoluto;
  // en cero no hay base y no se muestra.
  const desviacion = (r) => {
    if (!r.teorico) return ''
    const pct = (r.resultado / Math.abs(r.teorico)) * 100
    return `${pct > 0 ? '+' : ''}${pct.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  }

  const celdaResultado = (a, c) => {
    if (!c.resultado) return <Raya />
    const n = c.resultado.resultado
    const pct = desviacion(c.resultado)
    return (
      <button
        type="button"
        onClick={() => setResumen({ auditoria: a, carga: c })}
        className="btn btn-link p-0 border-0 fw-bold"
        style={{ fontSize: '0.7rem', color: colorResultado(n), whiteSpace: 'nowrap' }}
        title="Ver el resumen de la cuenta"
      >
        {textoResultado(n)}
        {pct && <span className="fw-semibold ms-1">({pct})</span>}
      </button>
    )
  }

  const columnas = esEncargado ? 5 : 6

  // La primera fila de cada pedido va con la línea gris arriba.
  const bordeFila = (a, n) => (n === 0 ? { borderTop: '2px solid #94a3b8' } : {})
  // La última fila de un campo, si sigue otro (27/10/2026), lleva la línea
  // negra fina abajo (fila-fin-grupo de index.css), así las dos de San Pablo
  // se ven juntas. Las dos tablas usan las mismas, para quedar parejas.
  const claseFila = (a, n) =>
    a.cargas[n + 1] && a.cargas[n + 1].campo !== a.cargas[n].campo ? 'fila-fin-grupo' : undefined

  // El nombre del tanque, con "Infinia" en su color (27/10/2026).
  const nombreTanque = (idCampo, tipo) => {
    const titulo = campoGasoil(idCampo)?.titulo || idCampo
    if (!conTipos(idCampo)) return titulo
    return (
      <>
        {titulo} ·{' '}
        <span style={tipo === 'infinia' ? { color: COLOR_INFINIA } : undefined}>{TIPOS_GASOIL[tipo]}</span>
      </>
    )
  }

  // La tabla del resultado copia la altura de cada fila de la de auditorías
  // (el encabezado incluido), así quedan parejas aunque una fila crezca. Se
  // vuelve a igualar cada vez que la de auditorías cambia de tamaño.
  const tablaRef = useRef(null)
  const resultadoRef = useRef(null)
  useLayoutEffect(() => {
    const principal = tablaRef.current
    const lado = resultadoRef.current
    if (!principal || !lado) return
    const igualarFilas = () => {
      const otras = lado.querySelectorAll('tr')
      principal.querySelectorAll('tr').forEach((fila, i) => {
        if (otras[i]) otras[i].style.height = `${fila.getBoundingClientRect().height}px`
      })
    }
    igualarFilas()
    const observador = new ResizeObserver(igualarFilas)
    observador.observe(principal)
    return () => observador.disconnect()
  }, [lista, verResultado])

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
        <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: '34px', height: '34px', backgroundColor: COLOR, color: '#fff', fontSize: '1.05rem' }}
            >
              <i className="bi bi-clipboard-check-fill"></i>
            </div>
            <span className="fw-bold" style={{ color: COLOR, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
              Gasoil · Auditorías
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
          {/* El historial lleva los resultados: lo ve quien los ve. */}
          {verResultado && (
            <Button
              size="sm"
              onClick={() => setVerHistorial(true)}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: '#fff', borderColor: COLOR, color: COLOR, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
              title="Resumen de las auditorías y gráfico del resultado"
            >
              <i className="bi bi-clock-history"></i>
              <span>Historial</span>
            </Button>
          )}
          {!esEncargado && (
            <Button
              size="sm"
              onClick={pedir}
              disabled={!puedePedir || pidiendo}
              className="rounded-3 px-3 d-flex align-items-center gap-2"
              style={{ backgroundColor: COLOR, borderColor: COLOR, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
              title={puedePedir ? 'Pedir a los talleres el stock de gasoil y la foto del nivel' : 'Sin permiso para editar'}
            >
              <i className="bi bi-plus-lg"></i>
              <span>{pidiendo ? 'Pidiendo…' : 'Pedir auditoría'}</span>
            </Button>
          )}
          </div>
        </div>

        {/* Stock inicial: una caja por tanque (el encargado, solo las de su
            campo). */}
        <div className="d-flex gap-2 flex-wrap justify-content-center mb-3 flex-shrink-0">
          {stocks.map((s, i) => {
            const campo = campoGasoil(s.campo)
            // Un espacio entre campos (27/10/2026): las dos de San Pablo van
            // juntas, aparte de la de Berdina.
            const otroCampo = i > 0 && stocks[i - 1].campo !== s.campo
            const color = campo?.color || COLOR
            const dato = { fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }
            return (
              <div
                key={`${s.campo}-${s.tipo}`}
                className="bg-white rounded-3 shadow-sm"
                style={{
                  flex: '1 1 220px',
                  maxWidth: '320px',
                  border: '1px solid #cbd5e1',
                  borderTop: `4px solid ${color}`,
                  ...(otroCampo ? { marginLeft: '24px' } : {}),
                }}
              >
                <div className="d-flex align-items-center justify-content-between px-2 pt-2">
                  <span className="fw-bold" style={{ color, fontSize: '0.8rem' }}>
                    Stock inicial · {nombreTanque(s.campo, s.tipo)}
                  </span>
                  {s.stock && puedeCorregirStock && (
                    <BotonAccion icono="bi-pencil" titulo="Corregir" variante="primary" onClick={() => abrirStock(s)} />
                  )}
                </div>
                {s.stock ? (
                  <div className="d-flex justify-content-between gap-2 px-2 pb-2 pt-1">
                    <div>
                      <div style={dato}>Fecha</div>
                      <div style={{ fontSize: '0.8rem' }}>{fechaDia(s.stock.fecha)}</div>
                    </div>
                    <div>
                      <div style={dato}>Lts</div>
                      <div className="fw-bold" style={{ fontSize: '0.9rem', color }}>{litros(s.stock.litros)}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={dato}>Foto</div>
                      {s.stock.foto?.url ? (
                        <div className="d-flex align-items-center gap-1">
                          <a
                            href={s.stock.foto.url}
                            target="_blank"
                            rel="noreferrer"
                            title={s.stock.foto.nombre || 'Ver la foto del nivel'}
                            className="text-truncate"
                            style={{ maxWidth: 100, fontSize: '0.75rem' }}
                          >
                            <i className="bi bi-paperclip" /> {s.stock.foto.nombre || 'Ver'}
                          </a>
                          {!sinEditar && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-danger p-0"
                              style={{ lineHeight: 1 }}
                              title="Quitar la foto"
                              onClick={() => quitarFotoStock(s)}
                            >
                              <i className="bi bi-x-lg" style={{ fontSize: '0.7rem' }} />
                            </button>
                          )}
                        </div>
                      ) : !sinEditar ? (
                        <label
                          className={`btn btn-outline-dark mb-0${subiendo === `stock-${s.campo}-${s.tipo}` ? ' disabled' : ''}`}
                          style={{ fontSize: '0.66rem', lineHeight: 1, padding: '1px 6px', borderRadius: '4px' }}
                          title="Subir la foto del nivel"
                        >
                          {subiendo === `stock-${s.campo}-${s.tipo}` ? 'Subiendo…' : <><i className="bi bi-upload" /> Subir</>}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={subiendo === `stock-${s.campo}-${s.tipo}`}
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) subirFotoStock(s, file); e.target.value = '' }}
                          />
                        </label>
                      ) : (
                        <Raya />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-2 pb-2 pt-1">
                    {!sinEditar ? (
                      <Button
                        size="sm"
                        onClick={() => abrirStock(s)}
                        className="rounded-3 px-2 py-0 d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '0.72rem', backgroundColor: color, borderColor: color, fontWeight: 600 }}
                      >
                        <i className="bi bi-pencil-square"></i>
                        <span>Cargar</span>
                      </Button>
                    ) : (
                      <span className="fw-semibold" style={{ color: '#b45309', fontSize: '0.75rem' }}>
                        Pendiente
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* La línea que separa el stock inicial de las auditorías. */}
        <hr className="mt-0 mb-2 flex-shrink-0" style={{ borderTop: `1px solid ${COLOR}`, opacity: 0.5 }} />

        <div className="fw-semibold mb-1" style={{ color: COLOR, fontSize: '0.8rem' }}>
          Auditorías
        </div>
        {/* Dos tablas en el mismo scroll: la de las auditorías y, a la
            derecha y aparte, la del resultado, que copia la altura de cada
            fila de la otra (igualarFilas). */}
        <div style={{ flex: '0 1 auto', minHeight: 0, overflow: 'auto' }}>
          <div className="d-flex align-items-start gap-3" style={{ minWidth: esEncargado ? '560px' : '750px' }}>
            <div
              className="shadow-sm bg-white rounded-3 flex-grow-1"
              style={{ overflow: 'clip', border: '1px solid #cbd5e1' }}
            >
              <Table ref={tablaRef} className="mb-0 tabla-informe" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ height: ALTO_ENCABEZADO }}>
                    <th style={{ ...thCentro, width: '100px' }}>Fecha pedido</th>
                    <th style={{ ...thCentro, width: '90px' }}>Taller</th>
                    <th style={{ ...thCentro, width: '100px' }}>Stock (lts)</th>
                    <th style={{ ...thCentro, width: '70px' }}>Foto</th>
                    <th style={th}>Cargó</th>
                    {!esEncargado && <th style={{ ...thCentro, width: '60px' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {lista.length === 0 ? (
                    <tr>
                      <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                        {cargando ? 'Cargando…' : 'No hay auditorías pedidas'}
                      </td>
                    </tr>
                  ) : (
                    lista.map((a) =>
                      a.cargas.map((c, n) => {
                        const campo = campoGasoil(c.campo)
                        const cargada = c.litros !== null && c.litros !== undefined
                        // La primera fila de cada pedido lleva la fecha y el
                        // borrar, que abarcan las filas de los dos campos.
                        const primera = n === 0
                        return (
                          <tr
                            key={`${a._id}-${c.campo}-${c.tipo}`}
                            className={claseFila(a, n)}
                            style={{ height: ALTO_FILA, ...bordeFila(a, n) }}
                          >
                            {primera && (
                              <td style={{ ...tdCentro, fontWeight: 600 }} rowSpan={a.cargas.length} title={a.pedidoPor ? `Pidió ${a.pedidoPor}` : undefined}>
                                {fecha(a.fechaPedido)}
                              </td>
                            )}
                            <td style={{ ...tdCentro, fontWeight: 600, color: campo?.color }}>{nombreTanque(c.campo, c.tipo)}</td>
                            <td style={tdCentro}>
                              {cargada ? (
                                litros(c.litros)
                              ) : puedeCargar ? (
                                <Button
                                  size="sm"
                                  onClick={() => abrirCarga(a, c)}
                                  className="rounded-3 px-2 py-0 d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '0.7rem', backgroundColor: campo?.color, borderColor: campo?.color, fontWeight: 600 }}
                                >
                                  <i className="bi bi-pencil-square"></i>
                                  <span>Cargar</span>
                                </Button>
                              ) : (
                                <span className="fw-semibold" style={{ color: '#b45309' }}>
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td style={tdCentro}>{celdaFoto(a, c, cargada)}</td>
                            <td style={td}>
                              {cargada ? (
                                <div className="d-flex align-items-center justify-content-between gap-2">
                                  <span>
                                    {c.cargadoPor || <Raya />}
                                    <span className="text-muted ms-1">{fechaHora(c.fechaCarga)}</span>
                                  </span>
                                  {puedeCorregirStock && (
                                    <BotonAccion icono="bi-pencil" titulo="Corregir" variante="primary" onClick={() => abrirCarga(a, c)} />
                                  )}
                                </div>
                              ) : (
                                <Raya />
                              )}
                            </td>
                            {primera && !esEncargado && (
                              <td style={tdCentro} rowSpan={a.cargas.length}>
                                <BotonAccion
                                  icono="bi-trash"
                                  titulo={puedePedir ? 'Borrar la auditoría' : 'Sin permiso para editar'}
                                  variante="danger"
                                  deshabilitado={!puedePedir}
                                  onClick={() => borrar(a)}
                                />
                              </td>
                            )}
                          </tr>
                        )
                      })
                    )
                  )}
                </tbody>
              </Table>
            </div>

            {/* El resultado, aparte: una fila por cada fila de la otra tabla. */}
            {verResultado && (
              <div
                className="shadow-sm bg-white rounded-3 flex-shrink-0"
                style={{ width: '170px', overflow: 'clip', border: '1px solid #cbd5e1' }}
              >
                <Table ref={resultadoRef} className="mb-0 tabla-informe" style={{ width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={thCentro}>Resultado (lts)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.length === 0 ? (
                      <tr>
                        <td className="text-center text-muted py-4" style={td}>
                          <Raya />
                        </td>
                      </tr>
                    ) : (
                      lista.map((a) =>
                        a.cargas.map((c, n) => (
                          <tr
                            key={`${a._id}-${c.campo}-${c.tipo}`}
                            className={claseFila(a, n)}
                            style={bordeFila(a, n)}
                          >
                            <td style={tdCentro}>{celdaResultado(a, c)}</td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </Container>

      {/* Litros y foto del nivel de un campo. */}
      <Modal show={editando !== null} onHide={() => setEditando(null)} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: editando ? campoGasoil(editando.carga.campo)?.color : COLOR,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-clipboard-check-fill"></i>
            <span>
              Auditoría del {editando && fecha(editando.auditoria.fechaPedido)} ·{' '}
              {editando && tituloTanque(editando.carga.campo, editando.carga.tipo)}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardarCarga}>
          <Modal.Body className="p-3 p-md-4">
            <Form.Label className="fw-semibold text-dark small mb-1">Litros en el tanque</Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={litrosForm}
              onChange={(e) => setLitrosForm(e.target.value)}
              className="rounded-3 mb-3"
              style={{ fontSize: '0.85rem', width: '140px' }}
              required
            />
            <Form.Label className="fw-semibold text-dark small mb-1">Foto del nivel</Form.Label>
            {/* La que ya está: el nombre con la x. Sacada, se elige otra. */}
            {editando?.carga.foto?.url && !fotoQuitada ? (
              <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                <a href={editando.carga.foto.url} target="_blank" rel="noreferrer" className="text-truncate">
                  <i className="bi bi-paperclip" /> {editando.carga.foto.nombre || 'Ver la foto'}
                </a>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger p-0"
                  style={{ lineHeight: 1 }}
                  title="Quitar la foto"
                  onClick={() => setFotoQuitada(true)}
                >
                  <i className="bi bi-x-lg" style={{ fontSize: '0.8rem' }} />
                </button>
              </div>
            ) : (
              <Form.Control
                type="file"
                accept="image/*"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                className="rounded-3"
                style={{ fontSize: '0.85rem' }}
              />
            )}
          </Modal.Body>
          <Modal.Footer className="bg-light border-0 py-2 px-4" style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
            <Button variant="outline-secondary" size="sm" onClick={() => setEditando(null)} className="rounded-3 px-3" style={{ fontSize: '0.84rem' }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={guardando}
              className="rounded-3 px-3 shadow-sm"
              style={{
                fontSize: '0.84rem',
                backgroundColor: editando ? campoGasoil(editando.carga.campo)?.color : COLOR,
                borderColor: editando ? campoGasoil(editando.carga.campo)?.color : COLOR,
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <HistorialAuditoriasGasoil
        show={verHistorial}
        onHide={() => setVerHistorial(false)}
        lista={lista}
        orden={stocks.map((s) => ({ campo: s.campo, tipo: s.tipo }))}
      />

      {/* El resumen del resultado de una auditoría en un campo. */}
      <Modal show={resumen !== null} onHide={() => setResumen(null)} centered size="sm" contentClassName="border-0 shadow-lg rounded-4">
        {resumen && (() => {
          const campo = campoGasoil(resumen.carga.campo)
          const r = resumen.carga.resultado
          const renglon = (etiqueta, valor, estilo) => (
            <div className="d-flex justify-content-between py-1" style={{ borderBottom: '1px solid #e2e8f0', ...estilo }}>
              <span className="text-muted">{etiqueta}</span>
              <span className="fw-semibold">{valor}</span>
            </div>
          )
          return (
            <>
              <Modal.Header
                closeButton
                closeVariant="white"
                style={{ backgroundColor: campo?.color || COLOR, color: '#fff', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
              >
                <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
                  <i className="bi bi-calculator-fill"></i>
                  <span>
                    Resultado · {tituloTanque(resumen.carga.campo, resumen.carga.tipo)} · {fecha(resumen.auditoria.fechaPedido)}
                  </span>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body className="p-3" style={{ fontSize: '0.82rem' }}>
                {/* Desde: cuando se cargó el stock inicial (27/10/2026), o la
                    foto de la anterior. Hasta: la foto de esta. El corte es
                    por cuándo se escribió cada consumo e ingreso. */}
                {renglon('Desde', `${r.origen === 'stock inicial' ? 'Stock inicial' : 'Foto'} ${fechaHora(r.desde)}`)}
                {renglon('Hasta', `Foto ${fechaHora(r.hasta)}`)}
                {renglon(r.origen === 'stock inicial' ? 'Stock inicial' : 'Auditoría anterior', `${litros(r.partida)} lts`)}
                {renglon('Ingresa', `+ ${litros(r.ingresos)} lts`, { color: '#1d4ed8' })}
                {renglon('Consumo', `− ${litros(r.consumos)} lts`)}
                {renglon('Tendría que haber', `${litros(r.teorico)} lts`)}
                {renglon('Medido', `${litros(r.medido)} lts`)}
                <div className="d-flex justify-content-between pt-2 fw-bold" style={{ color: colorResultado(r.resultado), fontSize: '0.9rem' }}>
                  <span>Resultado</span>
                  <span>
                    {textoResultado(r.resultado)}
                    {desviacion(r) && <span className="ms-1">({desviacion(r)})</span>}
                  </span>
                </div>
              </Modal.Body>
            </>
          )
        })()}
      </Modal>

      {/* Stock inicial de un campo: litros, fecha y foto del nivel. */}
      <Modal show={editandoStock !== null} onHide={() => setEditandoStock(null)} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: editandoStock ? campoGasoil(editandoStock.campo)?.color : COLOR,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-fuel-pump-fill"></i>
            <span>Stock inicial · {editandoStock && tituloTanque(editandoStock.campo, editandoStock.tipo)}</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardarStock}>
          <Modal.Body className="p-3 p-md-4">
            <div className="d-flex gap-3 flex-wrap mb-3">
              <div>
                <Form.Label className="fw-semibold text-dark small mb-1">Fecha</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaForm}
                  onChange={(e) => setFechaForm(e.target.value)}
                  className="rounded-3"
                  style={{ fontSize: '0.85rem', width: '150px' }}
                  required
                />
              </div>
              <div>
                <Form.Label className="fw-semibold text-dark small mb-1">Litros en el tanque</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={litrosForm}
                  onChange={(e) => setLitrosForm(e.target.value)}
                  className="rounded-3"
                  style={{ fontSize: '0.85rem', width: '140px' }}
                  required
                />
              </div>
            </div>
            <Form.Label className="fw-semibold text-dark small mb-1">
              Foto del nivel
              {editandoStock?.stock?.foto?.url && <span className="text-muted fw-normal"> (vacío deja la que está)</span>}
            </Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              className="rounded-3"
              style={{ fontSize: '0.85rem' }}
            />
          </Modal.Body>
          <Modal.Footer className="bg-light border-0 py-2 px-4" style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
            <Button variant="outline-secondary" size="sm" onClick={() => setEditandoStock(null)} className="rounded-3 px-3" style={{ fontSize: '0.84rem' }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={guardando}
              className="rounded-3 px-3 shadow-sm"
              style={{
                fontSize: '0.84rem',
                backgroundColor: editandoStock ? campoGasoil(editandoStock.campo)?.color : COLOR,
                borderColor: editandoStock ? campoGasoil(editandoStock.campo)?.color : COLOR,
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
