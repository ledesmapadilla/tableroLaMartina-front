import { useEffect, useId, useRef, useState } from "react";
import { Form } from "react-bootstrap";

/**
 * Barras por centro de costo al lado de las tablas del informe del mes
 * (27/09/2026). En las abscisas los CC, de menor a mayor; en las ordenadas la
 * medida que se esté mirando. El switch elige las horas contra las que se
 * calcula: las de turno o las del horómetro del CC.
 *
 * - `porTarea`: las filas son de CC y tarea; arriba aparece un select con las
 *   tareas y se grafican los CC de la elegida.
 * - `tipo`: "consumo" o "produccion", qué se puede graficar (ver MEDIDAS_CONSUMO y
 *   MEDIDAS_PRODUCCION). Con más de una aparece un select para elegirla; si
 *   la elegida no depende de las horas, el switch queda apagado.
 *
 * El alto acompaña al de la tabla (`altoTabla`) entre un mínimo y un máximo:
 * una tabla de tres filas no deja un gráfico aplastado, y una de cuarenta no
 * lo estira hasta el piso.
 */
const ALTO_MIN = 240;
const ALTO_MAX = 440;
// Lo que ocupa el encabezado del recuadro (el título).
const ALTO_ENCABEZADO = 38;

const COLOR = "#2d6a4f";
const COLOR_HOVER = "#40916c";
const GRILLA = "#e2e8f0";
const TEXTO = "#475569";
const TEXTO_SUAVE = "#94a3b8";

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
// Los litros por planta dan 0,0049: con dos decimales se verían como cero.
const nfFino = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

// Las medidas de producción usan solo los partes que cuentan para producción
// (en herbicida y desmalezado de San Pablo, los de lotes terminados).
const horasProdDe = (f, hsCC) => (hsCC ? f.horasCCProd ?? f.horasCC : f.horasTurnoProd ?? f.horasTurno);
// Consumo: los litros consumidos (no cargados) de los tramos entre cargas
// cerrados, y sus horas (27/09/2026).
const horasConsDe = (f, hsCC) => (hsCC ? f.horasCCCons : f.horasTurnoCons);
const textoHoras = (hsCC) => (hsCC ? "hs CC" : "hs turno");
const unidadDe = (f) => f?.unidad || "un";

/**
 * Cada medida dice de qué campo de la fila sale, en qué unidad se lee y qué
 * cuenta muestra el cartel al pasar el mouse. `usaHoras`: si cambia con el
 * switch de horas.
 */
const MEDIDAS_CONSUMO = [
  {
    id: "consumo",
    nombre: "Consumo",
    titulo: "Consumo por CC",
    usaHoras: true,
    campo: (hsCC) => (hsCC ? "consumoCC" : "consumo"),
    unidad: (_f, hsCC) => `lts / ${textoHoras(hsCC)}`,
    detalle: (f, hsCC) =>
      `${nf.format(f.litrosCons)} lts gastados en ${nf.format(horasConsDe(f, hsCC))} hs (medido entre llenados de tanque)`,
  },
];

const MEDIDAS_PRODUCCION = [
  {
    id: "rendimiento",
    nombre: "Rendimiento",
    titulo: "Rendimiento por CC",
    usaHoras: true,
    campo: (hsCC) => (hsCC ? "rendimientoCC" : "rendimiento"),
    unidad: (f, hsCC) => `${unidadDe(f)} / ${textoHoras(hsCC)}`,
    detalle: (f, hsCC) =>
      `${nf.format(f.cantidad)} ${unidadDe(f)} en ${nf.format(horasProdDe(f, hsCC))} hs`,
  },
  {
    id: "ltsPorUnidad",
    nombre: "Consumo (lts / unidad)",
    titulo: "Litros por unidad",
    usaHoras: false,
    fino: true,
    campo: () => "ltsPorUnidad",
    unidad: (f) => `lts / ${unidadDe(f)}`,
    detalle: (f) =>
      `${nf.format(f.litrosConsProd)} lts consumidos para ${nf.format(f.cantidadConsProd)} ${unidadDe(f)}`,
  },
  {
    id: "unidadPorLts",
    nombre: "Consumo (unidad / lts)",
    titulo: "Unidades por litro",
    usaHoras: false,
    fino: true,
    campo: () => "unidadPorLts",
    unidad: (f) => `${unidadDe(f)} / lts`,
    detalle: (f) =>
      `${nf.format(f.cantidadConsProd)} ${unidadDe(f)} con ${nf.format(f.litrosConsProd)} lts consumidos`,
  },
];

