import { useEffect, useMemo, useState } from 'react'
import { Container, Table, Button } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro } from './formato'
import {
  CATALOGO,
  SECCIONES_PERMISOS,
  ROLES_CONFIGURABLES,
  nombreRol,
  resolverPermisos,
} from '../../utils/permisosCatalogo'

/** La casilla de Ver o Editar: una cruz cuando el rol puede. */
const Cruz = ({ activa, onClick, titulo }) => (
  <button
    type="button"
    onClick={onClick}
    title={titulo}
    className="btn p-0 d-inline-flex align-items-center justify-content-center rounded-2"
    style={{
      width: '24px',
      height: '24px',
      border: `1px solid ${activa ? BORDO : '#cbd5e1'}`,
      backgroundColor: activa ? BORDO_SUAVE : '#fff',
      color: BORDO,
      fontWeight: 800,
      fontSize: '0.85rem',
      lineHeight: 1,
    }}
  >
    {activa ? '✕' : ''}
  </button>
)

/**
 * Qué ve y qué edita cada rol. Solo el superadmin entra.
 *
 * Una tabla por rol con todas las pantallas del proyecto (la lista está en
 * utils/permisosCatalogo.js) y dos columnas, Ver y Editar. Tocar una casilla
 * pone o saca la cruz; los cambios se guardan juntos con el botón. Editar
 * implica ver: marcar Editar marca Ver y sacar Ver saca Editar.
 */
