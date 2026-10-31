import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../../services/api";
import { usePermisos } from "../../context/permisos";
import { cosechaDeParam } from "../../utils/cosechas";
import { compararCC } from "../../utils/ordenCC";
import { CARROS_REPARACION } from "../../utils/carrosReparacion";
import { etiquetaEstado, fmtPct } from "../../utils/sistemasManitou";
import { traerAvancesManitou, avanceTotalManitous } from "../../utils/avanceManitous";
import NavbarSanPablo from "../shared/NavbarSanPablo";
import TarjetasSanPablo from "../shared/TarjetasSanPablo";
import { ordenarTarjetas } from "../../utils/ordenTarjetas";

// Los carros con letra (29/10/2026) van según su número: el 8C después del 8
// (o del 7 si no hay 8) y no al final, como en compararCC.
const compararCarros = (a, b) => {
  const x = /^(\d+)\s*(.*)$/.exec((a || "").trim());
  const y = /^(\d+)\s*(.*)$/.exec((b || "").trim());
  if (!x || !y) return compararCC(a, b);
  return Number(x[1]) - Number(y[1]) || x[2].localeCompare(y[2], "es", { sensitivity: "base" });
};

/**
 * Reparación carros (28/10/2026), desde el botón de Carros porta escaleras /
 * Escaleras: una tarjeta por carro porta escaleras del padrón de CC y una
 * General. La General tiene la fecha límite (29/10/2026), que se ve en su
 * tarjeta; las de cada carro todavía caen en el 404. La reparación de las
 * escaleras se carga desde los totales de la página de escaleras (tocando
 * Rotas). Desde el 29/10/2026 la misma página sirve a los carros porta bines
 * y porta bolsones, y a las tolvas (`tipo`, ver utils/carrosReparacion.js).
 * Las tolvas tienen plantilla (31/10/2026): cada tarjeta va por el id del CC y
 * lleva su avance, su estado y su fecha, como las de las Manitou, y la fecha
 * total se carga arriba de las tarjetas en vez de en General.
 */
