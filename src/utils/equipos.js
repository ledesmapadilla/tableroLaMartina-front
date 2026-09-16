// Los equipos del padrón de CC y el grupo de Compras de cada uno (16/09/2026).
//
// En el alta de CC se elige solo el equipo: el grupo sale de acá y no se
// escribe a mano, así un CC no puede quedar en un grupo que no es el suyo ni
// sin grupo (y fuera del selector de Nuevo pedido).
//
// `flota` es la pantalla donde aparece la unidad al dar de alta el CC; `km`,
// los que cuentan kilómetros en vez de horas. El orden es el del selector y
// el del listado de CC.
//
// Es copia de TableroBack/src/catalogos/equipos.js, que es el que manda: si se
// toca uno, se toca el otro.
export const EQUIPOS = [
  { equipo: "Tractor", grupo: "Tractores", flota: "Tractores" },
  { equipo: "Manitou", grupo: "Manitou", flota: "Tractores" },
  { equipo: "Camión", grupo: "Tractores", flota: "Tractores", km: true },
  { equipo: "Turbo", grupo: "Pulverizadora" },
  { equipo: "Jacto", grupo: "Pulverizadora" },
  { equipo: "Martignani", grupo: "Pulverizadora" },
  { equipo: "Metalfor", grupo: "Pulverizadora" },
  { equipo: "Chancho", grupo: "Chancho" },
  { equipo: "Nodriza", grupo: "Nodriza" },
  { equipo: "Herbicida", grupo: "Herbicida" },
  { equipo: "Desmalezadora", grupo: "Desmalezadora" },
  { equipo: "Abonadora", grupo: "Abonadora" },
  { equipo: "Tk. riego", grupo: "Riego" },
  { equipo: "Camioneta", grupo: "Camioneta", flota: "Camionetas" },
  { equipo: "Colectivo", grupo: "Colectivos", flota: "Colectivos" },
  { equipo: "Otros", grupo: "Otros" },
];

export const NOMBRES_EQUIPO = EQUIPOS.map((e) => e.equipo);

const fichaDe = (equipo) => EQUIPOS.find((e) => e.equipo === (equipo || "").trim()) || null;

export const grupoDeEquipo = (equipo) => fichaDe(equipo)?.grupo || "";
export const flotaDeEquipo = (equipo) => fichaDe(equipo)?.flota || null;

// Los grupos de un pedido de Compras, en el orden de los filtros: los de los
// equipos y los que no son de ningún CC (Taller y los del depósito). "Arquito"
// queda mientras se decide si es un equipo que falta.
export const GRUPOS_PEDIDO = [
  "Pulverizadora",
  "Chancho",
  "Nodriza",
  "Desmalezadora",
  "Herbicida",
  "Abonadora",
  "Riego",
  "Arquito",
  "Tractores",
  "Camioneta",
  "Manitou",
  "Colectivos",
  "Taller",
  "Herreria",
  "Gomeria",
  "Stock",
  "Otros",
];
