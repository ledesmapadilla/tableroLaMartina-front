const AZUL = "#1d4ed8";
const ROJO = "#dc2626";

/**
 * El círculo de sí / no, como el de "Camioneta parada" del check list: azul
 * con la tilde si es sí, rojo con la cruz si es no. Lo usan los ingresos de
 * San Pablo (Revisada, Plan de mantenimiento) y los chequeos de Manitous.
 */
export default function CirculoSiNo({ marcada, onClick, titulo, deshabilitado = false, tamano = 20 }) {
  const color = marcada ? AZUL : ROJO;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      title={`${titulo}: ${marcada ? "sí" : "no"}`}
      className="d-inline-flex align-items-center justify-content-center p-0"
      style={{
        width: `${tamano}px`,
        height: `${tamano}px`,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        backgroundColor: color,
        color: "#fff",
        cursor: deshabilitado ? "default" : "pointer",
        opacity: deshabilitado ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <i
        className={`bi ${marcada ? "bi-check-lg" : "bi-x-lg"}`}
        style={{ fontSize: `${tamano * (marcada ? 0.65 : 0.5)}px`, lineHeight: 1 }}
      ></i>
    </button>
  );
}
