import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { CARROS_REPARACION } from "../../utils/carrosReparacion";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";

// Los tres carros juntos (28/10/2026), desde la tarjeta Carros de
// ReparacionesSanPablo. Porta escaleras va a la página de Escaleras (los
// carros se manejan desde ahí, 06/10/2026); porta bines y porta bolsones, a
// la de sus tarjetas por carro (29/10/2026). Las tres muestran su fecha límite.
const tarjetas = [
  {
    id: "carros-porta-bines",
    titulo: "Carros porta bines",
    bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    hoverBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    accentColor: "#818cf8",
    icono: "bi bi-box-seam-fill",
  },
  {
    id: "carros-porta-bolsones",
    titulo: "Carros porta bolsones",
    bg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)",
    hoverBg: "linear-gradient(135deg, #083344 0%, #164e63 100%)",
    accentColor: "#22d3ee",
    icono: "bi bi-bag-fill",
  },
  {
    id: "escaleras",
    titulo: "Carros porta escaleras",
    bg: "linear-gradient(135deg, #365314 0%, #4d7c0f 100%)",
    hoverBg: "linear-gradient(135deg, #1a2e05 0%, #365314 100%)",
    accentColor: "#a3e635",
    icono: "bi bi-bar-chart-steps",
  },
];

function CarrosSanPablo() {
  const { cosecha } = useParams();
  // La fecha límite de cada carro (29/10/2026), la que se carga en su General:
  // { carros, escaleras, bines, bolsones, carrosTotal }. carrosTotal es la de
  // los tres juntos, que se carga acá arriba y se ve en la tarjeta Carros.
  const [fechas, setFechas] = useState({});
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  useEffect(() => {
    api
      .get(`/ingresos-sanpablo/fecha-limite-escaleras?cosecha=${cosechaDeParam(cosecha)}`)
      .then((r) => setFechas(r ?? {}))
      .catch(() => setFechas({}));
  }, [cosecha]);

  // Se guarda al elegirla; vacía la borra.
  const guardarFechaTotal = async (valor) => {
    const anterior = fechas.carrosTotal;
    setFechas((f) => ({ ...f, carrosTotal: valor || null }));
    try {
      await api.put("/ingresos-sanpablo/fecha-limite-escaleras", {
        cosecha: cosechaDeParam(cosecha),
        solapa: "carrosTotal",
        fecha: valor || null,
      });
    } catch (error) {
      setFechas((f) => ({ ...f, carrosTotal: anterior }));
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message, width: "300px" });
    }
  };

  const conFecha = tarjetas.map((t) => {
    const carro = Object.values(CARROS_REPARACION).find((c) => c.tarjeta === t.id);
    const fecha = carro && fechas[carro.solapa];
    return fecha ? { ...t, fechaLimite: fecha.slice(0, 10).split("-").reverse().join("/"), fechaAbajo: true } : t;
  });

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
        titulo={`Cosecha ${cosecha} · Carros`}
        icono={<i className="bi bi-truck-flatbed"></i>}
        volverA={`/reparaciones/sanpablo/${cosecha}`}
      />

      {/* La fecha límite de los tres carros, arriba de las tarjetas (29/10/2026). */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "16px 16px 0" }}>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#312e81" }}>
          <i className="bi bi-calendar-event me-2"></i>
          Fecha límite
        </span>
        <input
          type="date"
          className="form-control form-control-sm"
          style={{ width: "auto" }}
          value={fechas.carrosTotal ? fechas.carrosTotal.slice(0, 10) : ""}
          onChange={(e) => guardarFechaTotal(e.target.value)}
          disabled={sinEditar}
          title={sinEditar ? "Sin permiso para editar" : "Para cuándo tienen que estar reparados los carros"}
        />
      </div>

      {/* Las 3 tarjetas en una fila. */}
      <TarjetasSanPablo
        tarjetas={conFecha}
        base={`/reparaciones/sanpablo/${cosecha}`}
        porFila={3}
        maxWidth="min(900px, calc((100vh - 250px) * 3))"
      />
    </div>
  );
}

export default CarrosSanPablo;
