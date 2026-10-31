import TractorIcon from "./TractorIcon";

// El ícono blanco de los encabezados de una familia (utils/familiasReparacion.js).
export default function IconoFamilia({ familia, size }) {
  if (familia.icono) return <i className={familia.icono} style={{ color: "#fff", fontSize: size, lineHeight: 1 }}></i>;
  return <TractorIcon size={size} color="#fff" />;
}
