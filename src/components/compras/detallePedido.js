import Swal from 'sweetalert2'
import { BORDO, th, td } from './formato'

/**
 * Los carteles de las tablas de pedidos y de pendientes: el detalle de un
 * pedido con varios ítems y el historial de estados de un ítem. Van en
 * SweetAlert, así que las tablas se arman en HTML con el formato común
 * (docs/formato-tablas.md): letra chica, encabezado bordó y cebra. Sin chapas
 * ni adornos, a pedido (13/09/2026). Antes cada pantalla tenía su propia
 * copia, con la tabla genérica de Bootstrap.
 */

// Estilo en línea a partir de los objetos de formato.js.
const css = (estilo) =>
  Object.entries(estilo)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(';')

// Los textos son de carga libre: se escapan antes de meterlos en el HTML.
const escapar = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Un dato que falta va como raya gris, igual que en las tablas.
const RAYA = '<span style="color:#cbd5e1">—</span>'
const texto = (v) => (v === null || v === undefined || v === '' ? RAYA : escapar(v))

const COLOR_URGENCIA = { Baja: '#6c757d', Media: '#c87800', Alta: '#dc3545', Crítica: '#dc3545' }
const urgencia = (u) =>
  u ? `<span style="font-weight:600;color:${COLOR_URGENCIA[u] || '#6c757d'}">${escapar(u)}</span>` : RAYA

// El estado va en texto, con los mismos nombres que muestran las tablas.
const NOMBRE_ESTADO = { Pedido: 'Para analisis', 'En analisis': 'Para analisis', Autorizar: 'Autorizar Gcia.' }
const estado = (e) => texto(NOMBRE_ESTADO[e] || e)

// El encabezado queda fijo cuando la lista es larga y el cuadro scrollea.
const fijo = { position: 'sticky', top: 0, zIndex: 1 }
const TH = css({ ...th, ...fijo })
const TH_CENTRO = css({ ...th, ...fijo, textAlign: 'center' })
const TD = css(td)
const TD_CENTRO = css({ ...td, textAlign: 'center' })
const TD_DESCRIPCION = css({ ...td, minWidth: '220px' })

// El título va chico, adentro del cuerpo: el de SweetAlert es muy grande para
// una tabla de letra chica.
const TITULO = `text-align:left;font-weight:700;color:${BORDO};font-size:0.9rem;margin-bottom:0.5rem`
const SUBTITULO = 'text-align:left;font-weight:600;font-size:0.78rem;color:#334155;margin-bottom:0.25rem'

// Texto a la izquierda; números, códigos, urgencia y estado centrados.
const COLUMNAS = [
  { titulo: 'Repuesto', celda: (i) => texto(i.nombre_repuesto), th: TH, td: TD },
  { titulo: 'Cant.', celda: (i) => texto(i.cant), th: TH_CENTRO, td: TD_CENTRO },
  { titulo: 'Un.', celda: (i) => texto(i.unidad), th: TH_CENTRO, td: TD_CENTRO },
  { titulo: 'C.C.', celda: (i) => texto(i.cc), th: TH_CENTRO, td: TD_CENTRO },
  { titulo: 'Urgencia', celda: (i) => urgencia(i.urgencia), th: TH_CENTRO, td: TD_CENTRO },
  { titulo: 'Grupo', celda: (i) => texto(i.grupo), th: TH, td: TD },
  { titulo: 'Descripción', celda: (i) => texto(i.descripcion), th: TH, td: TD_DESCRIPCION, descripcion: true },
  { titulo: 'Solicita', celda: (i) => texto(i.solicita), th: TH, td: TD },
  { titulo: 'Estado', celda: (i) => estado(i.estado), th: TH_CENTRO, td: TD_CENTRO },
]

/**
 * Muestra el detalle. Las pantallas de pendientes no llevan la descripción
 * (`conDescripcion: false`), igual que antes.
 */
