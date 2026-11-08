import { nuevoWorkbook } from "../helpers/excel";
import { claveTarea } from "./contable";

/**
 * Lee el Excel mensual de Contable (05/11/2026) y devuelve sus filas como
 * datos del sistema.
 *
 * Es la planilla de tareas de los contratistas ("Otras tareas"): una fila de
 * encabezado y debajo el detalle, con una fila de subtotal después de cada
 * tarea. Los subtotales no se leen (la tabla los calcula) y las demás hojas
 * tampoco, que son cuentas sueltas.
 *
 * Las columnas se buscan por el nombre del encabezado, no por la posición, así
 * un Excel con las columnas en otro orden se lee igual.
 *
 * Desde el 08/11/2026 además revisa el Excel y devuelve los problemas que
 * encontró, cada uno explicado: una columna que no está (y cuál parece ser la
 * que le cambiaron el nombre), un almacén mal escrito (y cuál parece ser),
 * números que no son números, subtotales que se contarían como tareas. El
 * programa no corrige nada por su cuenta (pedido del usuario): dice qué
 * cambiar en el Excel.
 *
 * Frena la carga solo lo que entra en las cuentas o las comparativas
 * (niveles "error" y "aviso"). Lo demás (una columna que solo se muestra, un
 * almacén nuevo) es "info": se advierte y se carga igual. Una unidad nueva
 * pasa sin aviso: la pide Equivalencias (EquivalenciaUnidad en el back).
 *
 * El importe de cada fila es Cant. × Precio unitario, calculado acá (y otra
 * vez en el back al guardar), no el Subtotal del Excel (08/11/2026, pedido
 * del usuario): el Subtotal es una cuenta que puede venir mal. Queda solo
 * como control: si no da Cant. × Precio unitario, frena. Se guarda en el
 * campo `subtotal` de siempre, así todo el programa lo usa sin cambios.
 */

// Encabezado del Excel → campo del sistema, con el título tal como viene.
const COLUMNAS = [
  ["documentoCompras", "Documento compras"],
  ["ordenTrabajo", "Orden de trabajo"],
  ["fecha", "Fecha/Hora creación"],
  ["almacen", "Denominación almacén"],
  ["contratista", "Contratista"],
  ["nroServicio", "Número de servicio"],
  ["tarea", "Detalle de tarea"],
  ["cantidad", "Cant."],
  ["unidad", "Unidad medida base"],
  ["precioUnitario", "Precio unitario"],
  ["subtotal", "Subtotal"],
  ["ordenControl", "Orden de control"],
  ["centroCosteCodigo", "Centro de coste"],
  ["centroCosto", "Centro de costo"],
  ["activoFijo", "Activo fijo"],
];
const TITULO = Object.fromEntries(COLUMNAS);

// Otros nombres con los que puede venir cada columna, para sugerir cuál es
// cuando no aparece la de siempre. Se comparan como claveTarea (sin
// mayúsculas, acentos, espacios ni signos).
const SINONIMOS = {
  tarea: ["detalletarea", "detalletareas", "descripciondetarea", "descripciontarea", "descripcion", "tarea", "tareas", "detalle", "textobreve", "servicio descripcion"],
  cantidad: ["cantidad", "cantidades", "cant", "cantid", "qty"],
  subtotal: ["sub total", "importe", "importetotal", "total", "monto", "valor", "valorneto", "importeneto"],
  almacen: ["almacen", "denominaciondealmacen", "nombrealmacen", "finca", "campo", "deposito", "lugar"],
  fecha: ["fecha", "fechacreacion", "fechadecreacion", "fechahora", "fechadocumento"],
  unidad: ["unidad", "unidaddemedida", "unidadmedida", "unidaddemedidabase", "um", "umb", "unid"],
  precioUnitario: ["precio", "preciounit", "punitario", "preciounidad", "precioporunidad"],
  documentoCompras: ["documentodecompras", "doccompras", "documentocompra", "nrodocumento", "pedidodecompras", "ordendecompra", "documento"],
  contratista: ["proveedor", "nombreproveedor", "contratistas", "razonsocial"],
  ordenTrabajo: ["ot", "ordentrabajo", "nroot", "ordendetrabajos"],
  nroServicio: ["nroservicio", "nservicio", "numeroservicio", "nrodeservicio", "servicio"],
  ordenControl: ["ordencontrol", "oc"],
  centroCosteCodigo: ["codigocentrodecoste", "codcentrocoste", "cecos"],
  centroCosto: ["centrodecostos", "nombrecentrodecosto", "denominacioncentrodecosto"],
  activoFijo: ["activo", "af", "activosfijos"],
};

