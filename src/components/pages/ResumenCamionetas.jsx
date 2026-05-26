import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "react-bootstrap";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MES_CAMPO = ["enero", null, "marzo", null, "mayo", null, "julio", null, "septiembre", null, "noviembre", null];
const INTERVAL_KM = 10000;
const INICIO_ANIO = 2026;
const INICIO_MES  = 5;

function ResumenCamionetas() {
  const navigate = useNavigate();
  const location = useLocation();
  const [anio, setAnio] = useState(() => Number(localStorage.getItem("tablero_anio")) || new Date().getFullYear());
  const [dropAnio, setDropAnio] = useState(false);
  const dropAnioRef = useRef(null);
  const aniosOpciones = Array.from({ length: 10 }, (_, i) => 2026 + i);

  const [programas, setProgramas] = useState([]);
  const [camionetas, setCamionetas] = useState([]);
  const [totalCamionetas, setTotalCamionetas] = useState(0);
  const [kmResumen, setKmResumen] = useState({});
  const [serviciosAtrasados, setServiciosAtrasados] = useState(null);
  const [unidadesParadas, setUnidadesParadas] = useState(null);
  const [tareasPendientes, setTareasPendientes] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (dropAnioRef.current && !dropAnioRef.current.contains(e.target)) setDropAnio(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setProgramas([]);
    setKmResumen({});
    setServiciosAtrasados(null);
    setUnidadesParadas(null);
    setTareasPendientes(null);
    fetch("/api/camionetas").then((r) => r.json()).then((d) => { setCamionetas(d); setTotalCamionetas(d.length); }).catch(() => {});
    Promise.all([
      fetch("/api/services/ultimos").then((r) => r.json()).catch(() => []),
      fetch("/api/kilometros/ultimos").then((r) => r.json()).catch(() => []),
    ]).then(([ultimos, ultimosKm]) => {
      const count = ultimosKm.filter((km) => {
        const camId = (km.camioneta?._id ?? km.camioneta)?.toString();
        const srv = ultimos.find((u) => {
          const srvId = (u.camioneta?._id ?? u.camioneta)?.toString();
          return srvId === camId;
        });
        if (km.kms == null || srv?.kms == null) return false;
        return km.kms - srv.kms >= INTERVAL_KM;
      }).length;
      setServiciosAtrasados(count);
    }).catch(() => setServiciosAtrasados(0));
    fetch("/api/paradas/abiertas/count").then((r) => r.json()).then((d) => setUnidadesParadas(d.count)).catch(() => setUnidadesParadas(0));
    fetch("/api/trabajos-camioneta/pendientes/ids").then((r) => r.json()).then((ids) => setTareasPendientes(ids.length)).catch(() => setTareasPendientes(0));
    fetch(`/api/programa-checklist/${anio}`).then((r) => r.json()).then(setProgramas).catch(() => setProgramas([]));
    fetch("/api/kilometros")
      .then((r) => r.json())
      .then((kms) => {
        const res = {};
        kms.forEach((km) => {
          let mesReg, anioReg;
          if (km.mes != null && km.anio != null) {
            mesReg = km.mes; anioReg = km.anio;
          } else {
            const fecha = new Date(km.fecha);
            mesReg = fecha.getUTCMonth() + 1; anioReg = fecha.getUTCFullYear();
          }
          if (anioReg !== anio) return;
          const id = (km.camioneta?._id ?? km.camioneta)?.toString();
          if (!res[mesReg]) res[mesReg] = new Set();
          res[mesReg].add(id);
        });
        const resumen = {};
        Object.keys(res).forEach((m) => { resumen[m] = Array.from(res[m]); });
        setKmResumen(resumen);
      })
      .catch(() => setKmResumen({}));
  }, [anio, location.key]);

  const esAntesDeProgramar = (anioEval, mesEval) =>
    anioEval < INICIO_ANIO || (anioEval === INICIO_ANIO && mesEval < INICIO_MES);

  const getKmSinRelevar = (mesIndex) => {
    if (camionetas.length === 0) return null;
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const mesNumero = mesIndex + 1;
    if (anio > anioActual) return null;
    if (anio === anioActual && mesNumero > mesActual) return null;
    if (esAntesDeProgramar(anio, mesNumero)) return null;
    // Cruzar contra camionetas activas para no contar registros de camionetas eliminadas
    const idsConRegistro = new Set(kmResumen[mesNumero] ?? []);
    const conRegistroActivas = camionetas.filter((c) => idsConRegistro.has(c._id?.toString())).length;
    return camionetas.length - conRegistroActivas;
  };

  const getCheckListInfo = (mesIndex) => {
    const campo = MES_CAMPO[mesIndex];
    if (!campo || camionetas.length === 0) return null;
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const mesNumero = mesIndex + 1;
    if (anio > anioActual) return null;
    if (anio === anioActual && mesNumero > mesActual) return null;
    if (esAntesDeProgramar(anio, mesNumero)) return null;
    // Cruzar contra camionetas activas para no contar docs "fantasma" de camionetas eliminadas
    const realizados = camionetas.filter((c) => {
      const prog = programas.find((p) => (p.camioneta?._id ?? p.camioneta)?.toString() === c._id?.toString());
      return prog?.[campo]?.estado === "realizado";
    }).length;
    const pendientes = camionetas.length - realizados;
    return { pendientes };
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "0.8rem 1.5rem 0" }}>
        <h3 className="fw-bold mb-0 w-100 text-center">Tablero de Control Camionetas</h3>
        <div className="d-flex gap-2" style={{ position: "absolute", right: "1.5rem" }}>
          <Button onClick={() => navigate(-1)} style={{ backgroundColor: "#fff", border: "2px solid #000", color: "#000", fontSize: "0.85rem", padding: "3px 10px" }}>
            <i className="bi bi-arrow-left me-2"></i>Volver
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#fff", border: "2px solid #000", color: "#000", fontSize: "0.85rem", padding: "3px 10px" }}>
            <i className="bi bi-house-fill me-2"></i>General
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0.4rem 0.8rem", overflow: "hidden" }}>
        {/* Selector de año */}
        <div className="d-flex justify-content-start align-items-center" style={{ marginBottom: "0.8rem", width: "80%" }}>
          <div ref={dropAnioRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropAnio((v) => !v)}
              style={{ width: "90px", textAlign: "center", fontWeight: "700", fontSize: "1.3rem", background: "rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.3)", borderRadius: "6px", color: "#000", padding: "2px 8px", cursor: "pointer" }}
            >
              {anio}
            </button>
            {dropAnio && (
              <div style={{ position: "absolute", top: "110%", left: 0, backgroundColor: "#fff", border: "2px solid #000", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.25)", zIndex: 200, overflow: "hidden", minWidth: "90px" }}>
                {aniosOpciones.map((a) => (
                  <div
                    key={a}
                    onClick={() => { setAnio(a); localStorage.setItem("tablero_anio", a); setDropAnio(false); }}
                    style={{ padding: "6px 14px", textAlign: "center", cursor: "pointer", fontWeight: a === anio ? "700" : "400", backgroundColor: a === anio ? "#e3eaf7" : "transparent", color: "#000", fontSize: "0.9rem" }}
                    onMouseEnter={(e) => { if (a !== anio) e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = a === anio ? "#e3eaf7" : "transparent"; }}
                  >
                    {a}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid de meses + tarjeta 13 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gridAutoRows: "1fr", gap: "0.3rem", flex: 1, maxHeight: "70vh", width: "80%" }}>
          {MESES.map((mes, i) => {
            const info = getCheckListInfo(i);
            const esImpar = (i + 1) % 2 !== 0;
            const clBg = info === null ? "#4a6fa5" : info.pendientes === 0 ? "#52735a" : "#8b4a4a";
            const clBgHover = info === null ? "#5a7fa8" : info.pendientes === 0 ? "#627d6a" : "#9e5a5a";
            return (
              <div key={mes} style={{ gridColumn: "span 2", backgroundColor: "#4a6fa5", borderRadius: "8px", boxShadow: "2px 2px 6px rgba(0,0,0,0.3)", border: "2px solid #000", display: "flex", overflow: "hidden", userSelect: "none" }}>
                {/* Izquierda: mes */}
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{ flex: 1, fontWeight: "600", fontSize: "1.1rem", cursor: "pointer", transition: "background-color 0.15s", padding: "4px", color: "#000" }}
                  onClick={() => navigate("/camionetas", { state: { mes: i + 1, anio } })}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {mes}
                </div>
                {/* Separador vertical */}
                <div style={{ width: "1px", backgroundColor: "rgba(0,0,0,0.2)" }} />
                {/* Derecha: check list (solo meses impares) + service */}
                <div style={{ display: "flex", flexDirection: "column", width: "52%" }}>
                  {esImpar && (
                    <div
                      className="d-flex flex-column align-items-center justify-content-center text-white"
                      style={{ flex: 1, fontSize: "1rem", fontWeight: "600", cursor: "pointer", transition: "background-color 0.15s", borderBottom: "1px solid #000", backgroundColor: clBg }}
                      onClick={() => navigate("/camionetas/checklist", { state: { mes: i + 1, anio } })}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = clBgHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = clBg)}
                    >
                      <span>Check List</span>
                      {info !== null && info.pendientes > 0 && (
                        <span style={{ fontSize: "0.75rem", marginTop: "1px" }}>{info.pendientes} pendiente{info.pendientes > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  )}
                  {(() => {
                    const kmSinRelevar = getKmSinRelevar(i);
                    const svBg = kmSinRelevar === null ? "#4a6fa5" : kmSinRelevar === 0 ? "#52735a" : "#8b4a4a";
                    const svBgHover = kmSinRelevar === null ? "#5a7fa8" : kmSinRelevar === 0 ? "#627d6a" : "#9e5a5a";
                    return (
                      <div
                        className="d-flex flex-column align-items-center justify-content-center text-white"
                        style={{ flex: 1, fontSize: "1rem", fontWeight: "600", cursor: "pointer", transition: "background-color 0.15s", backgroundColor: svBg }}
                        onClick={() => navigate("/camionetas/services/kilometros", { state: { mes: i + 1, anio } })}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = svBgHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = svBg)}
                      >
                        <span>Kilometraje</span>
                        {kmSinRelevar !== null && kmSinRelevar > 0 && (
                          <span style={{ fontSize: "0.75rem", marginTop: "1px", opacity: 0.9 }}>
                            {kmSinRelevar} sin relevar
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {/* Tarjeta 13: Services Atrasados */}
          {(() => {
            const bg = serviciosAtrasados === null ? "#4a6fa5" : serviciosAtrasados === 0 ? "#52735a" : "#8b4a4a";
            const bgHover = serviciosAtrasados === null ? "#5a7fa8" : serviciosAtrasados === 0 ? "#627d6a" : "#9e5a5a";
            return (
              <div
                className="d-flex flex-column align-items-center justify-content-center text-white"
                style={{ gridColumn: "2 / span 2", backgroundColor: bg, borderRadius: "8px", boxShadow: "2px 2px 6px rgba(0,0,0,0.3)", border: "2px solid #000", cursor: "pointer", transition: "background-color 0.15s", userSelect: "none", padding: "1rem" }}
                onClick={() => navigate("/camionetas/services/ultimo-service")}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bg)}
              >
                <span style={{ fontSize: "1.2rem", fontWeight: "600" }}>Services Atrasados</span>
                {serviciosAtrasados !== null && (
                  <span style={{ fontSize: "2rem", fontWeight: "700", marginTop: "4px" }}>{serviciosAtrasados}</span>
                )}
              </div>
            );
          })()}

          {/* Tarjeta 14: Unidades con Tareas Pendientes */}
          {(() => {
            const bg = tareasPendientes === null ? "#4a6fa5" : tareasPendientes === 0 ? "#52735a" : "#8b4a4a";
            const bgHover = tareasPendientes === null ? "#5a7fa8" : tareasPendientes === 0 ? "#627d6a" : "#9e5a5a";
            return (
              <div
                className="d-flex flex-column align-items-center justify-content-center text-white"
                style={{ gridColumn: "4 / span 2", backgroundColor: bg, borderRadius: "8px", boxShadow: "2px 2px 6px rgba(0,0,0,0.3)", border: "2px solid #000", cursor: "pointer", transition: "background-color 0.15s", userSelect: "none", padding: "1rem" }}
                onClick={() => navigate("/camionetas/services/reparaciones")}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bg)}
              >
                <span style={{ fontSize: "1.2rem", fontWeight: "600", textAlign: "center" }}>Unidades con tareas pendientes</span>
                {tareasPendientes !== null && (
                  <span style={{ fontSize: "2rem", fontWeight: "700", marginTop: "4px" }}>{tareasPendientes}</span>
                )}
              </div>
            );
          })()}

          {/* Tarjeta 15: Unidades Paradas */}
          {(() => {
            const bg = unidadesParadas === null ? "#4a6fa5" : unidadesParadas === 0 ? "#52735a" : "#8b4a4a";
            const bgHover = unidadesParadas === null ? "#5a7fa8" : unidadesParadas === 0 ? "#627d6a" : "#9e5a5a";
            return (
              <div
                className="d-flex flex-column align-items-center justify-content-center text-white"
                style={{ gridColumn: "6 / span 2", backgroundColor: bg, borderRadius: "8px", boxShadow: "2px 2px 6px rgba(0,0,0,0.3)", border: "2px solid #000", cursor: "pointer", transition: "background-color 0.15s", userSelect: "none", padding: "1rem" }}
                onClick={() => navigate("/camionetas/checklist")}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bg)}
              >
                <span style={{ fontSize: "1.2rem", fontWeight: "600" }}>Unidades Paradas</span>
                {unidadesParadas !== null && (
                  <span style={{ fontSize: "2rem", fontWeight: "700", marginTop: "4px" }}>{unidadesParadas}</span>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default ResumenCamionetas;

