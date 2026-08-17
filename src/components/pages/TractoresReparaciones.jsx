import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TractorIcon from "../shared/TractorIcon";

// Triángulo rojo chillón con signo de exclamación blanco y opacidad oscura de contraste
function IconoAlertaTractor({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        filter: "drop-shadow(0 0 5px rgba(0,0,0,0.95)) drop-shadow(0 0 8px rgba(255,0,34,0.85))",
        overflow: "visible",
        display: "inline-block",
      }}
    >
      <path
        d="M12 2.2L1.2 21.2h21.6L12 2.2z"
        fill="#ff0022"
        stroke="#ff0022"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="11" y="8.5" width="2" height="6.5" rx="1" fill="#ffffff" />
      <circle cx="12" cy="17.8" r="1.25" fill="#ffffff" />
    </svg>
  );
}

const gruposInfo = [
  {
    numero: 1,
    label: "Grupo 1",
    supervisor: "Jorge Rosas",
    bg: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
    hoverBg: "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)",
    accent: "#60a5fa",
  },
  {
    numero: 2,
    label: "Grupo 2",
    supervisor: "Guillermo Bustos",
    bg: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
    hoverBg: "linear-gradient(135deg, #022c22 0%, #065f46 100%)",
    accent: "#34d399",
  },
  {
    numero: 3,
    label: "Grupo 3",
    supervisor: "Carlos Chumiento",
    bg: "linear-gradient(135deg, #854d0e 0%, #a16207 100%)",
    hoverBg: "linear-gradient(135deg, #451a03 0%, #854d0e 100%)",
    accent: "#facc15",
  },
  {
    numero: 4,
    label: "Grupo 4",
    supervisor: "brandan alejandro",
    bg: "linear-gradient(135deg, #581c87 0%, #6b21a8 100%)",
    hoverBg: "linear-gradient(135deg, #3b0764 0%, #581c87 100%)",
    accent: "#c084fc",
  },
  {
    numero: 5,
    label: "Grupo 5",
    supervisor: "Elio Rojas",
    bg: "linear-gradient(135deg, #9a3412 0%, #c2410c 100%)",
    hoverBg: "linear-gradient(135deg, #431407 0%, #9a3412 100%)",
    accent: "#fb923c",
  },
  {
    numero: 6,
    label: "Berdina",
    supervisor: "Kevin",
    bg: "linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)",
    hoverBg: "linear-gradient(135deg, #450a0a 0%, #991b1b 100%)",
    accent: "#f87171",
  },
  {
    numero: 7,
    label: "San Pablo",
    supervisor: "Victor",
    bg: "linear-gradient(135deg, #3f6212 0%, #4d7c0f 100%)",
    hoverBg: "linear-gradient(135deg, #1a2e05 0%, #3f6212 100%)",
    accent: "#a3e635",
  },
];