// Sin estas no hay tabla. El importe sale de Cant. × Precio unitario.
const OBLIGATORIAS = ["tarea", "cantidad", "precioUnitario"];
// Las que distinguen una tarea de su fila de subtotal: el subtotal no trae
// ninguna de las tres.
const DE_TAREA = ["documentoCompras", "almacen", "contratista"];

const NUMEROS = new Set(["cantidad", "precioUnitario", "subtotal"]);

// Lo que pasa si falta cada columna (y no se encontró a cuál le cambiaron el
// nombre). Las obligatorias no están: sin ellas no se carga.
const SI_FALTA = {
  subtotal: [
    "info",
    "el importe de cada fila sale de Cant. × Precio unitario, así que se carga igual, pero no se puede controlar que esa cuenta coincida con la del Excel.",
  ],
  almacen: ["aviso", "las comparativas no van a poder separar Berdina de San Pablo y van a quedar vacías."],
  unidad: [
    "aviso",
    "Equivalencias no va a poder controlar que no se junten tareas de distinta unidad (horas con plantas, por ejemplo), y la unidad va a quedar vacía en las comparativas.",
  ],
  fecha: ["aviso", "el historial día por día de las comparativas va a quedar sin fechas."],
  documentoCompras: ["info", "va a quedar vacía en la tabla. Es una de las tres columnas con las que se reconocen las filas de subtotal, pero con almacén y contratista alcanza."],
  contratista: ["info", "va a quedar vacía en la tabla. Es una de las tres columnas con las que se reconocen las filas de subtotal, pero con almacén y documento alcanza."],
  centroCosto: ["info", "va a quedar vacía en la tabla, en el filtro CC y en el detalle de la comparativa. No afecta las cuentas."],
};
const SI_FALTA_OTRA = ["info", "va a quedar vacía en la tabla. No afecta las cuentas."];
// Las que entran en las cuentas o las comparativas: un problema en ellas
// frena la carga.
const DE_CALCULO = new Set(["tarea", "cantidad", "precioUnitario", "subtotal", "almacen", "unidad", "fecha"]);

// Los almacenes que se conocen. Caspinchango también vale: el back lo cambia
// por Berdina al guardar (catalogos/nombreBerdina.js).
const ALMACENES = [
  { nombre: "Berdina", clave: "berdina", siglas: ["b", "bd", "ber", "berd"] },
  { nombre: "San Pablo", clave: "sanpablo", siglas: ["sp", "sanp", "spablo", "stapablo", "stpablo", "spa"] },
  { nombre: "Cevil Pozo", clave: "cevilpozo", siglas: ["cp", "cevil", "cpozo"] },
];
const PREFIJOS_CASPINCHANGO = ["caspinch", "kaspinch", "caspich", "kaspich"];

const COLUMNA_EXACTA = new Map(COLUMNAS.map(([campo, titulo]) => [claveTarea(titulo), campo]));

/** Distancia de edición (letras de más, de menos o cambiadas). */
const distancia = (a, b) => {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
};

/** Qué tanto se parece un encabezado a una columna, de 0 a 1. */
const parecido = (encabezado, campo) => {
  const k = claveTarea(encabezado);
  if (!k) return 0;
  const formas = [claveTarea(TITULO[campo]), ...(SINONIMOS[campo] || []).map(claveTarea)];
  let mejor = 0;
  for (const f of formas) {
    if (k === f) return 1;
    // Abreviada o con algo de más: "cant" / "cantidad", "subtotalneto".
    const corta = k.length < f.length ? k : f;
    const larga = k.length < f.length ? f : k;
    if (corta.length >= 3 && larga.startsWith(corta)) mejor = Math.max(mejor, 0.85);
    else if (corta.length >= 5 && larga.includes(corta)) mejor = Math.max(mejor, 0.75);
    mejor = Math.max(mejor, 1 - distancia(k, f) / Math.max(k.length, f.length));
  }
  return mejor;
};
const PARECIDO_MINIMO = 0.6;

