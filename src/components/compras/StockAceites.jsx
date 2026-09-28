import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { exportarPlanilla } from '../../helpers/excel'
import { Raya, BotonAccion, BotonLimpiar, BotonVolver, FiltroSelect } from './estilos'
import ModalMovimientoAceite from './ModalMovimientoAceite'
import { useMovimientosAceite } from './useMovimientosAceite'
import { A, litros, nombreAceite, hoy, fechaCorta } from './aceites'

/**
 * Movimientos de aceites (28/09/2026).
 *
 * Copia de Mantenimiento › Consumo de aceites del Sistema de Gestión Lepa, con
 * la misma tabla: primero una fila de stock por cada aceite —con el saldo en
 * la columna Stock y el botón "Ver detalle de compra"— y después los consumos.
 * Las compras están en su propia pantalla (StockAceitesCompras.jsx), igual que
 * allá.
 *
 * Lo único que cambia es a dónde va el consumo: la máquina, la obra y la razón
 * social de allá acá son el grupo y el centro de costo, que es como se imputa
 * todo en el Tablero.
 */
const COLUMNAS = 7

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

  // Los filtros del original: tipo de aceite y a dónde fue (acá, grupo y C.C.).
  const [fAceite, setFAceite] = useState('')
  const [fGrupo, setFGrupo] = useState('')
  const [fCC, setFCC] = useState('')

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

  const movs = useMovimientosAceite({ recargar: cargar })

  // Los consumos, del más nuevo al más viejo (el back ya los manda así).
  const consumos = movimientos.filter((m) => m.movimiento === 'Salida')

  // Las opciones salen de todos los consumos, no de lo ya filtrado.
  const unicos = (valores) => [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const opcionesAceite = unicos(consumos.map((m) => nombreAceite(m.aceite)))
  const opcionesGrupo = unicos(consumos.map((m) => m.grupo))
  const opcionesCC = unicos(consumos.filter((m) => !fGrupo || m.grupo === fGrupo).map((m) => m.cc))

  // Los filtros son de los consumos: las filas de stock están siempre, como
  // en el original.
  const consumosFiltrados = consumos.filter((m) => {
    if (fAceite && nombreAceite(m.aceite) !== fAceite) return false
    if (fGrupo && m.grupo !== fGrupo) return false
    if (fCC && m.cc !== fCC) return false
    return true
  })

  const hayFiltros = !!(fAceite || fGrupo || fCC)
  const limpiar = () => {
    setFAceite('')
    setFGrupo('')
    setFCC('')
  }

  // El "Ver" del original: el consumo entero en un cartel.
  const verConsumo = (m) =>
    Swal.fire({
      title: 'Detalle del consumo',
      html: `<div style="text-align:left;font-size:0.9rem">
          <p><b>Fecha:</b> ${fechaCorta(m.fecha)}</p>
          <p><b>Aceite:</b> ${nombreAceite(m.aceite)}</p>
          <p><b>Litros:</b> ${litros(m.litros)}</p>
          <p><b>Grupo:</b> ${m.grupo || '—'}</p>
          <p><b>C.C.:</b> ${m.cc || '—'}</p>
          <p><b>Observaciones:</b> ${m.observaciones || '—'}</p>
        </div>`,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: A.color,
    })

  const exportar = () => {
    const columnas = [
      { titulo: 'Fecha', ancho: 12, valor: (m) => fechaCorta(m.fecha) },
      { titulo: 'Tipo de aceite', ancho: 36, valor: (m) => nombreAceite(m.aceite) },
      { titulo: 'Litros', ancho: 10, valor: (m) => m.litros },
      { titulo: 'Grupo', ancho: 18, valor: (m) => m.grupo },
      { titulo: 'C.C.', ancho: 14, valor: (m) => m.cc },
      { titulo: 'Stock', ancho: 10, valor: () => '' },
    ]
    exportarPlanilla({
      titulo: 'Movimientos de aceites',
      hoja: 'Aceites',
      columnas,
      filas: [
        ...aceites.map((a) => ['', `Stock ${nombreAceite(a)}`, '', '', '', a.existencia]),
        ...consumosFiltrados.map((m) => columnas.map((c) => c.valor(m) ?? '')),
      ],
      archivo: `aceites_movimientos_${hoy()}.xlsx`,
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
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <BotonVolver />
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
              disabled={aceites.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ fontSize: '0.82rem', backgroundColor: '#15803d', borderColor: '#15803d' }}
              title="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
            </Button>
            <Button
              size="sm"
              onClick={() => movs.abrir('Entrada')}
              disabled={sinEditar || aceites.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ fontSize: '0.82rem', fontWeight: 600, backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' }}
              title={sinEditar ? 'Sin permiso para editar' : 'Registrar una compra de aceite'}
            >
              <i className="bi bi-cart-plus"></i>
              <span>Compra de aceite</span>
            </Button>
            <Button
              size="sm"
              onClick={() => movs.abrir('Salida')}
              disabled={sinEditar || aceites.length === 0}
              className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm"
              style={{ fontSize: '0.82rem', fontWeight: 600, backgroundColor: '#9d2235', borderColor: '#9d2235' }}
              title={sinEditar ? 'Sin permiso para editar' : 'Registrar un consumo de aceite'}
            >
              <i className="bi bi-droplet-half"></i>
              <span>Consumo de aceite</span>
            </Button>
          </div>
        </div>

        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <FiltroSelect
              etiqueta="Tipo de aceite"
              ancho="280px"
              valor={fAceite}
              vacio="Todos"
              onChange={setFAceite}
              opciones={opcionesAceite}
            />
            <FiltroSelect
              etiqueta="Grupo"
              ancho="200px"
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
              ancho="150px"
              valor={fCC}
              vacio="Todos"
              onChange={setFCC}
              opciones={opcionesCC}
            />
            {hayFiltros && <BotonLimpiar onClick={limpiar} />}
          </div>
        </Card>

        {/* La tabla va del ancho del encabezado y de los filtros. Si la
            pantalla es angosta, el scroll queda adentro del marco. */}
        <div
          className="shadow-sm rounded-3 bg-white"
          style={{
            flex: '0 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid #cbd5e1',
          }}
        >
          <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '820px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Tipo de aceite</th>
                <th style={thCentro}>Litros</th>
                <th style={th}>Grupo</th>
                <th style={thCentro}>C.C.</th>
                <th style={thCentro}>Stock</th>
                <th style={{ ...thCentro, width: '150px' }}></th>
              </tr>
            </thead>
            <tbody>
              {aceites.length === 0 && consumosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando ? 'Cargando…' : 'No hay movimientos registrados'}
                  </td>
                </tr>
              ) : (
                <>
                  {/* Primero, el stock de cada aceite. */}
                  {aceites.map((a) => (
                    <tr key={a._id}>
                      <td style={tdCentro}>
                        <Raya />
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: '#15803d' }}>Stock {nombreAceite(a)}</td>
                      <td style={tdCentro}>
                        <Raya />
                      </td>
                      <td style={td}>
                        <Raya />
                      </td>
                      <td style={tdCentro}>
                        <Raya />
                      </td>
                      <td style={{ ...tdNumero, fontWeight: 700, color: a.existencia ? '#1e293b' : '#dc2626' }}>
                        {litros(a.existencia)}
                      </td>
                      <td style={tdCentro}>
                        <button
                          type="button"
                          onClick={() => navigate(`/compras/analista/aceites/compras?aceite=${a._id}`)}
                          className="btn btn-sm rounded-3 py-0 px-2"
                          style={{
                            fontSize: '0.68rem',
                            color: '#1d4ed8',
                            border: '1px solid #1d4ed8',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Ver detalle de compra
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Después, los consumos. */}
                  {consumosFiltrados.map((m) => (
                    <tr key={m._id}>
                      <td style={tdNumero}>{fechaCorta(m.fecha)}</td>
                      <td style={td}>{nombreAceite(m.aceite)}</td>
                      <td style={tdNumero}>{litros(m.litros)}</td>
                      <td style={td}>{m.grupo || <Raya />}</td>
                      <td style={tdCentro}>{m.cc || <Raya />}</td>
                      <td style={tdCentro}>
                        <Raya />
                      </td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center gap-2">
                          <BotonAccion icono="bi-eye" titulo="Ver" onClick={() => verConsumo(m)} />
                          <BotonAccion
                            icono="bi-pencil"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Editar'}
                            variante="primary"
                            deshabilitado={sinEditar}
                            onClick={() => movs.editar(m)}
                          />
                          <BotonAccion
                            icono="bi-trash"
                            titulo={sinEditar ? 'Sin permiso para editar' : 'Borrar'}
                            variante="danger"
                            deshabilitado={sinEditar}
                            onClick={() => movs.borrar(m)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </Table>
        </div>
      </Container>

      <ModalMovimientoAceite
        mov={movs.mov}
        datos={movs.movDatos}
        aceites={aceites}
        guardando={movs.guardando}
        onCampo={movs.setCampo}
        onGuardar={movs.guardar}
        onCerrar={movs.cerrar}
      />
    </div>
  )
}
