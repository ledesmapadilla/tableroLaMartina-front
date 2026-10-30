import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { CARROS_REPARACION } from "../../utils/carrosReparacion";
import NavbarSanPablo from "../shared/NavbarSanPablo";

/**
 * Reparación carros › General (29/10/2026): por ahora, la fecha límite de la
 * reparación de los carros porta escaleras, que se ve en la tarjeta General.
 * Es la fecha "carros" de fecha-limite-escaleras, una por cosecha. También la
 * General de los carros porta bines y porta bolsones (`tipo`, 29/10/2026),
 * cada una con su fecha.
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

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "16px 16px 0" }}>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#14532d" }}>
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
    </div>
  );
}
