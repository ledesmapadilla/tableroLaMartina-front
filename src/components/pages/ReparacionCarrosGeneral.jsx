import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { CARROS_REPARACION } from "../../utils/carrosReparacion";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";

// La tarjeta del presupuesto, abajo de los sistemas: como la de Manitous
// General, de la mitad de alto y el doble de ancho.
const tarjetaPresupuesto = {
  id: "presupuesto",
  titulo: "Presupuesto",
  icono: "bi bi-currency-dollar",
  ancho: 2,
  alto: 0.5,
  bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
  hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  accentColor: "#34d399",
};
// Las tarjetas de los sistemas, cian como las de Manitous General, y el
// mismo ancho de grilla que allá.
const cian = {
  bg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
  hoverBg: "linear-gradient(135deg, #083344 0%, #164e63 100%)",
  accentColor: "#22d3ee",
};
const ANCHO_GENERAL = "max(min(500px, calc((100vh - 200px) * 0.8)), 480px)";

/**
 * Reparación carros › General (29/10/2026): por ahora, la fecha límite de la
 * reparación de los carros porta escaleras, que se ve en la tarjeta General.
 * Es la fecha "carros" de fecha-limite-escaleras, una por cosecha. También la
 * General de los carros porta bines y porta bolsones (`tipo`, 29/10/2026),
 * cada una con su fecha.
 * Con `sistemas` en su config (20/11/2026, los colectivos), abajo de la
 * fecha van sus tarjetas y la del Presupuesto, de a 3 por fila y sin scroll.
 * No tienen página todavía: caen en el 404.
 */
export default function ReparacionCarrosGeneral({ tipo = "escaleras" }) {
  const config = CARROS_REPARACION[tipo];
  const { cosecha: param } = useParams();
  const cosecha = cosechaDeParam(param);
  // "AAAA-MM-DD" o "".
  const [fechaLimite, setFechaLimite] = useState("");
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  useEffect(() => {
    api
      .get(`/ingresos-sanpablo/fecha-limite-escaleras?cosecha=${cosecha}`)
      .then((r) => setFechaLimite(r[config.solapa] ? r[config.solapa].slice(0, 10) : ""))
      .catch(() => setFechaLimite(""));
  }, [cosecha, config.solapa]);

  // Se guarda al elegirla; vacía la borra.
  const guardarFechaLimite = async (valor) => {
    const anterior = fechaLimite;
    setFechaLimite(valor);
    try {
      await api.put("/ingresos-sanpablo/fecha-limite-escaleras", { cosecha, solapa: config.solapa, fecha: valor || null });
    } catch (error) {
      setFechaLimite(anterior);
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message, width: "300px" });
    }
  };

  const fechaInput = (
    <div className="d-flex align-items-center flex-shrink-0" style={{ gap: "10px" }}>
      <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#14532d", whiteSpace: "nowrap" }}>
        <i className="bi bi-calendar-event me-2"></i>
        Fecha límite
      </span>
      <input
        type="date"
        className="form-control form-control-sm"
        style={{ width: "auto" }}
        value={fechaLimite}
        onChange={(e) => guardarFechaLimite(e.target.value)}
        disabled={sinEditar}
        title={sinEditar ? "Sin permiso para editar" : "Para cuándo tienen que estar reparados los carros"}
      />
    </div>
  );

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
      <NavbarSanPablo
        titulo={config.tituloGeneral}
        sinSeccion
        cosecha={cosecha}
        icono={<i className="bi bi-grid-fill"></i>}
        volverA={`/reparaciones/sanpablo/${param}/${config.ruta}`}
      />

      {config.sistemas ? (
        // Como Manitous General: el encabezado con el nombre grande y la línea
        // de color (acá con la fecha límite a la derecha) y las tarjetas
        // cian, chicas, del tamaño de las de 4 por fila. Como allá (4 y 3), en
        // dos filas parejas (3 y 2) y el Presupuesto solo en la de abajo.
        <TarjetasSanPablo
          tarjetas={[
            ...config.sistemas.map((s, i) => ({ ...s, ...cian, nuevaFila: i === Math.ceil(config.sistemas.length / 2) })),
            { ...tarjetaPresupuesto, nuevaFila: true },
          ]}
          base={`/reparaciones/sanpablo/${param}/${config.ruta}/general`}
          porFila={4}
          maxWidth={ANCHO_GENERAL}
          chicas
          ajustadas
        >
          <div
            className="d-flex align-items-center justify-content-between gap-3 pb-3 mb-4"
            style={{ maxWidth: ANCHO_GENERAL, width: "100%", borderBottom: `3px solid ${config.colorTitulo}` }}
          >
            <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
              <div
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  background: config.colores.bg,
                  boxShadow: `0 6px 16px ${config.colorTitulo}59`,
                  flexShrink: 0,
                }}
              >
                <i className={config.colores.icono} style={{ fontSize: "2rem", color: "#fff" }}></i>
              </div>
              <div className="fw-bold" style={{ fontSize: "2rem", lineHeight: 1, color: config.colorTitulo, letterSpacing: "0.02em" }}>
                {config.titulo.toUpperCase()}
              </div>
            </div>
            {/* La fecha en columna (título arriba, fecha abajo): en una
                línea no entra al lado del nombre grande. */}
            <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ gap: "4px" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#14532d", whiteSpace: "nowrap" }}>
                <i className="bi bi-calendar-event me-1"></i>
                Fecha límite
              </span>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ width: "auto" }}
                value={fechaLimite}
                onChange={(e) => guardarFechaLimite(e.target.value)}
                disabled={sinEditar}
                title={sinEditar ? "Sin permiso para editar" : "Para cuándo tienen que estar reparados"}
              />
            </div>
          </div>
        </TarjetasSanPablo>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "16px 16px 0" }}>
          {fechaInput}
        </div>
      )}
    </div>
  );
}
