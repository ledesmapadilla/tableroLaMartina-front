import Swal from "sweetalert2";

/**
 * Aviso cuando una lectura de horómetro no respeta la regla (toda lectura debe
 * ser igual o mayor a la última anterior a su fecha). Lo usan todas las
 * pantallas que cargan horómetro para que el aviso sea siempre el mismo.
 *
 * La validación la hace el backend; acá solo se resuelve qué hacer.
 */

// El backend rechaza con 409 y este cuerpo cuando la lectura retrocede.
export const esConflictoHorometro = (status, cuerpo) =>
  status === 409 && cuerpo?.motivo === "HOROMETRO_RETROCEDE";

const formatearFecha = (iso) => {
  const [a, m, d] = String(iso || "").slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : iso;
};

// Visitas, Preventivo y Reparaciones cargan el horómetro dentro de un Modal de
// react-bootstrap, que se devuelve el foco apenas sale de él: un cartel con
// campo colgado del body queda sin poder escribirse. Se lo dibuja dentro del
// modal abierto (el de más arriba) para que el foco no salga de ahí.
const dentroDelModal = () => {
  const abiertos = document.querySelectorAll(".modal.show");
  return abiertos.length ? abiertos[abiertos.length - 1] : "body";
};

// Cómo se nombra cada fuente de lectura en los avisos.
const FUENTES = {
  service: "service",
  reparacion: "reparación",
  visita: "visita",
  parte: "parte diario",
  "horometro:manual": "carga manual",
  "horometro:produccion": "historial (parte diario)",
  "horometro:reparacion": "historial (reparación)",
  "horometro:visita": "historial (visita)",
  "horometro:service": "historial (service)",
};
const CAMPOS = { horomIngreso: "ingreso", horomSalida: "salida" };

export const etiquetaFuente = (fuente, campo) => {
  const base = FUENTES[fuente] || String(fuente || "").replace(/^horometro:/, "historial ");
  return CAMPOS[campo] ? `${base} (${CAMPOS[campo]})` : base;
};

// Las cuatro salidas del aviso. Sweetalert trae tres botones, así que se
// dibujan a mano, cada uno con su explicación debajo.
const OPCIONES = [
  {
    accion: "chequear",
    titulo: "Chequear información",
    color: "#15803d",
    fondo: "#f0fdf4",
    texto: () => "Vuelvo al formulario a revisar el número que cargué.",
  },
  {
    accion: "descartar",
    titulo: "Descartar cambio",
    color: "#475569",
    fondo: "#f8fafc",
    texto: ({ descartarCancela }) =>
      descartarCancela
        ? "No se guarda esta lectura; queda vigente la anterior."
        : "Guardo sin esta lectura; queda vigente la anterior.",
  },
  {
    accion: "cambio",
    titulo: "Cambio de horómetro",
    color: "#b45309",
    fondo: "#fffbeb",
    texto: () => "Se reemplazó el equipo por uno nuevo que arranca de cero.",
  },
  {
    accion: "correccion",
    titulo: "Corrección de lectura anterior",
    color: "#1d4ed8",
    fondo: "#eff6ff",
    texto: ({ ultima }) =>
      `La lectura nueva está bien: el que estaba mal cargado es el ${ultima?.horometro}.`,
  },
];

/**
 * Muestra el aviso con las cuatro alternativas.
 * Devuelve "chequear" | "descartar" | "cambio" | "correccion" | null (si
 * cerró el cartel).
 */