export const verDetallePedido = ({ titulo, items = [], conDescripcion = true }) => {
  const columnas = COLUMNAS.filter((c) => conDescripcion || !c.descripcion)
  const encabezado = columnas.map((c) => `<th style="${c.th}">${c.titulo}</th>`).join('')
  const filas = items
    .map((i) => `<tr>${columnas.map((c) => `<td style="${c.td}">${c.celda(i)}</td>`).join('')}</tr>`)
    .join('')

  return Swal.fire({
    html: `
      <div style="${TITULO}">${escapar(titulo)}</div>
      <div style="overflow:auto;max-height:60vh">
        <table class="table mb-0 tabla-informe tabla-compras" style="width:100%">
          <thead><tr>${encabezado}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`,
    // Ancho para que las nueve columnas se lean sin amontonarse; en pantallas
    // chicas no pasa del 95%.
    width: 'min(960px, 95vw)',
    padding: '0.9rem',
    confirmButtonText: 'Cerrar',
    confirmButtonColor: BORDO,
  })
}

// ── Historial de estados de un ítem ───────────────────────────────────

/**
 * El historial arranca con la creación del pedido. Los ítems viejos no la
 * tienen registrada: se agrega con la fecha del pedido y quien lo pidió.
 */
export const conCreacion = (historial = [], { fecha, solicita } = {}) => {
  const tieneInicio = historial.some((h) => ['Para analisis', 'Pedido', 'En analisis'].includes(h.estado))
  return tieneInicio
    ? historial
    : [{ fecha, estado: 'Para analisis', usuario: solicita || 'Sin especificar', nota: 'Pedido creado' }, ...historial]
}

// La fecha del pedido se guarda como día (medianoche UTC): en hora local se
// veía como las 21 hs del día anterior. Esas van sin hora y sin correrse; los
// cambios de estado sí llevan la hora.
const fechaHora = (f) => {
  if (!f) return null
  const d = new Date(f)
  if (isNaN(d)) return null
  if (d.toISOString().endsWith('T00:00:00.000Z')) {
    return d.toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: '2-digit' })
  }
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

// Cancelado y rechazado se leen igual: en rojo, como "Rechazado".
const estadoHistorial = (e) =>
  e === 'Cancelado' || e === 'Rechazado'
    ? '<span style="color:#dc3545;font-weight:600">Rechazado</span>'
    : estado(e)

// La nota ("Pedido creado", el motivo de un cambio) va al lado, en gris.
const usuarioConNota = (h) =>
  texto(h.usuario) + (h.nota ? ` <span style="color:#94a3b8">· ${escapar(h.nota)}</span>` : '')

const tablaHistorial = (historial) => `
  <table class="table mb-0 tabla-informe tabla-compras" style="width:100%">
    <thead><tr>
      <th style="${TH_CENTRO}">Fecha</th>
      <th style="${TH_CENTRO}">Estado</th>
      <th style="${TH}">Usuario</th>
    </tr></thead>
    <tbody>${historial
      .map(
        (h) => `<tr>
      <td style="${TD_CENTRO};white-space:nowrap">${texto(fechaHora(h.fecha))}</td>
      <td style="${TD_CENTRO}">${estadoHistorial(h.estado)}</td>
      <td style="${TD}">${usuarioConNota(h)}</td>
    </tr>`
      )
      .join('')}</tbody>
  </table>`

/**
 * Muestra el historial. Una sección por ítem: las pantallas de pedidos y de
 * pendientes muestran uno; Gerencia, todos los del pedido, cada uno con su
 * nombre como subtítulo.
 */
export const verHistorialPedido = ({ titulo, secciones = [] }) =>
  Swal.fire({
    html: `
      <div style="${TITULO}">${escapar(titulo)}</div>
      <div style="overflow:auto;max-height:60vh">
        ${secciones
          .map(
            (s) =>
              (s.subtitulo ? `<div style="${SUBTITULO}">${escapar(s.subtitulo)}</div>` : '') +
              tablaHistorial(s.historial)
          )
          .join('<div style="height:0.75rem"></div>')}
      </div>`,
    width: 'min(640px, 95vw)',
    padding: '0.9rem',
    confirmButtonText: 'Cerrar',
    confirmButtonColor: BORDO,
  })
