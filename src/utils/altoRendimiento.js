/**
 * Precios de las tareas y alto rendimiento (02/10/2026).
 *
 * Lo usan el informe de tareas por personal (que paga), la planilla de carga
 * y el resumen por personal (que marcan la cantidad de los días de alto
 * rendimiento). Está acá para que los tres hagan la misma cuenta.
 */

import { claveCliente, clienteDe, mismoCliente } from "./clientes";

const soloFecha = (iso) => (iso || "").slice(0, 10);
const redondear = (v) => Math.round((Number(v) || 0) * 100) / 100;
const comparar = (a, b) => String(a || "").localeCompare(String(b || ""));

// Lo que se descuenta del bruto para llegar al neto. Es el mismo valor que usa
// el backend al guardar el precio; acá solo hace falta para las cargas viejas
// que quedaron sin el bruto calculado.
export const RETENCION = 0.205;

/**
 * Precio que rige para una tarea en una fecha dada, con su neto y su bruto.
 * Los dos salen de la misma carga de Variables: el que se escribe es el neto y
 * el backend guarda el bruto ya calculado con la retención.
 *
 * Los precios se cargan en **Variables** (`/produccion/variables/remuneracion`)
 * y son una fila por cada vez que el valor cambió: el que corresponde a un
 * parte es el de la vigencia más nueva que no sea posterior a su fecha. Si el
 * parte cae antes de la primera vigencia cargada, no hay precio: eso es una
 * raya, no un cero.
 *
 * El precio es por cliente (04/10/2026): el parte se paga con el de su
 * cliente, y si ese cliente no tiene precio para la tarea no hay importe. Un
 * parte o un precio sin cliente cuenta como de Citrusvil (ver clienteDe).
 */
export const precioVigente = (variables, idTarea, cliente, fecha) => {
  const delCliente = { cliente };
  const deLaTarea = variables.filter(
    (v) => (v.tarea?._id || v.tarea) === idTarea && mismoCliente(v, delCliente)
  );
  if (deLaTarea.length === 0) return null;

  const dia = soloFecha(fecha);
  const vigentes = deLaTarea
    .filter((v) => v.vigenciaDesde && soloFecha(v.vigenciaDesde) <= dia)
    .sort((a, b) => soloFecha(b.vigenciaDesde).localeCompare(soloFecha(a.vigenciaDesde)));

  const neto = vigentes[0]?.neto;
  if (!Number.isFinite(neto)) return null;

  // El bruto se guarda con el precio; si una carga vieja no lo tiene, se
  // rehace la misma cuenta que hace el backend.
  const bruto = vigentes[0]?.bruto;
  const { cantAlto, netoAlto, brutoAlto } = vigentes[0];
  return {
    neto,
    bruto: Number.isFinite(bruto) ? bruto : redondear(neto / (1 - RETENCION)),
    // El alto rendimiento (solo Berdina): desde la tancada número `cantAlto`
    // del día se paga `netoAlto`.
    cantAlto: Number.isFinite(cantAlto) && cantAlto > 0 ? cantAlto : null,
    netoAlto: Number.isFinite(netoAlto) ? netoAlto : null,
    brutoAlto: Number.isFinite(brutoAlto)
      ? brutoAlto
      : Number.isFinite(netoAlto)
      ? redondear(netoAlto / (1 - RETENCION))
      : null,
  };
};

/**
 * Alto rendimiento (solo Berdina).
 *
 * Una tarea con cant. y neto de alto rendimiento cargados en Variables se
 * paga por día: con objetivo 9, las primeras 8 del día van al neto normal y
 * de la novena en adelante, al neto de alto rendimiento.
 *
 * Pulverizado Jacto y Pulverizado FMC van distinto: si el día llega al
 * objetivo, todo lo del día va al neto de alto rendimiento; si no, todo al
 * normal.
 */
const TODO_EL_DIA = new Set(["pulverizado jacto", "pulverizado fmc"]);
const ESTABLECIMIENTO_ALTO = "caspinchango";

