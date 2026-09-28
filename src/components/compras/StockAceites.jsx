import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { exportarPlanilla } from '../../helpers/excel'
import { Raya, BotonAccion, BotonLimpiar, FiltroSelect, Buscador } from './estilos'
import ModalMovimientoAceite from './ModalMovimientoAceite'
import { A, litros, pesos, nombreAceite, normalizar, hoy, fechaCorta } from './aceites'

/**
 * Los movimientos de aceites (28/09/2026).
 *
 * Copiada de Mantenimiento › Consumo de aceites del Sistema de Gestión Lepa y
 * pasada al formato del Tablero. Allá eran dos pantallas —los consumos con el
 * stock arriba, y las compras aparte, a las que se llegaba con "Ver detalle de
 * compra"—; acá son una sola con dos vistas, Consumos y Compras, y el stock de
 * cada aceite en una franja arriba que al tocarla filtra la tabla.
 *
 * La máquina y la obra de allá acá son el grupo y el centro de costo, que es
 * como se imputa todo en el Tablero.
 *
 * Los aceites se dan de alta en su propia pantalla (StockAceitesAlta.jsx), con
 * el botón "Alta de aceites".
 */
const MOV_VACIO = {
  fecha: hoy(),
  aceite: '',
  litros: '',
  proveedor: '',
  marca: '',
  precio: '',
  grupo: '',
  cc: '',
  observaciones: '',
}

const VISTAS = [
  { valor: 'Salida', texto: 'Consumos', icono: 'bi-droplet-half' },
  { valor: 'Entrada', texto: 'Compras', icono: 'bi-cart-plus' },
]

