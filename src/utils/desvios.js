/**
 * Desvíos contra los valores admisibles (Variables › Valores admisibles,
 * 24/09/2026). Los usan el informe del mes y la planilla de carga, para que
 * los dos marquen con el mismo criterio (27/09/2026).
 */

/**
 * Desvío en porcentaje: cuánto se apartó lo real del admisible. Sin
 * admisible cargado, o sin dato real, no hay desvío.
 */
export const desvio = (real, admisible) =>
  real === null || real === undefined || !(admisible > 0) ? null : ((real - admisible) / admisible) * 100;

// El semáforo mira el desvío en contra: en el consumo es gastar de más, en el
// rendimiento es producir de menos. A favor siempre es verde. Rojo: más del 8 %
// en contra (regla del usuario); amarillo: desde la mitad de ese margen
// (hoy entre el 4 % y el 8 %). Cambiando el rojo, el amarillo lo sigue.
export const DESVIO_ROJO = 8;
export const DESVIO_AMARILLO = DESVIO_ROJO / 2;

export const SEMAFORO = {
  verde: { backgroundColor: "#dcfce7", color: "#15803d" },
  amarillo: { backgroundColor: "#fef9c3", color: "#a16207" },
  rojo: { backgroundColor: "#fee2e2", color: "#b91c1c" },
};

export const semaforo = (d, malSiSube) => {
  if (d === null) return null;
  const enContra = malSiSube ? d : -d;
  if (enContra > DESVIO_ROJO) return "rojo";
  if (enContra > DESVIO_AMARILLO) return "amarillo";
  return "verde";
};

