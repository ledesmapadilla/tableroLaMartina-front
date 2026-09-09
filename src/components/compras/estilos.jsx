import { Form } from 'react-bootstrap'

/**
 * Los componentes comunes de las pantallas de Compras: los filtros y los
 * botones chicos. Los colores y los estilos de tabla están en formato.js.
 *
 * Viven acá y no copiados en cada pantalla: son varias las que llevan tabla y
 * filtros, y así se tocan todas de un lado.
 */

// Un dato que falta va como raya gris, nunca un cero ni un vacío.
export const Raya = () => <span style={{ color: '#cbd5e1' }}>—</span>

/** Botón de ícono de 24x24 para la columna de acciones. */
export const BotonAccion = ({ icono, titulo, onClick, variante = 'secondary', deshabilitado = false }) => (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    disabled={deshabilitado}
    className={`btn btn-sm btn-outline-${variante} d-flex align-items-center justify-content-center rounded-2 p-0`}
    style={{ width: '24px', height: '24px' }}
    title={titulo}
  >
    <i className={`bi ${icono}`} style={{ fontSize: '0.8rem' }}></i>
  </button>
)

/**
 * Los filtros de la barra, con el mismo comportamiento que en Producción: el
 * rótulo en negrita, el valor en rojo y en negrita cuando el filtro está
 * puesto, y una cruz al costado para limpiarlo.
 *
 * El rótulo va arriba del campo y no al costado: son siete u ocho filtros por
 * pantalla y con el rótulo al lado no entran en una sola fila.
 */
export const FiltroTexto = ({ etiqueta, ancho, valor, onChange, placeholder, tipo = 'text' }) => (
  <div className="d-flex flex-column" style={{ width: ancho }}>
    <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
      {etiqueta}
    </span>
    <div className="input-group input-group-sm">
      <Form.Control
        type={tipo}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-3 ${valor ? 'rounded-end-0 border-end-0 fw-bold filtro-activo' : ''}`}
        style={{
          fontSize: '0.82rem',
          height: '32px',
          padding: '3px 8px',
          color: valor ? '#dc2626' : '#1e293b',
          fontWeight: valor ? '700' : 'normal',
        }}
      />
      {valor && (
        <button
          className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
          type="button"
          onClick={() => onChange('')}
          title={`Limpiar filtro ${etiqueta.toLowerCase()}`}
          style={{ padding: '0 6px', height: '32px' }}
        >
          <i className="bi bi-x" style={{ fontSize: '0.9rem' }}></i>
        </button>
      )}
    </div>
  </div>
)

export const FiltroSelect = ({ etiqueta, ancho, valor, vacio, onChange, opciones }) => (
  <div className="d-flex flex-column" style={{ width: ancho }}>
    <span className="fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>
      {etiqueta}
    </span>
    <div className="input-group input-group-sm">
      <Form.Select
        size="sm"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-3 ${valor ? 'rounded-end-0 border-end-0 fw-bold filtro-activo' : ''}`}
        style={{
          fontSize: '0.82rem',
          height: '32px',
          padding: '3px 24px 3px 8px',
          color: valor ? '#dc2626' : '#1e293b',
          fontWeight: valor ? '700' : 'normal',
        }}
      >
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </Form.Select>
      {valor && (
        <button
          className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
          type="button"
          onClick={() => onChange('')}
          title={`Limpiar filtro ${etiqueta.toLowerCase()}`}
          style={{ padding: '0 6px', height: '32px' }}
        >
          <i className="bi bi-x" style={{ fontSize: '0.9rem' }}></i>
        </button>
      )}
    </div>
  </div>
)

/** El botón que limpia todos los filtros de una. Va al final de la barra. */
export const BotonLimpiar = ({ onClick }) => (
  <button
    className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
    onClick={onClick}
    style={{ width: '32px', height: '32px', padding: 0 }}
    title="Limpiar todos los filtros"
  >
    <i className="bi bi-x-lg" style={{ fontSize: '0.8rem' }}></i>
  </button>
)

/** El switch de agrupar pedidos múltiples, que va en la línea del título. */
export const SwitchAgrupar = ({ id, valor, onChange }) => (
  <div className="form-check form-switch mb-0 ms-3">
    <input
      className="form-check-input"
      type="checkbox"
      role="switch"
      id={id}
      checked={valor}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: 36, height: 20, cursor: 'pointer' }}
    />
    <label
      className="form-check-label ms-1 fw-bold text-dark"
      htmlFor={id}
      style={{ fontSize: '0.78rem', cursor: 'pointer', userSelect: 'none' }}
    >
      Agrupar pedidos múltiples
    </label>
  </div>
)

/** Buscador de una sola caja, el de las pantallas de altas. */
export const Buscador = ({ valor, onChange, placeholder }) => (
  <div className="input-group input-group-sm">
    <span
      className="input-group-text bg-light border-end-0 text-muted"
      style={{ padding: '3px 9px', height: '32px' }}
    >
      <i className="bi bi-search" style={{ fontSize: '0.8rem' }}></i>
    </span>
    <Form.Control
      type="text"
      placeholder={placeholder}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`border-start-0 ${valor ? 'fw-bold filtro-activo' : ''}`}
      style={{
        fontSize: '0.82rem',
        height: '32px',
        padding: '3px 8px 3px 10px',
        color: valor ? '#dc2626' : '#1e293b',
        fontWeight: valor ? '700' : 'normal',
      }}
    />
    {valor && (
      <button
        className="btn btn-outline-secondary border-start-0 d-flex align-items-center justify-content-center"
        type="button"
        onClick={() => onChange('')}
        title="Limpiar la búsqueda"
        style={{ padding: '0 7px', height: '32px' }}
      >
        <i className="bi bi-x" style={{ fontSize: '0.9rem' }}></i>
      </button>
    )}
  </div>
)
