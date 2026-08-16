import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function ServicesReparaciones() {
  const navigate = useNavigate();
  const [camionetas, setCamionetas] = useState([]);
  const [conTareaPendiente, setConTareaPendiente] = useState(new Set());
  const [paradasIds, setParadasIds] = useState(new Set());
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/camionetas").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/trabajos-camioneta/pendientes/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/paradas/abiertas/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([cams, pendientesIds, abIds]) => {
      setCamionetas(Array.isArray(cams) ? cams : []);
      setConTareaPendiente(new Set(Array.isArray(pendientesIds) ? pendientesIds : []));
      setParadasIds(new Set(Array.isArray(abIds) ? abIds : []));
    });
  }, []);

  const totalCams = camionetas.length;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8f9fa",
        height: "100%",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Barra de Cabecera Institucional */}
      <div
        className="d-flex align-items-center justify-content-between px-4 py-2 border-bottom shadow-sm flex-shrink-0"
        style={{ backgroundColor: "#1e293b", color: "#fff", height: "54px" }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center me-1"
            style={{
              width: "34px",
              height: "34px",
              backgroundColor: "#f59e0b",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
            }}
          >
            <i className="bi bi-tools"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Reparaciones de Camionetas</span>
            <span className="text-light opacity-75 small">- {totalCams} Unidades</span>
          </div>
        </div>

        {/* Botones de Navegación */}
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-arrow-left"></i>
            <span>Volver</span>
          </button>
          <button
            onClick={() => navigate("/camionetas")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-car-front-fill me-1"></i>
            <span>Camionetas</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="btn btn-sm btn-light text-dark d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>General</span>
          </button>
        </div>
      </div>

      {/* Botón Resumen General Arriba a la Izquierda con Formato del Proyecto */}
      <div className="px-4 pt-3 pb-1 d-flex justify-content-start flex-shrink-0">
        <button
          onClick={() => navigate("/camionetas/services/reparaciones/resumen")}
          className="btn d-inline-flex align-items-center gap-2 rounded-3 px-3 py-1.5 text-white"
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
            fontSize: "0.82rem",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 18px rgba(0, 0, 0, 0.3), 0 0 12px rgba(16, 185, 129, 0.35)";
            e.currentTarget.style.borderColor = "#10b981";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #1e293b 0%, #334155 100%)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.18)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
          }}
        >
          <div
            className="rounded-2 d-flex align-items-center justify-content-center"
            style={{
              width: "24px",
              height: "24px",
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34d399",
              fontSize: "0.85rem",
            }}
          >
            <i className="bi bi-table"></i>
          </div>
          <span>Resumen General</span>
        </button>
      </div>

      {/* Grilla Limpia y Minimalista de Camionetas */}
      <div
        className="flex-grow-1 p-3 d-flex align-items-center justify-content-center"
        style={{
          overflowY: "auto",
        }}
      >
        <div
          className="d-flex flex-wrap justify-content-center align-items-center"
          style={{
            gap: "1.25rem",
            maxWidth: "1350px",
            width: "100%",
          }}
        >
          {camionetas.map((c) => {
            const id = c._id?.toString();
            const tieneTarea = conTareaPendiente.has(id);
            const estaParada = paradasIds.has(id);
            const isHovered = hoveredId === id;

            return (
              <div
                key={c._id}
                className="card-camioneta-item d-flex flex-column align-items-center justify-content-center p-3 text-center"
                style={{
                  position: "relative",
                  background: isHovered
                    ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
                    : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                  borderRadius: "16px",
                  width: "190px",
                  height: "115px",
                  boxShadow: isHovered
                    ? "0 14px 28px -6px rgba(0, 0, 0, 0.4), 0 0 16px rgba(59, 130, 246, 0.25)"
                    : "0 6px 16px -2px rgba(0, 0, 0, 0.22)",
                  border: isHovered
                    ? "1px solid #3b82f6"
                    : "1px solid rgba(255, 255, 255, 0.12)",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-4px) scale(1.03)" : "translateY(0) scale(1)",
                  color: "#ffffff",
                  userSelect: "none",
                }}
                onClick={() =>
                  navigate(`/camionetas/services/reparaciones/${c._id}`, {
                    state: { patente: c.patente, marca: c.marca },
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  navigate(`/camionetas/services/reparaciones/${c._id}`, {
                    state: { patente: c.patente, marca: c.marca },
                  })
                }
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Triángulo de Alerta: Rojo si está parada, Amarillo si tiene tareas pendientes o en proceso */}
                {estaParada ? (
                  <i
                    className="bi bi-exclamation-triangle-fill text-danger"
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "10px",
                      color: "#ef4444",
                      fontSize: "1.2rem",
                      filter: "drop-shadow(0 2px 5px rgba(239, 68, 68, 0.5))",
                    }}
                    title="Unidad Parada"
                  />
                ) : tieneTarea ? (
                  <i
                    className="bi bi-exclamation-triangle-fill text-warning"
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "10px",
                      color: "#f59e0b",
                      fontSize: "1.2rem",
                      filter: "drop-shadow(0 2px 5px rgba(245, 158, 11, 0.5))",
                    }}
                    title="Tareas Pendientes / En proceso"
                  />
                ) : null}

                {/* Patente */}
                <div
                  className="fw-bold tracking-tight text-white mb-0.5"
                  style={{
                    fontSize: "1.45rem",
                    letterSpacing: "1.2px",
                  }}
                >
                  {c.patente}
                </div>

                {/* Marca / Modelo */}
                <div
                  className="small text-light opacity-75 text-truncate w-100 px-2"
                  title={c.marca}
                  style={{ fontSize: "0.83rem" }}
                >
                  {c.marca || "Camioneta"}
                </div>
              </div>
            );
          })}

          {camionetas.length === 0 && (
            <div className="text-center py-5 w-100">
              <i className="bi bi-inbox fs-1 text-muted"></i>
              <p className="text-muted mt-2">Sin camionetas registradas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServicesReparaciones;
