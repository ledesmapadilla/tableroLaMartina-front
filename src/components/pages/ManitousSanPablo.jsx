import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import TractorIcon from "../shared/TractorIcon";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";
import { UNIDADES_MANITOU, MANITOUS_FUERA_DE_REPARACION, seccionManitou, fmtPct } from "../../utils/sistemasManitou";
import { traerAvancesManitou, avanceTotalManitous } from "../../utils/avanceManitous";

// El verde de la tarjeta Manitous de ReparacionesSanPablo.
const verde = {
  bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
  hoverBg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
  accentColor: "#34d399",
};

// Los colores de los círculos de la página de cada Manitou.
const ESTADOS = {
  reparacion: { texto: "En reparación", color: "#ea580c" },
  espera: { texto: "En espera", color: "#2563eb" },
};

// Una tarjeta por Manitou y la General (06/10/2026). Todas abren
// ManitouGeneralSanPablo: General es la plantilla y cada Manitou trabaja con
// la copia (09/10/2026).
const tarjetas = [
  ...UNIDADES_MANITOU.map((nro) => ({
    id: nro,
    titulo: `Manitou ${nro}`,
    ...verde,
    tractor: true,
  })),
  {
    id: "general",
    titulo: "General",
    bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    accentColor: "#34d399",
    icono: "bi bi-grid-fill",
  },
];

function ManitousSanPablo() {
  const { cosecha } = useParams();
  // Los responsables ya no van en la tarjeta (28/10/2026): se ven adentro.
  // En reparación o en espera, por unidad (11/10/2026): { [unidad]: estado }.
  const [estados, setEstados] = useState({});
  // El avance de la reparación de cada Manitou (21/10/2026), con la misma
  // cuenta que su página: { [unidad]: % }. Sin pesos de los sistemas, vacío.
  const [avances, setAvances] = useState({});
  // Para cuándo tienen que estar reparadas (28/10/2026), "AAAA-MM-DD" o "".
  const [fechaLimite, setFechaLimite] = useState("");
  // La de cada Manitou, en su tarjeta: { [seccion]: fecha ISO }.
  const [fechasManitou, setFechasManitou] = useState({});
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  useEffect(() => {
    const nro = cosechaDeParam(cosecha);
    api
      .get(`/ingresos-sanpablo/estado-manitou?cosecha=${nro}`)
      .then((lista) =>
        setEstados(
          Object.fromEntries(
            (Array.isArray(lista) ? lista : [])
              .filter((d) => d.estado)
              .map((d) => [UNIDADES_MANITOU.find((u) => seccionManitou(u) === d.seccion), d.estado])
          )
        )
      )
      .catch(() => setEstados({}));

    traerAvancesManitou(nro).then(setAvances);

    api
      .get(`/ingresos-sanpablo/fecha-limite-manitou?cosecha=${nro}`)
      .then((r) => {
        setFechaLimite(r.fecha ? r.fecha.slice(0, 10) : "");
        setFechasManitou(r.porManitou ?? {});
      })
      .catch(() => {
        setFechaLimite("");
        setFechasManitou({});
      });
  }, [cosecha]);

  // Se guarda al elegirla; vacía la borra.
  const guardarFechaLimite = async (valor) => {
    const anterior = fechaLimite;
    setFechaLimite(valor);
    try {
      await api.put("/ingresos-sanpablo/fecha-limite-manitou", { cosecha: cosechaDeParam(cosecha), fecha: valor || null });
    } catch (error) {
      setFechaLimite(anterior);
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message, width: "300px" });
    }
  };

  // El avance total, en la tarjeta General: el promedio de las que están en
  // reparación (la 1100 no cuenta).
  const valores = Object.values(avances);
  const avanceTotal = avanceTotalManitous(avances);

  // Lo del avance de cada tarjeta: la barra, el texto de la 1100 o nada.
  const avanceDe = (id) => {
    if (MANITOUS_FUERA_DE_REPARACION.includes(id)) return { avanceTexto: "Fuera de reparación" };
    if (id === "general") {
      return avanceTotal === null
        ? {}
        : {
            // En General, en torta (21/10/2026, para probar).
            torta: true,
            avance: avanceTotal,
            avanceTitulo: `Avance total: el promedio de las ${valores.length} Manitou en reparación`,
          };
    }
    return avances[id] === undefined ? {} : { avance: avances[id], avanceTitulo: `Avance de la reparación: ${fmtPct(avances[id])}` };
  };

  const conDatos = tarjetas.map((t) => {
    const estado = ESTADOS[estados[t.id]];
    const fecha = t.id !== "general" && fechasManitou[seccionManitou(t.id)];
    return {
      ...t,
      ...(fecha && { fechaLimite: fecha.slice(0, 10).split("-").reverse().join("/") }),
      ...(estado && { etiqueta: estado }),
      ...avanceDe(t.id),
    };
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
        titulo={`Cosecha ${cosecha} · Manitous`}
        icono={<TractorIcon size="1.25rem" color="#fff" />}
        volverA={`/reparaciones/sanpablo/${cosecha}`}
      />

      {/* La fecha límite, arriba de las tarjetas. */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "16px 16px 0" }}>
        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#064e3b" }}>
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
          title={sinEditar ? "Sin permiso para editar" : "Para cuándo tienen que estar reparadas"}
        />
      </div>

      {/* Las 6 tarjetas en dos filas de 3, sin scroll. */}
      <TarjetasSanPablo
        tarjetas={conDatos}
        iconoChico
        base={`/reparaciones/sanpablo/${cosecha}/manitous`}
        porFila={3}
        maxWidth="min(900px, calc((100vh - 230px) * 1.5))"
      />
    </div>
  );
}

export default ManitousSanPablo;