export default function ReparacionCarros({ tipo = "escaleras" }) {
  const config = CARROS_REPARACION[tipo];
  const { cosecha: param } = useParams();
  const cosecha = cosechaDeParam(param);
  const [carros, setCarros] = useState([]);
  // Sin la lista no se dibujan: General sola saldría gigante un instante.
  const [cargado, setCargado] = useState(false);
  // La fecha límite que se carga en General (29/10/2026), en su tarjeta.
  const [fechaLimite, setFechaLimite] = useState(null);
  const { puede } = usePermisos();
  const sinEditar = !puede("sanpablo.ingresos", "editar");

  useEffect(() => {
    api
      .get(`/ingresos-sanpablo/fecha-limite-escaleras?cosecha=${cosecha}`)
      .then((r) => setFechaLimite(r[config.solapa] ?? null))
      .catch(() => setFechaLimite(null));
  }, [cosecha, config.solapa]);

  useEffect(() => {
    api
      .get("/centros-costo")
      .then((data) =>
        setCarros(
          (Array.isArray(data) ? data : [])
            // Sin el "S/N" (29/10/2026): no es un carro, no lleva tarjeta.
            .filter((c) => (c.equipo || "").trim() === config.equipo && (c.cc || "").trim().toUpperCase() !== "S/N")
            .sort((a, b) => compararCarros(a.cc, b.cc))
        )
      )
      .catch(() => setCarros([]))
      .finally(() => setCargado(true));
  }, [config.equipo]);

  // Se guarda al elegirla; vacía la borra.
  const guardarFechaLimite = async (valor) => {
    const anterior = fechaLimite;
    setFechaLimite(valor || null);
    try {
      await api.put("/ingresos-sanpablo/fecha-limite-escaleras", { cosecha, solapa: config.solapa, fecha: valor || null });
    } catch (error) {
      setFechaLimite(anterior);
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: error.message, width: "300px" });
    }
  };

  // Con plantilla: { avances: { [id]: % }, estados: { [seccion]: { estado, orden } }, fechas: { [seccion]: fecha } }.
  const familia = config.familia;
  const [plantilla, setPlantilla] = useState({ avances: {}, estados: {}, fechas: {} });
  useEffect(() => {
    if (!familia || !carros.length) return;
    Promise.all([
      traerAvancesManitou(cosecha, familia, carros.map((c) => c._id)),
      api.get(`/ingresos-sanpablo/estado-manitou?cosecha=${cosecha}`).catch(() => []),
      api.get(`/ingresos-sanpablo/fecha-limite-manitou?cosecha=${cosecha}${familia.consulta}`).catch(() => ({})),
    ]).then(([avances, lista, fechas]) =>
      setPlantilla({
        avances,
        estados: Object.fromEntries((Array.isArray(lista) ? lista : []).map((d) => [d.seccion, d])),
        fechas: fechas.porManitou ?? {},
      })
    );
  }, [familia, carros, cosecha]);

  // Lo que la plantilla le suma a la tarjeta de una tolva.
  const datosPlantilla = (c) => {
    if (!familia) return {};
    const seccion = familia.seccion(c._id);
    const estado = etiquetaEstado(plantilla.estados[seccion], carros.length);
    const fecha = plantilla.fechas[seccion];
    const avance = plantilla.avances[c._id];
    return {
      ...(fecha && { fechaLimite: fecha.slice(0, 10).split("-").reverse().join("/") }),
      ...(estado && { etiqueta: estado }),
      ...(avance !== undefined && { avance, avanceTitulo: `Avance de la reparación: ${fmtPct(avance)}` }),
    };
  };
  const avanceTotal = familia ? avanceTotalManitous(plantilla.avances) : null;

  const tarjetas = [
    ...carros.map((c) => ({
      // El código va en la dirección: "S/N" lleva una barra.
      id: familia ? c._id : encodeURIComponent(c.cc),
      titulo: `${config.prefijo ?? "Carro"} ${c.cc}`.trim(),
      ...(c.descripcion && { subtitulo: c.descripcion }),
      ...config.colores,
      ...datosPlantilla(c),
    })),
    {
      id: "general",
      titulo: "General",
      bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      hoverBg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      accentColor: config.colores.accentColor,
      icono: "bi bi-grid-fill",
      // Con plantilla la fecha va arriba de las tarjetas, como en Manitous.
      ...(fechaLimite && !familia && {
        fechaLimite: fechaLimite.slice(0, 10).split("-").reverse().join("/"),
        fechaEtiqueta: "Límite",
      }),
      ...(avanceTotal !== null && {
        torta: true,
        avance: avanceTotal,
        avanceTitulo: `Avance total: el promedio de las ${Object.keys(plantilla.avances).length} ${familia?.plural}`,
      }),
    },
  ];

  // Con plantilla se ordenan por el lugar en la espera y, sin él, por su fecha.
  const ordenadas = familia
    ? ordenarTarjetas(
        tarjetas,
        (t) => plantilla.estados[familia.seccion(t.id)]?.orden,
        (t) => plantilla.fechas[familia.seccion(t.id)]
      )
    : tarjetas;

  // Son 22 carros más la General: siete por fila (29/10/2026), en cuatro filas, y el
  // ancho atado al alto para que entren sin scroll. Lo que se descuenta del
  // alto (29/10/2026, más grandes): el navbar (54px), el padding de la grilla
  // (48px) y un margen para el salto del hover.
  const porFila = config.porFila ?? 7;
  const filas = Math.max(1, Math.ceil(tarjetas.length / porFila));

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
        titulo={config.titulo}
        sinSeccion
        cosecha={cosecha}
        icono={<i className={tipo === "escaleras" ? "bi bi-tools" : config.colores.icono}></i>}
        volverA={`/reparaciones/sanpablo/${param}${config.volver ? `/${config.volver}` : ""}`}
      />

      {/* La fecha límite, arriba de las tarjetas. */}
      {familia && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "16px 16px 0" }}>
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: familia.color }}>
            <i className="bi bi-calendar-event me-2"></i>
            Fecha límite
          </span>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: "auto" }}
            value={fechaLimite ? fechaLimite.slice(0, 10) : ""}
            onChange={(e) => guardarFechaLimite(e.target.value)}
            disabled={sinEditar}
            title={sinEditar ? "Sin permiso para editar" : "Para cuándo tienen que estar reparadas"}
          />
        </div>
      )}

      {cargado && (
        <TarjetasSanPablo
          tarjetas={ordenadas}
          base={`/reparaciones/sanpablo/${param}/${config.ruta}`}
          porFila={porFila}
          maxWidth={`min(1500px, calc((100vh - ${familia ? 175 : 115}px) * ${porFila / filas}))`}
          chicas
        />
      )}
    </div>
  );
}