export default function StockAceites() {
  const navigate = useNavigate()

  const th = {
    backgroundColor: A.color,
    color: '#fff',
    fontSize: '0.66rem',
    fontWeight: 600,
    verticalAlign: 'middle',
    padding: '3px 5px',
    whiteSpace: 'nowrap',
  }
  const thCentro = { ...th, textAlign: 'center' }
  const td = { fontSize: '0.7rem', padding: '1px 5px', verticalAlign: 'middle' }
  const tdCentro = { ...td, textAlign: 'center' }
  const tdNumero = { ...tdCentro, whiteSpace: 'nowrap' }

  const { puede } = usePermisos()
  const sinEditar = !puede('compras.stock', 'editar')

  const [aceites, setAceites] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  // Qué se mira: los consumos (como en el Sistema de Gestión) o las compras.
  const [vista, setVista] = useState('Salida')
  const [fAceite, setFAceite] = useState('')
  const [fGrupo, setFGrupo] = useState('')
  const [fCC, setFCC] = useState('')
  const [fProveedor, setFProveedor] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // La compra o el consumo que se está cargando. En null, el modal está cerrado.
  const [mov, setMov] = useState(null)
  const [movDatos, setMovDatos] = useState(MOV_VACIO)
  const [guardando, setGuardando] = useState(false)

  // Con .then y no con async/await: así el compilador de React ve que el
  // estado se toca en la respuesta y no adentro del efecto que la pide.
  const cargar = () =>
    Promise.all([api.get(A.API), api.get(`${A.API}/movimientos`)])
      .then(([listaAceites, listaMovs]) => {
        setAceites(Array.isArray(listaAceites) ? listaAceites : [])
        setMovimientos(Array.isArray(listaMovs) ? listaMovs : [])
      })
      .catch((error) =>
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudieron traer los aceites' })
      )
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const compras = vista === 'Entrada'
  const deLaVista = movimientos.filter((m) => m.movimiento === vista)

  // Las opciones salen de todo lo de la vista, no de lo ya filtrado: si no,
  // elegir un aceite vacía el resto de los desplegables.
  const unicos = (valores) => [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const opcionesAceite = unicos(aceites.map(nombreAceite))
  const opcionesGrupo = unicos(deLaVista.map((m) => m.grupo))
  const opcionesCC = unicos(deLaVista.filter((m) => !fGrupo || m.grupo === fGrupo).map((m) => m.cc))
  const opcionesProveedor = unicos(deLaVista.map((m) => m.proveedor))

  const busq = normalizar(busqueda.trim())
  const lista = deLaVista.filter((m) => {
    if (fAceite && nombreAceite(m.aceite) !== fAceite) return false
    if (compras) {
      if (fProveedor && m.proveedor !== fProveedor) return false
    } else {
      if (fGrupo && m.grupo !== fGrupo) return false
      if (fCC && m.cc !== fCC) return false
    }
    if (!busq) return true
    return [nombreAceite(m.aceite), m.proveedor, m.marca, m.grupo, m.cc, m.observaciones].some((v) =>
      normalizar(v).includes(busq)
    )
  })

  const totalLitros = lista.reduce((s, m) => s + (m.litros || 0), 0)
  const totalPrecio = lista.reduce((s, m) => s + (m.precio || 0), 0)

  const hayFiltros = !!(fAceite || fGrupo || fCC || fProveedor || busqueda)
  const limpiar = () => {
    setFAceite('')
    setFGrupo('')
    setFCC('')
    setFProveedor('')
    setBusqueda('')
  }

  const cambiarVista = (v) => {
    setVista(v)
    // Los filtros propios de cada vista no tienen sentido en la otra.
    setFGrupo('')
    setFCC('')
    setFProveedor('')
  }

  // ── Cargar, corregir y borrar ──

  const setCampo = (campo, valor) => setMovDatos((d) => ({ ...d, [campo]: valor }))

  const abrir = (movimiento) => {
    setMov({ movimiento })
    // Si la tabla está filtrada por un aceite, arranca elegido.
    const filtrado = aceites.find((a) => nombreAceite(a) === fAceite)
    setMovDatos({
      ...MOV_VACIO,
      fecha: hoy(),
      aceite: filtrado?._id || '',
      marca: movimiento === 'Entrada' ? filtrado?.marca || '' : '',
    })
  }

  const editar = (m) => {
    setMov({ movimiento: m.movimiento, editando: m._id })
    setMovDatos({
      fecha: m.fecha ? m.fecha.slice(0, 10) : hoy(),
      aceite: m.aceite?._id || '',
      litros: m.litros ?? '',
      proveedor: m.proveedor || '',
      marca: m.marca || '',
      precio: m.precio ?? '',
      grupo: m.grupo || '',
      cc: m.cc || '',
      observaciones: m.observaciones || '',
    })
  }

  const cerrar = () => setMov(null)

  const guardar = async (e) => {
    e.preventDefault()
    // Los desplegables con buscador no son campos del formulario: lo
    // obligatorio se controla acá.
    const falta = !movDatos.aceite
      ? 'Elegí el aceite'
      : mov.movimiento === 'Entrada' && !movDatos.proveedor
        ? 'Elegí el proveedor'
        : mov.movimiento === 'Salida' && !movDatos.grupo
          ? 'Elegí el grupo'
          : null
    if (falta) return Swal.fire({ icon: 'warning', title: 'Falta un dato', text: falta })

    setGuardando(true)
    try {
      const base = `${A.API}/${movDatos.aceite}/movimientos`
      if (mov.editando) await api.put(`${base}/${mov.editando}`, movDatos)
      else await api.post(base, { ...movDatos, movimiento: mov.movimiento })
      const texto = mov.movimiento === 'Entrada' ? 'Compra' : 'Consumo'
      setMov(null)
      // Lo recién cargado se ve en su vista.
      setVista(mov.movimiento)
      cargar()
      Swal.fire({
        icon: 'success',
        title: mov.editando ? `${texto} actualizado` : `${texto} registrado`,
        timer: 1200,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo guardar' })
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (m) => {
    const esCompra = m.movimiento === 'Entrada'
    const resultado = await Swal.fire({
      title: esCompra ? '¿Borrar esta compra?' : '¿Borrar este consumo?',
      text: `${litros(m.litros)} L de ${nombreAceite(m.aceite)} del ${fechaCorta(m.fecha)}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) return
    try {
      await api.delete(`${A.API}/${m.aceite._id}/movimientos/${m._id}`)
      cargar()
      Swal.fire({
        icon: 'success',
        title: esCompra ? 'Compra borrada' : 'Consumo borrado',
        timer: 1200,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo borrar' })
    }
  }

  // ── Excel: lo que se ve, con las columnas de la vista ──

  const exportar = () => {
    const columnas = compras
      ? [
          { titulo: 'Fecha', ancho: 12, valor: (m) => fechaCorta(m.fecha) },
          { titulo: 'Proveedor', ancho: 28, valor: (m) => m.proveedor },
          { titulo: 'Aceite', ancho: 36, valor: (m) => nombreAceite(m.aceite) },
          { titulo: 'Marca', ancho: 16, valor: (m) => m.marca },
          { titulo: 'Litros', ancho: 10, valor: (m) => m.litros },
          { titulo: 'Precio', ancho: 14, valor: (m) => m.precio ?? '' },
          { titulo: '$/L', ancho: 12, valor: (m) => (m.precio && m.litros ? Math.round(m.precio / m.litros) : '') },
          { titulo: 'Observaciones', ancho: 36, valor: (m) => m.observaciones },
        ]
      : [
          { titulo: 'Fecha', ancho: 12, valor: (m) => fechaCorta(m.fecha) },
          { titulo: 'Aceite', ancho: 36, valor: (m) => nombreAceite(m.aceite) },
          { titulo: 'Litros', ancho: 10, valor: (m) => m.litros },
          { titulo: 'Grupo', ancho: 18, valor: (m) => m.grupo },
          { titulo: 'C.C.', ancho: 14, valor: (m) => m.cc },
          { titulo: 'Observaciones', ancho: 36, valor: (m) => m.observaciones },
        ]
    exportarPlanilla({
      titulo: `Aceites — ${compras ? 'Compras' : 'Consumos'}`,
      hoja: compras ? 'Compras' : 'Consumos',
      columnas,
      filas: lista.map((m) => columnas.map((c) => c.valor(m) ?? '')),
      archivo: `aceites_${compras ? 'compras' : 'consumos'}_${hoy()}.xlsx`,
    })
  }

  const columnas = compras ? 9 : 7

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
        style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: '34px',
              height: '34px',
              backgroundColor: A.acento,
              color: '#fff',
              fontSize: '1.05rem',
              boxShadow: `0 2px 8px ${A.acento}55`,
            }}
          >
            <i className={A.icono}></i>
          </div>
          <span className="fw-bold" style={{ color: A.color, fontSize: '1.05rem' }}>
            Movimientos de aceites
          </span>

          {/* Consumos o compras: la tabla cambia de columnas. */}
          <div className="btn-group btn-group-sm ms-2" role="group">
            {VISTAS.map((v) => (
              <button
                key={v.valor}
                type="button"
                onClick={() => cambiarVista(v.valor)}
                className="btn d-inline-flex align-items-center gap-1 px-3"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: vista === v.valor ? A.color : '#fff',
                  color: vista === v.valor ? '#fff' : A.color,
                  border: `1px solid ${A.color}`,
                }}
              >
                <i className={`bi ${v.icono}`}></i>
                <span>{v.texto}</span>
              </button>
            ))}
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto flex-wrap">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => navigate('/compras/analista/aceites/alta')}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1"
              style={{ fontSize: '0.82rem', color: A.color, borderColor: A.acento, backgroundColor: A.colorSuave }}
              title="Dar de alta, editar o borrar aceites"
            >
              <i className="bi bi-plus-square"></i>
              <span>Alta de aceites</span>
            </Button>
            <Button
              size="sm"
              onClick={exportar}
              disabled={lista.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ fontSize: '0.82rem', backgroundColor: '#15803d', borderColor: '#15803d' }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={() => abrir('Entrada')}
              disabled={sinEditar || aceites.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ fontSize: '0.82rem', fontWeight: 600, backgroundColor: '#15803d', borderColor: '#15803d' }}
              title={sinEditar ? 'Sin permiso para editar' : 'Registrar una compra de aceite'}
            >
              <i className="bi bi-cart-plus"></i>
              <span>Compra</span>
            </Button>
            <Button
              size="sm"
              onClick={() => abrir('Salida')}
              disabled={sinEditar || aceites.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ fontSize: '0.82rem', fontWeight: 600, backgroundColor: '#9d2235', borderColor: '#9d2235' }}
              title={sinEditar ? 'Sin permiso para editar' : 'Registrar un consumo de aceite'}
            >
              <i className="bi bi-droplet-half"></i>
              <span>Consumo</span>
            </Button>
          </div>
        </div>

        {/* El stock de cada aceite. Tocar uno filtra la tabla por ese aceite;
            tocarlo de nuevo saca el filtro. */}
        <Card className="mb-2 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-bold text-dark me-1" style={{ fontSize: '0.72rem' }}>
              Stock
            </span>
            {aceites.length === 0 ? (
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                {cargando ? 'Cargando…' : 'No hay aceites dados de alta: cargalos con "Alta de aceites".'}
              </span>
            ) : (
              aceites.map((a) => {
                const nombre = nombreAceite(a)
                const elegido = fAceite === nombre
                const vacio = !a.existencia
                return (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => setFAceite(elegido ? '' : nombre)}
                    className="btn btn-sm rounded-3 d-inline-flex align-items-center gap-2 px-2 py-1"
                    style={{
                      fontSize: '0.76rem',
                      backgroundColor: elegido ? A.color : A.colorSuave,
                      color: elegido ? '#fff' : A.color,
                      border: `1px solid ${elegido ? A.color : '#fde68a'}`,
                    }}
                    title={elegido ? 'Sacar el filtro' : `Ver solo ${nombre}`}
                  >
                    <span>
                      {a.tipo} · {a.marca}
                      {a.denominacion ? ` · ${a.denominacion}` : ''}
                    </span>
                    <b style={{ color: elegido ? '#fde047' : vacio ? '#dc2626' : A.color }}>{litros(a.existencia)} L</b>
                  </button>
                )
              })
            )}
          </div>
        </Card>

        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <FiltroSelect
              etiqueta="Aceite"
              ancho="260px"
              valor={fAceite}
              vacio="Todos"
              onChange={setFAceite}
              opciones={opcionesAceite}
            />
            {compras ? (
              <FiltroSelect
                etiqueta="Proveedor"
                ancho="220px"
                valor={fProveedor}
                vacio="Todos"
                onChange={setFProveedor}
                opciones={opcionesProveedor}
              />
            ) : (
              <>
                <FiltroSelect
                  etiqueta="Grupo"
                  ancho="170px"
                  valor={fGrupo}
                  vacio="Todos"
                  onChange={(v) => {
                    setFGrupo(v)
                    setFCC('')
                  }}
                  opciones={opcionesGrupo}
                />
                <FiltroSelect
                  etiqueta="C.C."
                  ancho="130px"
                  valor={fCC}
                  vacio="Todos"
                  onChange={setFCC}
                  opciones={opcionesCC}
                />
              </>
            )}
            <div className="d-flex flex-column" style={{ width: '260px' }}>
              <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
                Buscar
              </span>
              <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Aceite, observaciones…" />
            </div>
            {hayFiltros && <BotonLimpiar onClick={limpiar} />}
          </div>
        </Card>

        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: '0 1 auto',
            minHeight: 0,
            alignSelf: 'center',
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: 'auto', minWidth: compras ? '1000px' : '820px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {compras ? (
                <tr>
                  <th style={thCentro}>Fecha</th>
                  <th style={th}>Proveedor</th>
                  <th style={th}>Aceite</th>
                  <th style={th}>Marca</th>
                  <th style={thCentro}>Litros</th>
                  <th style={thCentro}>Precio</th>
                  <th style={thCentro}>$/L</th>
                  <th style={th}>Observaciones</th>
                  <th style={{ ...thCentro, width: '80px' }}>Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th style={thCentro}>Fecha</th>
                  <th style={th}>Aceite</th>
                  <th style={thCentro}>Litros</th>
                  <th style={th}>Grupo</th>
                  <th style={thCentro}>C.C.</th>
                  <th style={th}>Observaciones</th>
                  <th style={{ ...thCentro, width: '80px' }}>Acciones</th>
                </tr>
              )}
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={columnas} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : hayFiltros
                        ? compras
                          ? 'Ninguna compra coincide con los filtros'
                          : 'Ningún consumo coincide con los filtros'
                        : compras
                          ? 'No hay compras registradas'
                          : 'No hay consumos registrados'}
                  </td>
                </tr>
              ) : (
                <>
                  {lista.map((m) => {
                    const acciones = (
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center gap-2">
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Corregir'}
                            variante="primary"
                            deshabilitado={sinEditar}
                            onClick={() => editar(m)}
                          />
                          <BotonAccion
                            icono="bi-trash"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Borrar'}
                            variante="danger"
                            deshabilitado={sinEditar}
                            onClick={() => borrar(m)}
                          />
                        </div>
                      </td>
                    )
                    return compras ? (
                      <tr key={m._id}>
                        <td style={tdNumero}>{fechaCorta(m.fecha)}</td>
                        <td style={td}>{m.proveedor || <Raya />}</td>
                        <td style={td}>{nombreAceite(m.aceite)}</td>
                        <td style={td}>{m.marca || <Raya />}</td>
                        <td style={tdNumero}>{litros(m.litros)}</td>
                        <td style={tdNumero}>{m.precio != null ? pesos(m.precio) : <Raya />}</td>
                        <td style={tdNumero}>
                          {m.precio && m.litros ? pesos(Math.round(m.precio / m.litros)) : <Raya />}
                        </td>
                        <td style={td}>{m.observaciones || <Raya />}</td>
                        {acciones}
                      </tr>
                    ) : (
                      <tr key={m._id}>
                        <td style={tdNumero}>{fechaCorta(m.fecha)}</td>
                        <td style={td}>{nombreAceite(m.aceite)}</td>
                        <td style={tdNumero}>{litros(m.litros)}</td>
                        <td style={td}>{m.grupo || <Raya />}</td>
                        <td style={tdCentro}>{m.cc || <Raya />}</td>
                        <td style={td}>{m.observaciones || <Raya />}</td>
                        {acciones}
                      </tr>
                    )
                  })}
                  {compras ? (
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: A.color }}>TOTAL</td>
                      <td style={td} colSpan={3}></td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{litros(totalLitros)}</td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{pesos(totalPrecio)}</td>
                      <td style={td} colSpan={3}></td>
                    </tr>
                  ) : (
                    <tr className="fila-total">
                      <td style={{ ...td, fontWeight: 700, color: A.color }}>TOTAL</td>
                      <td style={td}></td>
                      <td style={{ ...tdNumero, fontWeight: 700 }}>{litros(totalLitros)}</td>
                      <td style={td} colSpan={4}></td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      <ModalMovimientoAceite
        mov={mov}
        datos={movDatos}
        aceites={aceites}
        guardando={guardando}
        onCampo={setCampo}
        onGuardar={guardar}
        onCerrar={cerrar}
      />
    </div>
  )
}