export default function Roles() {
  const [rol, setRol] = useState('solicitante')
  // Lo guardado en la base, por rol.
  const [guardadosPorRol, setGuardadosPorRol] = useState({})
  // Los permisos del rol elegido mientras se editan; null si no se tocó nada.
  const [edicion, setEdicion] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    Promise.all([api.get('/roles'), api.get('/usuarios').catch(() => [])])
      .then(([roles, us]) => {
        if (!vigente) return
        setGuardadosPorRol(Object.fromEntries((roles || []).map((r) => [r.rol, r.permisos || {}])))
        setUsuarios(Array.isArray(us) ? us : [])
      })
      .catch((err) => {
        if (vigente) Swal.fire({ icon: 'error', title: 'No se pudieron cargar los roles', text: err.message })
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  const actuales = useMemo(() => resolverPermisos(rol, guardadosPorRol[rol]), [rol, guardadosPorRol])
  const permisos = edicion ?? actuales
  const hayCambios = edicion !== null && JSON.stringify(edicion) !== JSON.stringify(actuales)
  const nombresDe = (r) => usuarios.filter((u) => u.rol === r).map((u) => u.nombre)

  const elegirRol = async (r) => {
    if (r === rol) return
    if (hayCambios) {
      const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: 'Hay cambios sin guardar',
        text: `Si cambiás de rol se pierden los cambios de ${nombreRol(rol)}.`,
        showCancelButton: true,
        confirmButtonText: 'Descartar y cambiar',
        cancelButtonText: 'Seguir editando',
        confirmButtonColor: BORDO,
      })
      if (!isConfirmed) return
    }
    setEdicion(null)
    setRol(r)
  }

  const alternar = (clave, accion) =>
    setEdicion((prev) => {
      const base = prev ?? actuales
      const { ver, editar } = base[clave]
      const nuevo =
        accion === 'ver'
          ? ver
            ? { ver: false, editar: false }
            : { ver: true, editar }
          : editar
            ? { ver, editar: false }
            : { ver: true, editar: true }
      return { ...base, [clave]: nuevo }
    })

  const guardar = async () => {
    setGuardando(true)
    try {
      const r = await api.put(`/roles/${rol}`, { permisos })
      setGuardadosPorRol((g) => ({ ...g, [rol]: r?.permisos || permisos }))
      setEdicion(null)
      Swal.fire({
        icon: 'success',
        title: 'Permisos guardados',
        text: `Valen para ${nombreRol(rol)} en cuanto vuelva a la pestaña o recargue la página.`,
        timer: 2200,
        showConfirmButton: false,
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudieron guardar', text: err.message })
    } finally {
      setGuardando(false)
    }
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
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '860px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Roles y permisos
          </span>
          <span className="text-muted" style={{ fontSize: '0.78rem' }}>
            Una cruz en Ver deja entrar a la pantalla; en Editar, además, cargar, cambiar y borrar.
          </span>
        </div>

        {/* Los roles, con quién tiene cada uno. */}
        <div className="d-flex flex-wrap gap-2 mb-3 flex-shrink-0">
          {ROLES_CONFIGURABLES.map((r) => {
            const elegido = r === rol
            const nombres = nombresDe(r)
            return (
              <button
                key={r}
                type="button"
                onClick={() => elegirRol(r)}
                className="btn btn-sm rounded-3 text-start px-3 py-1"
                style={{
                  backgroundColor: elegido ? BORDO : '#fff',
                  color: elegido ? '#fff' : '#334155',
                  border: `1px solid ${elegido ? BORDO : '#cbd5e1'}`,
                  minWidth: '150px',
                }}
              >
                <div className="fw-bold" style={{ fontSize: '0.84rem' }}>
                  {nombreRol(r)}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                  {nombres.length ? nombres.join(', ') : 'Sin usuarios'}
                </div>
              </button>
            )
          })}
          <div
            className="rounded-3 px-3 py-1 d-flex flex-column justify-content-center"
            style={{ border: '1px dashed #cbd5e1', color: '#64748b', minWidth: '150px' }}
            title="El superadministrador puede todo y no se configura"
          >
            <div className="fw-bold" style={{ fontSize: '0.84rem' }}>
              {nombreRol('superadmin')}
            </div>
            <div style={{ fontSize: '0.7rem' }}>Puede todo</div>
          </div>
        </div>

        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '420px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={th}>Pantalla</th>
                <th style={{ ...thCentro, width: '90px' }}>Ver</th>
                <th style={{ ...thCentro, width: '90px' }}>Editar</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4" style={td}>
                    Cargando…
                  </td>
                </tr>
              ) : (
                SECCIONES_PERMISOS.flatMap((seccion) => [
                  <tr key={`s-${seccion}`}>
                    <td
                      colSpan={3}
                      style={{ ...td, fontWeight: 700, color: BORDO, backgroundColor: BORDO_SUAVE, padding: '3px 6px' }}
                    >
                      {seccion}
                    </td>
                  </tr>,
                  ...CATALOGO.filter((p) => p.seccion === seccion).map((p) => {
                    const { ver, editar } = permisos[p.clave]
                    return (
                      <tr key={p.clave}>
                        <td style={{ ...td, paddingLeft: '14px' }}>{p.label}</td>
                        <td style={tdCentro}>
                          <Cruz
                            activa={ver}
                            onClick={() => alternar(p.clave, 'ver')}
                            titulo={ver ? 'Puede ver (tocar para sacar)' : 'No puede ver (tocar para dar)'}
                          />
                        </td>
                        <td style={tdCentro}>
                          <Cruz
                            activa={editar}
                            onClick={() => alternar(p.clave, 'editar')}
                            titulo={editar ? 'Puede editar (tocar para sacar)' : 'No puede editar (tocar para dar)'}
                          />
                        </td>
                      </tr>
                    )
                  }),
                ])
              )}
            </tbody>
          </Table>
        </div>

        <div className="d-flex align-items-center justify-content-end gap-2 mt-3 flex-shrink-0">
          {hayCambios && (
            <span className="me-auto" style={{ fontSize: '0.8rem', color: '#b45309' }}>
              <i className="bi bi-exclamation-circle me-1"></i>Hay cambios sin guardar
            </span>
          )}
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setEdicion(null)}
            disabled={!hayCambios || guardando}
            className="rounded-3 px-3 py-1"
            style={{ fontSize: '0.84rem' }}
          >
            Descartar
          </Button>
          <Button
            size="sm"
            onClick={guardar}
            disabled={!hayCambios || guardando}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
          >
            <i className="bi bi-check-lg"></i>
            <span>{guardando ? 'Guardando…' : 'Guardar cambios'}</span>
          </Button>
        </div>
      </Container>
    </div>
  )
}
