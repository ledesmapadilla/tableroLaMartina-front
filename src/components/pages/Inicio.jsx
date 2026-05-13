import { useNavigate } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";

const secciones = [
  { titulo: "Camionetas",            ruta: "/camionetas",           bg: "#4a6fa5", icono: "bi bi-truck-front-fill" },
  { titulo: "Tractores",             ruta: "/tractores",            bg: "#52735a", icono: null },
  { titulo: "Reparaciones San Pablo",ruta: "/reparaciones/sanpablo",bg: "#7a5038", icono: "bi bi-tools" },
  { titulo: "Reparaciones Berdina",  ruta: "/reparaciones/berdina", bg: "#7a3535", icono: "bi bi-wrench-adjustable-circle-fill" },
];

function Inicio() {
  const navigate = useNavigate();

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "2rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {secciones.map((s) => (
          <div
            key={s.ruta}
            className="seccion-inicio d-flex flex-column align-items-center justify-content-center text-white"
            style={{ backgroundColor: s.bg, borderRadius: "16px", boxShadow: "10px 10px 40px rgba(0,0,0,0.6)", cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease", width: "500px", height: "320px" }}
            onClick={() => navigate(s.ruta)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(s.ruta)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "14px 14px 50px rgba(0,0,0,0.7)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "6px 6px 20px rgba(0,0,0,0.35)"; }}
          >
            {s.icono
              ? <i className={s.icono} style={{ fontSize: "4rem" }}></i>
              : <TractorIcon size="4rem" color="#fff" />
            }
            <h1 className="display-5 fw-bold text-center mt-3 px-4">{s.titulo}</h1>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Inicio;
