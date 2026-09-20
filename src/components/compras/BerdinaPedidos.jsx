import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { verDetallePedido, verHistorialPedido, conCreacion } from './detallePedido'
import { exportarPlanilla } from '../../helpers/excel'
import { api } from '../../services/api'
import { usePermisos } from '../../context/permisos'
import { useAuth } from '../../context/AuthContext'
import { sePuedeApurar, sePuedeApurarFila, apuroDeLaFila, itemsDeLaFila, cuando } from './apuro'
import { subirArchivo, borrarArchivo } from '../../services/archivos'
import { GRUPOS_PEDIDO } from '../../utils/equipos'
import { BORDO, BORDO_SUAVE, th, thCentro, td, tdCentro, COLOR_NRO_MULTIPLE, COLOR_NRO_SIMPLE } from './formato'
import { avisarSinOC, idsARetirar } from './avisos'
import {
  Raya,
  BotonAccion,
  BotonLimpiar,
  FiltroTexto,
  FiltroSelect,
  OjoPedido,
  CeldaOP,
} from './estilos'
import { useProveedorDeOP } from './proveedorOP'

const fmtNro = (n) => `B-${String(n).padStart(3, '0')}`

const URGENCIAS = ['Baja', 'Media', 'Alta', 'Crítica']
const ESTADOS   = ['Para analisis', 'Para hacer OP', 'Autorizar', 'Para retirar', 'Rechazado']

// Un ítem se edita solo mientras el paso siguiente no lo procesó: cuando el
// analista lo toma, lo cargado queda como está.
const sinProcesar = (item) => item.estado === 'Para analisis' || item.estado === 'Pedido'
// Los grupos salen del catálogo de equipos (utils/equipos.js).
const GRUPOS = GRUPOS_PEDIDO

const ITEM_INIT = { nombre_repuesto: '', cant: '', unidad: '', descripcion: '', urgencia: 'Media', grupo: 'Tractores', cc: '', estado: 'Pendiente' }