export const preguntarQueHacer = async (conflicto, { descartarCancela = false } = {}) => {
  const { lectura, ultima } = conflicto || {};
  let elegida = null;

  const botones = OPCIONES.map(
    (o) => `
      <button type="button" data-accion="${o.accion}"
        style="display:block;width:100%;text-align:left;padding:.55rem .75rem;cursor:pointer;
               border:1px solid ${o.color};border-radius:8px;background:${o.fondo}">
        <div style="font-weight:700;color:${o.color}">${o.titulo}</div>
        <div style="font-size:.8rem;color:#475569;margin-top:.1rem">
          ${o.texto({ ultima, descartarCancela })}
        </div>
      </button>`
  ).join("");

  await Swal.fire({
    icon: "warning",
    title: "El horómetro retrocede",
    html: `
      <div style="text-align:left;font-size:0.92rem;line-height:1.5">
        <div>Lectura cargada: <b>${lectura}</b></div>
        <div>
          Último registrado: <b>${ultima?.horometro}</b>
          (${formatearFecha(ultima?.fecha)} · ${etiquetaFuente(ultima?.fuente, ultima?.campo)})
        </div>
        <div style="display:grid;gap:.5rem;margin-top:.8rem">${botones}</div>
      </div>`,
    showConfirmButton: false,
    showCloseButton: true,
    width: "540px",
    didOpen: (popup) => {
      popup.querySelectorAll("[data-accion]").forEach((boton) =>
        boton.addEventListener("click", () => {
          elegida = boton.dataset.accion;
          Swal.close();
        })
      );
    },
  });

  return elegida;
};

/**
 * Envuelve un guardado para que respete la regla del horómetro.
 *
 * `enviar({ sinHorometro })` tiene que mandar la petición y devolver la
 * Response; recibe sinHorometro:true cuando el usuario elige descartar la
 * lectura. `tractor` es el id contra el que se registraría un cambio.
 *
 * Devuelve { ok, res, cuerpo, cancelado }. Con cancelado:true el usuario eligió
 * chequear o cerró el cartel: no hay que mostrar ningún error.
 */
export const guardarConReglaHorometro = async ({
  enviar,
  tractor,
  fecha,
  // Pantallas donde la lectura ES el registro (la carga manual): ahí descartar
  // no puede guardar una fila vacía, cancela.
  descartarCancela = false,
}) => {
  let res = await enviar({ sinHorometro: false });
  let accion = null;
  const cancelar = () => ({ ok: false, cancelado: true, accion });

  // Corregir la lectura anterior puede destapar otra que también queda por
  // encima (la corregida no era la única mal cargada): se vuelve a preguntar
  // hasta que el guardado pase o el usuario desista.
  while (res.status === 409) {
    const conflicto = await res.json().catch(() => ({}));
    if (!esConflictoHorometro(res.status, conflicto)) {
      return { ok: false, res, cuerpo: conflicto };
    }

    accion = await preguntarQueHacer(conflicto, { descartarCancela });
    if (accion === "chequear" || accion === null) return cancelar();

    if (accion === "descartar") {
      if (descartarCancela) return cancelar();
      res = await enviar({ sinHorometro: true });
      continue;
    }

    const datos = { tractor: tractor || conflicto.tractor, fecha, conflicto };
    const resuelto =
      accion === "cambio"
        ? await registrarCambioDeHorometro(datos)
        : await corregirLecturaAnterior(datos);
    if (!resuelto) return cancelar();
    res = await enviar({ sinHorometro: false });
  }

  if (res.ok) return { ok: true, res, accion };
  return { ok: false, res, accion, cuerpo: await res.json().catch(() => ({})) };
};

/**
 * Pide cuántas horas alcanzó a marcar el horómetro viejo y registra el cambio.
 * Devuelve el cambio creado, o null si se canceló o falló.
 */
