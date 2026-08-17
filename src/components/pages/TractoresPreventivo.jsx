import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";

function TractoresPreventivo() {
  const navigate = useNavigate();
  const [totalTractores, setTotalTractores] = useState(0);

  useEffect(() => {
    fetch("/api/tractores")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTotalTractores(Array.isArray(d) ? d.length : 0))
      .catch(() => setTotalTractores(0));
  }, []);

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
      {/* Barra de Cabecera */}
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
              backgroundColor: "#059669",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
            }}
          >
            <i className="bi bi-shield-check"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6 fw-semibold">Tractores — Mantenimiento Preventivo</span>
            {totalTractores > 0 && (
              <span className="text-light opacity-75 small">- {totalTractores} Unidades</span>
            )}
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
            onClick={() => navigate("/tractores/reparaciones")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-tools"></i>
            <span>Reparaciones</span>
          </button>
          <button
            onClick={() => navigate("/tractores")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <TractorIcon size="1.05rem" color="#fff" />
            <span>Tractores</span>
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

      {/* Contenedor Central Limpio */}
      <div
        className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-4"
        style={{ overflow: "auto" }}
      >
        {/* Espacio limpio para la nueva sección de preventivo de tractores */}
      </div>
    </div>
  );
}

export default TractoresPreventivo;
