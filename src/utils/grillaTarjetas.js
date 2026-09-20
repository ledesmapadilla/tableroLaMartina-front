/**
 * La grilla de tarjetas de una pantalla que muestra distinto según el rol.
 *
 * Las columnas salen de **cuántas tarjetas se ven**, no de cuántas hay: con
 * `repeat(3, 1fr)` y dos tarjetas visibles quedaba una columna vacía a la
 * derecha y las dos corridas a la izquierda (19/09/2026). El ancho máximo
 * acompaña a las columnas, así una tarjeta sola tampoco se estira a lo ancho de
 * la pantalla.
 *
 * `ancho` es lo que mide una tarjeta cómoda en esa pantalla y `maxColumnas`
 * cuántas entran por fila antes de pasar a la siguiente.
 *
 * Se usa con spread en el style del contenedor:
 *
 *   <div style={{ ...grillaCentrada(visibles.length), gap: "1.75rem" }}>
 */
export const grillaCentrada = (cantidad, { ancho = 320, maxColumnas = 3 } = {}) => {
  const columnas = Math.min(Math.max(cantidad, 1), maxColumnas);
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columnas}, 1fr)`,
    width: "100%",
    maxWidth: `${columnas * ancho}px`,
    margin: "0 auto",
  };
};

/**
 * Lo que le falta a la última tarjeta de una grilla de `columnas` columnas
 * cuando la fila de abajo queda incompleta: ocupa la fila entera y se centra
 * con el ancho de una sola columna. Sin esto la última queda pegada a la
 * izquierda.
 *
 * `gap` es el mismo que lleva la grilla, en la unidad que sea.
 */
export const ultimaCentrada = (indice, cantidad, columnas, gap = "1.75rem") => {
  const sobran = cantidad % columnas;
  const esUltima = indice === cantidad - 1;
  if (!sobran || !esUltima || sobran !== 1) return undefined;
  return {
    gridColumn: `span ${columnas}`,
    width: `calc(${100 / columnas}% - ${gap} * ${(columnas - 1) / columnas})`,
    margin: "0 auto",
  };
};
