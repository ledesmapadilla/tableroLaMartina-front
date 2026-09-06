# Formato de las tablas del Tablero

Convención que ya usan todas las tablas del proyecto. Cuando se arma una tabla
nueva, se copia de acá en vez de inventar estilos: la idea es que todas las
pantallas se lean igual.

Ejemplos canónicos:
- `src/components/pages/ProduccionInformeMes.jsx` — informes.
- `src/components/pages/ProduccionCertificadoMes.jsx` — planilla
  de carga, con encabezado fijo.
- `src/components/pages/ProduccionAltaPersonal.jsx` — altas.

---

## 1. La clase `tabla-informe`

Todo el aspecto base sale de `src/index.css` (bloque
`.tabla-informe`). Alcanza con ponerle la clase a la `<Table>`:

```jsx
<Table className="mb-0 tabla-informe" style={{ width: "auto", minWidth: "820px" }}>
```

Lo que ya trae, sin escribir nada más:

| Qué | Valor |
| --- | --- |
| Borde del marco | `1px solid #cbd5e1` |
| Borde de cada celda | `1px solid #e2e8f0` |
| Padding de celda | `2px 5px` |
| Cebra (filas pares) | `#f1f5f4` |
| Hover de fila | `#dcefe4` |
| Fila de total (`.fila-total`) | fondo `#e8f5ee` + borde superior `2px solid #1b4332` |
| Fila en edición (`.fila-editando`) | `#e0f2fe` |

El hover está escrito como `tr:hover:not(.fila-total)`, así que **la fila de
total tiene que llevar la clase `fila-total`**; si no, el hover la pinta igual
y le gana en especificidad a cualquier `background` local.

## 2. Estilos de celda

Los mismos dos objetos en todas las pantallas, definidos adentro del
componente:

```jsx
const th = {
  backgroundColor: "#1b4332",
  color: "#fff",
  fontSize: "0.66rem",
  fontWeight: 600,
  verticalAlign: "middle",
  padding: "3px 5px",
  whiteSpace: "nowrap",
};
const td = { fontSize: "0.7rem", padding: "1px 5px", verticalAlign: "middle" };
```

- Texto (nombres, tareas, observaciones) a la izquierda; números, fechas y
  códigos centrados.
- Un dato que falta va como raya gris, nunca un cero: `<span style={{ color:
  "#cbd5e1" }}>—</span>`. Un cero miente: dice que se midió y dio cero.
- Subtítulo de unidad adentro del `th`, cuando hace falta:
  `<div style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.75 }}>`.

## 3. Fila de total

```jsx
<tr className="fila-total">
  <td style={{ ...td, fontWeight: 700, color: "#1b4332" }}>TOTAL</td>
  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{numero(total)}</td>
  …
</tr>
```

El rótulo es la palabra `TOTAL` sola, en la primera columna, a la izquierda.
Los números del total van en negrita; los de las filas comunes, no.

## 4. Marco de la tabla

Fondo blanco, esquinas redondeadas, sombra, y el scroll adentro del marco —
nunca en la página:

```jsx
<div
  className="shadow-sm rounded-3 bg-white"
  style={{
    flex: "1 1 auto",
    minHeight: 0,
    alignSelf: "center",   // la tabla no se estira al ancho de la pantalla
    maxWidth: "100%",
    overflowY: "auto",
    overflowX: "auto",
    border: "1px solid #cbd5e1",
  }}
>
```

`alignSelf: "center"` la deja centrada en la página (el contenedor es
`d-flex flex-column`). En las pantallas que apilan varias tablas se usa en su
lugar `display: "inline-block"` con el mismo efecto.

Cuando la tabla es una sola y ocupa el alto de la pantalla, el encabezado va
fijo:

```jsx
<thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#1b4332", color: "#fff" }}>
```

## 5. Fila vacía

Un solo `td` con `colSpan` de todas las columnas, y el texto según el motivo:

```jsx
<td colSpan={N} className="text-center text-muted py-4" style={td}>
  {cargando ? "Cargando…" : hayFiltro ? "Ningún parte coincide con los filtros" : "No hay … cargados"}
</td>
```

## 6. Barra de filtros

`<Card className="mb-3 p-2 shadow-sm border-0 rounded-3">` con los filtros en
fila. Cada uno es el componente local `FiltroSelect`, que ya está copiado en
varias pantallas: rótulo en negrita, el select se pone en rojo y en negrita
cuando está activo (`filtro-activo`) y aparece una cruz al costado para
limpiarlo. Los desplegables largos (personal, tareas) usan
`components/shared/SelectBuscador.jsx`, que filtra con `include`.

Las opciones de un filtro salen de **todos** los datos del período, no de lo ya
filtrado: si no, elegir una persona vacía el resto de los desplegables.

## 7. Encabezado de la pantalla

Flecha de volver (`btn btn-sm btn-outline-secondary` con `bi bi-arrow-left`),
título en `#1b4332`, el chip del período con fondo `#e8f5ee`, y el botón de
Excel (`#15803d`) empujado a la derecha con `ms-auto`.

## 8. Excel

El export sigue la tabla de pantalla: título combinado arriba, línea de
período, fila de encabezado con fondo `FF1B4332` y letra blanca, bordes
`FFE2E8F0` en el cuerpo, y `ws.columns` con los anchos. Los importes llevan
`numFmt: '"$"#,##0.00'`.

---

## Excepción conocida

`ProduccionInformeTareasPersonal.jsx` no usa `fila-total`: tiene un `<style>`
propio (`total-persona` / `fin-persona`) con la fila de total sin fondo, el
rótulo `Total <persona>` a la derecha y una línea vertical gruesa antes de la
columna `$ total`. Quedó así a pedido (05/09/2026). Es la única que se aparta:
las tablas nuevas van con la convención de arriba.
