import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { exportarPlanilla } from '../../helpers/excel'
import { usePermisos } from '../../context/permisos'
import { Raya, BotonAccion, BotonLimpiar, FiltroSelect, Buscador } from './estilos'
import { RUBROS, CATALOGO } from './rubrosStock'
import MovimientosStock from './MovimientosStock'
import ModalMovimiento from './ModalMovimiento'
import { useMovimientos } from './useMovimientos'

/**
 * El catálogo general del almacén (22/09/2026).
 *
 * Todo lo que existe junto, de los seis rubros, para buscar un repuesto sin
 * saber de antemano en qué tarjeta lo cargaron.
 *
 * Las entradas y salidas se cargan **desde acá también**: encontrar el repuesto
 * y moverlo es la misma tarea, y mandar a la otra pantalla para eso era dar una
 * vuelta al pedo. Cada fila sabe de qué rubro salió, así que el movimiento va a
 * la URL que corresponde. Dar de alta, editar o prestar una herramienta sí se
 * siguen haciendo en el rubro: tocando el código se va para allá con ese
 * artículo ya buscado.
 *
 * No lleva la columna de a cargo: es de Herramientas nada más y acá está todo
 * mezclado.
 *
 * La lista viene armada del back (`/stock/catalogo`), con el rubro pegado a
 * cada fila y el nombre siempre en `descripcion`, aunque el rubro lo guarde
 * como `tipo`.
 */
const API = '/stock/catalogo'

