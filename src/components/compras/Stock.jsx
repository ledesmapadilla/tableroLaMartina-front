import { useState, useEffect } from 'react'
import { Container, Card, Table, Button, Form, Modal, Row, Col } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { BORDO, campo, th, thCentro, td, tdCentro } from './formato'
import { Raya, BotonAccion, BotonLimpiar, FiltroTexto, FiltroSelect } from './estilos'
import { usePermisos } from '../../context/permisos'
import { useAuth } from '../../context/AuthContext'
import { GRUPOS_PEDIDO } from '../../utils/equipos'
import SelectBuscador from '../shared/SelectBuscador'
import { BORDO_SUAVE } from './formato'
import { leerExcelDeArticulos, separarRepetidos } from './stockImportar'
import {
  TIPOS,
  NOMBRE_TIPO,
  TALLERES,
  listarArticulos,
  guardarArticulo,
  borrarArticulo,
  movimientosDe,
  registrarMovimiento,
} from '../../services/stock'

/**
 * El stock del almacén (20/09/2026).
 *
 * Por ahora el depósito tiene lo que el analista ingresa a mano: todavía no se
 * conecta con Compras, que es el paso siguiente.
 *
 * El catálogo crece con el uso: al ingresar mercadería se busca el artículo y,
 * si no está, se da de alta en el mismo paso. El saldo nunca se escribe a
 * mano: lo mueven Ingresar, Entregar y Ajustar, y cada uno deja su movimiento.
 *
 * Las secciones son los mismos grupos con los que se pide un repuesto
 * (utils/equipos.js): así lo que se pidió para Manitou entra al stock de
 * Manitou sin traducir nada.
 */

/**
 * Las secciones del almacén.
 *
 * Primero los equipos, que son los mismos grupos con los que se pide un
 * repuesto en Compras (utils/equipos.js), sin "Stock" —que es el depósito
 * mismo— ni "Otros", que va al final. Después los rubros del almacén, que no
 * son de un equipo sino del tipo de repuesto, y por eso no están en la lista
 * de los pedidos.
 */
const RUBROS = ['Filtros', 'Lubricantes', 'Correas', 'Cubiertas', 'Herramientas', 'Electricidad']

const SECCIONES = [
  ...GRUPOS_PEDIDO.filter((g) => g !== 'Stock' && g !== 'Otros'),
  ...RUBROS,
  'Otros',
]

const UNIDADES = ['un', 'm', 'kg', 'l', 'jgo', 'par']

const FORM_INIT = {
  nombre: '',
  seccion: 'Tractores',
  unidad: 'un',
  cantidad: '',
  minimo: '',
  ubicacion: '',
}

const FILTROS_INIT = { buscar: '', seccion: '', estado: '' }

// El ingreso de mercadería: qué llegó, cuánto y de dónde. `articulo` es el id
// del artículo del catálogo o, si es uno que todavía no existe, el nombre
// tipeado: ahí el mismo formulario lo da de alta.
const INGRESO_INIT = { articulo: '', cantidad: '', origen: '', seccion: 'Tractores', unidad: 'un', minimo: '' }

const fmtFecha = (f) =>
  new Date(f).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const escapar = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Un artículo está en falta cuando no llega a su mínimo. */
const enFalta = (a) => Number(a.minimo) > 0 && Number(a.cantidad) <= Number(a.minimo)

