import { claveTarea } from "./contable";
import { precioVigente } from "./altoRendimiento";

/**
 * El cálculo de las comparativas de Contable (volumétrica y costos), sacado
 * de ContableComparativa.jsx el 12/11/2026 para usarlo también en el
 * Acumulado del año. Las funciones de abajo son las de siempre; la última,
 * calcularComparativa, junta todo para un mes y un campo.
 */

const ordenar = (a, b) => String(a).localeCompare(String(b), "es");

/**
 * Las filas del mes juntadas por almacén y por la tarea de La Martina que le
 * toca a cada tarea de Citrusvil (Equivalencias de tareas). Suma cantidad y
 * subtotal; el precio unitario es subtotal / cantidad, que con una sola
 * tarifa es esa misma y con varias es el promedio pesado. El subtotal de cada
 * fila es Cant. × Precio unitario del Excel, calculado al cargarlo
 * (08/11/2026), no el Subtotal que trae el Excel.
 *
 * Una de Citrusvil sin equivalencia queda con su propio nombre, marcada.
 */
export const agrupar = (filas, laMartinaDe, tareaLM) => {
  const grupos = new Map();
  for (const f of filas) {
    // Por clave y no por el texto exacto: una variante escrita distinto
    // (mayúsculas, acentos, espacios, signos) es la misma tarea.
    const idLM = laMartinaDe.get(claveTarea(f.tarea));
    const lm = idLM ? tareaLM.get(idLM) : null;
    const tarea = lm ? lm.tarea : f.tarea || "";
    const clave = `${f.almacen || ""}|${lm ? `lm:${idLM}` : `ctv:${claveTarea(tarea)}`}`;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        clave,
        almacen: f.almacen || "",
        tarea,
        sinEquivalencia: !lm,
        idLM: lm ? idLM : null,
        unidad: lm ? lm.unidad : f.unidad || "",
        cantidad: 0,
        subtotal: 0,
        tareasCtv: new Set(),
        // Las filas del Excel que forman el grupo: el detalle al tocarlo.
        filas: [],
      };
      grupos.set(clave, g);
    }
    g.cantidad += f.cantidad || 0;
    g.subtotal += f.subtotal || 0;
    if (f.tarea) g.tareasCtv.add(f.tarea);
    g.filas.push(f);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, precio: g.cantidad ? g.subtotal / g.cantidad : null, tareasCtv: [...g.tareasCtv].sort(ordenar) }))
    .sort((a, b) => ordenar(a.almacen, b.almacen) || ordenar(a.tarea, b.tarea));
};

/**
 * Las tareas de La Martina que se comparan juntas (06/11/2026). Una de
 * Citrusvil puede estar en varias de La Martina; lo que pagó Citrusvil por
 * ella no se puede repartir, así que esas tareas de La Martina van en una
 * sola fila ("Herbicida + Herbicida Bajo Volumen") y se compara lo pagado
 * contra lo certificado entre todas, sin contar nada dos veces. Las que
 * comparten se encadenan: si A y B comparten una y B y C otra, van A, B y C.
 *
 * → { grupoDe: id de La Martina → id del grupo, tareaDe: id del grupo →
 *     { tarea: nombre (los nombres unidos con " + "), unidad } }
 */
export const juntarTareasLM = (equivalencias, tareas) => {
  const padre = new Map();
  const raiz = (x) => {
    while (padre.get(x) !== x) x = padre.get(x);
    return x;
  };
  const unir = (a, b) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(rb, ra);
  };
  const primeraDe = new Map(); // clave de Citrusvil → primera tarea de La Martina que la tiene
  for (const e of equivalencias) {
    const id = String(e.tarea);
    if (!padre.has(id)) padre.set(id, id);
    for (const c of e.citrusvil || []) {
      const k = claveTarea(c);
      if (primeraDe.has(k)) unir(primeraDe.get(k), id);
      else primeraDe.set(k, id);
    }
  }
  const porId = new Map(tareas.map((t) => [String(t._id), t]));
  const miembros = new Map();
  for (const id of padre.keys()) {
    const r = raiz(id);
    miembros.set(r, [...(miembros.get(r) || []), id]);
  }
  const grupoDe = new Map();
  const tareaDe = new Map();
  for (const [r, ids] of miembros) {
    const lista = ids.map((id) => porId.get(id)).filter(Boolean);
    for (const id of ids) grupoDe.set(id, r);
    tareaDe.set(r, {
      tarea: lista.map((t) => t.tarea).sort(ordenar).join(" + "),
      unidad: lista[0]?.unidad || "",
      juntas: lista.length > 1,
    });
  }
  return { grupoDe, tareaDe };
};

