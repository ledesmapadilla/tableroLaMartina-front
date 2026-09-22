import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { exportarPlanilla } from '../../helpers/excel'
import { Raya, BotonAccion, BotonLimpiar, FiltroSelect, Buscador } from './estilos'
import MovimientosStock from './MovimientosStock'
import ModalMovimiento from './ModalMovimiento'
import { useMovimientos } from './useMovimientos'
import AsignacionesStock from './AsignacionesStock'
import ResumenACargo from './ResumenACargo'
import { rubroDe } from './rubrosStock'
import Error404 from '../pages/Error404'

/**
 * Un rubro del almacén de repuestos (22/09/2026).
 *
 * Es una pantalla sola para las seis tarjetas del stock: todas se miran igual
 * —el catálogo del rubro con su existencia, y las entradas y salidas que la
 * mueven— y lo que cambia entre una y otra está en `rubrosStock.js`, que le
 * pone a cada una su color, su título y sus tipos.
 *
 * Son dos códigos distintos y por eso están las dos columnas:
 *  - Código: el interno, lo arma el servidor (AIR-001, CUB-012…) y no se edita.
 *  - Código de fábrica: el que viene impreso, el de la marca.
 *
 * Los prefijos no se inventan por tarjeta: salen del catálogo del almacén
 * (TableroBack/src/catalogos/almacen.js), que es uno solo para todo el
 * proyecto, así un código no puede querer decir dos cosas distintas.
 *
 * Hay dos formas de nombrar un artículo, y de ahí sale su código:
 *  - Con `tipos`, el alta elige de una lista y el correlativo va por tipo. Es
 *    el caso de Filtros.
 *  - Sin `tipos`, el alta escribe la descripción a mano y todo el rubro numera
 *    con un prefijo solo. Una cubierta se reconoce por su medida (18.4-38) y
 *    no hay lista que las contenga a todas.
 */
const VACIO = { tipo: '', descripcion: '', marca: '', codigoFabrica: '', existencia: 0, ubicacion: '', observaciones: '' }

// Entregar una herramienta o recibirla: arranca con la fecha de hoy, que es
// lo que más pasa.
const hoy = () => new Date().toISOString().slice(0, 10)
const ACARGO_VACIO = { fecha: hoy(), persona: '', observaciones: '' }