// Las medidas de cada gráfico, por el `tipo` que recibe.
const MEDIDAS = { consumo: MEDIDAS_CONSUMO, produccion: MEDIDAS_PRODUCCION };

// Divisiones redondas del eje: 0, 5, 10… o 0, 20, 40… según el máximo. Sirve
// también para valores chicos (0, 0,002, 0,004…).
const divisiones = (maximo) => {
  if (!(maximo > 0)) return [0, 1];
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= crudo);
  const cantidad = Math.ceil(maximo / paso - 1e-9);
  return Array.from({ length: cantidad + 1 }, (_, i) => Number((i * paso).toPrecision(12)));
};

// Barra con la punta redondeada y la base recta, apoyada en el eje.
const caminoBarra = (x, y, ancho, alto) => {
  const r = Math.min(4, ancho / 2, alto);
  return (
    `M${x},${y + alto}V${y + r}Q${x},${y} ${x + r},${y}` +
    `H${x + ancho - r}Q${x + ancho},${y} ${x + ancho},${y + r}V${y + alto}Z`
  );
};

// Los select de la segunda fila (tarea y medida), con el formato de los filtros.
const Selector = ({ etiqueta, valor, onChange, opciones }) => (
  <div className="d-flex align-items-center gap-1" style={{ flex: "1 1 150px", minWidth: 0 }}>
    <span className="fw-bold text-dark flex-shrink-0" style={{ fontSize: "0.74rem" }}>
      {etiqueta}:
    </span>
    <Form.Select
      size="sm"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      disabled={opciones.length === 0}
      className="rounded-3"
      style={{ fontSize: "0.76rem", height: "28px", padding: "2px 24px 2px 8px", color: "#1e293b" }}
    >
      {opciones.map(([id, nombre]) => (
        <option key={id} value={id}>
          {nombre}
        </option>
      ))}
    </Form.Select>
  </div>
);