/**
 * Lo certificado en La Martina en el mes, por tarea (la solapa "Certificado
 * en LM", 05/11/2026). Sale del mismo cálculo que Contable - Pagos
 * (utils/certificado.js): una fila por persona y tarea, que acá se juntan por
 * tarea. Las personas que en Pagos están "sin contar" no cuentan.
 *
 * El precio unitario es el de "Pagado por Ctv" para la misma tarea de La
 * Martina en el mismo campo (`preciosCTV`: id de la tarea → precio), y el
 * subtotal, la cantidad certificada por ese precio (05/11/2026): así se ve
 * cuánto valdría lo certificado a lo que paga Citrusvil. Una tarea que no
 * está en Ctv queda sin precio ni subtotal.
 *
 * `conEquivalencia` son los id de las tareas de La Martina que tienen alguna
 * de Citrusvil en Equivalencias de tareas: las demás van destacadas, igual
 * que en "Pagado por Ctv".
 *
 * Con `precioPersonal` (Comparativa costos tarea, 07/11/2026) el precio es
 * el que se le paga a la gente: el de Variables de remuneración del campo,
 * con el mismo cálculo que Pagos (cliente, vigencia, alto rendimiento y
 * correcciones a mano). Si en la tarea hay más de un precio, va el promedio
 * de lo certificado, que es lo que cierra con el subtotal.
 */
export const agruparLM = (filasCert, excluidos, almacen, preciosCTV, conEquivalencia, juntas, precioPersonal = false) => {
  const grupos = new Map();
  for (const f of filasCert) {
    if (excluidos.has(f.idPersona)) continue;
    // Las que comparten una tarea de Citrusvil van juntas (juntarTareasLM).
    const id = String(f.idTarea);
    const grupo = juntas.grupoDe.get(id) || id;
    let g = grupos.get(grupo);
    if (!g) {
      const junta = juntas.tareaDe.get(grupo);
      g = {
        clave: `lm:${grupo}`,
        almacen,
        tarea: junta?.tarea || f.tarea,
        unidad: junta?.unidad || f.unidad,
        cantidad: 0,
        precio: preciosCTV.get(grupo) ?? null,
        sinEquivalencia: !conEquivalencia.has(id),
        personas: [],
      };
      grupos.set(grupo, g);
    }
    g.cantidad += f.cantidad || 0;
    g.personas.push(f);
  }
  if (precioPersonal) {
    return [...grupos.values()]
      .map((g) => {
        const conImporte = g.personas.filter((p) => p.importe !== null && p.importe !== undefined);
        const subtotal = conImporte.length ? conImporte.reduce((a, p) => a + p.importe, 0) : null;
        const cantConPrecio = conImporte.reduce((a, p) => a + (p.cantidad || 0), 0);
        const precios = new Set(conImporte.map((p) => p.precio).filter((p) => p !== null && p !== undefined));
        const precio =
          precios.size === 1 ? [...precios][0] : cantConPrecio ? subtotal / cantConPrecio : null;
        return { ...g, precio, subtotal, variosPrecios: precios.size > 1 };
      })
      .sort((a, b) => ordenar(a.tarea, b.tarea));
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      subtotal: g.precio === null ? null : g.cantidad * g.precio,
      // Cada persona también al precio de Ctv, para el detalle.
      personas: g.personas.map((p) => ({
        ...p,
        precio: g.precio,
        importe: g.precio === null ? null : (p.cantidad || 0) * g.precio,
      })),
    }))
    .sort((a, b) => ordenar(a.tarea, b.tarea));
};

