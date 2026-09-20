/**
 * Los campos de Producción: la clave que se guarda y el nombre que se lee.
 *
 * Berdina y Caspinchango son el mismo lugar con dos nombres: Compras y
 * Mantenimiento le decían Berdina (de ahí la B de los pedidos, `B-001`) y
 * Producción, Caspinchango. El 19/09/2026 se unificó lo que se muestra —queda
 * **Berdina** en todo el proyecto— y la clave se dejó como estaba.
 *
 * La clave `caspinchango` está guardada en cada parte, lote, período,
 * descuento y cambio (enum e índice en el back) y va en las URLs, así que
 * cambiarla pedía migrar la base sin que nadie viera la diferencia. Por eso el
 * nombre visible sale de acá y de ningún otro lado: si mañana se vuelve a
 * llamar distinto, se toca esta lista y nada más.
 */
export const ESTABLECIMIENTOS = [
  { clave: "caspinchango", nombre: "Berdina" },
  { clave: "san-pablo", nombre: "San Pablo" },
];

export const nombreEstablecimiento = (clave) =>
  ESTABLECIMIENTOS.find((e) => e.clave === clave)?.nombre || "";
