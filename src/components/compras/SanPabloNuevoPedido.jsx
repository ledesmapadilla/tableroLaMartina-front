import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button, Form, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { BORDO, BORDO_SUAVE, campo, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion } from './estilos'
import SelectBuscador from '../shared/SelectBuscador'

const URGENCIAS     = ['Baja', 'Media', 'Alta', 'Crítica']
const GRUPOS_SIN_CC = ['Herreria', 'Gomeria', 'Stock', 'Otros']
// C.C. que no son un centro del padrón: "Sin CC" (el ítem no es de ninguna
// máquina), "Varios" (es para más de una) y "Taller" (es para el taller).
const CC_ESPECIALES = ['Sin CC', 'Varios', 'Taller']
// Los que no dependen del grupo: sobreviven a un cambio de grupo.
const CC_DE_CUALQUIER_GRUPO = ['Varios', 'Taller']

// Fecha de hoy en la hora local. toISOString da la de UTC, que desde las 21 hs
// de Argentina ya es mañana: dejaría la fecha por defecto en el futuro.
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}




const getNombreUsuario = () => {
  try {
    const token = localStorage.getItem('token')
    if (!token) return ''
    return JSON.parse(atob(token.split('.')[1])).nombre || ''
  } catch { return '' }
}

const ITEM_INIT = { nombre_repuesto: '', cant: '', unidad: '', descripcion: '', urgencia: 'Media', grupo: '', cc: '', estado: 'Para analisis' }