function GraficoConsumoCC({ filas: todas, altoTabla = 0, porTarea = false, tipo = "consumo" }) {
  const medidas = MEDIDAS[tipo] || MEDIDAS.consumo;
  const idSwitch = useId();
  const [porHorasCC, setPorHorasCC] = useState(false);
  const [tareaElegida, setTareaElegida] = useState("");
  const [medidaElegida, setMedidaElegida] = useState(medidas[0].id);
  const [encima, setEncima] = useState(null);
  const [{ ancho, altoSvg }, setMedida] = useState({ ancho: 0, altoSvg: 0 });
  const refCaja = useRef(null);

  // El lugar sale de lo que le deja la tabla: se vuelve a medir si cambia.
  useEffect(() => {
    const caja = refCaja.current;
    if (!caja) return undefined;
    const obs = new ResizeObserver(([e]) =>
      setMedida({ ancho: Math.floor(e.contentRect.width), altoSvg: Math.floor(e.contentRect.height) })
    );
    obs.observe(caja);
    return () => obs.disconnect();
  }, []);

  const medida = medidas.find((x) => x.id === medidaElegida) || medidas[0];
  // Sin horas en la medida, el switch no cambia nada: se lee como apagado.
  const hsCC = medida.usaHoras && porHorasCC;
  const formato = medida.fino ? nfFino : nf;

  // Las tareas del select salen de las filas que llegan (ya filtradas por la
  // tabla). Si la elegida desaparece con un filtro, se toma la primera.
  const tareas = porTarea
    ? [...new Map(todas.map((f) => [String(f.idTarea), f.tarea])).entries()].sort((a, b) =>
        String(a[1]).localeCompare(String(b[1]), "es", { sensitivity: "base" })
      )
    : [];
  const tarea = tareas.some(([id]) => id === tareaElegida) ? tareaElegida : tareas[0]?.[0] || "";
  const filas = porTarea ? todas.filter((f) => String(f.idTarea) === tarea) : todas;

  const campo = medida.campo(hsCC);
  // De menor a mayor: el más alto queda a la derecha.
  const datos = filas
    .filter((f) => f[campo] !== null && f[campo] !== undefined && f[campo] > 0)
    .sort((a, b) => a[campo] - b[campo]);
  const sinDato = filas.length - datos.length;
  // Con una tarea elegida todas las filas tienen la misma unidad.
  const unidad = medida.unidad(datos[0] || filas[0], hsCC);

  const altoTotal = Math.max(ALTO_MIN, Math.min(ALTO_MAX, altoTabla || 0));
  // Compacto: el ancho va con la cantidad de CC (unos 30 px por barra) y el
  // recuadro se centra en el lugar libre al lado de la tabla.
  const anchoIdeal = Math.min(600, Math.max(340, datos.length * 30 + 60));

  const escala = divisiones(Math.max(0, ...datos.map((d) => d[campo])));
  const tope = escala[escala.length - 1] || 1;

  // Márgenes: a la izquierda los números del eje; abajo los CC, parados a
  // 90° (27/09/2026): el margen es el largo del CC más largo.
  const largoCC = Math.max(2, ...datos.map((d) => String(d.cc).length));
  const largoEje = Math.max(...escala.map((v) => formato.format(v).length));
  const m = {
    arriba: 16,
    derecha: 8,
    abajo: Math.round(largoCC * 7.5) + 12,
    izquierda: Math.max(32, largoEje * 6 + 12),
  };
  const anchoPlot = Math.max(0, ancho - m.izquierda - m.derecha);
  const altoPlot = Math.max(0, altoSvg - m.arriba - m.abajo);
  const pasoX = datos.length ? anchoPlot / datos.length : 0;
  const anchoBarra = Math.max(2, Math.min(24, pasoX - 2));
  // El valor arriba de cada barra solo si entra sin pisarse con el vecino.
  const conValor = pasoX >= (medida.fino ? 34 : 26);

  const y = (v) => m.arriba + altoPlot - (v / tope) * altoPlot;

  const sinDatosTexto = hsCC
    ? "Ningún CC tiene horas de horómetro cargadas en estos partes"
    : "No hay datos para graficar";
  const motivoSinDato = medida.usaHoras
    ? `sin ${hsCC ? "horas de horómetro" : "horas de turno"}`
    : "sin cantidad o sin combustible";

  return (
    <div className="position-relative" style={{ width: `min(100%, ${anchoIdeal}px)` }}>
      {/* El switch va afuera, arriba a la derecha del recuadro: adentro
          estorbaba la vista del gráfico (27/09/2026). Queda en el espacio libre
          a la altura de los títulos de la tabla, sin correr el recuadro. */}
      <div
        className="position-absolute d-flex align-items-center gap-2"
        style={{
          bottom: "100%",
          right: 0,
          marginBottom: 4,
          fontSize: "0.72rem",
          opacity: medida.usaHoras ? 1 : 0.45,
        }}
        title={medida.usaHoras ? undefined : "Esta medida no depende de las horas"}
      >
        <span style={{ color: hsCC ? TEXTO_SUAVE : "#1b4332", fontWeight: hsCC ? 400 : 700 }}>Hs turno</span>
        <Form.Check
          type="switch"
          id={idSwitch}
          checked={hsCC}
          disabled={!medida.usaHoras}
          onChange={(e) => setPorHorasCC(e.target.checked)}
          className="mb-0"
          title="Cambiar entre horas de turno y horas del horómetro del CC"
        />
        <span style={{ color: hsCC ? "#1b4332" : TEXTO_SUAVE, fontWeight: hsCC ? 700 : 400 }}>Hs CC</span>
      </div>

    <div
      className="bg-white rounded-3 shadow-sm d-flex flex-column"
      style={{ border: "2px solid #1b4332", height: altoTotal, overflow: "hidden" }}
    >
      {/* Encabezado blanco: el título en verde oscuro y más grande para que se
          destaque. */}
      <div
        className="d-flex align-items-center gap-2 px-2"
        style={{ height: ALTO_ENCABEZADO, borderBottom: "1px solid #e2e8f0" }}
      >
        <span className="fw-bold text-truncate" style={{ color: "#1b4332", fontSize: "0.95rem" }}>
          {medida.titulo}
          <span className="fw-normal ms-1" style={{ color: TEXTO, fontSize: "0.74rem" }}>
            ({unidad})
          </span>
        </span>
      </div>

      {(porTarea || medidas.length > 1) && (
        <div
          className="d-flex align-items-center gap-2 px-2 py-1 flex-wrap"
          style={{ borderBottom: "1px solid #f1f5f9" }}
        >
          {porTarea && (
            <Selector
              etiqueta="Tarea"
              valor={tarea}
              opciones={tareas}
              onChange={(v) => {
                setTareaElegida(v);
                setEncima(null);
              }}
            />
          )}
          {medidas.length > 1 && (
            <Selector
              etiqueta="Medida"
              valor={medida.id}
              opciones={medidas.map((x) => [x.id, x.nombre])}
              onChange={(v) => {
                setMedidaElegida(v);
                setEncima(null);
              }}
            />
          )}
        </div>
      )}

      <div ref={refCaja} className="position-relative" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
        {datos.length === 0 ? (
          <div
            className="d-flex align-items-center justify-content-center h-100 text-muted text-center px-3"
            style={{ fontSize: "0.76rem" }}
          >
            {sinDatosTexto}
          </div>
        ) : (
          ancho > 0 && (
            <svg width={ancho} height={altoSvg} style={{ display: "block" }} onMouseLeave={() => setEncima(null)}>
              {/* Grilla y eje de valores: suaves, que no compitan con las barras */}
              {escala.map((v) => (
                <g key={v}>
                  <line
                    x1={m.izquierda}
                    x2={ancho - m.derecha}
                    y1={y(v)}
                    y2={y(v)}
                    stroke={v === 0 ? "#cbd5e1" : GRILLA}
                    strokeWidth={1}
                  />
                  <text x={m.izquierda - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={TEXTO_SUAVE}>
                    {formato.format(v)}
                  </text>
                </g>
              ))}

              {datos.map((d, i) => {
                const valor = d[campo];
                const xBanda = m.izquierda + i * pasoX;
                const x = xBanda + (pasoX - anchoBarra) / 2;
                const alto = Math.max(1, m.arriba + altoPlot - y(valor));
                const activa = encima?.id === d.id;
                const xCentro = xBanda + pasoX / 2;
                const yBase = m.arriba + altoPlot;
                return (
                  <g key={d.id}>
                    <path d={caminoBarra(x, yBase - alto, anchoBarra, alto)} fill={activa ? COLOR_HOVER : COLOR} />
                    {conValor && (
                      <text x={xCentro} y={yBase - alto - 4} textAnchor="middle" fontSize="9.5" fill={TEXTO}>
                        {formato.format(valor)}
                      </text>
                    )}
                    <text
                      x={xCentro + 4}
                      y={yBase + 6}
                      fontSize="11.5"
                      fontWeight="700"
                      fill="#1b4332"
                      textAnchor="end"
                      transform={`rotate(-90 ${xCentro + 4} ${yBase + 6})`}
                    >
                      {d.cc}
                    </text>
                    {/* Zona de hover: toda la columna, más grande que la barra */}
                    <rect
                      x={xBanda}
                      y={m.arriba}
                      width={pasoX}
                      height={altoPlot}
                      fill="transparent"
                      onMouseEnter={() => setEncima({ ...d, valor, x: xCentro, y: yBase - alto })}
                    />
                  </g>
                );
              })}
            </svg>
          )
        )}

        {encima && (
          <div
            className="position-absolute rounded-2 shadow-sm px-2 py-1"
            style={{
              left: Math.min(Math.max(encima.x, 80), ancho - 80),
              // Arriba de la barra; si no entra (barra alta), adentro de ella.
              top: encima.y < 64 ? encima.y + 8 : encima.y - 8,
              transform: encima.y < 64 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
              background: "#fff",
              border: "1px solid #e2e8f0",
              fontSize: "0.72rem",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div className="fw-bold" style={{ color: "#0f172a" }}>
              {formato.format(encima.valor)} {medida.unidad(encima, hsCC)}
            </div>
            <div style={{ color: TEXTO }}>
              CC {encima.cc}
              {encima.equipo ? ` · ${encima.equipo}` : ""}
              {porTarea ? ` · ${encima.tarea}` : ""}
            </div>
            <div style={{ color: TEXTO_SUAVE }}>{medida.detalle(encima, hsCC)}</div>
          </div>
        )}
      </div>

      {sinDato > 0 && datos.length > 0 && (
        <div className="px-2 pb-1" style={{ fontSize: "0.66rem", color: TEXTO_SUAVE }}>
          {sinDato} CC {motivoSinDato}: no aparecen.
        </div>
      )}
    </div>
    </div>
  );
}

export default GraficoConsumoCC;
