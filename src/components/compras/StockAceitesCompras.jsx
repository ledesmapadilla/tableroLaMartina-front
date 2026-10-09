import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Container, Card, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { exportarPlanilla } from '../../helpers/excel'
import { Raya, BotonAccion, BotonVolver, Buscador } from './estilos'
import ModalMovimientoAceite from './ModalMovimientoAceite'
import { useMovimientosAceite } from './useMovimientosAceite'
import { A, litros, pesos, nombreAceite, normalizar, hoy, fechaCorta } from './aceites'

/**
 * Compras de aceite (28/09/2026).
 *
 * Copia de la pantalla de compras del Sistema de Gestión Lepa, a la que se
 * llega con "Ver detalle de compra" desde la fila de stock de un aceite: abre
 * con las compras de ese aceite, y "Ver todos" muestra las de todos. Las
 * compras se corrigen y se borran desde acá; se cargan desde Movimientos de
 * aceites.
 */
const COLUMNAS = 9

export default function StockAceitesCompras() {
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

  // El aceite del que se vino a ver las compras, si se vino de uno.
  const [params] = useSearchParams()
  const [aceiteId, setAceiteId] = useState(params.get('aceite') || '')
  const [busqueda, setBusqueda] = useState('')

  // Con .then y no con async/await: así el compilador de React ve que el
  // estado se toca en la respuesta y no adentro del efecto que la pide.
  const cargar = () =>
    Promise.all([api.get(A.API), api.get(`${A.API}/movimientos`)])
      .then(([listaAceites, listaMovs]) => {
        setAceites(Array.isArray(listaAceites) ? listaAceites : [])
        setMovimientos(Array.isArray(listaMovs) ? listaMovs : [])
      })
      .catch((error) =>
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudieron traer las compras' })
      )
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const movs = useMovimientosAceite({ recargar: cargar })

  const elegido = aceites.find((a) => a._id === aceiteId)
  const busq = normalizar(busqueda.trim())
  const compras = movimientos.filter((m) => {
    if (m.movimiento !== 'Entrada') return false
    if (aceiteId && m.aceite?._id !== aceiteId) return false
    if (!busq) return true
    return [nombreAceite(m.aceite), m.proveedor].some((v) => normalizar(v).includes(busq))
  })

  const verTodos = () => {
    setAceiteId('')
    setBusqueda('')
  }

  const exportar = () => {
    const columnas = [
      { titulo: 'Fecha', ancho: 12, valor: (m) => fechaCorta(m.fecha) },
      { titulo: 'Proveedor', ancho: 28, valor: (m) => m.proveedor },
      { titulo: 'Tipo de aceite', ancho: 36, valor: (m) => nombreAceite(m.aceite) },
      { titulo: 'Marca', ancho: 16, valor: (m) => m.marca },
      { titulo: 'Cantidad (L)', ancho: 12, valor: (m) => m.litros },
      { titulo: 'Precio ($)', ancho: 14, moneda: true, valor: (m) => m.precio ?? '' },
      { titulo: '$/L', ancho: 12, moneda: true, valor: (m) => (m.precio && m.litros ? Math.round(m.precio / m.litros) : '') },
      { titulo: 'Observaciones', ancho: 36, valor: (m) => m.observaciones },
    ]
    exportarPlanilla({
      titulo: elegido ? `Compras de aceite — ${nombreAceite(elegido)}` : 'Compras de aceite',
      hoja: 'Compras',
      columnas,
      filas: compras.map((m) => columnas.map((c) => c.valor(m) ?? '')),
      archivo: `aceites_compras_${hoy()}.xlsx`,
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
            <i className="bi bi-cart-plus"></i>
          </div>
          <span className="fw-bold" style={{ color: A.color, fontSize: '1.05rem' }}>
            Compras de aceite
          </span>
          {elegido && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: '0.76rem', backgroundColor: A.colorSuave, color: A.color, fontWeight: 600 }}
            >
              {nombreAceite(elegido)}
            </span>
          )}

          <Button
            size="sm"
            onClick={exportar}
            disabled={compras.length === 0}
            className="d-inline-flex align-items-center gap-1 rounded-3 px-3 py-1 shadow-sm ms-auto"
            style={{ fontSize: '0.82rem', backgroundColor: '#15803d', borderColor: '#15803d' }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>
        </div>

        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <div className="d-flex flex-column" style={{ width: '340px', maxWidth: '100%' }}>
              <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
                Buscar
              </span>
              <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Tipo de aceite o proveedor…" />
            </div>
            {(aceiteId || busqueda) && (
              <Button
                size="sm"
                variant="outline-warning"
                onClick={verTodos}
                className="rounded-3 px-3"
                style={{ fontSize: '0.82rem', height: '32px' }}
              >
                Ver todos
              </Button>
            )}
          </div>
        </Card>

        {/* Del ancho del encabezado y del buscador. Si la pantalla es angosta,
            el scroll queda adentro del marco. */}
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
          <Table className="mb-0 tabla-informe" style={{ width: '100%', minWidth: '1000px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>Fecha</th>
                <th style={th}>Proveedor</th>
                <th style={th}>Tipo de aceite</th>
                <th style={th}>Marca</th>
                <th style={thCentro}>Cantidad (L)</th>
                <th style={thCentro}>Precio ($)</th>
                <th style={thCentro}>$/L</th>
                <th style={th}>Observaciones</th>
                <th style={{ ...thCentro, width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {compras.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNAS} className="text-center text-muted py-4" style={td}>
                    {cargando ? 'Cargando…' : 'No hay compras registradas'}
                  </td>
                </tr>
              ) : (
                compras.map((m) => (
                  <tr key={m._id}>
                    <td style={tdNumero}>{fechaCorta(m.fecha)}</td>
                    <td style={td}>{m.proveedor || <Raya />}</td>
                    <td style={td}>{nombreAceite(m.aceite)}</td>
                    <td style={td}>{m.marca || <Raya />}</td>
                    <td style={tdNumero}>{litros(m.litros)}</td>
                    <td style={tdNumero}>{m.precio != null ? pesos(m.precio) : <Raya />}</td>
                    <td style={tdNumero}>{m.precio && m.litros ? pesos(Math.round(m.precio / m.litros)) : <Raya />}</td>
                    <td style={td}>{m.observaciones || <Raya />}</td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center gap-2">
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
                ))
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