export default function SanPabloNuevoPedido() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(hoyLocal())
  const [itemForm, setItemForm] = useState(ITEM_INIT)
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [centrosCosto, setCentrosCosto] = useState([])
  const [ccSearch, setCcSearch] = useState('')
  const [showCcDrop, setShowCcDrop] = useState(false)

  useEffect(() => {
    api.get('/centros-costo').then(setCentrosCosto).catch(() => {})
  }, [])

  const ccLabel = (cc) => {
    if (!cc || CC_ESPECIALES.includes(cc)) return cc || ''
    const c = centrosCosto.find(x => x.cc === cc)
    return cc + (c?.marca ? ` — ${c.marca}` : '')
  }

  // "Taller" no tiene centros en el padrón pero es un grupo más.
  const todosGrupos = [...new Set([...centrosCosto.map(c => c.grupo), ...GRUPOS_SIN_CC, 'Taller'])].sort()

  const handleGrupoChange = (grupo) => {
    if (GRUPOS_SIN_CC.includes(grupo)) {
      setItemForm(prev => ({ ...prev, grupo, cc: 'Sin CC' }))
      setCcSearch('Sin CC')
    } else {
      const ccSigueValido =
        CC_DE_CUALQUIER_GRUPO.includes(itemForm.cc) ||
        centrosCosto.find(c => c.cc === itemForm.cc && c.grupo === grupo)
      // El grupo Taller trae su C.C. puesto; se puede cambiar.
      const ccNuevo = grupo === 'Taller' ? 'Taller' : ''
      setItemForm(prev => ({ ...prev, grupo, cc: ccSigueValido ? prev.cc : ccNuevo }))
      if (!ccSigueValido) setCcSearch(ccNuevo)
    }
  }

  const seleccionarCc = (val) => {
    const centro = centrosCosto.find(c => c.cc === val)
    setItemForm(prev => ({
      ...prev,
      cc: val,
      // El C.C. Taller sin grupo elegido lleva al grupo Taller.
      grupo: val === 'Taller'
        ? (prev.grupo || 'Taller')
        : CC_ESPECIALES.includes(val) ? prev.grupo : (centro ? centro.grupo : prev.grupo),
    }))
    setCcSearch(ccLabel(val))
    setShowCcDrop(false)
  }

  const ccsFiltrados = (() => {
    const sinCcGrupo = GRUPOS_SIN_CC.includes(itemForm.grupo)
    if (sinCcGrupo) return []
    let base = itemForm.grupo
      ? centrosCosto.filter(c => c.grupo === itemForm.grupo)
      : centrosCosto
    // "Varios" y "Taller" van siempre; "Sin CC" solo mientras no haya grupo
    // elegido.
    const siempre = [
      { _id: 'varios', cc: 'Varios', marca: 'más de un C.C.' },
      { _id: 'taller', cc: 'Taller', marca: '' },
    ]
    const opciones = itemForm.grupo
      ? [...siempre, ...base]
      : [{ _id: 'sincc', cc: 'Sin CC', marca: '' }, ...siempre, ...base]
    if (!ccSearch) return opciones
    const q = ccSearch.toLowerCase()
    return opciones.filter(c =>
      c.cc.toLowerCase().includes(q) ||
      (c.marca && c.marca.toLowerCase().includes(q))
    )
  })()

  const agregarFila = (e) => {
    e.preventDefault()
    // El desplegable de grupo no es un <select>: el required del navegador no
    // lo cubre, así que el obligatorio se controla acá.
    if (!itemForm.grupo) {
      Swal.fire({ icon: 'warning', title: 'Falta el grupo', text: 'Elegí el grupo del ítem.' })
      return
    }
    if (editingId) {
      setItems(items.map(i => i._tmpId === editingId ? { ...itemForm, _tmpId: editingId } : i))
      setEditingId(null)
    } else {
      setItems([...items, { ...itemForm, _tmpId: Date.now() }])
    }
    setItemForm(ITEM_INIT)
    setCcSearch('')
  }

  const editarFila = (item) => {
    const { _tmpId, ...rest } = item
    setItemForm(rest)
    setCcSearch(ccLabel(item.cc))
    setEditingId(_tmpId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicion = () => { setItemForm(ITEM_INIT); setEditingId(null); setCcSearch('') }

  const quitarFila = (tmpId) => {
    setItems(items.filter(i => i._tmpId !== tmpId))
    if (editingId === tmpId) cancelarEdicion()
  }

  const guardar = async () => {
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin ítems', text: 'Agregá al menos un ítem antes de guardar.' })
      return
    }
    // El calendario no deja elegir fechas futuras, pero escrita a mano sí entra.
    if (!fecha || fecha > hoyLocal()) {
      Swal.fire({ icon: 'warning', title: 'Fecha inválida', text: 'La fecha del pedido no puede ser posterior a hoy.' })
      return
    }
    try {
      const solicita = getNombreUsuario()
      // _tmpId es de la pantalla —identifica la fila mientras se arma el
      // pedido— y no viaja al backend. La cantidad va solo si se cargó.
      const itemsLimpios = items.map((item) => {
        const { cant } = item
        const rest = { ...item }
        delete rest._tmpId
        delete rest.cant
        return {
          ...rest,
          ...(cant !== '' && cant != null ? { cant: Number(cant) } : {}),
          ...(solicita ? { solicita } : {}),
        }
      })
      await api.post('/sanpablo/pedidos', { fecha, items: itemsLimpios })
      Swal.fire({ icon: 'success', title: 'Pedido guardado', timer: 1500, showConfirmButton: false })
      navigate('/compras/sanpablo/pedidos')
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const badgeUrgencia = (u) => {
    const color = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
    return <span style={{ fontWeight: 600, color: color[u] || '#6c757d' }}>{u}</span>
  }

  // El encabezado de la tarjeta cambia de color al editar: es la única señal
  // de que el formulario ya no está agregando, sino modificando una fila.
  const colorTarjeta = editingId ? '#3730a3' : BORDO

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
      {/* El ancho de la página lo fija el Container: encabezado, formulario y
          tabla comparten el mismo borde izquierdo y derecho. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1120px', width: '100%', margin: '0 auto', overflowY: 'auto' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap flex-shrink-0">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Nuevo pedido
          </span>
          {items.length > 0 && (
            <span
              className="px-2 py-1 rounded-3"
              style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
            >
              {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
            </span>
          )}
        </div>

        {/* Carga de un ítem */}
        {/* Sin overflow-hidden: recortaba los desplegables de C.C. y grupo en
            el borde de la tarjeta. Las esquinas del encabezado se redondean
            a mano. */}
        <Card className="mb-3 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div
            className="d-flex justify-content-between align-items-center px-3 py-2"
            style={{ backgroundColor: colorTarjeta, color: '#fff', borderRadius: '0.5rem 0.5rem 0 0' }}
          >
            <span className="fw-semibold d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
              <i className={`bi ${editingId ? 'bi-pencil-square' : 'bi-plus-circle-fill'}`}></i>
              <span>{editingId ? 'Editando ítem' : 'Agregar ítem'}</span>
            </span>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold" style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                Fecha
              </span>
              <Form.Control
                type="date"
                size="sm"
                value={fecha}
                max={hoyLocal()}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-3"
                style={{ width: '150px', fontSize: '0.82rem', height: '32px' }}
              />
            </div>
          </div>

          <Card.Body className="p-3">
            <Form onSubmit={agregarFila}>
              <Row className="g-3">
                {/* Todas las casillas en una fila y la descripción abajo. */}
                <Col md={4}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Nombre repuesto <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    className="rounded-3"
                    style={campo}
                    value={itemForm.nombre_repuesto}
                    onChange={(e) => setItemForm({ ...itemForm, nombre_repuesto: e.target.value })}
                    required
                  />
                </Col>

                <Col md={1}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Cant. <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    className="rounded-3"
                    style={campo}
                    value={itemForm.cant}
                    onChange={(e) => setItemForm({ ...itemForm, cant: e.target.value })}
                    onKeyDown={(e) => ['e', 'E', '+', '-', '.'].includes(e.key) && e.preventDefault()}
                    required
                  />
                </Col>

                <Col md={1}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Un. <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    className="rounded-3"
                    style={campo}
                    placeholder="un/kg"
                    value={itemForm.unidad}
                    onChange={(e) => setItemForm({ ...itemForm, unidad: e.target.value })}
                    required
                  />
                </Col>

                {/* Primero el grupo y después el C.C.: el grupo acota los C.C.
                    que se ofrecen y en Taller o los grupos sin C.C. lo completa. */}
                <Col md={2}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Grupo <span className="text-danger">*</span>
                  </Form.Label>
                  {/* Mismo desplegable con buscador que Producción, con el
                      bordó de Compras: el select nativo centraba el texto y
                      abría la lista del navegador, distinta a la del C.C. */}
                  <SelectBuscador
                    opciones={todosGrupos.map((g) => ({ valor: g, texto: g }))}
                    valor={itemForm.grupo}
                    onChange={handleGrupoChange}
                    placeholder="Elegir grupo…"
                    className="rounded-3"
                    style={campo}
                    colores={{ marcada: BORDO_SUAVE, elegida: BORDO }}
                  />
                </Col>

                {/* El C.C. se busca escribiendo: son muchos y se los conoce por
                    el número o por la marca. */}
                <Col md={2} style={{ position: 'relative' }}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    C.C. <span className="text-danger">*</span>
                  </Form.Label>
                  {GRUPOS_SIN_CC.includes(itemForm.grupo) ? (
                    <Form.Control
                      className="rounded-3"
                      style={{ ...campo, backgroundColor: '#f1f5f9', cursor: 'default' }}
                      value="Sin CC"
                      readOnly
                    />
                  ) : (
                    <Form.Control
                      className="rounded-3"
                      style={campo}
                      placeholder={itemForm.cc ? ccLabel(itemForm.cc) : 'Buscar…'}
                      value={ccSearch}
                      onChange={(e) => {
                        setCcSearch(e.target.value)
                        setShowCcDrop(true)
                      }}
                      onFocus={() => {
                        setCcSearch('')
                        setShowCcDrop(true)
                      }}
                      onBlur={() => setTimeout(() => setShowCcDrop(false), 150)}
                      required={!itemForm.cc}
                      autoComplete="off"
                    />
                  )}

                  {showCcDrop && ccsFiltrados.length > 0 && (
                    <div
                      className="shadow-lg"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '12px',
                        zIndex: 100,
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        maxHeight: 240,
                        overflowY: 'auto',
                        minWidth: 280,
                      }}
                    >
                      {ccsFiltrados.map((c) => (
                        <div
                          key={c._id}
                          onMouseDown={() => seleccionarCc(c.cc)}
                          style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = BORDO_SUAVE
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <strong style={{ color: BORDO }}>{c.cc}</strong>
                          {c.marca ? ` — ${c.marca}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </Col>

                <Col md={2}>
                  <Form.Label className="fw-semibold text-dark small mb-1">
                    Urgencia <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    className="rounded-3"
                    style={campo}
                    value={itemForm.urgencia}
                    onChange={(e) => setItemForm({ ...itemForm, urgencia: e.target.value })}
                  >
                    {URGENCIAS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Form.Select>
                </Col>

                <Col md={12}>
                  <Form.Label className="fw-semibold text-dark small mb-1">Descripción</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    className="rounded-3"
                    style={campo}
                    value={itemForm.descripcion}
                    onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })}
                  />
                </Col>
              </Row>

              <div className="d-flex gap-2 mt-3">
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
                  style={{ backgroundColor: colorTarjeta, borderColor: colorTarjeta, fontSize: '0.84rem', fontWeight: 600 }}
                >
                  <i className={`bi ${editingId ? 'bi-check-lg' : 'bi-plus-lg'}`}></i>
                  <span>{editingId ? 'Actualizar ítem' : 'Agregar ítem'}</span>
                </Button>

                {editingId && (
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={cancelarEdicion}
                    className="rounded-3 px-3 py-1"
                    style={{ fontSize: '0.84rem' }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>

        {/* Los ítems que ya se cargaron. Todavía no se guardó nada: esto vive
            en memoria hasta que se aprieta Guardar pedido. */}
        {items.length > 0 && (
          <div
            className="shadow-sm rounded-3 bg-white mb-3 flex-shrink-0"
            style={{ maxWidth: '100%', overflowX: 'auto', border: '1px solid #cbd5e1' }}
          >
            <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={th}>Repuesto</th>
                  <th style={thCentro}>Cant.</th>
                  <th style={thCentro}>Un.</th>
                  <th style={th}>Descripción</th>
                  <th style={thCentro}>Urgencia</th>
                  <th style={th}>Grupo</th>
                  <th style={thCentro}>C.C.</th>
                  <th style={thCentro}>Estado</th>
                  <th style={thCentro}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._tmpId} className={editingId === item._tmpId ? 'fila-editando' : ''}>
                    <td style={{ ...td, fontWeight: 500 }}>{item.nombre_repuesto}</td>
                    <td style={tdCentro}>{item.cant}</td>
                    <td style={tdCentro}>{item.unidad}</td>
                    <td style={td}>{item.descripcion || <Raya />}</td>
                    <td style={tdCentro}>{badgeUrgencia(item.urgencia)}</td>
                    <td style={td}>{item.grupo}</td>
                    <td style={tdCentro}>{item.cc}</td>
                    <td style={tdCentro}>
                      <span className="badge" style={{ backgroundColor: '#3730a3', fontSize: '0.62rem' }}>
                        Para analisis
                      </span>
                    </td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                        <BotonAccion
                          icono="bi-pencil"
                          titulo="Editar este ítem"
                          variante="primary"
                          onClick={() => editarFila(item)}
                        />
                        <BotonAccion
                          icono="bi-trash"
                          titulo="Quitar del pedido"
                          variante="danger"
                          onClick={() => quitarFila(item._tmpId)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* Acciones del pedido */}
        <div className="d-flex justify-content-end gap-2 mb-4 flex-shrink-0">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-3 px-3 py-1"
            style={{ fontSize: '0.84rem' }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={guardar}
            disabled={items.length === 0}
            className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
          >
            <i className="bi bi-check-lg"></i>
            <span>
              Guardar pedido
              {items.length > 0 ? ` (${items.length} ítem${items.length !== 1 ? 's' : ''})` : ''}
            </span>
          </Button>
        </div>
      </Container>
    </div>
  )
}
