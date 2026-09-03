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

/**
 * Muestra el aviso con las tres alternativas.
 * Devuelve "verificar" | "descartar" | "cambio" | null (si cerró el cartel).
 */
export const preguntarQueHacer = async (conflicto) => {
  const { lectura, ultima } = conflicto || {};
  const res = await Swal.fire({
    icon: "warning",
    title: "El horómetro retrocede",
    html: `
      <div style="text-align:left;font-size:0.92rem;line-height:1.5">
        <div>Lectura cargada: <b>${lectura}</b></div>
        <div>Último registrado: <b>${ultima?.horometro}</b> (${formatearFecha(ultima?.fecha)})</div>
        <hr style="margin:.6rem 0">
        <div><b>Verificar</b>: vuelvo al campo y corrijo el número.</div>
        <div><b>Descartar</b>: guardo sin horómetro; queda vigente el anterior.</div>
        <div><b>Cambio de horómetro</b>: se reemplazó el equipo por uno nuevo.</div>
      </div>`,
    showConfirmButton: true,
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: "Verificar",
    denyButtonText: "Cambio de horómetro",
    cancelButtonText: "Descartar",
    confirmButtonColor: "#15803d",
    denyButtonColor: "#b45309",
    cancelButtonColor: "#64748b",
    reverseButtons: true,
    width: "520px",
  });

  if (res.isConfirmed) return "verificar";
  if (res.isDenied) return "cambio";
  if (res.dismiss === Swal.DismissReason.cancel) return "descartar";
  return null;
};

/**
 * Envuelve un guardado para que respete la regla del horómetro.
 *
 * `enviar({ sinHorometro })` tiene que mandar la petición y devolver la
 * Response; recibe sinHorometro:true cuando el usuario elige descartar la
 * lectura. `tractor` es el id contra el que se registraría un cambio.
 *
 * Devuelve { ok, res, cuerpo, cancelado }. Con cancelado:true el usuario eligió
 * verificar o cerró el cartel: no hay que mostrar ningún error.
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

  if (res.status === 409) {
    const conflicto = await res.json().catch(() => ({}));
    if (!esConflictoHorometro(res.status, conflicto)) {
      return { ok: false, res, cuerpo: conflicto };
    }

    accion = await preguntarQueHacer(conflicto);
    if (accion === "verificar" || accion === null) return { ok: false, cancelado: true, accion };

    if (accion === "descartar") {
      if (descartarCancela) return { ok: false, cancelado: true, accion };
      res = await enviar({ sinHorometro: true });
    } else {
      const cambio = await registrarCambioDeHorometro({
        tractor: tractor || conflicto.tractor,
        fecha,
        conflicto,
      });
      if (!cambio) return { ok: false, cancelado: true, accion };
      res = await enviar({ sinHorometro: false });
    }
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