function TractoresReparaciones() {
  const navigate = useNavigate();
  const [tractores, setTractores] = useState([]);
  const [paradosIds, setParadosIds] = useState(new Set());
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/tractores").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/trabajos-tractor/parados/ids").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([tracsData, stopIdsData]) => {
      if (Array.isArray(tracsData)) {
        setTractores(tracsData);
      }
      if (Array.isArray(stopIdsData)) {
        setParadosIds(new Set(stopIdsData));
      }
    });
  }, []);

  const renderCCsPorGrupo = (grupoNum) => {
    const listForGrupo = tractores.filter(
      (t) => Number(t.gruppo ?? 6) === Number(grupoNum)
    );

    if (listForGrupo.length === 0) return "Sin CCs";

    const mapCC = new Map();
    listForGrupo.forEach((t) => {
      const clean = String(t.cc || "").replace(/^cc\s*/i, "").trim();
      if (!clean) return;
      const isParado = paradosIds.has(t._id?.toString()) || paradosIds.has(t.cc?.toString());
      if (!mapCC.has(clean)) {
        mapCC.set(clean, isParado);
      } else if (isParado) {
        mapCC.set(clean, true);
      }
    });

    const sortedCleanCCs = Array.from(mapCC.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    if (sortedCleanCCs.length === 0) return "Sin CCs";

    return sortedCleanCCs.map((ccStr, idx) => {
      const estaParado = mapCC.get(ccStr);
      return (
        <span key={ccStr}>
          <span
            style={{
              color: estaParado ? "#ff1a1a" : "#ffffff",
              fontWeight: estaParado ? "800" : "600",
              fontSize: estaParado ? "0.82rem" : "0.74rem",
              textShadow: estaParado ? "0 0 4px #000, 0 0 8px rgba(255, 0, 0, 0.95)" : "none",
            }}
          >
            {ccStr}
          </span>
          {idx < sortedCleanCCs.length - 1 ? ", " : ""}
        </span>
      );
    });
  };

  const getTractoresParadosGrupoCount = (grupoNum) => {
    return tractores.filter(
      (t) => Number(t.gruppo ?? 6) === Number(grupoNum) && paradosIds.has(t._id?.toString())
    ).length;
  };

  const totalTractores = tractores.length;

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
              backgroundColor: "#4338ca",
              color: "#fff",
              fontSize: "1.15rem",
              boxShadow: "0 2px 8px rgba(67, 56, 202, 0.3)",
            }}
          >
            <i className="bi bi-tools"></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fs-6">Tractores - Reparaciones</span>
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
            onClick={() => navigate("/tractores/preventivo")}
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1.5 rounded-3 px-3 py-1"
            style={{ fontSize: "0.82rem" }}
          >
            <i className="bi bi-shield-check"></i>
            <span>Preventivo</span>
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

      {/* Botón Resumen General Arriba a la Izquierda con Formato del Proyecto */}
      <div className="px-4 pt-3 pb-1 d-flex justify-content-start flex-shrink-0">
        <button
          onClick={() => navigate("/tractores/services/reparaciones/resumen")}
          className="btn d-inline-flex align-items-center gap-2 rounded-3 px-3 py-1.5 text-white"
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
            fontSize: "0.82rem",
            fontWeight: "500",
            transition: "all 0.15s ease",
          }}
        >
          <i className="bi bi-file-earmark-spreadsheet-fill" style={{ color: "#38bdf8", fontSize: "0.95rem" }}></i>
          <span>Resumen General</span>
        </button>
      </div>

      {/* Grid Central de Grupos y Resumen Reparaciones */}
      <div
        className="flex-grow-1 p-4 d-flex align-items-center justify-content-center"
        style={{
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 235px)",
            gap: "1.5rem",
            maxWidth: "1020px",
            width: "100%",
            justifyContent: "center",
          }}
        >
          {gruposInfo.map((g) => {
            const ccs = renderCCsPorGrupo(g.numero);
            const cantParados = getTractoresParadosGrupoCount(g.numero);
            const isHovered = hoveredCard === g.numero;

            return (
              <div
                key={g.numero}
                className="d-flex flex-column align-items-center justify-content-center text-white"
                style={{
                  position: "relative",
                  background: isHovered ? g.hoverBg : g.bg,
                  borderRadius: "18px",
                  width: "235px",
                  minHeight: "180px",
                  padding: "1.1rem 1rem",
                  boxShadow: isHovered
                    ? `0 14px 28px -6px rgba(0, 0, 0, 0.4), 0 0 16px ${g.accent}40`
                    : "0 6px 18px -2px rgba(0, 0, 0, 0.25)",
                  border: isHovered
                    ? `1px solid ${g.accent}`
                    : "1px solid rgba(255, 255, 255, 0.14)",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-4px) scale(1.03)" : "translateY(0) scale(1)",
                  userSelect: "none",
                }}
                onClick={() => navigate(`/tractores/grupo/${g.numero}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/tractores/grupo/${g.numero}`)}
                onMouseEnter={() => setHoveredCard(g.numero)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Alerta si tiene tractores parados (Triángulo rojo chillón con exclamación blanca y halo de opacidad sin borde) */}
                {cantParados > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      display: "flex",
                      gap: "5px",
                      alignItems: "center",
                      zIndex: 10,
                    }}
                    title={`${cantParados} ${cantParados === 1 ? "Tractor parado" : "Tractores parados"}`}
                  >
                    {Array.from({ length: cantParados }).map((_, idx) => (
                      <IconoAlertaTractor key={idx} size={22} />
                    ))}
                  </div>
                )}

                <div
                  className="rounded-3 d-flex align-items-center justify-content-center mb-1"
                  style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                  }}
                >
                  <TractorIcon size="1.8rem" color="#fff" />
                </div>

                <h5 className="fw-bold text-center mt-1 mb-0" style={{ fontSize: "1.1rem", letterSpacing: "0.2px" }}>
                  {g.label}
                </h5>

                <small
                  className="text-center mt-0.5 px-2 text-light opacity-75"
                  style={{ fontSize: "0.78rem" }}
                >
                  {g.supervisor}
                </small>

                <div
                  className="text-center px-2 mt-2"
                  style={{
                    color: "#fff",
                    fontSize: "0.74rem",
                    fontWeight: "600",
                    lineHeight: "1.3",
                    wordBreak: "break-word",
                    width: "100%",
                  }}
                >
                  {ccs}
                </div>
              </div>
            );
          })}

          {/* Tarjeta Resumen Reparaciones General */}
          <div
            className="d-flex flex-column align-items-center justify-content-center text-white"
            style={{
              position: "relative",
              background:
                hoveredCard === "resumen"
                  ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
                  : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
              borderRadius: "18px",
              width: "235px",
              minHeight: "180px",
              padding: "1.1rem 1rem",
              boxShadow:
                hoveredCard === "resumen"
                  ? "0 14px 28px -6px rgba(0, 0, 0, 0.4), 0 0 16px rgba(56, 189, 248, 0.25)"
                  : "0 6px 18px -2px rgba(0, 0, 0, 0.25)",
              border:
                hoveredCard === "resumen"
                  ? "1px solid #38bdf8"
                  : "1px solid rgba(255, 255, 255, 0.14)",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              transform:
                hoveredCard === "resumen" ? "translateY(-4px) scale(1.03)" : "translateY(0) scale(1)",
              userSelect: "none",
            }}
            onClick={() => navigate("/tractores/services/reparaciones/resumen")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" && navigate("/tractores/services/reparaciones/resumen")
            }
            onMouseEnter={() => setHoveredCard("resumen")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center mb-2"
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                color: "#38bdf8",
              }}
            >
              <i className="bi bi-file-earmark-spreadsheet-fill" style={{ fontSize: "1.8rem" }}></i>
            </div>
            <h5 className="fw-semibold text-center mt-1 mb-1" style={{ fontSize: "1.05rem" }}>
              Resumen Reparaciones
            </h5>
            <small className="text-light opacity-75 text-center" style={{ fontSize: "0.75rem" }}>
              Planilla general de maquinaria
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TractoresReparaciones;