export const registrarCambioDeHorometro = async ({ tractor, fecha, conflicto }) => {
  const sugerido = conflicto?.ultima?.horometro ?? "";

  const { value: horas } = await Swal.fire({
    title: "Cambio de horómetro",
    target: dentroDelModal(),
    html: `
      <div style="text-align:left;font-size:0.9rem;line-height:1.5">
        ¿Cuántas horas alcanzó a marcar el <b>horómetro anterior</b> antes de
        salir de servicio?
        <div style="color:#64748b;margin-top:.4rem">
          De acá en adelante las horas de la máquina se cuentan como estas horas
          más lo que marque el horómetro nuevo.
        </div>
      </div>`,
    input: "number",
    inputValue: sugerido,
    inputAttributes: { min: "0", step: "any" },
    showCancelButton: true,
    confirmButtonText: "Registrar cambio",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#b45309",
    cancelButtonColor: "#64748b",
    inputValidator: (v) =>
      v === "" || v === null || Number(v) < 0
        ? "Indique las horas del horómetro anterior"
        : undefined,
  });

  if (horas === undefined) return null;

  try {
    const res = await fetch("/api/horometros-tractor/cambio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tractor,
        fecha,
        horasAnterior: Number(horas),
        lecturaInicial: conflicto?.lectura ?? 0,
        observaciones: "Registrado al detectar que el horómetro retrocedía",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      Swal.fire({ icon: "error", title: "Error", text: err.error || "No se pudo registrar el cambio" });
      return null;
    }
    const cambio = await res.json();
    await Swal.fire({
      icon: "success",
      title: `Horómetro N° ${cambio.numero}`,
      text: `Quedan ${cambio.base} horas acumuladas de los horómetros anteriores.`,
      timer: 2200,
      showConfirmButton: false,
    });
    return cambio;
  } catch {
    Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    return null;
  }
};

/**
 * Corrige la última lectura registrada, cuando la mal cargada era esa y no la
 * nueva. Pide el valor correcto y el backend lo reescribe en todas las
 * fuentes donde figura. Devuelve el resultado, o null si se canceló o falló.
 */
export const corregirLecturaAnterior = async ({ tractor, conflicto }) => {
  const { lectura, ultima } = conflicto || {};
  if (!ultima) return null;

  const { value: valor } = await Swal.fire({
    title: "Corrección de lectura anterior",
    target: dentroDelModal(),
    html: `
      <div style="text-align:left;font-size:0.9rem;line-height:1.5">
        La lectura del <b>${formatearFecha(ultima.fecha)}</b>
        (${etiquetaFuente(ultima.fuente, ultima.campo)}) figura con
        <b>${ultima.horometro}</b>. ¿Cuál es el valor correcto?
        <div style="color:#64748b;margin-top:.4rem">
          Se corrige en todos los registros del tractor donde figura esa lectura
          ese día. Después se guarda la lectura nueva (${lectura}).
        </div>
      </div>`,
    input: "number",
    inputAttributes: { min: "0", step: "any" },
    showCancelButton: true,
    confirmButtonText: "Corregir",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#1d4ed8",
    cancelButtonColor: "#64748b",
    inputValidator: (v) => {
      if (v === "" || v === null || Number(v) < 0) return "Indique el valor correcto";
      if (Number(v) === Number(ultima.horometro)) return "Es el mismo valor que ya estaba registrado";
      // Si la corrección no baja del valor nuevo, el guardado vuelve a frenar.
      if (Number(v) > Number(lectura)) {
        return `Con ese valor la lectura ${lectura} seguiría retrocediendo. Si el ${ultima.horometro} estaba bien, elija Cambio de horómetro.`;
      }
      return undefined;
    },
  });

  if (valor === undefined) return null;

  try {
    const res = await fetch("/api/horometros-tractor/corregir-lectura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tractor,
        fecha: ultima.fecha,
        valorAnterior: ultima.horometro,
        valorNuevo: Number(valor),
      }),
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      Swal.fire({
        icon: "error",
        title: "No se pudo corregir",
        text: cuerpo.mensaje || cuerpo.error || "No se pudo corregir la lectura",
      });
      return null;
    }

    const lugares = [
      ...new Set((cuerpo.corregidas || []).map((c) => etiquetaFuente(c.fuente, c.campo))),
    ];
    await Swal.fire({
      icon: "success",
      title: "Lectura corregida",
      html: `
        <div style="font-size:0.9rem;line-height:1.5">
          ${ultima.horometro} → <b>${Number(valor)}</b> (${formatearFecha(ultima.fecha)})
          <div style="color:#64748b;margin-top:.3rem">Se corrigió en: ${lugares.join(", ")}</div>
        </div>`,
      timer: 2600,
      showConfirmButton: false,
    });
    return cuerpo;
  } catch {
    Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    return null;
  }
};