// Para buscar: sin acentos y sin distinguir mayúsculas, así "hidraulico"
// encuentra "Filtro hidráulico".
const normalizar = (t) =>
  (t ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Qué tarjeta del stock se abrió. Las que todavía no tienen rubro —el catálogo
 * general— caen en el 404, igual que antes.
 *
 * El 404 se decide acá afuera y no adentro de la pantalla porque un `return`
 * temprano dejaría los hooks atrás de un `if`.
 */
export default function StockRubro() {
  const rubro = rubroDe(useParams().seccion)
  // La `key` es el rubro: pasar de una tarjeta a otra tiene que empezar de
  // cero, con su lista y sin el buscador de la anterior.
  return rubro ? <Rubro key={rubro.clave} r={rubro} /> : <Error404 />
}

function Rubro({ r }) {
  // La URL del rubro en el back. En mayúscula para no taparle el nombre al
  // servicio `api`, que es con el que se la llama.
  const API = `/stock/${r.clave}`
  // Cómo se nombra un artículo del rubro: "filtro" en Filtros y "artículo" en
  // los que juntan cosas distintas.
  const [singular, plural] = r.nombre
  const Singular = singular[0].toUpperCase() + singular.slice(1)
  // Con lista el alta elige el tipo; sin ella, escribe la descripción.
  const porTipo = !!r.tipos

  const th = {
    backgroundColor: r.color,
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

  // Ver sin editar: los botones quedan a la vista pero deshabilitados, igual
  // que en las altas del Tablero.
  const { puede } = usePermisos()
  const sinEditar = !puede('compras.stock', 'editar')

  const [articulos, setArticulos] = useState([])
  const [cargando, setCargando] = useState(true)
  // El buscador puede venir cargado de afuera: el catálogo general manda el
  // código en la URL para abrir esa fila sola.
  const [params] = useSearchParams()
  const [busqueda, setBusqueda] = useState(params.get('buscar') || '')
  // El tipo por el que se filtra, solo en los rubros que tienen lista.
  const [tipo, setTipo] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  // Mientras el alta está guardando, el botón se bloquea. Sin esto un doble
  // clic manda dos altas y quedan dos artículos con el mismo código: pasó el
  // 22/09/2026 con HER-006, dos filas cargadas con un segundo de diferencia.
  const [guardandoAlta, setGuardandoAlta] = useState(false)

  // Las entradas y salidas: la lógica es la misma en todo el almacén y vive en
  // el hook. Acá solo se le dice a qué rubro van y qué recargar después.
  const movimientos = useMovimientos({ apiDe: () => API, recargar: () => cargar() })

  // Entregar o recibir una herramienta: de cuál se trata y los datos del
  // formulario. En null, el modal está cerrado. Solo en los rubros con `aCargo`.
  const [aCargo, setACargo] = useState(null)
  const [aCargoDatos, setACargoDatos] = useState(ACARGO_VACIO)
  const [guardandoACargo, setGuardandoACargo] = useState(false)
  // Por dónde anduvo una herramienta. En null, cerrado.
  const [prestamos, setPrestamos] = useState(null)
  // El cartel con dónde está cada herramienta, todas juntas.
  const [resumen, setResumen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ defaultValues: VACIO })

  // Lo que se está escribiendo en la descripción, para el predictivo de más
  // abajo. Con `useWatch` y no con `watch()`: el segundo devuelve una función
  // que el compilador de React no puede memorizar, y por eso deja de optimizar
  // la pantalla entera.
  const descripcionEscrita = useWatch({ control, name: 'descripcion' })

  const cargar = async () => {
    try {
      const data = await api.get(API)
      setArticulos(Array.isArray(data) ? data : [])
    } catch {
      setArticulos([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API])

  const abrirNuevo = () => {
    setEditando(null)
    reset(VACIO)
    setShowModal(true)
  }

  const abrirEditar = (f) => {
    setEditando(f._id)
    reset({
      tipo: f.tipo || '',
      descripcion: f.descripcion || '',
      marca: f.marca || '',
      codigoFabrica: f.codigoFabrica || '',
      existencia: f.existencia ?? 0,
      ubicacion: f.ubicacion || '',
      observaciones: f.observaciones || '',
    })
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setEditando(null)
    reset(VACIO)
  }

  // ── El predictivo de la descripción ──
  //
  // Mientras se escribe, se muestra lo que ya está cargado y se le parece: casi
  // siempre el repuesto ya existe y lo que hace falta es una entrada, no un
  // alta nueva. Sale de la lista que la pantalla ya tiene, no pide nada al
  // servidor. En Filtros no va: ahí el alta elige el tipo de una lista.
  const escrito = normalizar(porTipo ? '' : descripcionEscrita).trim()

  // El mismo, letra por letra (sin acentos ni mayúsculas). Ese no hay que
  // darlo de alta.
  const yaCargado =
    escrito.length > 0
      ? articulos.find((a) => a._id !== editando && normalizar(a.descripcion).trim() === escrito)
      : null

  // Los que lo contienen. Desde dos letras: con una sola traería medio almacén.
  const parecidos =
    escrito.length >= 2
      ? articulos
          .filter(
            (a) =>
              a._id !== editando &&
              a._id !== yaCargado?._id &&
              normalizar(a.descripcion).includes(escrito)
          )
          .slice(0, 5)
      : []

  // Ir a verlo: se cierra el alta y se busca su código, así queda esa sola fila
  // en la tabla con su existencia y sus botones.
  const irAlCargado = (a) => {
    cerrarModal()
    setTipo('')
    setBusqueda(a.codigo)
  }

  const onSubmit = async (datos) => {
    if (guardandoAlta) return
    const cuerpo = { ...datos, existencia: Number(datos.existencia) || 0 }
    setGuardandoAlta(true)
    try {
      if (editando) await api.put(`${API}/${editando}`, cuerpo)
      else await api.post(API, cuerpo)
      cerrarModal()
      cargar()
      Swal.fire({
        icon: 'success',
        title: `${Singular} ${editando ? 'actualizado' : 'registrado'}`,
        timer: 1500,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo guardar' })
    } finally {
      setGuardandoAlta(false)
    }
  }

  const eliminar = async (f) => {
    const resultado = await Swal.fire({
      title: `¿Eliminar ${singular}?`,
      text: `Se quitará ${f.codigo} del almacén`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) return
    try {
      await api.delete(`${API}/${f._id}`)
      cargar()
      Swal.fire({ icon: 'success', title: `${Singular} eliminado`, timer: 1200, showConfirmButton: false })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo eliminar' })
    }
  }

  // ── A cargo de quién está ──
  //
  // Una herramienta no se consume: sale a cargo de alguien y vuelve. La
  // existencia no se toca —lo que hay cargado sigue siendo lo mismo—, lo que
  // cambia es dónde está.

  const enAlguien = (f) => f?.aCargo?.persona || ''

  // El mismo modal entrega y recibe: si ya la tiene alguien, lo que se carga es
  // la devolución y el único botón dice "Devuelve".
  const abrirACargo = (articulo) => {
    setACargo(articulo)
    setACargoDatos({ ...ACARGO_VACIO, fecha: hoy() })
  }

  const cerrarACargo = () => {
    setACargo(null)
    setACargoDatos(ACARGO_VACIO)
  }

  const setACargoCampo = (campo, valor) => setACargoDatos((d) => ({ ...d, [campo]: valor }))

  const guardarACargo = async (e) => {
    e.preventDefault()
    const devolviendo = !!enAlguien(aCargo)
    if (!devolviendo && !aCargoDatos.persona.trim()) {
      Swal.fire({ icon: 'warning', title: 'A cargo de quién', text: 'Poné quién se la lleva' })
      return
    }
    setGuardandoACargo(true)
    try {
      if (devolviendo) await api.put(`${API}/${aCargo._id}/acargo/devolver`, aCargoDatos)
      else await api.post(`${API}/${aCargo._id}/acargo`, aCargoDatos)
      cerrarACargo()
      cargar()
      Swal.fire({
        icon: 'success',
        title: devolviendo ? 'Volvió al almacén' : `A cargo de ${aCargoDatos.persona.trim()}`,
        timer: 1500,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo registrar' })
    } finally {
      setGuardandoACargo(false)
    }
  }

  // Por dónde anduvo: para saber si está en el almacén o a cargo de alguien, y
  // desde cuándo.
  const abrirPrestamos = async (articulo) => {
    setPrestamos({ articulo, asignaciones: [], cargando: true })
    try {
      const asignaciones = await api.get(`${API}/${articulo._id}/acargo`)
      setPrestamos({ articulo, asignaciones, cargando: false })
    } catch (error) {
      setPrestamos(null)
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo traer el historial' })
    }
  }

  const hayFiltros = busqueda !== '' || tipo !== ''
  const limpiar = () => {
    setBusqueda('')
    setTipo('')
  }

  // Cómo se nombra cada artículo: el tipo que se eligió de la lista o la
  // descripción que se escribió. Es la columna que titula "Descripción".
  const nombreDe = (f) => (porTipo ? f.tipo : f.descripcion)

  // Se busca por todas las columnas, ese nombre incluido: escribir "aceite"
  // tiene que traer los filtros de aceite, no solo lo que tenga esas letras en
  // el código. Donde la descripción es libre el buscador es lo único que la
  // alcanza, porque no hay desplegable que acote.
  const lista = articulos.filter((f) => {
    if (tipo && f.tipo !== tipo) return false
    const q = normalizar(busqueda).trim()
    if (!q) return true
    return [f.codigo, nombreDe(f), f.marca, f.codigoFabrica, f.ubicacion, f.observaciones].some(
      (v) => normalizar(v).includes(q)
    )
  })

  // ── Las columnas de la tabla ──
  //
  // En una lista y no escritas a mano en el <thead> y en el <tbody>: el orden
  // cambia según el rubro y así se cambia en un solo lugar. De acá sale también
  // el Excel, salvo las columnas que son botones (`excel` vacío).
  const COL = {
    codigo: {
      titulo: 'Código',
      aclaracion: 'interno',
      ancho: '80px',
      centrada: true,
      excel: { ancho: 12, valor: (f) => f.codigo },
      celda: (f) => <span style={{ fontWeight: 600, color: r.color }}>{f.codigo}</span>,
    },
    descripcion: {
      titulo: 'Descripción',
      ancho: porTipo ? '165px' : '190px',
      centrada: porTipo,
      excel: { ancho: porTipo ? 22 : 34, valor: nombreDe },
      celda: nombreDe,
    },
    marca: {
      titulo: 'Marca',
      ancho: '120px',
      excel: { ancho: 18, valor: (f) => f.marca || '—' },
      celda: (f) => f.marca || <Raya />,
    },
    codigoFabrica: {
      titulo: 'Código de fábrica',
      ancho: '115px',
      centrada: true,
      excel: { ancho: 20, valor: (f) => f.codigoFabrica || '—' },
      celda: (f) => f.codigoFabrica || <Raya />,
    },
    // Sin existencia es un cero de verdad —el artículo está cargado y no hay—
    // así que va el número, no la raya. Se toca para ver de dónde salió: las
    // entradas y las salidas que lo dejaron en ese número.
    existencia: {
      titulo: 'Existencia',
      ancho: '75px',
      centrada: true,
      excel: { ancho: 12, valor: (f) => f.existencia ?? 0 },
      celda: (f) => (
        <button
          type="button"
          onClick={() => movimientos.abrirHistorial(f)}
          className="btn btn-link p-0 border-0 align-baseline text-decoration-none"
          title="Ver las entradas y salidas"
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: (f.existencia ?? 0) === 0 ? '#dc2626' : '#1e293b',
          }}
        >
          {f.existencia ?? 0}
        </button>
      ),
    },
    ubicacion: {
      titulo: 'Ubicación',
      ancho: '115px',
      excel: { ancho: 18, valor: (f) => f.ubicacion || '—' },
      celda: (f) => f.ubicacion || <Raya />,
    },
    observaciones: {
      titulo: 'Observaciones',
      excel: { ancho: 40, valor: (f) => f.observaciones || '—' },
      celda: (f) => f.observaciones || <Raya />,
    },
    movimientos: {
      titulo: 'Movimientos',
      aclaracion: 'entradas y salidas',
      ancho: '180px',
      centrada: true,
      celda: (f) => (
        <div className="d-flex justify-content-center align-items-center gap-1">
          <button
            type="button"
            onClick={() => movimientos.abrir(f, 'Entrada')}
            disabled={sinEditar}
            className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 rounded-2 py-0 px-2"
            style={{ fontSize: '0.68rem', fontWeight: 600 }}
            title={sinEditar ? 'Sin permiso para editar' : 'Registrar una entrada'}
          >
            <i className="bi bi-box-arrow-in-down"></i>
            <span>Entra</span>
          </button>
          <button
            type="button"
            onClick={() => movimientos.abrir(f, 'Salida')}
            disabled={sinEditar || (f.existencia ?? 0) === 0}
            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 rounded-2 py-0 px-2"
            style={{ fontSize: '0.68rem', fontWeight: 600 }}
            title={
              sinEditar
                ? 'Sin permiso para editar'
                : (f.existencia ?? 0) === 0
                  ? 'No hay existencia para sacar'
                  : 'Registrar una salida'
            }
          >
            <i className="bi bi-box-arrow-up"></i>
            <span>Sale</span>
          </button>
          {/* Lo ya cargado, que es donde se corrige o se borra. Con botón
              propio y no solo tocando la existencia: así se ve que está. */}
          <BotonAccion
            icono="bi-clock-history"
            titulo="Ver, corregir o borrar los movimientos"
            variante="secondary"
            onClick={() => movimientos.abrirHistorial(f)}
          />
        </div>
      ),
    },
    // Dónde está la herramienta. El nombre del que la tiene se toca y abre por
    // dónde anduvo, igual que la existencia abre sus movimientos.
    aCargo: {
      titulo: 'A cargo',
      aclaracion: 'quién la tiene',
      ancho: '240px',
      centrada: true,
      excel: { ancho: 24, valor: (f) => enAlguien(f) || 'En almacén' },
      celda: (f) => (
        <div className="d-flex justify-content-center align-items-center">
          {/* El nombre va en un bloque de ancho fijo y los botones aparte: así
              queda aire entre "En almacén" y el botón, y los botones caen
              alineados de una fila a la otra en vez de bailar con lo largo que
              sea el nombre. */}
          <button
            type="button"
            onClick={() => abrirPrestamos(f)}
            className="btn btn-link p-0 border-0 text-decoration-none text-truncate text-start me-2"
            title="Ver por dónde anduvo"
            style={{
              fontSize: '0.7rem',
              fontWeight: enAlguien(f) ? 700 : 400,
              color: enAlguien(f) ? '#b45309' : '#94a3b8',
              width: '96px',
              flex: '0 0 auto',
            }}
          >
            {enAlguien(f) || 'En almacén'}
          </button>
          <button
            type="button"
            onClick={() => abrirACargo(f)}
            disabled={sinEditar}
            className={`btn btn-sm d-inline-flex align-items-center gap-1 rounded-2 py-0 px-2 ${
              enAlguien(f) ? 'btn-outline-success' : 'btn-outline-warning'
            }`}
            style={{ fontSize: '0.68rem', fontWeight: 600 }}
            title={
              sinEditar
                ? 'Sin permiso para editar'
                : enAlguien(f)
                  ? `Recibirla de ${enAlguien(f)}`
                  : 'Entregarla a alguien'
            }
          >
            <i className={`bi ${enAlguien(f) ? 'bi-box-arrow-in-left' : 'bi-person-up'}`}></i>
            <span>{enAlguien(f) ? 'Devuelve' : 'A cargo'}</span>
          </button>
          <span className="ms-1">
            <BotonAccion
              icono="bi-clock-history"
              titulo="Ver por dónde anduvo"
              variante="secondary"
              onClick={() => abrirPrestamos(f)}
            />
          </span>
        </div>
      ),
    },
  }

  /**
   * El orden, que no es el mismo en todos los rubros.
   *
   * En Herramientas la existencia y "a cargo" se adelantan: dónde está cada una
   * es lo que se viene a mirar, y detrás de Observaciones quedaban pasada la
   * mitad de la tabla, escondidas atrás del scroll horizontal.
   */
  const columnas = (
    r.aCargo
      ? ['codigo', 'descripcion', 'existencia', 'aCargo', 'marca', 'codigoFabrica', 'ubicacion', 'observaciones', 'movimientos']
      : ['codigo', 'descripcion', 'marca', 'codigoFabrica', 'existencia', 'ubicacion', 'observaciones', 'movimientos']
  ).map((clave) => ({ clave, ...COL[clave] }))


  const exportar = () => {
    // Las columnas que son botones no van a la planilla.
    const deExcel = columnas.filter((c) => c.excel)
    exportarPlanilla({
      titulo: `Almacén de repuestos — ${r.hoja}`,
      hoja: r.hoja,
      columnas: deExcel.map((c) => ({ titulo: c.titulo, ancho: c.excel.ancho })),
      filas: lista.map((f) => deExcel.map((c) => c.excel.valor(f))),
      archivo: `${r.archivo}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    })
  }

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
      {/* Acciones queda pegada a la derecha aunque la tabla no entre: los
          botones de editar y borrar el artículo se perdían atrás del scroll
          horizontal (22/09/2026). El fondo se repite acá porque una celda
          `sticky` tapa a las de abajo y sin fondo propio se transparenta;
          van la cebra y el hover de .tabla-informe. */}
      <style>{`
        .tabla-rubro th.col-fija,
        .tabla-rubro td.col-fija {
          position: sticky;
          right: 0;
          border-left: 2px solid #cbd5e1 !important;
        }
        .tabla-rubro thead th.col-fija { z-index: 11; background-color: ${r.color}; }
        .tabla-rubro tbody td.col-fija { background-color: #fff; }
        .tabla-rubro tbody tr:nth-of-type(even) > td.col-fija { background-color: ${r.cebra}; }
        .tabla-rubro tbody tr:hover > td.col-fija { background-color: ${r.hover}; }
      `}</style>

      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1320px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center"
            style={{
              width: '34px',
              height: '34px',
              backgroundColor: r.acento,
              color: '#fff',
              fontSize: '1.05rem',
              boxShadow: `0 2px 8px ${r.acento}55`,
            }}
          >
            <i className={r.icono}></i>
          </div>
          <span className="fw-bold" style={{ color: r.color, fontSize: '1.05rem' }}>
            {r.titulo}
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: r.colorSuave, color: r.color, fontWeight: 600 }}
          >
            {lista.length} {lista.length === 1 ? singular : plural}
          </span>

          <div className="d-flex align-items-center gap-2 ms-auto">
            {/* Dónde está cada herramienta, todas juntas. Mira la lista entera
                y no la filtrada: es para salir a buscarlas. */}
            {r.aCargo && (
              <Button
                size="sm"
                onClick={() => setResumen(true)}
                disabled={articulos.length === 0}
                className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
                style={{ fontSize: '0.82rem', backgroundColor: '#b45309', borderColor: '#b45309' }}
                title="Ver dónde está cada herramienta"
              >
                <i className="bi bi-clipboard-check"></i>
                <span>Resumen</span>
              </Button>
            )}
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
              onClick={abrirNuevo}
              disabled={sinEditar}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ backgroundColor: r.color, borderColor: r.color, fontSize: '0.82rem', fontWeight: 600 }}
              title={sinEditar ? 'Sin permiso para editar' : `Cargar un ${singular}`}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nuevo {singular}</span>
            </Button>
          </div>
        </div>

        {/* Filtros de la tabla. El desplegable del tipo está solo donde hay
            lista: donde la descripción se escribe a mano no hay de dónde
            sacarlo, y el buscador queda más ancho para compensar. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            {porTipo && (
              <FiltroSelect
                etiqueta="Tipo"
                ancho="190px"
                valor={tipo}
                vacio="Todos"
                onChange={setTipo}
                opciones={r.tipos}
              />
            )}
            <div className="d-flex flex-column" style={{ width: porTipo ? '320px' : '380px' }}>
              <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
                Buscar
              </span>
              <Buscador
                valor={busqueda}
                onChange={setBusqueda}
                placeholder={`Código, ${porTipo ? 'tipo' : 'descripción'}, marca, ubicación…`}
              />
            </div>
            {hayFiltros && <BotonLimpiar onClick={limpiar} />}
          </div>
        </Card>

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
          {/* Sin ancho mínimo: la tabla entra en la pantalla y no hay scroll
              horizontal. Los anchos de las columnas son una sugerencia de cómo
              repartir el lugar, no un piso, así que lo que no entra se acomoda
              en dos renglones en vez de empujar la tabla para afuera. */}
          <Table className="mb-0 tabla-informe tabla-rubro" style={{ width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                {columnas.map((c) => (
                  <th key={c.clave} style={{ ...(c.centrada ? thCentro : th), width: c.ancho }}>
                    {c.titulo}
                    {c.aclaracion && (
                      <div style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.75 }}>
                        {c.aclaracion}
                      </div>
                    )}
                  </th>
                ))}
                <th className="col-fija" style={{ ...thCentro, width: '80px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={columnas.length + 1} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : hayFiltros
                        ? `Ningún ${singular} coincide con la búsqueda`
                        : `No hay ${plural} cargados`}
                  </td>
                </tr>
              ) : (
                lista.map((f) => (
                  <tr key={f._id}>
                    {columnas.map((c) => (
                      <td key={c.clave} style={c.centrada ? tdCentro : td}>
                        {c.celda(f)}
                      </td>
                    ))}
                    <td className="col-fija" style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center gap-2">
                        <BotonAccion
                          icono="bi-pencil"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Editar'}
                          variante="primary"
                          deshabilitado={sinEditar}
                          onClick={() => abrirEditar(f)}
                        />
                        <BotonAccion
                          icono="bi-trash"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Eliminar'}
                          variante="danger"
                          deshabilitado={sinEditar}
                          onClick={() => eliminar(f)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      {/* Las entradas y salidas ya cargadas, con su corregir y su borrar. El
          cartel es el de todo el almacén y le pone el color el rubro. */}
      <MovimientosStock
        abierto={!!movimientos.historial}
        articulo={movimientos.historial?.articulo}
        movimientos={movimientos.historial?.movimientos}
        cargando={movimientos.historial?.cargando}
        color={r.color}
        acento={r.acento}
        sinEditar={sinEditar}
        onEditar={movimientos.editar}
        onBorrar={movimientos.borrar}
        onCerrar={movimientos.cerrarHistorial}
      />

      {/* Cargar una entrada o una salida. El formulario es el mismo en todo el
          almacén; el color lo pone el rubro. */}
      <ModalMovimiento
        mov={movimientos.mov}
        datos={movimientos.movDatos}
        guardando={movimientos.guardando}
        color={r.color}
        colorSuave={r.colorSuave}
        onCampo={movimientos.setCampo}
        onGrupo={movimientos.elegirGrupo}
        onGuardar={movimientos.guardar}
        onCerrar={movimientos.cerrar}
      />

      {/* Dónde está cada herramienta, todas juntas y agrupadas por quién las
          tiene. Sale de la lista que ya está cargada, no pide nada al back. */}
      <ResumenACargo
        abierto={resumen}
        articulos={articulos}
        color={r.color}
        acento={r.acento}
        onCerrar={() => setResumen(false)}
      />

      {/* Por dónde anduvo la herramienta: de acá sale si está en el almacén o a
          cargo de alguien, y desde cuándo. */}
      <AsignacionesStock
        abierto={!!prestamos}
        articulo={prestamos?.articulo}
        asignaciones={prestamos?.asignaciones}
        cargando={prestamos?.cargando}
        color={r.color}
        acento={r.acento}
        onCerrar={() => setPrestamos(null)}
      />

      {/* Entregar una herramienta o recibirla. Es un modal solo: si ya la tiene
          alguien, lo que se carga es la devolución y el botón dice "Devuelve".
          La existencia no se toca, lo que cambia es dónde está. */}
      <Modal show={!!aCargo} onHide={cerrarACargo} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: enAlguien(aCargo) ? '#15803d' : '#b45309',
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className={`bi ${enAlguien(aCargo) ? 'bi-box-arrow-in-left' : 'bi-person-up'}`}></i>
            <span>
              {enAlguien(aCargo) ? 'Devolución' : 'A cargo'} · {aCargo?.codigo}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardarACargo}>
          <Modal.Body className="p-4">
            {/* De qué herramienta se trata y dónde está hoy. */}
            <div
              className="rounded-3 px-3 py-2 mb-3"
              style={{ backgroundColor: r.colorSuave, fontSize: '0.8rem', color: r.color }}
            >
              <span className="fw-bold">{nombreDe(aCargo || {})}</span>
              {aCargo?.marca ? ` · ${aCargo.marca}` : ''}
              <span className="ms-2">
                —{' '}
                {enAlguien(aCargo) ? (
                  <>
                    la tiene <b>{aCargo.aCargo.persona}</b>
                  </>
                ) : (
                  <b>está en el almacén</b>
                )}
              </span>
            </div>

            <Row className="g-3">
              <Col md={enAlguien(aCargo) ? 12 : 6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Fecha <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  required
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={aCargoDatos.fecha}
                  onChange={(e) => setACargoCampo('fecha', e.target.value)}
                />
              </Col>

              {/* Solo al entregarla: al recibirla ya se sabe quién la tenía. */}
              {!enAlguien(aCargo) && (
                <Col md={6}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    A cargo de <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    required
                    className="rounded-3"
                    placeholder="Quién se la lleva"
                    style={{ fontSize: '0.85rem' }}
                    value={aCargoDatos.persona}
                    onChange={(e) => setACargoCampo('persona', e.target.value)}
                  />
                </Col>
              )}

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  placeholder={
                    enAlguien(aCargo) ? 'Cómo volvió, si falta algo…' : 'Para qué la necesita, hasta cuándo…'
                  }
                  style={{ fontSize: '0.85rem' }}
                  value={aCargoDatos.observaciones}
                  onChange={(e) => setACargoCampo('observaciones', e.target.value)}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarACargo}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={guardandoACargo}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{
                backgroundColor: enAlguien(aCargo) ? '#15803d' : '#b45309',
                borderColor: enAlguien(aCargo) ? '#15803d' : '#b45309',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              <i className="bi bi-check-lg"></i>
              <span>
                {guardandoACargo ? 'Guardando…' : enAlguien(aCargo) ? 'Devuelve' : 'Registrar'}
              </span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Nuevo / Editar. El código no está: lo pone el servidor al crearlo y
          después no se toca. */}
      <Modal show={showModal} onHide={cerrarModal} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: r.color,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className={r.icono} style={{ color: r.acento }}></i>
            <span>
              {editando ? 'Editar' : 'Nuevo'} {singular}
            </span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              {/* Lo único obligatorio: es qué es el artículo. Donde hay lista
                  se elige y entra en media fila; donde se escribe a mano va a
                  lo ancho, con la medida adentro si la tiene. */}
              {porTipo ? (
                <Col md={6}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Tipo <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    className="rounded-3"
                    style={{ fontSize: '0.85rem' }}
                    {...register('tipo', { required: 'El tipo es requerido' })}
                    isInvalid={!!errors.tipo}
                  >
                    <option value="">Elegir…</option>
                    {r.tipos.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                    {errors.tipo?.message}
                  </Form.Control.Feedback>
                </Col>
              ) : (
                <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Descripción <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  placeholder="Cubierta 18.4-38, Batería 12x70, Correa del alternador…"
                  style={{ fontSize: '0.85rem' }}
                  {...register('descripcion', {
                    required: 'La descripción es requerida',
                    maxLength: { value: 120, message: 'Máximo 120 caracteres' },
                  })}
                  isInvalid={!!errors.descripcion}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                  {errors.descripcion?.message}
                </Form.Control.Feedback>

                {/* Lo que ya está cargado y se parece a lo que se está
                    escribiendo. Es para no dar de alta dos veces el mismo
                    repuesto: se toca el que ya está y la pantalla lo va a
                    buscar en la tabla. No frena el alta —dos artículos pueden
                    llamarse parecido— solo avisa. */}
                {(yaCargado || parecidos.length > 0) && (
                  <div
                    className="mt-2 rounded-3 p-2"
                    style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}
                  >
                    <div
                      className="d-flex align-items-center gap-1 mb-1"
                      style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}
                    >
                      <i className={`bi ${yaCargado ? 'bi-exclamation-triangle-fill' : 'bi-search'}`}></i>
                      <span>
                        {yaCargado
                          ? `Eso ya está cargado como ${yaCargado.codigo}`
                          : `Ya hay ${parecidos.length === 1 ? 'uno parecido' : 'otros parecidos'}`}
                      </span>
                    </div>
                    <div className="d-flex flex-column">
                      {(yaCargado ? [yaCargado, ...parecidos] : parecidos).map((a) => (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() => irAlCargado(a)}
                          className="btn btn-link p-0 border-0 text-decoration-none text-start text-truncate"
                          title="Verlo en la tabla"
                          style={{ fontSize: '0.74rem', color: '#7c2d12' }}
                        >
                          <span className="fw-bold">{a.codigo}</span>
                          {' · '}
                          {a.descripcion}
                          {a.marca ? ` · ${a.marca}` : ''}
                          <span style={{ opacity: 0.6 }}>
                            {' '}
                            — hay {a.existencia ?? 0}
                            {a.ubicacion ? ` en ${a.ubicacion}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </Col>
              )}

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Marca</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  {...register('marca', { maxLength: { value: 60, message: 'Máximo 60 caracteres' } })}
                  isInvalid={!!errors.marca}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                  {errors.marca?.message}
                </Form.Control.Feedback>
              </Col>

              {/* Ni la marca ni el código de fábrica son obligatorios: el
                  artículo se carga con lo que se tiene a mano y se completa
                  después. */}
              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Código de fábrica</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  {...register('codigoFabrica', {
                    maxLength: { value: 40, message: 'Máximo 40 caracteres' },
                  })}
                  isInvalid={!!errors.codigoFabrica}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                  {errors.codigoFabrica?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Existencia</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  {...register('existencia', {
                    min: { value: 0, message: 'No puede ser negativa' },
                  })}
                  isInvalid={!!errors.existencia}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                  {errors.existencia?.message}
                </Form.Control.Feedback>
              </Col>

              {/* Donde la descripción se llevó la fila entera de arriba, la
                  ubicación va al lado de la existencia y el formulario queda
                  parejo. Con lista de tipos las filas ya cierran solas. */}
              <Col md={porTipo ? 12 : 6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Ubicación</Form.Label>
                <Form.Control
                  className="rounded-3"
                  placeholder="Estantería, cajón…"
                  style={{ fontSize: '0.85rem' }}
                  {...register('ubicacion', { maxLength: { value: 60, message: 'Máximo 60 caracteres' } })}
                  isInvalid={!!errors.ubicacion}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                  {errors.ubicacion?.message}
                </Form.Control.Feedback>
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  placeholder="Para qué equipo sirve, equivalencias…"
                  style={{ fontSize: '0.85rem' }}
                  {...register('observaciones', {
                    maxLength: { value: 300, message: 'Máximo 300 caracteres' },
                  })}
                  isInvalid={!!errors.observaciones}
                />
                <Form.Control.Feedback type="invalid" style={{ fontSize: '0.78rem' }}>
                  {errors.observaciones?.message}
                </Form.Control.Feedback>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer
            className="bg-light border-0 py-2 px-4"
            style={{ borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={cerrarModal}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={guardandoAlta}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{
                backgroundColor: r.colorGuardar,
                borderColor: r.colorGuardar,
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              <i className="bi bi-check-lg"></i>
              <span>{guardandoAlta ? 'Guardando…' : 'Guardar'}</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