const sinTildes = (t) =>
  (t || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

// Sin precio vigente (`null`) no hay alto rendimiento.
export const pagaAlto = (establecimiento, precio) =>
  establecimiento === ESTABLECIMIENTO_ALTO &&
  Boolean(precio) &&
  precio.cantAlto !== null &&
  precio.netoAlto !== null;

// Cuánto del día va a cada precio. Con objetivo 9: hasta 8 al normal y el
// resto al alto; en Jacto y FMC, con 9 o más todo al alto.
export const repartirDia = (cantidad, tope, nombreTarea) => {
  if (TODO_EL_DIA.has(sinTildes(nombreTarea))) {
    return cantidad >= tope ? { normal: 0, alto: cantidad } : { normal: cantidad, alto: 0 };
  }
  const normal = Math.min(cantidad, Math.max(tope - 1, 0));
  return { normal, alto: redondear(cantidad - normal) };
};

// Los partes juntados por persona, tarea, cliente y día: así se mide el alto
// rendimiento, igual que en el informe de tareas por personal.
const juntarPorDia = (partes) => {
  const porDia = new Map();
  for (const p of partes) {
    const idTarea = p.tarea?._id || p.tarea;
    if (!idTarea) continue;
    const clave = [
      p.persona?._id || p.persona || "sin-persona",
      idTarea,
      claveCliente(clienteDe(p)),
      soloFecha(p.fecha),
    ].join("|");
    const dia = porDia.get(clave) || {
      idPersona: p.persona?._id || p.persona || "sin-persona",
      idTarea,
      tarea: p.tarea?.tarea,
      cliente: clienteDe(p),
      fecha: p.fecha,
      cantidad: 0,
      ids: [],
    };
    dia.cantidad += Number(p.cantidad) || 0;
    dia.ids.push(p._id);
    porDia.set(clave, dia);
  }
  return [...porDia.values()];
};

/**
 * Los partes que caen en un día de alto rendimiento: los ids de todos los
 * partes de una persona, tarea y cliente en un día en que algo se pagó al
 * neto alto. El día se arma igual que en el informe de tareas por personal.
 */
export const partesEnAltoRendimiento = (partes, variables, establecimiento) => {
  const ids = new Set();
  if (establecimiento !== ESTABLECIMIENTO_ALTO || !variables.length) return ids;

  for (const dia of juntarPorDia(partes)) {
    const precio = precioVigente(variables, dia.idTarea, dia.cliente, dia.fecha);
    if (!pagaAlto(establecimiento, precio)) continue;
    if (repartirDia(dia.cantidad, precio.cantAlto, dia.tarea).alto > 0) dia.ids.forEach((id) => ids.add(id));
  }
  return ids;
};

/**
 * Los días de una persona en una tarea, con cuánto de cada uno fue al precio
 * normal y cuánto al de alto rendimiento: el detalle que abre el resumen por
 * personal al tocar una cantidad destacada. Van todos los días de la tarea,
 * también los que no llegaron al objetivo, del más viejo al más nuevo.
 * Solo cantidades: el resumen no muestra importes.
 */
export const diasDeAltoRendimiento = (partes, variables, establecimiento, idPersona, idTarea) => {
  const dias = [];
  for (const dia of juntarPorDia(partes)) {
    if (dia.idPersona !== idPersona || dia.idTarea !== idTarea) continue;
    const precio = precioVigente(variables, dia.idTarea, dia.cliente, dia.fecha);
    const conAlto = pagaAlto(establecimiento, precio);
    const { normal, alto } = conAlto
      ? repartirDia(dia.cantidad, precio.cantAlto, dia.tarea)
      : { normal: dia.cantidad, alto: 0 };
    dias.push({
      fecha: soloFecha(dia.fecha),
      cliente: dia.cliente,
      cantidad: redondear(dia.cantidad),
      tope: conAlto ? precio.cantAlto : null,
      normal: redondear(normal),
      alto,
    });
  }
  return dias.sort((a, b) => a.fecha.localeCompare(b.fecha) || comparar(a.cliente, b.cliente));
};
