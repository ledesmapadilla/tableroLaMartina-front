/**
 * Los guardados de Contable › Caja van por detrás y de a uno (13/11/2026).
 * La cola es una sola para todas las pantallas de Caja: antes de leer una
 * semana o un mes se espera a que termine lo que está en camino, así el
 * sobrante de la semana anterior no se lee a medio guardar.
 */
let cola = Promise.resolve();

/** Pone `tarea` (función que devuelve una promesa) al final de la cola. */
export const enCola = (tarea) => {
  const resultado = cola.then(tarea);
  cola = resultado.catch(() => {});
  return resultado;
};

/** Se resuelve cuando termina todo lo que está en la cola. */
export const esperarGuardados = () => cola;

/**
 * Lo último que se trajo de cada semana y de cada mes (13/11/2026): la
 * pantalla lo muestra al instante y lo actualiza cuando contesta el back.
 * Vive mientras la pestaña está abierta. Claves: "semana/2026-11-13",
 * "mes/2026-11".
 */
const memoria = new Map();
export const deMemoria = (clave) => memoria.get(clave) || null;
export const aMemoria = (clave, datos) => {
  if (datos) memoria.set(clave, datos);
};

/** Trae una semana o un mes de Caja (después de los guardados) y lo recuerda. */
export const traerCaja = (clave, api) =>
  esperarGuardados()
    .then(() => api.get(`/contable/caja/${clave}`))
    .then((d) => {
      aMemoria(clave, d);
      return d;
    });

/**
 * Las semanas de un mes armadas acá (viernes a jueves, cada una en el mes de
 * su viernes), sin la cuenta: para mostrar las tarjetas antes de que llegue.
 * `mes` de 1 a 12.
 */
export const semanasLocales = (anio, mes) => {
  const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  const f = new Date(anio, mes - 1, 1);
  f.setDate(f.getDate() + ((5 - f.getDay() + 7) % 7)); // el primer viernes
  const lista = [];
  while (f.getMonth() === mes - 1) {
    const hasta = new Date(f);
    hasta.setDate(hasta.getDate() + 6);
    lista.push({ semana: iso(f), hasta: iso(hasta) });
    f.setDate(f.getDate() + 7);
  }
  return lista;
};