export const textoDesvio = (d) =>
  `${d > 0 ? "+" : ""}${d.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

const sinAcentos = (t) =>
  (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Herbicida y desmalezado de San Pablo se pagan por lote terminado: la
 * cantidad no se carga día a día, la escribe el reparto cuando se termina el
 * lote (`repartido`), en proporción a las horas de cada jornada.
 */
export const esTareaPorLote = (p) =>
  p?.establecimiento === "san-pablo" &&
  ["herbicida", "desmalezado"].some((t) => sinAcentos(p.tarea?.tarea).includes(t));

/**
 * Si el parte cuenta para medir producción (rendimiento y litros por unidad).
 * En las tareas por lote solo cuentan las jornadas de lotes ya terminados:
 * mientras el lote está en proceso, o si la jornada es de un mes anterior al
 * cierre, sus horas no tienen cantidad y hundirían el rendimiento
 * (27/09/2026). Como el reparto es proporcional a las horas, esas jornadas
 * dan el rendimiento del lote entero.
 */
export const cuentaParaProduccion = (p) => !esTareaPorLote(p) || Boolean(p.repartido);

// Las tareas vienen como id o poblada; los admisibles se buscan por id.
export const mapaDeAdmisibles = (lista) =>
  new Map((Array.isArray(lista) ? lista : []).map((a) => [String(a.tarea?._id || a.tarea), a]));

const fechaCorta = (dia) => {
  const [, m, d] = String(dia || "").split("-");
  return d ? `${d}/${m}` : "";
};

const nfTramo = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

// De dónde sale el consumo, en palabras simples (27/09/2026): cuánto trabajó
// la máquina y cuánto hizo falta para volver a llenarle el tanque.
// Ej.: "Trabajó 28 hs (del 20/09 al 23/09). Para volver a llenar el tanque,
// el 24/09, hicieron falta 60 lts: 60 ÷ 28 = 2,14 lts por hora."
const textoTramo = (t, conHorasCC) => {
  const horas = conHorasCC ? t.horasCC : t.horas;
  const dias = t.desde === t.hasta ? `el ${fechaCorta(t.desde)}` : `del ${fechaCorta(t.desde)} al ${fechaCorta(t.hasta)}`;
  return (
    `Trabajó ${nfTramo.format(horas)} hs${conHorasCC ? " de horómetro" : ""} (${dias}). ` +
    `Para volver a llenar el tanque, el ${fechaCorta(t.carga.dia)}, hicieron falta ${nfTramo.format(t.carga.litros)} lts: ` +
    `${nfTramo.format(t.carga.litros)} ÷ ${nfTramo.format(horas)} = ${nfTramo.format(t.carga.litros / horas)} lts por hora.`
  );
};

/**
 * Los desvíos de un parte diario, con los mismos criterios que el informe:
 *
 * - Consumo del CC y del turbo: el del TRAMO entre cargas al que pertenece el
 *   parte (27/09/2026). Se carga a tanque lleno, así que la carga que cierra
 *   el tramo es lo que se consumió en él (ver consumos.service.js en el
 *   backend). `consumo` es lo que devuelve /api/partes/consumos para este
 *   parte; si su tramo todavía no cerró, el consumo no se mide.
 * - Rendimiento: cantidad / horas de turno, contra el rendimiento admisible.
 *   Si el parte no tiene horas de turno pero sí horómetro, se usan las horas
 *   del CC (`conHorasCC`).
 *
 * Devuelve solo los que están fuera (amarillo o rojo), el peor primero, cada
 * uno con { tipo, medida, real, admisible, unidad, desvio, color, nota }. El
 * renglón de pago de un lote no es un día trabajado: no se mide.
 */
export const desviosDelParte = (p, admisibles, consumo = null) => {
  if (!p || p.pagoDe) return [];
  const a = admisibles.get(String(p.tarea?._id || p.tarea || ""));
  if (!a) return [];

  const unidad = p.tarea?.unidad || "un";
  const lista = [];
  // `tipo`: "consumo" o "rendimiento", para que la planilla los muestre con
  // íconos distintos.
  const medir = (tipo, medida, real, admisible, unidadMedida, malSiSube, nota = "") => {
    if (!(real > 0) || !(admisible > 0)) return;
    const d = desvio(real, admisible);
    const color = semaforo(d, malSiSube);
    if (color === "rojo" || color === "amarillo") {
      lista.push({ tipo, medida, real, admisible, unidad: unidadMedida, desvio: d, color, nota });
    }
  };

  // El consumo del tramo: contra las horas de turno, o las del horómetro si
  // el tramo no tiene horas de turno.
  const medirTramo = (medida, c) => {
    if (c?.estado !== "cerrado") return;
    const t = c.tramo;
    const real = t.tasa ?? t.tasaCC;
    const nota = textoTramo(t, t.tasa === null);
    medir("consumo", medida, real, a.consumo, "lts/hs", true, nota);
  };
  medirTramo("Consumo del CC", consumo?.cc);
  if ((p.turbo || "").trim()) medirTramo(`Consumo del turbo ${p.turbo.trim()}`, consumo?.turbo);

  // En las tareas por lote, el rendimiento es el del lote terminado; en
  // proceso todavía no se sabe y no se mide.
  const turno = Number(p.totalHoras) || 0;
  const horas = turno > 0 ? turno : Number(p.horasCC) || 0;
  if (horas > 0 && cuentaParaProduccion(p)) {
    const porLote = esTareaPorLote(p);
    const nombre = porLote ? `Rendimiento del lote ${(p.lote || "").trim() || "—"} (terminado)` : "Rendimiento";
    const nota = porLote
      ? "Es el del lote entero: sus plantas o hectáreas repartidas entre sus jornadas según las horas."
      : turno > 0
        ? `${Number(p.cantidad) || 0} ${unidad} en ${turno} hs de turno`
        : `${Number(p.cantidad) || 0} ${unidad} en ${horas} hs de CC (el parte no tiene horas de turno)`;
    medir("rendimiento", nombre, (Number(p.cantidad) || 0) / horas, a.rendimiento, `${unidad}/hs`, false, nota);
  }

  return lista.sort((x, y) => (x.color === y.color ? 0 : x.color === "rojo" ? -1 : 1));
};
