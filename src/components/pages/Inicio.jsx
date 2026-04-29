import { useNavigate } from "react-router-dom";

const secciones = [
  { titulo: "Camionetas", ruta: "/camionetas/resumen", bg: "#0d47a1", icono: "bi bi-truck-front-fill" },
  { titulo: "Tractores", ruta: "/tractores", bg: "#1b5e20", icono: "bi bi-truck-flatbed" },
  { titulo: "Reparaciones San Pablo", ruta: "/reparaciones/sanpablo", bg: "#e65100", icono: "bi bi-tools" },
  { titulo: "Reparaciones Berdina", ruta: "/reparaciones/berdina", bg: "#b71c1c", icono: "bi bi-wrench-adjustable-circle-fill" },
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
          <i className={s.icono} style={{ fontSize: "4rem" }}></i>
          <h1 className="display-5 fw-bold text-center mt-3 px-4">{s.titulo}</h1>
        </div>
      ))}
      </div>
    </div>
  );
}

export default Inicio;