const th = {
  backgroundColor: CATALOGO.color,
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

// Para buscar: sin acentos y sin distinguir mayúsculas, así "hidraulico"
// encuentra "Filtro hidráulico".
const normalizar = (t) =>
  (t ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Cómo se llama cada rubro en la columna. Sale del mismo lugar que su color, y
// el nombre corto es el de la tarjeta en el stock.
const NOMBRES = {
  repuestos: 'Repuestos',
  filtros: 'Filtros',
  cubiertas: 'Cubiertas y correas',
  ferreteria: 'Ferretería',
  electricidad: 'Electricidad',
  herramientas: 'Herramientas',
}

export default function StockCatalogo() {
  const navigate = useNavigate()

  // Ver sin editar: los botones quedan a la vista pero deshabilitados, igual
  // que en la pantalla de cada rubro.
  const { puede } = usePermisos()
  const sinEditar = !puede('compras.stock', 'editar')

  const [articulos, setArticulos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [rubro, setRubro] = useState('')

  const cargar = () =>
    api
      .get(API)
      .then((data) => setArticulos(Array.isArray(data) ? data : []))
      .catch((error) => {
        setArticulos([])
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo traer el catálogo' })
      })
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  // Acá los artículos vienen de los seis rubros mezclados, así que cada uno
  // manda su movimiento a la URL del suyo.
  const movimientos = useMovimientos({
    apiDe: (a) => `/stock/${a.rubro}`,
    recargar: cargar,
  })

  const hayFiltros = busqueda !== '' || rubro !== ''
  const limpiar = () => {
    setBusqueda('')
    setRubro('')
  }

  // Se busca por todas las columnas: el punto del catálogo es encontrar algo
  // sabiendo cualquier dato suelto, un pedazo del nombre o un código de fábrica.
  const lista = articulos.filter((a) => {
    // El desplegable trabaja con el nombre visible: FiltroSelect ofrece
    // textos sueltos, no pares de valor y texto.
    if (rubro && NOMBRES[a.rubro] !== rubro) return false
    const q = normalizar(busqueda).trim()
    if (!q) return true
    return [a.codigo, a.descripcion, a.marca, a.codigoFabrica, a.ubicacion, a.observaciones].some(
      (v) => normalizar(v).includes(q)
    )
  })

  // Ir al rubro con ese artículo ya buscado: el código viaja en la URL y la
  // pantalla del rubro lo levanta.
  const irAlRubro = (a) =>
    navigate(`/compras/analista/stock/${a.rubro}?buscar=${encodeURIComponent(a.codigo)}`)

  const exportar = () =>
    exportarPlanilla({
      titulo: 'Almacén de repuestos — Catálogo general',
      hoja: CATALOGO.hoja,
      columnas: [
        { titulo: 'Rubro', ancho: 20 },
        { titulo: 'Código', ancho: 12 },
        { titulo: 'Descripción', ancho: 34 },
        { titulo: 'Marca', ancho: 18 },
        { titulo: 'Código de fábrica', ancho: 20 },
        { titulo: 'Existencia', ancho: 12 },
        { titulo: 'Ubicación', ancho: 18 },
        { titulo: 'Observaciones', ancho: 40 },
      ],
      filas: lista.map((a) => [
        NOMBRES[a.rubro] || a.rubro,
        a.codigo,
        a.descripcion,
        a.marca || '—',
        a.codigoFabrica || '—',
        a.existencia ?? 0,
        a.ubicacion || '—',
        a.observaciones || '—',
      ]),
      archivo: `${CATALOGO.archivo}_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
        .tabla-catalogo tbody tr:nth-of-type(even) > td { background-color: ${CATALOGO.cebra}; }
        .tabla-catalogo tbody tr:hover > td { background-color: ${CATALOGO.hover}; }
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
              backgroundColor: CATALOGO.acento,
              color: '#fff',
              fontSize: '1.05rem',
              boxShadow: `0 2px 8px ${CATALOGO.acento}55`,
            }}
          >
            <i className={CATALOGO.icono}></i>
          </div>
          <div className="d-flex flex-column">
            <span
              className="fw-bold"
              style={{ color: CATALOGO.color, fontSize: '1.05rem', lineHeight: 1.2 }}
            >
              {CATALOGO.titulo}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{CATALOGO.subtitulo}</span>
          </div>
          <span
            className="px-2 py-1 rounded-3"
            style={{
              fontSize: '0.76rem',
              backgroundColor: CATALOGO.colorSuave,
              color: CATALOGO.color,
              fontWeight: 600,
            }}
          >
            {lista.length} {lista.length === 1 ? 'artículo' : 'artículos'}
          </span>

          <div className="d-flex align-items-center gap-2 ms-auto">
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
          </div>
        </div>

        {/* Los filtros: el rubro y un buscador que mira todas las columnas. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <FiltroSelect
              etiqueta="Rubro"
              ancho="200px"
              valor={rubro}
              vacio="Todos"
              onChange={setRubro}
              opciones={Object.keys(RUBROS).map((clave) => NOMBRES[clave])}
            />
            <div className="d-flex flex-column" style={{ width: '360px' }}>
              <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
                Buscar
              </span>
              <Buscador
                valor={busqueda}
                onChange={setBusqueda}
                placeholder="Código, descripción, marca, ubicación…"
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
          <Table className="mb-0 tabla-informe tabla-catalogo" style={{ width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ ...th, width: '150px' }}>Rubro</th>
                <th style={{ ...thCentro, width: '85px' }}>
                  Código
                  <div style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.75 }}>interno</div>
                </th>
                <th style={{ ...th, width: '210px' }}>Descripción</th>
                <th style={{ ...th, width: '120px' }}>Marca</th>
                <th style={{ ...thCentro, width: '115px' }}>Código de fábrica</th>
                <th style={{ ...thCentro, width: '75px' }}>Existencia</th>
                <th style={{ ...th, width: '115px' }}>Ubicación</th>
                <th style={th}>Observaciones</th>
                <th style={{ ...thCentro, width: '180px' }}>
                  Movimientos
                  <div style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.75 }}>
                    entradas y salidas
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4" style={td}>
                    {cargando
                      ? 'Cargando…'
                      : hayFiltros
                        ? 'Ningún artículo coincide con la búsqueda'
                        : 'El almacén está vacío'}
                  </td>
                </tr>
              ) : (
                lista.map((a) => (
                  <tr key={`${a.rubro}-${a._id}`}>
                    {/* De qué tarjeta salió, con su color: es lo que ubica de
                        un vistazo adónde hay que ir a tocarlo. */}
                    <td style={td}>
                      <span
                        className="px-2 py-1 rounded-3"
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 600,
                          backgroundColor: RUBROS[a.rubro]?.colorSuave || '#f1f5f9',
                          color: RUBROS[a.rubro]?.color || '#334155',
                        }}
                      >
                        {NOMBRES[a.rubro] || a.rubro}
                      </span>
                    </td>
                    {/* El código lleva a su rubro con el artículo ya buscado:
                        el catálogo encuentra, el rubro es donde se toca. */}
                    <td style={tdCentro}>
                      <button
                        type="button"
                        onClick={() => irAlRubro(a)}
                        className="btn btn-link p-0 border-0 align-baseline text-decoration-none"
                        title={`Abrirlo en ${NOMBRES[a.rubro] || a.rubro}`}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: RUBROS[a.rubro]?.color || CATALOGO.color,
                        }}
                      >
                        {a.codigo}
                      </button>
                    </td>
                    <td style={td}>{a.descripcion}</td>
                    <td style={td}>{a.marca || <Raya />}</td>
                    <td style={tdCentro}>{a.codigoFabrica || <Raya />}</td>
                    {/* Se toca para ver de dónde salió: las entradas y las
                        salidas que lo dejaron en ese número. */}
                    <td style={tdCentro}>
                      <button
                        type="button"
                        onClick={() => movimientos.abrirHistorial(a)}
                        className="btn btn-link p-0 border-0 align-baseline text-decoration-none"
                        title="Ver las entradas y salidas"
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: (a.existencia ?? 0) === 0 ? '#dc2626' : '#1e293b',
                        }}
                      >
                        {a.existencia ?? 0}
                      </button>
                    </td>
                    <td style={td}>{a.ubicacion || <Raya />}</td>
                    <td style={td}>{a.observaciones || <Raya />}</td>
                    {/* Mover el saldo se hace desde acá: el artículo ya se
                        encontró y mandarlo a la otra pantalla para eso era dar
                        una vuelta al pedo. */}
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center gap-1">
                        <button
                          type="button"
                          onClick={() => movimientos.abrir(a, 'Entrada')}
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
                          onClick={() => movimientos.abrir(a, 'Salida')}
                          disabled={sinEditar || (a.existencia ?? 0) === 0}
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 rounded-2 py-0 px-2"
                          style={{ fontSize: '0.68rem', fontWeight: 600 }}
                          title={
                            sinEditar
                              ? 'Sin permiso para editar'
                              : (a.existencia ?? 0) === 0
                                ? 'No hay existencia para sacar'
                                : 'Registrar una salida'
                          }
                        >
                          <i className="bi bi-box-arrow-up"></i>
                          <span>Sale</span>
                        </button>
                        <BotonAccion
                          icono="bi-clock-history"
                          titulo="Ver, corregir o borrar los movimientos"
                          variante="secondary"
                          onClick={() => movimientos.abrirHistorial(a)}
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

      {/* Las entradas y salidas ya cargadas, con su corregir y su borrar. */}
      <MovimientosStock
        abierto={!!movimientos.historial}
        articulo={movimientos.historial?.articulo}
        movimientos={movimientos.historial?.movimientos}
        cargando={movimientos.historial?.cargando}
        color={CATALOGO.color}
        acento={CATALOGO.acento}
        sinEditar={sinEditar}
        onEditar={movimientos.editar}
        onBorrar={movimientos.borrar}
        onCerrar={movimientos.cerrarHistorial}
      />

      {/* Cargar una entrada o una salida: el mismo formulario que en el rubro. */}
      <ModalMovimiento
        mov={movimientos.mov}
        datos={movimientos.movDatos}
        guardando={movimientos.guardando}
        color={CATALOGO.color}
        colorSuave={CATALOGO.colorSuave}
        onCampo={movimientos.setCampo}
        onGrupo={movimientos.elegirGrupo}
        onGuardar={movimientos.guardar}
        onCerrar={movimientos.cerrar}
      />
    </div>
  )
}