export default function Stock() {
  // El stock es del analista: sin "Editar" se mira y no se toca.
  const { puede } = usePermisos()
  const { user } = useAuth()
  const sinEditar = !puede('compras.stock', 'editar')

  const [articulos, setArticulos] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_INIT)
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [ingreso, setIngreso] = useState(INGRESO_INIT)
  const [showIngreso, setShowIngreso] = useState(false)

  const setF = (k, v) => setFiltros((f) => ({ ...f, [k]: v }))
  const hayFiltros = Object.values(filtros).some((v) => v !== '')

  const recargar = () => listarArticulos().then(setArticulos).catch(() => {})

  useEffect(() => {
    let vigente = true
    listarArticulos()
      .then((lista) => { if (vigente) setArticulos(lista) })
      .catch(() => {})
    return () => { vigente = false }
  }, [])

  const avisarError = (err) =>
    Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.message })

  const lista = articulos.filter((a) => {
    if (filtros.buscar && !a.nombre?.toLowerCase().includes(filtros.buscar.toLowerCase())) return false
    if (filtros.seccion && a.seccion !== filtros.seccion) return false
    if (filtros.estado === 'En falta' && !enFalta(a)) return false
    if (filtros.estado === 'Con stock' && enFalta(a)) return false
    return true
  })

  // ── Alta y edición ──────────────────────────────────────────────────

  const abrirNuevo = () => {
    setForm(FORM_INIT)
    setEditId(null)
    setShowModal(true)
  }

  const abrirEditar = (a) => {
    setForm({
      nombre: a.nombre ?? '',
      seccion: a.seccion ?? 'Tractores',
      unidad: a.unidad ?? 'un',
      cantidad: a.cantidad ?? '',
      minimo: a.minimo ?? '',
      ubicacion: a.ubicacion ?? '',
    })
    setEditId(a._id)
    setShowModal(true)
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    try {
      await guardarArticulo({
        ...form,
        id: editId || undefined,
        nombre: form.nombre.trim(),
        cantidad: Number(form.cantidad) || 0,
        minimo: Number(form.minimo) || 0,
      })
      await recargar()
      setShowModal(false)
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false })
    } catch (err) {
      avisarError(err)
    }
  }

  const borrar = async (a) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Borrar el artículo?',
      html: `<div style="font-weight:600">${escapar(a.nombre)}</div>
             <div style="font-size:0.82rem;color:#64748b">Se borran también sus movimientos.</div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Borrar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-danger me-2', cancelButton: 'btn btn-outline-secondary' },
    })
    if (!isConfirmed) return
    try {
      await borrarArticulo(a._id)
      await recargar()
    } catch (err) {
      avisarError(err)
    }
  }

  // ── Ingreso de mercadería ───────────────────────────────────────────
  // El catálogo crece con el uso: el analista busca lo que le llegó y, si no
  // está, lo escribe y queda dado de alta en el mismo paso. Así el taller
  // sigue pidiendo con texto libre y el almacén igual queda ordenado, porque
  // el que decide qué es qué es uno solo.

  const opcionesCatalogo = articulos.map((a) => ({
    valor: a._id,
    texto: `${a.nombre}${a.seccion ? ` · ${a.seccion}` : ''}`,
  }))

  // Lo elegido es un artículo del catálogo, o un nombre nuevo si no coincide.
  const articuloElegido = articulos.find((a) => a._id === ingreso.articulo)
  const esArticuloNuevo = Boolean(ingreso.articulo) && !articuloElegido

  const confirmarIngreso = async (e) => {
    e.preventDefault()
    const cantidad = Number(ingreso.cantidad)
    if (!ingreso.articulo || !Number.isFinite(cantidad) || cantidad <= 0) return

    try {
      let id = articuloElegido?._id
      if (!id) {
        // Alta al vuelo: el artículo nace en cero y la cantidad entra como
        // movimiento, así queda registrada en su historia.
        const creado = await guardarArticulo({
          nombre: ingreso.articulo.trim(),
          seccion: ingreso.seccion,
          unidad: ingreso.unidad,
          cantidad: 0,
          minimo: Number(ingreso.minimo) || 0,
        })
        id = creado._id
      }

      await registrarMovimiento({
        articuloId: id,
        tipo: TIPOS.ENTRADA,
        cantidad,
        persona: user?.nombre || '',
        nota: ingreso.origen.trim() || 'Ingreso manual',
      })
      await recargar()
      setShowIngreso(false)
      setIngreso(INGRESO_INIT)
      Swal.fire({
        icon: 'success',
        title: esArticuloNuevo ? 'Ingresado y dado de alta' : 'Ingresado',
        timer: 1400,
        showConfirmButton: false,
      })
    } catch (err) {
      avisarError(err)
    }
  }

  // ── Precarga desde un Excel ─────────────────────────────────────────

  const importar = async (file) => {
    try {
      const { articulos: leidos, problemas } = await leerExcelDeArticulos(file)
      if (problemas.length > 0 && leidos.length === 0) {
        Swal.fire({ icon: 'warning', title: 'No se pudo leer', text: problemas[0] })
        return
      }

      const { nuevos, repetidos } = separarRepetidos(leidos, articulos)
      if (nuevos.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'No hay nada para cargar',
          text: 'Todos los artículos del archivo ya están en el catálogo.',
        })
        return
      }

      // Se muestra antes qué se va a cargar: una precarga no se deshace.
      const muestra = nuevos
        .slice(0, 8)
        .map((a) => `<li style="margin-bottom:2px">${escapar(a.nombre)}${a.seccion ? ` · ${escapar(a.seccion)}` : ''}${a.cantidad ? ` · ${a.cantidad}` : ''}</li>`)
        .join('')

      const { isConfirmed } = await Swal.fire({
        title: `¿Cargar ${nuevos.length} ${nuevos.length === 1 ? 'artículo' : 'artículos'}?`,
        html: `
          <div style="text-align:left;font-size:0.84rem">
            <ul style="padding-left:18px;margin-bottom:6px">${muestra}</ul>
            ${nuevos.length > 8 ? `<div style="color:#64748b">…y ${nuevos.length - 8} más</div>` : ''}
            ${repetidos.length > 0 ? `<div style="color:#b45309;margin-top:8px">${repetidos.length} ${repetidos.length === 1 ? 'se saltea porque ya está' : 'se saltean porque ya están'} en el catálogo.</div>` : ''}
          </div>`,
        width: 420,
        showCancelButton: true,
        confirmButtonText: 'Cargar',
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-outline-success me-2', cancelButton: 'btn btn-outline-secondary' },
      })
      if (!isConfirmed) return

      for (const a of nuevos) {
        // El artículo nace en cero y la cantidad entra como movimiento, igual
        // que todo lo demás: así la carga inicial queda en la historia.
        const creado = await guardarArticulo({
          nombre: a.nombre,
          seccion: SECCIONES.includes(a.seccion) ? a.seccion : 'Otros',
          unidad: a.unidad || 'un',
          cantidad: 0,
          minimo: a.minimo,
          ubicacion: a.ubicacion,
        })
        if (a.cantidad > 0) {
          await registrarMovimiento({
            articuloId: creado._id,
            tipo: TIPOS.ENTRADA,
            cantidad: a.cantidad,
            persona: user?.nombre || '',
            nota: 'Carga inicial desde Excel',
          })
        }
      }
      await recargar()
      Swal.fire({
        icon: 'success',
        title: `${nuevos.length} ${nuevos.length === 1 ? 'artículo cargado' : 'artículos cargados'}`,
        timer: 1600,
        showConfirmButton: false,
      })
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo importar', text: err.message })
    }
  }

  // ── Movimientos ─────────────────────────────────────────────────────

  const entregar = async (a) => {
    const opciones = TALLERES.map((t) => `<option value="${t.clave}">${t.nombre}</option>`).join('')
    const rotulo = 'display:block;font-weight:600;font-size:0.8rem;color:#475569;margin:10px 0 4px'
    const control = 'width:100%;margin:0;font-size:0.9rem;box-sizing:border-box'
    const { value, isConfirmed } = await Swal.fire({
      title: 'Entregar a un taller',
      html: `
        <div style="text-align:left">
          <div style="font-weight:700;color:#1e293b">${escapar(a.nombre)}</div>
          <div style="font-size:0.8rem;color:#64748b">Hay ${a.cantidad} ${escapar(a.unidad || '')}</div>
          <label for="st-cant" style="${rotulo}">Cantidad</label>
          <input id="st-cant" type="number" min="1" max="${a.cantidad}" class="swal2-input" style="${control}">
          <label for="st-taller" style="${rotulo}">Taller</label>
          <select id="st-taller" class="swal2-select" style="${control}">${opciones}</select>
          <label for="st-quien" style="${rotulo}">Quién retira</label>
          <input id="st-quien" class="swal2-input" style="${control}" autocomplete="off">
        </div>`,
      width: 380,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Entregar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-success me-2', cancelButton: 'btn btn-outline-secondary' },
      preConfirm: () => {
        const popup = Swal.getPopup()
        const cantidad = Number(popup.querySelector('#st-cant').value)
        const taller = popup.querySelector('#st-taller').value
        const persona = popup.querySelector('#st-quien').value.trim()
        if (!Number.isInteger(cantidad) || cantidad < 1) {
          Swal.showValidationMessage('Indicá cuánto se entrega')
          return false
        }
        if (cantidad > Number(a.cantidad)) {
          Swal.showValidationMessage(`No hay tanto: quedan ${a.cantidad}`)
          return false
        }
        if (!persona) {
          Swal.showValidationMessage('Indicá quién retira')
          return false
        }
        return { cantidad, taller, persona }
      },
    })
    if (!isConfirmed) return
    try {
      await registrarMovimiento({
        articuloId: a._id,
        tipo: TIPOS.SALIDA,
        cantidad: value.cantidad,
        taller: TALLERES.find((t) => t.clave === value.taller)?.nombre || '',
        persona: value.persona,
      })
      await recargar()
      Swal.fire({ icon: 'success', title: 'Entregado', timer: 1200, showConfirmButton: false })
    } catch (err) {
      avisarError(err)
    }
  }

  const ingresar = async (a) => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'Ingresar al stock',
      html: `<div style="font-weight:700">${escapar(a.nombre)}</div>
             <div style="font-size:0.8rem;color:#64748b">Hay ${a.cantidad} ${escapar(a.unidad || '')}</div>`,
      input: 'number',
      inputLabel: 'Cuánto entra',
      inputAttributes: { min: 1 },
      showCancelButton: true,
      confirmButtonText: 'Ingresar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-success me-2', cancelButton: 'btn btn-outline-secondary' },
      preConfirm: (v) => {
        const cantidad = Number(v)
        if (!Number.isInteger(cantidad) || cantidad < 1) {
          Swal.showValidationMessage('Indicá cuánto entra')
          return false
        }
        return cantidad
      },
    })
    if (!isConfirmed) return
    try {
      await registrarMovimiento({
        articuloId: a._id,
        tipo: TIPOS.ENTRADA,
        cantidad: value,
        persona: user?.nombre || '',
        nota: 'Carga manual',
      })
      await recargar()
      Swal.fire({ icon: 'success', title: 'Ingresado', timer: 1200, showConfirmButton: false })
    } catch (err) {
      avisarError(err)
    }
  }

  const ajustar = async (a) => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'Ajustar por conteo',
      html: `<div style="font-weight:700">${escapar(a.nombre)}</div>
             <div style="font-size:0.8rem;color:#64748b">El sistema dice ${a.cantidad} ${escapar(a.unidad || '')}</div>`,
      input: 'number',
      inputLabel: 'Cuánto hay de verdad',
      inputAttributes: { min: 0 },
      showCancelButton: true,
      confirmButtonText: 'Ajustar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-outline-warning me-2', cancelButton: 'btn btn-outline-secondary' },
      preConfirm: (v) => {
        const cantidad = Number(v)
        if (!Number.isInteger(cantidad) || cantidad < 0) {
          Swal.showValidationMessage('Indicá el conteo')
          return false
        }
        return cantidad
      },
    })
    if (!isConfirmed) return
    try {
      await registrarMovimiento({
        articuloId: a._id,
        tipo: TIPOS.AJUSTE,
        cantidad: value,
        persona: user?.nombre || '',
        nota: 'Conteo',
      })
      await recargar()
      Swal.fire({ icon: 'success', title: 'Ajustado', timer: 1200, showConfirmButton: false })
    } catch (err) {
      avisarError(err)
    }
  }

  const verMovimientos = async (a) => {
    const movimientos = await movimientosDe(a._id).catch(() => [])
    const filas = movimientos
      .map(
        (m) => `<tr>
          <td style="${CSS_TD}">${fmtFecha(m.fecha)}</td>
          <td style="${CSS_TD}">${NOMBRE_TIPO[m.tipo] || m.tipo}</td>
          <td style="${CSS_TD_CENTRO};font-weight:700;color:${m.cantidad < 0 ? '#dc2626' : '#15803d'}">
            ${m.cantidad > 0 ? '+' : ''}${m.cantidad}
          </td>
          <td style="${CSS_TD_CENTRO}">${m.saldo}</td>
          <td style="${CSS_TD}">${escapar(m.taller || m.nota || '')}</td>
          <td style="${CSS_TD}">${escapar(m.persona || '')}</td>
        </tr>`
      )
      .join('')

    Swal.fire({
      html: `
        <div style="text-align:left;font-weight:700;color:${BORDO};font-size:0.9rem;margin-bottom:0.5rem">
          ${escapar(a.nombre)} · movimientos
        </div>
        <div style="overflow:auto;max-height:60vh">
          <table class="table mb-0 tabla-informe tabla-compras" style="width:100%">
            <thead><tr>
              <th style="${CSS_TH}">Fecha</th>
              <th style="${CSS_TH}">Tipo</th>
              <th style="${CSS_TH_CENTRO}">Cant.</th>
              <th style="${CSS_TH_CENTRO}">Saldo</th>
              <th style="${CSS_TH}">Destino / motivo</th>
              <th style="${CSS_TH}">Quién</th>
            </tr></thead>
            <tbody>${filas || `<tr><td colspan="6" style="${CSS_TD};text-align:center;color:#94a3b8">Sin movimientos</td></tr>`}</tbody>
          </table>
        </div>`,
      width: 'min(720px, 95vw)',
      padding: '0.9rem',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: BORDO,
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
        className="px-4 py-3 d-flex flex-column flex-grow-1"
        style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', overflow: 'hidden' }}
      >
        {/* Encabezado. El volver está en el navbar de Compras, arriba. */}
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center"
              style={{
                width: '34px',
                height: '34px',
                backgroundColor: '#475569',
                color: '#fff',
                fontSize: '1.1rem',
                boxShadow: '0 2px 8px rgba(71, 85, 105, 0.3)',
              }}
            >
              <i className="bi bi-box-seam-fill"></i>
            </div>
            <div className="d-flex flex-column lh-sm">
              <span className="fw-bold" style={{ color: BORDO, fontSize: '1rem' }}>
                Stock general
              </span>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                {lista.length} {lista.length === 1 ? 'artículo' : 'artículos'}
                {articulos.some(enFalta) && ` · ${articulos.filter(enFalta).length} en falta`}
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* El botón verde de Excel es el mismo de todo el proyecto; acá
                trae artículos en vez de llevarlos. */}
            <label
              className={`btn btn-sm rounded-3 px-3 mb-0 d-flex align-items-center gap-2 text-white${
                sinEditar ? ' disabled' : ''
              }`}
              style={{
                backgroundColor: '#15803d',
                borderColor: '#15803d',
                fontSize: '0.78rem',
                height: '30px',
                fontWeight: 600,
              }}
              title={sinEditar ? 'Sin permiso para editar' : 'Cargar artículos desde un Excel'}
            >
              <i className="bi bi-file-earmark-excel-fill"></i>
              <span>Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                disabled={sinEditar}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = '' }}
              />
            </label>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={abrirNuevo}
              disabled={sinEditar}
              title={sinEditar ? 'Sin permiso para editar' : 'Dar de alta un artículo sin cargarle cantidad'}
              className="rounded-3 px-3 py-1 d-flex align-items-center gap-2"
              style={{ fontSize: '0.82rem' }}
            >
              <i className="bi bi-plus-lg"></i>
              <span>Nuevo artículo</span>
            </Button>

            {/* La puerta de entrada del almacén: lo que llegó. Si el artículo
                no está en el catálogo, se da de alta en el mismo paso. */}
            <Button
              size="sm"
              onClick={() => { setIngreso(INGRESO_INIT); setShowIngreso(true) }}
              disabled={sinEditar}
              title={sinEditar ? 'Sin permiso para editar' : undefined}
              className="rounded-3 px-3 py-1 shadow-sm d-flex align-items-center gap-2"
              style={{ backgroundColor: BORDO, borderColor: BORDO, fontSize: '0.82rem', fontWeight: 600 }}
            >
              <i className="bi bi-box-arrow-in-down"></i>
              <span>Ingresar mercadería</span>
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-3 p-2 shadow-sm border-0 rounded-3 flex-shrink-0">
          <div className="d-flex align-items-end justify-content-center gap-2 flex-wrap">
            <FiltroTexto
              etiqueta="Buscar"
              ancho="220px"
              valor={filtros.buscar}
              onChange={(v) => setF('buscar', v)}
              placeholder="Nombre del artículo"
            />
            <FiltroSelect
              etiqueta="Sección"
              ancho="150px"
              valor={filtros.seccion}
              vacio="Todas"
              onChange={(v) => setF('seccion', v)}
              opciones={SECCIONES}
            />
            <FiltroSelect
              etiqueta="Estado"
              ancho="130px"
              valor={filtros.estado}
              vacio="Todos"
              onChange={(v) => setF('estado', v)}
              opciones={['En falta', 'Con stock']}
            />
            {hayFiltros && <BotonLimpiar onClick={() => setFiltros(FILTROS_INIT)} />}
          </div>
        </Card>

        {/* Tabla del stock */}
        <div
          className="flex-grow-1 shadow-sm rounded-3 bg-white"
          style={{ minHeight: 0, overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1' }}
        >
          <Table className="mb-0 tabla-informe tabla-compras" style={{ width: '100%', minWidth: '820px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={th}>Artículo</th>
                <th style={th}>Sección</th>
                <th style={thCentro}>Cantidad</th>
                <th style={thCentro}>Mínimo</th>
                <th style={th}>Ubicación</th>
                <th style={{ ...thCentro, width: 160 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4" style={td}>
                    {articulos.length === 0
                      ? 'Todavía no hay artículos cargados'
                      : 'Ningún artículo coincide con los filtros'}
                  </td>
                </tr>
              ) : (
                lista.map((a) => (
                  <tr key={a._id} className={enFalta(a) ? 'fila-critica' : ''}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.nombre}</td>
                    <td style={td}>{a.seccion || <Raya />}</td>
                    <td style={{ ...tdCentro, fontWeight: 700, color: enFalta(a) ? '#dc2626' : '#1e293b' }}>
                      {a.cantidad} {a.unidad}
                    </td>
                    <td style={tdCentro}>{Number(a.minimo) > 0 ? a.minimo : <Raya />}</td>
                    <td style={td}>{a.ubicacion || <Raya />}</td>
                    <td style={tdCentro}>
                      <div className="d-flex justify-content-center align-items-center" style={{ gap: '6px' }}>
                        <BotonAccion
                          icono="bi-box-arrow-in-down"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Ingresar al stock'}
                          variante="success"
                          deshabilitado={sinEditar}
                          onClick={() => ingresar(a)}
                        />
                        <BotonAccion
                          icono="bi-box-arrow-up"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Entregar a un taller'}
                          variante="primary"
                          deshabilitado={sinEditar || Number(a.cantidad) <= 0}
                          onClick={() => entregar(a)}
                        />
                        <BotonAccion
                          icono="bi-clipboard-check"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Ajustar por conteo'}
                          variante="warning"
                          deshabilitado={sinEditar}
                          onClick={() => ajustar(a)}
                        />
                        <BotonAccion
                          icono="bi-clock-history"
                          titulo="Movimientos"
                          onClick={() => verMovimientos(a)}
                        />
                        <BotonAccion
                          icono="bi-pencil"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Editar'}
                          variante="primary"
                          deshabilitado={sinEditar}
                          onClick={() => abrirEditar(a)}
                        />
                        <BotonAccion
                          icono="bi-trash"
                          titulo={sinEditar ? 'Sin permiso para editar' : 'Borrar'}
                          variante="danger"
                          deshabilitado={sinEditar}
                          onClick={() => borrar(a)}
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

      {/* Modal Ingresar mercadería */}
      <Modal
        show={showIngreso}
        onHide={() => setShowIngreso(false)}
        centered
        contentClassName="border-0 shadow-lg rounded-4 overflow-visible"
      >
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: BORDO, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-box-arrow-in-down"></i>
            Ingresar mercadería
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={confirmarIngreso}>
          <Modal.Body className="py-3 px-4">
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Qué llegó</Form.Label>
                <SelectBuscador
                  opciones={opcionesCatalogo}
                  colores={{ marcada: BORDO_SUAVE, elegida: BORDO }}
                  valor={ingreso.articulo}
                  onChange={(v) => setIngreso({ ...ingreso, articulo: v })}
                  vacio={null}
                  libre
                  placeholder="Buscá el artículo o escribí uno nuevo"
                  style={campo}
                />
                <div className="text-muted mt-1" style={{ fontSize: '0.74rem' }}>
                  {articuloElegido
                    ? `Hay ${articuloElegido.cantidad} ${articuloElegido.unidad || ''} en ${articuloElegido.seccion}`
                    : esArticuloNuevo
                    ? 'No está en el catálogo: se da de alta con lo de abajo.'
                    : 'Buscá por cualquier parte del nombre.'}
                </div>
              </Col>

              {/* Solo si es uno nuevo: lo mínimo para que quede bien fichado. */}
              {esArticuloNuevo && (
                <>
                  <Col xs={5}>
                    <Form.Label className="fw-semibold text-dark small mb-1">Sección</Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={campo}
                      value={ingreso.seccion}
                      onChange={(e) => setIngreso({ ...ingreso, seccion: e.target.value })}
                    >
                      {SECCIONES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={3}>
                    <Form.Label className="fw-semibold text-dark small mb-1">Unidad</Form.Label>
                    <Form.Select
                      className="rounded-3"
                      style={campo}
                      value={ingreso.unidad}
                      onChange={(e) => setIngreso({ ...ingreso, unidad: e.target.value })}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={4}>
                    <Form.Label className="fw-semibold text-dark small mb-1">Mínimo</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      className="rounded-3"
                      style={campo}
                      value={ingreso.minimo}
                      onChange={(e) => setIngreso({ ...ingreso, minimo: e.target.value })}
                      placeholder="0"
                    />
                  </Col>
                </>
              )}

              <Col xs={5}>
                <Form.Label className="fw-semibold text-dark small mb-1">Cantidad</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  className="rounded-3"
                  style={campo}
                  value={ingreso.cantidad}
                  onChange={(e) => setIngreso({ ...ingreso, cantidad: e.target.value })}
                  placeholder="0"
                  required
                />
              </Col>
              <Col xs={7}>
                <Form.Label className="fw-semibold text-dark small mb-1">De dónde viene</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={ingreso.origen}
                  onChange={(e) => setIngreso({ ...ingreso, origen: e.target.value })}
                  placeholder="OP B-014, compra directa…"
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
              onClick={() => setShowIngreso(false)}
              className="rounded-3 px-3"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={sinEditar || !ingreso.articulo}
              className="rounded-3 px-3 shadow-sm d-flex align-items-center gap-1"
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontSize: '0.84rem', fontWeight: 600 }}
            >
              <i className="bi bi-check-lg"></i>
              <span>{esArticuloNuevo ? 'Dar de alta e ingresar' : 'Ingresar'}</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Nuevo / Editar artículo */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered contentClassName="border-0 shadow-lg rounded-4">
        <Modal.Header
          closeButton
          closeVariant="white"
          style={{ backgroundColor: BORDO, borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-white">
            <i className="bi bi-box-seam-fill"></i>
            {editId ? 'Editar artículo' : 'Nuevo artículo'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={guardar}>
          <Modal.Body className="py-3 px-4">
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Artículo</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Filtro de aceite"
                  required
                  autoFocus
                />
              </Col>
              <Col xs={7}>
                <Form.Label className="fw-semibold text-dark small mb-1">Sección</Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={campo}
                  value={form.seccion}
                  onChange={(e) => setForm({ ...form, seccion: e.target.value })}
                >
                  {SECCIONES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={5}>
                <Form.Label className="fw-semibold text-dark small mb-1">Unidad</Form.Label>
                <Form.Select
                  className="rounded-3"
                  style={campo}
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">
                  {editId ? 'Cantidad' : 'Cantidad inicial'}
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  className="rounded-3"
                  style={campo}
                  value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                  placeholder="0"
                  disabled={Boolean(editId)}
                  title={editId ? 'La cantidad se cambia con Ingresar, Entregar o Ajustar' : undefined}
                />
              </Col>
              <Col xs={6}>
                <Form.Label className="fw-semibold text-dark small mb-1">Stock mínimo</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  className="rounded-3"
                  style={campo}
                  value={form.minimo}
                  onChange={(e) => setForm({ ...form, minimo: e.target.value })}
                  placeholder="0"
                />
              </Col>
              <Col xs={12}>
                <Form.Label className="fw-semibold text-dark small mb-1">Ubicación</Form.Label>
                <Form.Control
                  className="rounded-3"
                  style={campo}
                  value={form.ubicacion}
                  onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                  placeholder="Estante 3, caja B"
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
              onClick={() => setShowModal(false)}
              className="rounded-3 px-3"
              style={{ fontSize: '0.84rem' }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={sinEditar}
              className="rounded-3 px-3 shadow-sm d-flex align-items-center gap-1"
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

// El cartel de movimientos se arma en HTML para SweetAlert, así que los estilos
// de la tabla se pasan en línea, como en detallePedido.js.
const css = (estilo) =>
  Object.entries(estilo)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(';')

const CSS_TH = css({ ...th, position: 'sticky', top: 0, zIndex: 1 })
const CSS_TH_CENTRO = css({ ...thCentro, position: 'sticky', top: 0, zIndex: 1 })
const CSS_TD = css(td)
const CSS_TD_CENTRO = css(tdCentro)