/** El almacén conocido al que se parece un texto, o null. */
const almacenParecido = (texto) => {
  const k = claveTarea(texto);
  if (!k) return null;
  // "Caspinch I", "Finca Caspinchango": el back los dejaría en "Berdina I",
  // que no entra en la comparativa.
  const letras = k.replace(/[^a-z]/g, "");
  if (PREFIJOS_CASPINCHANGO.some((p) => letras.includes(p))) return "Berdina";
  for (const a of ALMACENES) {
    if (a.siglas.includes(k)) return a.nombre;
    if (k.includes(a.clave)) return a.nombre; // "Finca San Pablo", "Berdina I"
    if (k.length >= 4 && a.clave.startsWith(k)) return a.nombre; // "San P"
    if (k.length >= 5 && distancia(k, a.clave) <= 2) return a.nombre; // "San Pablos", "Verdina"
  }
  return null;
};
// Conocido = entra tal cual en la comparativa: el nombre justo, o
// Caspinchango solo (mal escrito o no), que el back pasa a "Berdina".
const esAlmacenConocido = (texto) => {
  const k = claveTarea(texto);
  if (ALMACENES.some((a) => a.clave === k)) return true;
  return k.length >= 9 && distancia(k, "caspinchango") <= 2;
};

/** El valor de una celda de exceljs, sin fórmulas ni texto con formato. */
const valorDe = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return valorDe(v.result);
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text; // hipervínculo
    return null; // error de fórmula u otra cosa
  }
  return v;
};

/** El valor ya como dato del sistema; `invalido` si había algo y no se entendió. */
const aCampo = (campo, v) => {
  if (v === null || v === "" || (typeof v === "string" && !v.trim())) return { valor: null };
  if (NUMEROS.has(campo)) {
    if (typeof v === "number") return { valor: Number.isFinite(v) ? v : null, invalido: !Number.isFinite(v) };
    // Como texto puede venir "1.234,56" (con coma decimal) o "1234.56".
    const s = String(v).replace(/[$\s]/g, "");
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? { valor: n } : { valor: null, invalido: true };
  }
  if (campo === "fecha") {
    if (v instanceof Date) return { valor: v.toISOString() };
    // dd/mm/aaaa, por si viene como texto
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v).trim());
    return m ? { valor: new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString() } : { valor: null, invalido: true };
  }
  const s = String(v).trim();
  return { valor: s || null };
};

/** A centavos, como un importe. */
const redondear = (n) => Math.round(n * 100) / 100;
// Diferencia entre el Subtotal del Excel y Cant. × Precio unitario que se
// toma como redondeo: menos de medio peso. En los Excel cargados hasta el
// 08/11/2026 todas dan con menos de medio centavo.
const TOLERANCIA = 0.5;
const numero = (n) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 4 });
const pesos = (n) => `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "filas 12, 15 y 20" / "filas 12, 15, 20 y 7 más". */
const nroFilas = (lista) => {
  if (lista.length === 1) return `fila ${lista[0]}`;
  const max = 5;
  if (lista.length <= max) return `filas ${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
  return `filas ${lista.slice(0, max).join(", ")} y ${lista.length - max} más`;
};
const filasN = (n) => (n === 1 ? "1 fila" : `${n} filas`);
const lista = (textos) =>
  textos.length <= 1 ? textos.join("") : `${textos.slice(0, -1).join(", ")} y ${textos[textos.length - 1]}`;

/**
 * La hoja con la tabla: la fila (de las primeras 15 de cada hoja) con más
 * encabezados conocidos. Devuelve la hoja, la fila, columna → campo y los
 * encabezados que no se reconocieron, para buscar ahí los que faltan.
 */
