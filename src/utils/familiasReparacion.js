import { useEffect, useState } from "react";
import { api } from "../services/api";
import { SISTEMAS_MANITOU, SISTEMAS_TOLVA, seccionManitou, unidadManitouValida, UNIDADES_MANITOU } from "./sistemasManitou";

/**
 * Lo que cambia entre las máquinas que se reparan con plantilla (31/10/2026).
 * General, cada unidad, sus sistemas, repuestos y presupuesto son las mismas
 * pantallas (ManitouGeneralSanPablo y las que abre) para las dos familias:
 *  - nombre, plural, general  cómo se llaman en los textos.
 *  - ruta     después de /reparaciones/sanpablo/:cosecha/.
 *  - seccion  la sección de los chequeos de una unidad.
 *  - sistemas sus tarjetas.
 *  - porFila  cuántas por fila en General.
 *  - parejas  ver TarjetasSanPablo.
 *  - anchoGeneral el de la grilla de General; sin él, el de las Manitou. Atado
 *             al alto de la pantalla para que entre sin scroll.
 *  - consulta lo que se suma a las direcciones de pesos, fechas y gasto real.
 *  - icono    el de Bootstrap; sin él, el tractor.
 *
 * Las tolvas salen del padrón de CC y se les puede cambiar el código: en la
 * dirección y en la sección van por el id del CC. Igual que en el back
 * (catalogos/tolvas.js).
 */
export const FAMILIA_MANITOU = {
  id: "manitou",
  nombre: "Manitou",
  plural: "Manitous",
  general: "Manitous General",
  ruta: "manitous",
  seccion: seccionManitou,
  sistemas: SISTEMAS_MANITOU,
  porFila: 4,
  consulta: "",
  color: "#047857",
  gradiente: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
  sombra: "0 6px 16px rgba(4, 120, 87, 0.35)",
};

export const FAMILIA_TOLVA = {
  id: "tolva",
  nombre: "Tolva",
  plural: "Tolvas",
  general: "Tolvas General",
  ruta: "tolvas/reparacion",
  seccion: (unidad) => (unidad === "general" ? "tolvas-general" : `tolva-${unidad}`),
  sistemas: SISTEMAS_TOLVA,
  porFila: 3,
  parejas: true,
  anchoGeneral: "calc(max(120px, min(190px, (100vh - 320px) / 2.5)) * 3 + 2rem)",
  consulta: "&familia=tolvas",
  extra: { familia: "tolvas" },
  equipo: "Tolva",
  icono: "bi bi-minecart-loaded",
  color: "#92400e",
  gradiente: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
  sombra: "0 6px 16px rgba(146, 64, 14, 0.35)",
};

// Las unidades de la familia, con el C.C. de cada una: { id, cc }.
export const traerUnidades = async (familia) => {
  if (familia === FAMILIA_MANITOU) return UNIDADES_MANITOU.map((u) => ({ id: u, cc: u }));
  const data = await api.get("/centros-costo").catch(() => []);
  return (Array.isArray(data) ? data : [])
    .filter((c) => (c.equipo || "").trim() === familia.equipo)
    .map((c) => ({ id: c._id, cc: c.cc }));
};

// El total del lugar en la espera ("2/6"): sus unidades.
export const totalEsperaDe = async (familia) => (await traerUnidades(familia)).length;

// Si la unidad de la dirección existe y cómo se muestra (su C.C.). Mientras se
// busca una tolva vale, con el nombre vacío.
export const useUnidadReparacion = (familia, unidad) => {
  const buscar = familia !== FAMILIA_MANITOU && unidad !== "general";
  const [tolva, setTolva] = useState({ id: null, cc: "", valida: true });

  useEffect(() => {
    if (!buscar) return;
    let vigente = true;
    api
      .get(`/centros-costo/${unidad}`)
      .then((c) => vigente && setTolva({ id: unidad, cc: c.cc, valida: (c.equipo || "").trim() === familia.equipo }))
      .catch(() => vigente && setTolva({ id: unidad, cc: "", valida: false }));
    return () => {
      vigente = false;
    };
  }, [buscar, unidad, familia]);

  if (!buscar) return { valida: familia !== FAMILIA_MANITOU || unidadManitouValida(unidad), nombre: unidad };
  return tolva.id === unidad ? { valida: tolva.valida, nombre: tolva.cc } : { valida: true, nombre: "" };
};