/**
 * La solapa "Comparativa" (antes "Comparación") (05/11/2026): lo pagado por Citrusvil contra lo
 * certificado en La Martina, una fila por tarea de La Martina. Las
 * diferencias son Ctv − LM: positiva, Citrusvil pagó más de lo certificado.
 *
 * Van también las que están de un solo lado: una de Citrusvil sin
 * equivalencia (no hay con qué compararla en LM) y una certificada en LM sin
 * nada en Ctv (sin precio de Ctv no se puede valuar). La diferencia va en
 * todas las filas (06/11/2026): lo que falta de un lado cuenta como cero.
 */
/**
 * `cruce` (Comparativa de costos, 07/11/2026): grupo de La Martina de la fila
 * de Ctv → grupo de La Martina contra el que se compara. Lo pagado por Ctv
 * queda con su tarea de siempre (ej. Horas Motor Generador) pero se compara
 * con lo pagado a la gente en otra (MotoGenerador-Personal). Lo de LM de la
 * tarea de siempre queda en su propia fila. `nombres`: grupo → { tarea }.
 *
 * Desde el 12/11/2026 una de Ctv puede ir en costos con varias tareas y
 * alquileres: `cruce.origen` la manda a una fila "cos:…" que junta todo eso
 * (`cruce.lmEnFila`: grupo de La Martina → esa fila). Lo de LM se suma ahí; los
 * montos de los alquileres se suman después (gruposComp).
 */
export const compararGrupos = (gruposCTV, gruposLM, cruce = {}, nombres = new Map()) => {
  const { origen = new Map(), lmEnFila = new Map() } = cruce;
  const juntar = (lista, mas) => [...new Set([...(lista || []), ...mas].filter(Boolean))];
  const filas = new Map();
  const fila = (clave, base) => {
    if (!filas.has(clave)) {
      filas.set(clave, {
        clave,
        tarea: base.tarea,
        unidad: base.unidad,
        precio: null,
        // El precio de LM (en la de costos, lo que se le paga a la gente).
        precioLM: null,
        variosPreciosLM: false,
        cantCTV: null,
        cantLM: null,
        subCTV: null,
        subLM: null,
        sinEquivalencia: false,
        // Para el historial: las filas del Excel y el grupo de La Martina.
        filasCtv: [],
        grupoLM: null,
      });
    }
    return filas.get(clave);
  };
  for (const g of gruposCTV) {
    const llave = g.idLM ? String(g.idLM) : `ctv:${claveTarea(g.tarea)}`;
    const propia = g.idLM ? `lm:${g.idLM}` : `ctv:${g.clave}`;
    // La de costos de esta de Ctv; si no tiene, y su tarea de siempre está en
    // una fila juntada, va a esa fila.
    const destino = origen.get(llave) || (g.idLM ? lmEnFila.get(String(g.idLM)) : null) || null;
    const juntada = destino?.startsWith("cos:");
    const f = fila(destino || propia, g);
    if (juntada) {
      if (origen.has(llave)) f.tareasCtvCostos = juntar(f.tareasCtvCostos, g.tareasCtv?.length ? g.tareasCtv : [g.tarea]);
      if (g.idLM) f.gruposCtv = juntar(f.gruposCtv, [String(g.idLM)]);
    } else if (destino) {
      f.tareaLMCostos = nombres.get(destino.slice(3))?.tarea || "";
      f.grupoCtv = String(g.idLM);
    }
    f.cantCTV = (f.cantCTV || 0) + g.cantidad;
    f.subCTV = (f.subCTV || 0) + g.subtotal;
    // Con varios grupos en la fila (dos almacenes o el cruce de costos), el
    // precio es el ponderado de todos: subtotal / cantidad (12/11/2026).
    f.precio = f.cantCTV ? f.subCTV / f.cantCTV : f.precio ?? g.precio;
    if (g.sinEquivalencia) f.sinEquivalencia = true;
    f.filasCtv.push(...(g.filas || []));
    if (g.idLM && !juntada) f.grupoLM = destino ? destino.slice(3) : String(g.idLM);
  }
  for (const g of gruposLM) {
    const grupo = g.clave.slice(3);
    const enFila = lmEnFila.get(grupo);
    const f = fila(enFila || g.clave, g);
    if (enFila) f.gruposLM = juntar(f.gruposLM, [grupo]);
    else f.grupoLM = grupo;
    f.cantLM = (f.cantLM || 0) + g.cantidad;
    if (g.subtotal !== null) f.subLM = (f.subLM || 0) + g.subtotal;
    if (g.precio !== null) f.precioLM = g.precio;
    if (g.variosPrecios) f.variosPreciosLM = true;
    if (g.sinEquivalencia) f.sinEquivalencia = true;
  }
  return [...filas.values()]
    .map((f) => {
      // Con equivalencia y sin partes en LM, lo certificado es cero.
      const conLM = !f.sinEquivalencia && f.cantCTV !== null;
      const cantLM = f.cantLM ?? (conLM ? 0 : null);
      const subLM = f.subLM ?? (conLM && f.cantLM === null ? 0 : null);
      return {
        ...f,
        cantLM,
        subLM,
        difCant: (f.cantCTV || 0) - (cantLM || 0),
        dif: (f.subCTV || 0) - (subLM || 0),
      };
    })
    .sort((a, b) => ordenar(a.tarea, b.tarea));
};