export default function BerdinaPedidos() {
  const navigate = useNavigate()
  // El taller carga y corrige sus pedidos: sin "Editar" en Pedidos
  // (tabla de Roles) los botones quedan a la vista pero apagados.
  const { puede } = usePermisos()
  const { user } = useAuth()
  const sinEditar = !puede('compras.pedidos', 'editar')
  const [pedidos, setPedidos] = useState([])
  const [form, setForm] = useState(ITEM_INIT)
  const [editPedidoId, setEditPedidoId] = useState(null)
  const [editItemId, setEditItemId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  // Pedidos múltiples abiertos con el ojo: sus ítems se muestran debajo, en
  // la misma tabla.
  const [abiertos, setAbiertos] = useState(() => new Set())
  // A qué proveedor se le compró cada ítem, para mostrarlo al lado de la OP.
  const proveedorDeOP = useProveedorDeOP()
  const FILTROS_INIT = { nro: '', fecha: '', cc: '', repuesto: '', urgencia: '', grupo: '', solicita: '', estado: '' }
  const [filtros, setFiltros] = useState(FILTROS_INIT)
  const setF = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
  const limpiar = () => setFiltros(FILTROS_INIT)
  const hayFiltros = Object.values(filtros).some(v => v !== '')

  const cargar = () => api.get('/berdina/pedidos').then(setPedidos).catch(() => {})
  useEffect(() => { cargar() }, [])

  const items = pedidos.flatMap(p =>
    (p.items || []).map(item => ({ ...item, nro_pedido: p.nro_pedido, fecha: p.fecha, pedidoId: p._id }))
  )

  const lista = items.filter(item => {
    if (filtros.nro && !fmtNro(item.nro_pedido).includes(filtros.nro.toUpperCase())) return false
    if (filtros.fecha && item.fecha?.slice(0, 10) !== filtros.fecha) return false
    if (filtros.cc && !item.cc?.toLowerCase().includes(filtros.cc.toLowerCase())) return false
    if (filtros.repuesto && !item.nombre_repuesto?.toLowerCase().includes(filtros.repuesto.toLowerCase())) return false
    if (filtros.urgencia && item.urgencia !== filtros.urgencia) return false
    if (filtros.grupo && item.grupo !== filtros.grupo) return false
    if (filtros.solicita && !item.solicita?.toLowerCase().includes(filtros.solicita.toLowerCase())) return false
    if (filtros.estado) { const ne = (item.estado === 'Pedido' || item.estado === 'En analisis' || item.estado === 'Para revision') ? 'Para analisis' : item.estado; if (ne !== filtros.estado) return false }
    return true
  })

  const uniq = (arr) => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ''))]
  const colapsar = (vals) => vals.length === 0 ? '' : vals.length === 1 ? vals[0] : 'Varios'

  const listaAgrupada = Object.values(
    lista.reduce((acc, item) => {
      const k = item.nro_pedido
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    }, {})
  ).map(items => ({
    _agrupado: true,
    _count: items.length,
    _items: items,
    _key: items[0].nro_pedido,
    nro_pedido: items[0].nro_pedido,
    fecha: items[0].fecha,
    cc:              colapsar(uniq(items.map(i => i.cc))),
    nombre_repuesto: colapsar(uniq(items.map(i => i.nombre_repuesto))),
    cant:            colapsar(uniq(items.map(i => i.cant?.toString()))),
    unidad:          colapsar(uniq(items.map(i => i.unidad))),
    descripcion:     colapsar(uniq(items.map(i => i.descripcion))),
    urgencia:        colapsar(uniq(items.map(i => i.urgencia))),
    grupo:           colapsar(uniq(items.map(i => i.grupo))),
    solicita:        colapsar(uniq(items.map(i => i.solicita))),
    estado:          colapsar(uniq(items.map(i => i.estado))),
    oc:              colapsar(uniq(items.map(i => i.oc))),
  }))

  // Siempre por pedido: los múltiples se abren con el ojo.
  const listaAMostrar = listaAgrupada
    .slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const alternarAbierto = (clave) =>
    setAbiertos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(clave)) siguiente.delete(clave)
      else siguiente.add(clave)
      return siguiente
    })

  // Las filas de la tabla: cada pedido y, debajo de los abiertos, sus ítems
  // marcados como anidados. Se dibujan con la misma fila que un ítem suelto.
  const filasAMostrar = listaAMostrar.flatMap((f) =>
    f._agrupado && f._count > 1 && abiertos.has(f._key)
      ? [f, ...f._items.map((i) => ({ ...i, _anidada: true }))]
      : [f]
  )

  const abrirEditar = (item) => {
    setForm({
      nombre_repuesto: item.nombre_repuesto,
      cant: item.cant || '',
      unidad: item.unidad || '',
      descripcion: item.descripcion || '',
      urgencia: item.urgencia,
      grupo: item.grupo,
      cc: item.cc || '',
      estado: item.estado,
    })
    setEditPedidoId(item.pedidoId)
    setEditItemId(item._id)
    setShowModal(true)
  }

  const cerrar = () => { setForm(ITEM_INIT); setEditPedidoId(null); setEditItemId(null); setShowModal(false) }

  const guardar = async (e) => {
    e.preventDefault()
    try {
      // El estado no viaja: lo mueve el circuito del pedido, no esta pantalla.
      // La cantidad va solo si se cargó, y como número.
      const { cant } = form
      const rest = { ...form }
      delete rest.cant
      delete rest.estado
      const payload = { ...rest, usuario: 'Berdina', ...(cant !== '' && cant != null ? { cant: Number(cant) } : {}) }
      await api.put(`/berdina/pedidos/${editPedidoId}/items/${editItemId}`, payload)
      cargar()
      cerrar()
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  // --- Adjuntos ---
  // El archivo se sube a Cloudinary y en el ítem queda su URL, así se ve desde
  // cualquier computadora (services/archivos.js). El taller adjunta lo que
  // acompaña al pedido: un remito, la foto de la pieza, un presupuesto suyo.
  const [subiendo, setSubiendo] = useState(null)

  const adjuntar = async (item, file) => {
    setSubiendo(item._id)
    try {
      const archivo = await subirArchivo(file)
      await api.put(`/berdina/pedidos/${item.pedidoId}/items/${item._id}`, { archivo })
      cargar()
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo adjuntar', text: err.message })
    } finally {
      setSubiendo(null)
    }
  }

  const quitarArchivo = async (item) => {
    try {
      // Primero se lo saca del ítem: si después falla el borrado en Cloudinary,
      // queda un archivo suelto y no un link roto en pantalla.
      await api.put(`/berdina/pedidos/${item.pedidoId}/items/${item._id}`, { archivo: null })
      cargar()
      await borrarArchivo(item.archivo || {})
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo quitar el archivo', text: err.message })
    }
  }

  const celdaAdjunto = (item) => {
    if (!item) return <Raya />
    if (item.archivo?.url) {
      return (
        <div className="d-flex align-items-center justify-content-center gap-1">
          <a
            href={item.archivo.url}
            target="_blank"
            rel="noreferrer"
            title={item.archivo.nombre || 'Ver el adjunto'}
            className="text-truncate"
            style={{ maxWidth: 70, fontSize: '0.7rem' }}
          >
            <i className="bi bi-paperclip" /> {item.archivo.nombre || 'Ver'}
          </a>
          {!sinEditar && (
            <button
              className="btn btn-sm btn-link text-danger p-0"
              style={{ lineHeight: 1 }}
              title="Quitar el archivo"
              onClick={() => quitarArchivo(item)}
            >
              <i className="bi bi-x-lg" style={{ fontSize: '0.7rem' }} />
            </button>
          )}
        </div>
      )
    }
    const estaSubiendo = subiendo === item._id
    return (
      <label
        className={`btn btn-sm btn-outline-dark mb-0 py-0 px-2${sinEditar || estaSubiendo ? ' disabled' : ''}`}
        style={{ fontSize: '0.7rem' }}
        title={sinEditar ? 'Sin permiso para editar' : 'Adjuntar un PDF o una foto'}
      >
        {estaSubiendo ? 'Subiendo…' : <><i className="bi bi-upload" /> Subir</>}
        <input
          type="file"
          accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx"
          hidden
          disabled={sinEditar || estaSubiendo}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) adjuntar(item, file); e.target.value = '' }}
        />
      </label>
    )
  }

  const borrar = async (item) => {
    const result = await Swal.fire({
      title: '¿Borrar ítem?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4a0812',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/berdina/pedidos/${item.pedidoId}/items/${item._id}`)
      cargar()
      Swal.fire({ icon: 'success', title: 'Borrado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  // Exporta con exceljs, la unica libreria de Excel del proyecto. El formato
  // (titulo, fecha, encabezado verde y bordes) lo pone el helper compartido.
  const exportarExcel = async () => {
    await exportarPlanilla({
      titulo: "Pedidos Berdina — La Martina",
      columnas: [
      { titulo: "N° Pedido", ancho: 12 },
      { titulo: "Fecha", ancho: 12 },
      { titulo: "C.C.", ancho: 10 },
      { titulo: "Repuesto", ancho: 26 },
      { titulo: "Cant.", ancho: 8 },
      { titulo: "Un.", ancho: 8 },
      { titulo: "Descripción", ancho: 34 },
      { titulo: "Urgencia", ancho: 12 },
      { titulo: "Grupo", ancho: 16 },
      { titulo: "Solicita", ancho: 18 },
      { titulo: "Estado", ancho: 14 },
      { titulo: "O.P.", ancho: 12 },
    ],
      filas: lista.map((item) => [
      fmtNro(item.nro_pedido),
      item.fecha?.slice(0, 10).split("-").reverse().join("/"),
      item.cc || "",
      item.nombre_repuesto,
      item.cant ?? "",
      item.unidad || "",
      item.descripcion || "",
      item.urgencia,
      item.grupo,
      item.solicita || "",
      item.estado === "Pedido" ? "Para analisis" : item.estado || "",
      item.oc || "",
    ]),
      hoja: "Pedidos",
      archivo: `Pedidos_Berdina_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  }


  // --- Apurar ---
  // La campana le reclama al que tiene la tarea pendiente. Se guarda en el
  // ítem y el back la borra sola cuando el pedido cambia de estado
  // (compras/apuro.js).
  const apurar = async (fila) => {
    // Solo los items que esperan a otro: en un pedido con estados mezclados
    // no tiene sentido apurar los que ya se resolvieron.
    const items = itemsDeLaFila(fila).filter((i) => sePuedeApurar(i.estado, puede, user?.rol))
    if (items.length === 0) return
    try {
      await Promise.all(
        items.map((item) =>
          api.put(`${'/berdina/pedidos'}/${item.pedidoId}/items/${item._id}`, {
            apuro: { fecha: new Date().toISOString(), por: user?.nombre || 'Alguien' },
          })
        )
      )
      cargar()
      // Sin confirmación previa: se toca la campana y queda apurado. El aviso
      // va centrado, como el resto de los de Compras.
      Swal.fire({ icon: 'success', title: 'Pedido apurado', timer: 1500, showConfirmButton: false })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const celdaApuro = (fila) => {
    const apuro = apuroDeLaFila(fila)
    if (apuro) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            Swal.fire({
              icon: 'info',
              title: 'Pedido apurado',
              text: `${apuro.por || 'Alguien'} lo apuró el ${cuando(apuro.fecha)}.`,
            })
          }}
          className="btn btn-link p-0 d-inline-flex align-items-center"
          style={{ color: '#ff0000' }}
          title={`Apurado por ${apuro.por || 'alguien'} el ${cuando(apuro.fecha)}`}
        >
          <i className="bi bi-bell-fill" style={{ fontSize: '0.9rem' }}></i>
        </button>
      )
    }
    if (!sePuedeApurarFila(fila, puede, user?.rol)) return <Raya />
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); apurar(fila) }}
        className="btn btn-link p-0 d-inline-flex align-items-center"
        style={{ color: '#94a3b8' }}
        title="Apurar: avisarle al que lo tiene pendiente"
      >
        <i className="bi bi-bell" style={{ fontSize: '0.9rem' }}></i>
      </button>
    )
  }

  const verDetalle = (item) =>
    verDetallePedido({ titulo: `Pedido ${fmtNro(item.nro_pedido)}`, items: item._items || [item] })

  const verMotivoRetirado = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
      const retirado = [...hist].reverse().find(h => h.estado === 'Retirado')
      const fecha = retirado?.fecha ? new Date(retirado.fecha).toLocaleString('es-AR', { dateStyle: 'short' }) : '—'
      Swal.fire({
        icon: 'success',
        title: 'Retirado',
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Repuesto:</strong> ${item.nombre_repuesto}</div>
          <div style="margin-top:6px"><strong>Retirado por:</strong> ${retirado?.usuario || '—'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          ${retirado?.nota ? `<div style="margin-top:10px;padding:10px;background:#f0fff4;border-left:3px solid #198754;border-radius:2px"><strong>Observaciones:</strong> ${retirado.nota}</div>` : '<div style="margin-top:6px;color:#888">Sin observaciones</div>'}
        </div>`,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const verMotivoRevision = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
      const revision = [...hist].reverse().find(h => h.estado === 'Para revision')
      const fecha = revision?.fecha ? new Date(revision.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
      Swal.fire({
        icon: 'warning',
        title: 'Enviado a revisión',
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Repuesto:</strong> ${item.nombre_repuesto}</div>
          <div style="margin-top:6px"><strong>Enviado por:</strong> ${revision?.usuario || '—'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          ${revision?.nota ? `<div style="margin-top:10px;padding:10px;background:#fffbf0;border-left:3px solid #ffc107;border-radius:2px"><strong>Motivo:</strong> ${revision.nota}</div>` : '<div style="margin-top:6px;color:#888">Sin motivo registrado</div>'}
        </div>`,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const verMotivoRechazo = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
      const rechazo = [...hist].reverse().find(h => h.estado === 'Rechazado' || h.estado === 'Cancelado')
      const fecha = rechazo?.fecha ? new Date(rechazo.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
      Swal.fire({
        icon: 'error',
        title: 'Pedido rechazado',
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Repuesto:</strong> ${item.nombre_repuesto}</div>
          <div style="margin-top:6px"><strong>Rechazado por:</strong> ${rechazo?.usuario || '—'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          ${rechazo?.nota ? `<div style="margin-top:10px;padding:10px;background:#fff5f5;border-left:3px solid #dc3545;border-radius:2px"><strong>Motivo:</strong> ${rechazo.nota}</div>` : '<div style="margin-top:6px;color:#888">Sin motivo registrado</div>'}
        </div>`,
        confirmButtonText: 'Cerrar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-secondary' },
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const verHistorial = async (item) => {
    try {
      const hist = await api.get(`/berdina/pedidos/${item.pedidoId}/items/${item._id}/historial`)
      verHistorialPedido({
        titulo: `Historial · ${item.nombre_repuesto}`,
        secciones: [{ historial: conCreacion(hist, item) }],
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message })
    }
  }

  const varios = () => <span className="text-muted fst-italic" style={{ fontSize: 12 }}>Varios</span>

  const badgeUrgencia = (u) => {
    if (u === 'Varios') return varios()
    const color = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
    return <span style={{ fontWeight: 600, color: color[u] || '#6c757d' }}>{u}</span>
  }

  const badgeEstado = (e) => {
    if (e === 'Varios') return varios()
    if (e === 'Para revision') return <span className="badge bg-warning">Para revision</span>
    const norm = e === 'Pedido' || e === 'En analisis' ? 'Para analisis' : e
    // Se lee como botón: lleva al análisis que hizo el analista.
    if (norm === 'Autorizar') {
      return (
        <span className="badge" style={{ backgroundColor: '#8b2035' }} title="Ver el análisis del analista">
          <i className="bi bi-clipboard-data me-1"></i>Autorizar Gcia.
        </span>
      )
    }
    if (e === 'Retirado') return <span className="badge" style={{ backgroundColor: '#6f42c1' }}>Retirado</span>
    const color = { 'Para analisis': 'primary', 'Para hacer OP': 'info', Pendiente: 'secondary', 'En proceso': 'warning', 'Para retirar': 'success', Completado: 'success', Cancelado: 'danger', Rechazado: 'danger' }
    return <span className={`badge bg-${color[norm] || 'secondary'}`}>{norm}</span>
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
      {/* La urgencia crítica pinta la fila. Va en un bloque propio porque
          .tabla-informe pinta el fondo sobre los td y un style en el tr no le
          gana. */}
      <style>{`
        .tabla-informe.tabla-pedidos tbody tr.fila-critica > td { background-color: #fee2e2; }
        .tabla-informe.tabla-pedidos tbody tr.fila-critica:hover > td { background-color: #fca5a5; }
      `}</style>

      {/* El ancho de la página lo fija el Container: encabezado, filtros y
          tabla comparten el mismo borde izquierdo y derecho. */}
      <Container
        fluid
        className="px-3 py-2 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1120px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-bold" style={{ color: BORDO, fontSize: '1.05rem' }}>
            Pedidos
          </span>
          <span
            className="px-2 py-1 rounded-3"
            style={{ fontSize: '0.76rem', backgroundColor: BORDO_SUAVE, color: BORDO, fontWeight: 600 }}
          >
            {listaAMostrar.length} pedidos
          </span>

          {/* Sube acá para que los ocho filtros tengan la fila entera. */}

          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={listaAMostrar.length === 0}
            className="rounded-3 px-3 d-flex align-items-center gap-2 ms-auto"
            style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
            title="Exportar a Excel"
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel</span>
          </Button>

          <Button
            size="sm"
            disabled={sinEditar}
            title={sinEditar ? 'Sin permiso para editar' : 'Cargar un pedido nuevo'}
            onClick={() => navigate('/compras/berdina/pedidos/nuevo')}
            className="rounded-3 px-3 d-flex align-items-center gap-2"
            style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.78rem', height: '30px', fontWeight: 600 }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nuevo pedido</span>
          </Button>
        </div>

        {/* Filtros: los ocho en una sola fila, con el rótulo arriba del campo. */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-nowrap" style={{ overflowX: 'auto' }}>
            <FiltroTexto etiqueta="N°" ancho="72px" valor={filtros.nro} onChange={(v) => setF('nro', v)} placeholder="N°" />
            <FiltroTexto etiqueta="Fecha" ancho="132px" tipo="date" valor={filtros.fecha} onChange={(v) => setF('fecha', v)} />
            <FiltroTexto etiqueta="C.C." ancho="84px" valor={filtros.cc} onChange={(v) => setF('cc', v)} placeholder="C.C." />
            <FiltroTexto etiqueta="Repuesto" ancho="150px" valor={filtros.repuesto} onChange={(v) => setF('repuesto', v)} placeholder="Repuesto…" />
            <FiltroSelect etiqueta="Urgencia" ancho="104px" valor={filtros.urgencia} vacio="Todas" onChange={(v) => setF('urgencia', v)} opciones={URGENCIAS} />
            <FiltroSelect etiqueta="Grupo" ancho="128px" valor={filtros.grupo} vacio="Todos" onChange={(v) => setF('grupo', v)} opciones={GRUPOS} />
            <FiltroTexto etiqueta="Solicita" ancho="120px" valor={filtros.solicita} onChange={(v) => setF('solicita', v)} placeholder="Solicitante…" />
            <FiltroSelect etiqueta="Estado" ancho="128px" valor={filtros.estado} vacio="Todos" onChange={(v) => setF('estado', v)} opciones={ESTADOS} />

            {hayFiltros && <BotonLimpiar onClick={limpiar} />}
          </div>
        </Card>

        {/* Tabla de pedidos */}
        {/* La tabla ocupa el ancho de la página, el mismo que el encabezado. */}
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
          <Table className="mb-0 tabla-informe tabla-compras tabla-pedidos" style={{ width: '100%', minWidth: '1060px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thCentro}>N° Pedido</th>
                <th style={thCentro}>Fecha</th>
                <th style={thCentro}>C.C.</th>
                <th style={th}>Repuesto</th>
                <th style={thCentro}>Cant.</th>
                <th style={thCentro}>Un.</th>
                <th style={thCentro}>Descripción</th>
                <th style={thCentro}>Urgencia</th>
                <th style={th}>Grupo</th>
                <th style={th}>Solicita</th>
                <th style={thCentro}>Estado</th>
                <th style={thCentro}>O.P. · Proveedor</th>
                <th style={thCentro}>Adjunto</th>
                <th style={thCentro}>Apuro</th>
                <th style={thCentro}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listaAMostrar.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center text-muted py-4" style={td}>
                    {hayFiltros ? 'Ningún pedido coincide con los filtros' : 'No hay pedidos cargados'}
                  </td>
                </tr>
              ) : (
                filasAMostrar.map((item) => {
                  const multiple = item._agrupado && item._count > 1
                  // El ítem que representa la fila cuando es uno solo: un
                  // pedido de un ítem o un ítem abierto con el ojo.
                  const unItem = item._anidada ? item : item._count === 1 ? item._items[0] : null
                  const clickeable =
                    item.estado === 'Autorizar' ||
                    item.estado === 'Rechazado' ||
                    item.estado === 'Cancelado' ||
                    item.estado === 'Para revision' ||
                    item.estado === 'Para retirar' ||
                    item.estado === 'Retirado'
                  return (
                    <tr
                      key={item._agrupado ? item._key : `${item._anidada ? 'sub-' : ''}${item._id}`}
                      className={`${item.urgencia === 'Crítica' ? 'fila-critica' : ''}${item._anidada ? ' fila-anidada' : ' inicio-pedido'}`}
                    >
                      {/* El pedido múltiple y sus ítems abiertos comparten la
                          línea bordó de la izquierda: se leen como un bloque. */}
                      <td
                        style={{
                          ...tdCentro,
                          fontWeight: multiple ? 700 : 400,
                          whiteSpace: 'nowrap',
                          borderLeft:
                            (item._agrupado && item._count > 1) || item._anidada ? `3px solid ${BORDO}` : undefined,
                        }}
                      >
                        {/* El número abre el detalle del pedido: qué se pidió,
                            para qué equipo y con qué descripción. */}
                        {item._anidada ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); verDetalle(item) }}
                            className="btn btn-link p-0 align-baseline"
                            style={{
                              fontSize: 'inherit',
                              fontWeight: 700,
                              color: '#94a3b8',
                              textDecoration: 'underline',
                            }}
                            title="Ver el detalle del pedido"
                          >
                            ↳ {fmtNro(item.nro_pedido)}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); verDetalle(item) }}
                            className="btn btn-link p-0 align-baseline"
                            style={{
                              fontSize: 'inherit',
                              fontWeight: 700,
                              color: item._count > 1 ? COLOR_NRO_MULTIPLE : COLOR_NRO_SIMPLE,
                              textDecoration: 'underline',
                            }}
                            title="Ver el detalle del pedido"
                          >
                            {fmtNro(item.nro_pedido)}
                          </button>
                        )}
                        {item._agrupado && item._count > 1 && (
                          <OjoPedido abierto={abiertos.has(item._key)} onClick={() => alternarAbierto(item._key)} />
                        )}
                      </td>
                      <td style={tdCentro}>{item.fecha?.slice(0, 10).split('-').reverse().join('/')}</td>
                      <td style={tdCentro}>{item.cc === 'Varios' ? varios() : item.cc || <Raya />}</td>
                      <td style={td}>{item.nombre_repuesto === 'Varios' ? varios() : item.nombre_repuesto}</td>
                      <td style={tdCentro}>{item.cant === 'Varios' ? varios() : item.cant ?? <Raya />}</td>
                      <td style={tdCentro}>{item.unidad === 'Varios' ? varios() : item.unidad || <Raya />}</td>
                      <td style={tdCentro}>
                        {item.descripcion === 'Varios' ? (
                          varios()
                        ) : item.descripcion ? (
                          <div className="d-flex justify-content-center">
                            <BotonAccion
                              icono="bi-eye"
                              titulo="Ver la descripción"
                              onClick={() =>
                                Swal.fire({ title: 'Descripción', text: item.descripcion, confirmButtonText: 'Cerrar' })
                              }
                            />
                          </div>
                        ) : (
                          <Raya />
                        )}
                      </td>
                      <td style={tdCentro}>{badgeUrgencia(item.urgencia)}</td>
                      <td style={td}>{item.grupo === 'Varios' ? varios() : item.grupo}</td>
                      <td style={td}>{item.solicita === 'Varios' ? varios() : item.solicita || <Raya />}</td>
                      <td
                        style={{ ...tdCentro, cursor: clickeable ? 'pointer' : undefined }}
                        onClick={() => {
                          if (item.estado === 'Autorizar') {
                            // Lo que cargó el analista: proveedores, precios y
                            // presupuestos, sin poder editarlo.
                            navigate('/compras/pedidos/analisis', {
                              state: { item: { ...(item._agrupado ? item._items[0] : item), _src: 'berdina' } },
                            })
                          } else if (item.estado === 'Rechazado' || item.estado === 'Cancelado') {
                            verMotivoRechazo(item._agrupado ? item._items[0] : item)
                          } else if (item.estado === 'Para revision') {
                            verMotivoRevision(item._agrupado ? item._items[0] : item)
                          } else if (item.estado === 'Para retirar' && item.oc && item.oc !== 'Varios') {
                            navigate(`/compras/op/${encodeURIComponent(item.oc)}`, { state: { retirar: idsARetirar(item) } })
                          } else if (item.estado === 'Para retirar') {
                            avisarSinOC(item)
                          } else if (item.estado === 'Retirado') {
                            verMotivoRetirado(item._agrupado ? item._items[0] : item)
                          }
                        }}
                      >
                        {badgeEstado(item.estado)}
                      </td>
                      <td style={tdCentro}><CeldaOP oc={item.oc} proveedor={proveedorDeOP(item)} /></td>
                      <td style={tdCentro}>{celdaAdjunto(unItem)}</td>
                      <td style={tdCentro} onClick={(e) => e.stopPropagation()}>{celdaApuro(item)}</td>
                      <td style={tdCentro}>
                        <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                          <BotonAccion
                            icono="bi-clock-history"
                            titulo="Historial"
                            onClick={() => verHistorial(item._agrupado ? item._items[0] : item)}
                            deshabilitado={item._agrupado && item._count > 1}
                          />
                          {/* Una fila que es un solo ítem se edita y se borra;
                              un pedido múltiple, abriéndolo con el ojo. */}
                          {unItem && (
                            <BotonAccion
                              icono="bi-pencil"
                              titulo={sinEditar ? 'Sin permiso para editar' : 'Editar'}
                              variante="primary"
                              onClick={() => abrirEditar(unItem)}
                              deshabilitado={sinEditar || !sinProcesar(unItem)}
                            />
                          )}
                          {unItem && (
                            <BotonAccion
                              icono="bi-trash"
                              titulo={sinEditar ? 'Sin permiso para editar' : 'Borrar'}
                              variante="danger"
                              deshabilitado={sinEditar}
                              onClick={() => borrar(unItem)}
                            />
                          )}
                          {item._count > 1 && (
                            <BotonAccion icono="bi-list-ul" titulo="Ver el detalle" onClick={() => verDetalle(item)} />
                          )}
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

      {/* Modal Editar ítem */}
      <Modal show={showModal} onHide={cerrar} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{
            backgroundColor: BORDO,
            color: '#fff',
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-pencil-square" style={{ color: '#f59e0b' }}></i>
            <span>Editar ítem</span>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="p-4">
            <Row className="g-3">
              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Nombre repuesto <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={form.nombre_repuesto}
                  onChange={(e) => setForm({ ...form, nombre_repuesto: e.target.value })}
                  required
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Cant.</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={form.cant}
                  onChange={(e) => setForm({ ...form, cant: e.target.value })}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Unidad <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  placeholder="Ej: un, kg, mts"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  required
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">C.C.</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={form.cc}
                  onChange={(e) => setForm({ ...form, cc: e.target.value })}
                />
              </Col>

              <Col md={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Descripción</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Grupo <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={form.grupo}
                  onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                >
                  {GRUPOS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  Urgencia <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={{ fontSize: '0.85rem' }}
                  value={form.urgencia}
                  onChange={(e) => setForm({ ...form, urgencia: e.target.value })}
                >
                  {URGENCIAS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Form.Select>
              </Col>

              {/* El estado no se edita a mano: lo mueve el circuito del pedido. */}
              <Col md={4}>
                <Form.Label className="fw-semibold text-dark small mb-1">Estado</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={{ fontSize: '0.85rem', backgroundColor: '#f8f9fa', cursor: 'default' }}
                  value={form.estado === 'Pedido' ? 'Para analisis' : form.estado}
                  readOnly
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
              onClick={cerrar}
              className="rounded-3 px-3 py-1"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={sinEditar}
              title={sinEditar ? 'Sin permiso para editar' : 'Guardar'}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>Guardar</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