const buscarTabla = (wb) => {
  let mejor = null;
  wb.eachSheet((ws) => {
    const tope = Math.min(ws.rowCount, 15);
    for (let r = 1; r <= tope; r++) {
      const mapa = {};
      const otros = [];
      ws.getRow(r).eachCell({ includeEmpty: false }, (celda, col) => {
        const texto = String(valorDe(celda.value) ?? "").trim();
        if (!texto) return;
        const campo = COLUMNA_EXACTA.get(claveTarea(texto));
        if (campo && !Object.values(mapa).includes(campo)) mapa[col] = campo;
        else otros.push({ col, texto, repetida: campo || null });
      });
      const n = Object.keys(mapa).length;
      if (n >= 3 && (!mejor || n > Object.keys(mejor.mapa).length)) mejor = { ws, filaEncabezado: r, mapa, otros };
    }
  });
  return mejor;
};

/**
 * Lee el Excel (ArrayBuffer) y lo revisa.
 * → { filas, problemas: [{ nivel: "error" | "aviso" | "info", texto }] }
 *
 * "error" y "aviso" frenan la carga; "info" se advierte y se carga igual. Si
 * no es un Excel, tira un Error.
 */
export async function leerExcelContable(buffer) {
  const wb = await nuevoWorkbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error("No se pudo leer el archivo. Tiene que ser un Excel .xlsx.");
  }

  const problemas = [];
  const agregar = (nivel, texto) => problemas.push({ nivel, texto });

  const tabla = buscarTabla(wb);
  if (!tabla) {
    agregar(
      "error",
      "No se encontró la fila de encabezados en las primeras 15 filas de ninguna hoja. Se busca una fila con títulos como «Detalle de tarea», «Cant.», «Precio unitario» y «Denominación almacén». Puede que les hayan cambiado el nombre a casi todos o que la tabla empiece más abajo."
    );
    return { filas: [], problemas };
  }

  const { ws, filaEncabezado, mapa, otros } = tabla;
  const columnaDe = Object.fromEntries(Object.entries(mapa).map(([col, campo]) => [campo, Number(col)]));

  // ── Las columnas que faltan: ¿a cuál le cambiaron el nombre? ──
  const faltan = COLUMNAS.map(([campo]) => campo).filter((c) => !(c in columnaDe));
  const candidatos = [];
  for (const campo of faltan) {
    for (const o of otros) {
      if (o.repetida) continue;
      const p = parecido(o.texto, campo);
      if (p >= PARECIDO_MINIMO) candidatos.push({ campo, o, p });
    }
  }
  candidatos.sort((a, b) => b.p - a.p);
  const usadas = new Set();
  const sugerida = {};
  for (const c of candidatos) {
    if (sugerida[c.campo] || usadas.has(c.o.col)) continue;
    sugerida[c.campo] = c.o;
    usadas.add(c.o.col);
  }

  for (const campo of faltan) {
    const o = sugerida[campo];
    if (o) {
      agregar(
        OBLIGATORIAS.includes(campo) ? "error" : (SI_FALTA[campo] || SI_FALTA_OTRA)[0],
        `No está la columna «${TITULO[campo]}»: es probable que le hayan cambiado el nombre a «${o.texto}». Cambiale el título a «${TITULO[campo]}».`
      );
    } else if (OBLIGATORIAS.includes(campo)) {
      agregar("error", `No está la columna «${TITULO[campo]}» y no se encontró ninguna parecida: sin ella no se puede armar la tabla.`);
    } else {
      const [nivel, efecto] = SI_FALTA[campo] || SI_FALTA_OTRA;
      agregar(nivel, `No está la columna «${TITULO[campo]}»: ${efecto}`);
    }
  }
  const sinUsar = otros.filter((o) => !usadas.has(o.col));
  const repetidas = sinUsar.filter((o) => o.repetida);
  const ajenas = sinUsar.filter((o) => !o.repetida);
  for (const o of repetidas) {
    agregar(
      DE_CALCULO.has(o.repetida) ? "aviso" : "info",
      `La columna «${o.texto}» está repetida: solo se lee la de más a la izquierda. Dejá una sola con ese título.`
    );
  }
  if (ajenas.length && faltan.some((c) => !sugerida[c])) {
    agregar(
      "info",
      `Estas columnas el programa no las usa: ${lista(ajenas.map((o) => `«${o.texto}»`))}. Si alguna es una de las que faltan con otro nombre, cambiale el título en el Excel.`
    );
  }
  if (problemas.some((p) => p.nivel === "error")) return { filas: [], problemas };

  // ── Las filas ──
  const invalidos = {}; // campo → filas del Excel
  const leidas = []; // { nro, fila, subtotal }
  for (let r = filaEncabezado + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fila = {};
    for (const [campo, col] of Object.entries(columnaDe)) {
      const { valor, invalido } = aCampo(campo, valorDe(row.getCell(col).value));
      if (invalido) (invalidos[campo] ||= []).push(r);
      if (valor !== null) fila[campo] = valor;
    }
    if (!Object.keys(fila).length) continue; // fila vacía
    // La de subtotal trae solo la tarea, la cantidad y el subtotal: ni
    // documento, ni almacén, ni contratista.
    leidas.push({ nro: r, fila, subtotal: DE_TAREA.every((c) => !fila[c]) });
  }

  if (!leidas.some((l) => !l.subtotal)) {
    const sinColumnas = DE_TAREA.filter((c) => !(c in columnaDe));
    // El error ya lo explica: fuera los avisos de cada una ("con las otras
    // alcanza").
    if (sinColumnas.length === DE_TAREA.length) {
      const titulos = DE_TAREA.map((c) => `No está la columna «${TITULO[c]}»`);
      for (let i = problemas.length - 1; i >= 0; i--) {
        if (titulos.some((t) => problemas[i].texto.startsWith(t))) problemas.splice(i, 1);
      }
    }
    agregar(
      "error",
      sinColumnas.length === DE_TAREA.length
        ? `No quedó ninguna tarea: faltan las columnas ${lista(DE_TAREA.map((c) => `«${TITULO[c]}»`))}, que son las que distinguen una tarea de su fila de subtotal, y sin ellas todas las filas se toman como subtotales.`
        : "No quedó ninguna tarea: ninguna fila tiene documento, almacén ni contratista, así que todas se toman como subtotales."
    );
    return { filas: [], problemas };
  }

  // ── El importe: Cant. × Precio unitario ──
  // Lo del Excel queda en `subtotalExcel` solo para controlarlo.
  for (const l of leidas) {
    if (l.subtotal) continue;
    const { cantidad, precioUnitario } = l.fila;
    l.subtotalExcel = l.fila.subtotal;
    if (cantidad !== undefined && precioUnitario !== undefined) l.fila.subtotal = redondear(cantidad * precioUnitario);
    else delete l.fila.subtotal;
  }

  // ── Subtotales que se contarían como tareas ──
  // Una fila que suma lo de las de arriba de la misma tarea (dos o más) pero
  // trae documento, almacén o contratista: se contaría dos veces.
  const dudosas = new Set();
  let grupo = [];
  const cerca = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.01;
  for (const l of leidas) {
    if (l.subtotal) {
      grupo = [];
      continue;
    }
    const k = claveTarea(l.fila.tarea);
    if (grupo.length && claveTarea(grupo[0].fila.tarea) === k) {
      const cant = grupo.reduce((s, g) => s + (g.fila.cantidad || 0), 0);
      const sub = grupo.reduce((s, g) => s + (g.fila.subtotal || 0), 0);
      if (grupo.length >= 2 && k && cerca(cant, l.fila.cantidad) && cerca(sub, l.fila.subtotal)) {
        dudosas.add(l.nro);
        grupo = [];
        continue;
      }
      grupo.push(l);
    } else {
      grupo = [l];
    }
  }
  if (dudosas.size) {
    agregar(
      "aviso",
      `${dudosas.size === 1 ? "La" : "Las"} ${nroFilas([...dudosas])} ${dudosas.size === 1 ? "parece un subtotal" : "parecen subtotales"} (suma lo de las filas de arriba de la misma tarea), pero trae documento, almacén o contratista, así que se contaría como una tarea más y esa tarea quedaría sumada dos veces. Si es un subtotal, tiene que ir sin documento, almacén ni contratista; si no, revisá que no esté repetida.`
    );
  }

  const filas = leidas.filter((l) => !l.subtotal);

  // ── Números y fechas que no se entendieron ──
  for (const campo of ["cantidad", "subtotal", "precioUnitario", "fecha"]) {
    const nros = (invalidos[campo] || []).filter((n) => filas.some((l) => l.nro === n));
    if (!nros.length) continue;
    const queda = campo === "fecha" ? "no es una fecha" : "no es un número";
    agregar("aviso", `En ${filasN(nros.length)} (${nroFilas(nros)}) «${TITULO[campo]}» ${queda}: corregilo.`);
  }

  // ── Datos que faltan en filas de tarea ──
  const sinTarea = filas.filter((l) => !l.fila.tarea).map((l) => l.nro);
  if (sinTarea.length) {
    agregar(
      "aviso",
      `${filasN(sinTarea.length)} sin «Detalle de tarea» (${nroFilas(sinTarea)}): no se podrían juntar con ninguna tarea de La Martina. Completalo.`
    );
  }
  for (const campo of ["cantidad", "precioUnitario"]) {
    const nros = filas.filter((l) => l.fila[campo] === undefined && !(invalidos[campo] || []).includes(l.nro)).map((l) => l.nro);
    if (nros.length) {
      agregar(
        "aviso",
        `${filasN(nros.length)} sin «${TITULO[campo]}» (${nroFilas(nros)}): sin eso no se puede calcular el importe (Cant. × Precio unitario). Completalo.`
      );
    }
  }

  // ── El Subtotal del Excel tiene que dar Cant. × Precio unitario ──
  const malSumadas = filas.filter(
    (l) => l.subtotalExcel !== undefined && l.fila.subtotal !== undefined && Math.abs(l.subtotalExcel - l.fila.subtotal) >= TOLERANCIA
  );
  if (malSumadas.length) {
    const max = 5;
    const detalle = malSumadas
      .slice(0, max)
      .map(
        (l) =>
          `fila ${l.nro}: ${numero(l.fila.cantidad)} × ${pesos(l.fila.precioUnitario)} = ${pesos(l.fila.subtotal)}, pero el Subtotal dice ${pesos(l.subtotalExcel)}`
      )
      .join("; ");
    agregar(
      "aviso",
      `En ${filasN(malSumadas.length)} el Subtotal no da Cant. × Precio unitario (${detalle}${malSumadas.length > max ? ` y ${malSumadas.length - max} más` : ""}). Revisá cuál está mal.`
    );
  }

  // ── Almacenes ──
  if ("almacen" in columnaDe) {
    const porAlmacen = new Map();
    const sinAlmacen = [];
    for (const l of filas) {
      const a = l.fila.almacen;
      if (!a) sinAlmacen.push(l.nro);
      else if (!esAlmacenConocido(a)) (porAlmacen.get(a) || porAlmacen.set(a, []).get(a)).push(l);
    }
    for (const [a, ls] of porAlmacen) {
      const parece = almacenParecido(a);
      if (parece) {
        agregar(
          "aviso",
          `Hay un almacén con el nombre «${a}» (${filasN(ls.length)}): es probable que quiera decir «${parece}». Cambialo por «${parece}».`
        );
      } else {
        // Un almacén nuevo de verdad pasa: solo se avisa (08/11/2026).
        agregar(
          "info",
          `El almacén «${a}» (${filasN(ls.length)}) no es Berdina ni San Pablo: se carga y se ve en la tabla del mes, pero no entra en ninguna comparativa.`
        );
      }
    }
    if (sinAlmacen.length) {
      agregar(
        "aviso",
        `${filasN(sinAlmacen.length)} sin almacén (${nroFilas(sinAlmacen)}): no entrarían en ninguna comparativa. Completalo.`
      );
    }
  }

  return { filas: filas.map((l) => l.fila), problemas };
}