/**
 * Todo el cálculo de la comparativa de un mes y un campo (12/11/2026, sacado
 * de ContableComparativa.jsx para usarlo también en el Acumulado). Con los
 * datos ya traídos devuelve las filas de cada solapa y la Comparativa.
 *
 * `lm` y `base` pueden faltar (null): entonces no hay nada de LM.
 * `multiplicadores`: Map clave de Ctv → factor (doble pasada).
 */
export function calcularComparativa({
  tipo,
  campo,
  anio,
  mes,
  filas = [],
  equivalencias = [],
  costosEq = [],
  tareas = [],
  alquileres = [],
  multiplicadores = new Map(),
  lm = null,
  base = null,
  rango = null,
}) {
  const esCostos = tipo === "costos";

  // Las tareas de La Martina que tienen alguna de Citrusvil. En la de costos
  // también las que son "LM en costos" de alguna de Ctv.
  const conEquivalencia = new Set(equivalencias.filter((e) => (e.citrusvil || []).length).map((e) => String(e.tarea)));
  if (esCostos) for (const c of costosEq) for (const id of c.tareas || []) conEquivalencia.add(String(id));
  // Las tareas de La Martina que comparten una de Citrusvil, juntas.
  const juntas = juntarTareasLM(equivalencias, tareas);
  // Clave de Citrusvil → el grupo de tareas de La Martina.
  const laMartinaDe = new Map();
  for (const e of equivalencias)
    for (const c of e.citrusvil || []) laMartinaDe.set(claveTarea(c), juntas.grupoDe.get(String(e.tarea)) || String(e.tarea));
  const tareaLM = juntas.tareaDe;

  // Solo las filas del campo (su "Denominación almacén"). Las de doble pasada
  // (12/11/2026), con la cantidad y el subtotal por su factor.
  const filasCampo = campo
    ? filas
        .filter((f) => campo.almacenes.includes(claveTarea(f.almacen)))
        .map((f) => {
          const k = multiplicadores.get(claveTarea(f.tarea));
          return k && k !== 1 ? { ...f, cantidad: (f.cantidad || 0) * k, subtotal: (f.subtotal || 0) * k, factor: k } : f;
        })
    : [];
  const grupos = agrupar(filasCampo, laMartinaDe, tareaLM);

  // El precio de Ctv de cada tarea de La Martina en este campo: el ponderado
  // de todos los almacenes (12/11/2026).
  const suma = new Map();
  for (const g of grupos) {
    if (!g.idLM) continue;
    const id = String(g.idLM);
    const s = suma.get(id) || { cantidad: 0, subtotal: 0 };
    s.cantidad += g.cantidad;
    s.subtotal += g.subtotal;
    suma.set(id, s);
  }
  const preciosCTV = new Map();
  for (const [id, s] of suma) if (s.cantidad) preciosCTV.set(id, s.subtotal / s.cantidad);

  const gruposLM = lm && campo ? agruparLM(lm.filas, lm.excluidos, campo.titulo, preciosCTV, conEquivalencia, juntas) : [];
  // En la de costos, lo que se le paga a la gente.
  const gruposLMPersonal =
    esCostos && lm && campo ? agruparLM(lm.filas, lm.excluidos, campo.titulo, preciosCTV, conEquivalencia, juntas, true) : [];

  // El cruce de la Comparativa de costos ("LM en costos"): origen (grupo de
  // LM de la de Ctv, o "ctv:<clave>") → fila; las filas de solo alquileres;
  // los grupos de siempre que en costos ya no van; y lo que se le suma al
  // subtotal LM de la fila de la primera tarea (las demás tareas y los
  // alquileres, 12/11/2026).
  const origen = new Map();
  const lmEnFila = new Map();
  const combos = new Map();
  const redirigidos = new Set();
  const extrasDeFila = new Map();
  const gruposExtra = new Set();
  if (esCostos) {
    for (const c of costosEq) {
      const k = claveTarea(c.nombre);
      const grupoCtv = laMartinaDe.get(k);
      const llave = grupoCtv || `ctv:${k}`;
      if (origen.has(llave)) continue;
      // En el orden en que se tildaron: la primera es la de la fila.
      const gs = [...new Set((c.tareas || []).map(String).map((t) => juntas.grupoDe.get(t) || t))];
      const alqs = [...new Set([...(c.alquileres || []), ...(c.alquiler ? [c.alquiler] : [])].map(String))].sort();
      if (!gs.length && !alqs.length) continue;
      if (gs.length) {
        const fila = `lm:${gs[0]}`;
        const ya = extrasDeFila.get(fila) || { grupos: [], alquileres: [] };
        const masGrupos = gs.slice(1).filter((g) => g !== gs[0]);
        if (masGrupos.length || alqs.length) {
          extrasDeFila.set(fila, {
            grupos: [...new Set([...ya.grupos, ...masGrupos])],
            alquileres: [...new Set([...ya.alquileres, ...alqs])],
          });
          for (const g of masGrupos) gruposExtra.add(g);
        }
        if (gs[0] !== grupoCtv) {
          origen.set(llave, fila);
          if (grupoCtv) redirigidos.add(grupoCtv);
        }
        continue;
      }
      // Solo alquileres: una fila con cada uno en 1 y su monto.
      const fila = `cos:${alqs.map((a) => `alq:${a}`).join("+")}`;
      origen.set(llave, fila);
      if (grupoCtv) redirigidos.add(grupoCtv);
      if (!combos.has(fila)) combos.set(fila, { grupos: [], alquileres: alqs });
    }
    // Una tarea que es la de la fila de alguna no va como extra de otra.
    for (const fila of extrasDeFila.keys()) gruposExtra.delete(fila.slice(3));
  }
  const cruceCostos = { origen, lmEnFila, combos, redirigidos, extrasDeFila, gruposExtra };

  // La tarea de siempre de una que tiene "LM en costos" no va en lo pagado:
  // en su lugar va la de costos. Las extra tampoco (ya suman en otra fila).
  const gruposLMCostos = gruposLMPersonal.filter(
    (g) => !redirigidos.has(g.clave.slice(3)) && !gruposExtra.has(g.clave.slice(3))
  );

  const nombres = new Map(juntas.tareaDe);
  for (const t of tareas) if (!nombres.has(String(t._id))) nombres.set(String(t._id), { tarea: t.tarea });
  // El monto de cada alquiler: el vigente al cierre del período (o al último
  // día del mes si todavía no se abrió).
  const ultimoDia = new Date(Date.UTC(Number(anio), Number(mes), 0)).toISOString().slice(0, 10);
  const cierre = base?.hasta || ultimoDia;
  const deAlquiler = (id) => {
    const a = alquileres.find((x) => String(x._id) === id);
    const vigente = (a?.precios || []).find((p) => String(p.fecha).slice(0, 10) <= cierre);
    // Con "Alq." adelante (12/11/2026), así en "LM: … + Alq. Generador eléctrico"
    // se ve que es un alquiler. Si el nombre ya empieza con "alq", queda igual.
    const nombre = !a ? "Alquiler borrado" : /^alq/i.test(a.nombre.trim()) ? a.nombre : `Alq. ${a.nombre}`;
    return { nombre, monto: vigente ? vigente.precio : null };
  };
  const sumaMontos = (alqs) => alqs.reduce((t, a) => t + (a.monto || 0), 0);
  // Solo alquileres: cada uno cuenta 1 con su monto.
  const filaJuntada = (f) => {
    const combo = combos.get(f.clave) || { grupos: [], alquileres: [] };
    const alqs = combo.alquileres.map(deAlquiler);
    const conTareas = combo.grupos.length > 0;
    const cantLM = conTareas ? f.cantLM || 0 : alqs.length;
    const subLM = (conTareas ? f.subLM || 0 : 0) + sumaMontos(alqs);
    return {
      ...f,
      tarea: [...combo.grupos.map((g) => nombres.get(g)?.tarea || "Tarea borrada"), ...alqs.map((a) => a.nombre)].join(" + "),
      unidad: conTareas ? f.unidad : "Mes",
      grupoLM: null,
      gruposLM: combo.grupos,
      alquileresFila: alqs,
      sinMontoAlquiler: alqs.some((a) => a.monto === null),
      sinEquivalencia: false,
      cantLM,
      subLM,
      precioLM: conTareas ? f.precioLM : cantLM ? subLM / cantLM : null,
      variosPreciosLM: conTareas ? combo.grupos.length > 1 || f.variosPreciosLM : alqs.length > 1,
      difCant: (f.cantCTV || 0) - cantLM,
      dif: (f.subCTV || 0) - subLM,
    };
  };
  // La primera tarea de costos más otras tareas y/o alquileres: la fila de
  // siempre; lo pagado en las otras y los montos solo al subtotal LM.
  const pagadoDe = new Map(gruposLMPersonal.map((g) => [g.clave.slice(3), g.subtotal || 0]));
  const conExtras = (f) => {
    const ex = extrasDeFila.get(f.clave);
    const alqs = ex.alquileres.map(deAlquiler);
    const pagadoExtra = ex.grupos.reduce((t, g) => t + (pagadoDe.get(g) || 0), 0);
    const subLM = (f.subLM || 0) + pagadoExtra + sumaMontos(alqs);
    return {
      ...f,
      tareaLMCostos: [f.tareaLMCostos, ...ex.grupos.map((g) => nombres.get(g)?.tarea || "Tarea borrada"), ...alqs.map((a) => a.nombre)]
        .filter(Boolean)
        .join(" + "),
      // Para el historial: sus días suman lo pagado, no la cantidad.
      gruposLM: [...(f.gruposLM || []), ...ex.grupos],
      gruposSoloPlata: ex.grupos,
      alquileresFila: alqs,
      sinMontoAlquiler: alqs.some((a) => a.monto === null),
      subLM,
      dif: (f.subCTV || 0) - subLM,
    };
  };
  let gruposComp = compararGrupos(grupos, esCostos ? gruposLMCostos : gruposLM, cruceCostos, nombres).map((f) =>
    f.clave.startsWith("cos:") ? filaJuntada(f) : extrasDeFila.has(f.clave) ? conExtras(f) : f
  );
  // En la de costos, una tarea sin partes en el período: el precio vigente de
  // Variables de remuneración del campo al último día del rango (Citrusvil).
  if (esCostos && base?.variables && rango?.hasta) {
    const miembros = new Map();
    for (const [id, grupo] of juntas.grupoDe) miembros.set(grupo, [...(miembros.get(grupo) || []), id]);
    gruposComp = gruposComp.map((f) => {
      if (f.precioLM !== null || !f.grupoLM) return f;
      const ids = miembros.get(f.grupoLM) || [f.grupoLM];
      const precios = [
        ...new Set(
          ids.map((id) => precioVigente(base.variables, id, "Citrusvil", rango.hasta)?.neto).filter((p) => Number.isFinite(p))
        ),
      ];
      if (!precios.length) return f;
      return {
        ...f,
        precioLM: precios.reduce((a, p) => a + p, 0) / precios.length,
        variosPreciosLM: precios.length > 1,
        precioLMVariables: true,
      };
    });
  }

  return { juntas, grupos, gruposLM, gruposLMPersonal, gruposLMCostos, gruposComp, cruceCostos };
}
