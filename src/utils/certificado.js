import { RETENCION, precioVigente, pagaAlto, repartirDia } from "./altoRendimiento";

/**
 * Lo que se certifica en un mes de Producción, persona por persona y tarea
 * por tarea (05/11/2026).
 *
 * Es el cálculo de Contable - Pagos (ProduccionInformeTareasPersonal.jsx),
 * movido acá sin cambios para que lo use también la Comparativa de Contable
 * (solapa "Certificado en LM"): las dos tienen que dar lo mismo. El precio es
 * el del cliente del parte en la vigencia de ese día, con el alto rendimiento
 * y las correcciones a mano de la planilla.
 */

const soloFecha = (iso) => (iso || "").slice(0, 10);
const redondear = (v) => Math.round((Number(v) || 0) * 100) / 100;
const claveCliente = (c) => (c || "").trim().toLowerCase();
const comparar = (a, b) => String(a).localeCompare(String(b), "es", { sensitivity: "base" });

// Un renglón es una persona, una tarea y un cliente: el precio se certifica
// por cliente.
export const claveDeFila = (idPersona, idTarea, cliente) =>
  `${idPersona}|${idTarea}|${claveCliente(cliente)}`;

/**
 * El valor que rige para cada renglón corregido a mano (/api/cambios del mes).
 * → { porRenglon, porTarea }
 */
export function calcularAjustes(cambios) {
    // Por renglón exacto (persona, tarea y cliente) y, aparte, por persona y
    // tarea sin mirar el cliente: el segundo es el que salva la corrección
    // cuando en la planilla le cambian el cliente al parte.
    const porRenglon = new Map();
    const porTarea = new Map();

    for (const c of cambios) {
      const idPersona = c.persona?._id || c.persona;
      const idTarea = c.tarea?._id || c.tarea;

      for (const [mapa, clave] of [
        [porRenglon, claveDeFila(idPersona, idTarea, c.cliente)],
        [porTarea, `${idPersona}|${idTarea}`],
      ]) {
        const actual = mapa.get(clave) || {};
        if (actual[c.campo] === undefined) mapa.set(clave, { ...actual, [c.campo]: c.nuevo });
      }
    }
    return { porRenglon, porTarea };
}

/**
 * Una fila por persona, tarea y cliente (y aparte la de alto rendimiento), con
 * la cantidad del período y su importe neto y bruto.
 * → { filas, totalPorPersona, numeroPorPersona, diasPorPersona }
 *
 * `partesFiltrados` son los partes del período (sin "Uso interno"),
 * `variables` los precios del campo y `ajustes` lo de calcularAjustes.
 */
export function calcularCertificado(partesFiltrados, variables, ajustes, establecimiento) {
    const mapa = new Map();

    // El renglón de un parte; `alto` es el de alto rendimiento, que va aparte.
    const filaDe = (p, clave, alto = false) => {
      const claveFila = alto ? `${clave}|alto` : clave;
      if (!mapa.has(claveFila)) {
        mapa.set(claveFila, {
          clave: claveFila,
          alto,
          idPersona: p.persona?._id || "sin-persona",
          idTarea: p.tarea?._id || "sin-tarea",
          persona: p.persona?.apellidoNombre || "(sin persona)",
          legajo: p.persona?.legajo || "",
          tarea: p.tarea?.tarea || "(sin tarea)",
          cliente: (p.cliente || "").trim(),
          unidad: p.tarea?.unidad || "",
          cantidad: 0,
          // Lo que sí tiene precio se suma aparte: una tarea puede tener partes
          // de distintos clientes o de antes de la primera vigencia cargada.
          cantidadConPrecio: 0,
          importe: 0,
          importeBruto: 0,
          precios: new Set(),
        });
      }
      return mapa.get(claveFila);
    };

    const sumar = (fila, cantidad, neto, bruto) => {
      fila.cantidad += cantidad;
      if (neto === null) return;
      fila.cantidadConPrecio += cantidad;
      fila.importe += cantidad * neto;
      fila.importeBruto += cantidad * bruto;
      fila.precios.add(neto);
    };

    // Los partes se juntan por renglón y por día: el alto rendimiento se mide
    // con lo que la persona hizo en el día.
    const porDia = new Map();
    for (const p of partesFiltrados) {
      const clave = claveDeFila(p.persona?._id || "sin-persona", p.tarea?._id || "sin-tarea", p.cliente);
      const claveDia = `${clave}|${soloFecha(p.fecha)}`;
      const dia = porDia.get(claveDia) || { parte: p, clave, cantidad: 0 };
      dia.cantidad += Number(p.cantidad) || 0;
      porDia.set(claveDia, dia);
    }

    // Todos los días de cada renglón con tope de alto rendimiento: es el
    // detalle que abre el cartel "Alto Rto.".
    const diasPorClave = new Map();
    // Todas las tareas de cada persona, día por día: es el resumen que abre
    // el nombre (14/10/2026).
    const diasPorPersona = new Map();
    const anotarDia = (fila, dia) => {
      const lista = diasPorPersona.get(fila.idPersona) || [];
      lista.push({ tarea: fila.tarea, cliente: fila.cliente, unidad: fila.unidad, ...dia });
      diasPorPersona.set(fila.idPersona, lista);
    };

    for (const { parte: p, clave, cantidad } of porDia.values()) {
      const fila = filaDe(p, clave);
      // El precio es el del cliente del parte, en la vigencia que regía ese día.
      const precio = precioVigente(variables, fila.idTarea, fila.cliente, p.fecha);
      if (precio === null) {
        sumar(fila, cantidad, null);
        anotarDia(fila, {
          fecha: soloFecha(p.fecha),
          cantidad,
          alto: 0,
          neto: null,
          netoAlto: null,
          importe: null,
        });
      } else if (pagaAlto(establecimiento, precio)) {
        const { normal, alto } = repartirDia(cantidad, precio.cantAlto, fila.tarea);
        sumar(fila, normal, precio.neto, precio.bruto);
        if (alto > 0) sumar(filaDe(p, clave, true), alto, precio.netoAlto, precio.brutoAlto);
        anotarDia(fila, {
          fecha: soloFecha(p.fecha),
          cantidad,
          alto,
          neto: precio.neto,
          netoAlto: precio.netoAlto,
          importe: redondear(normal * precio.neto + alto * precio.netoAlto),
        });
        const dias = diasPorClave.get(clave) || [];
        dias.push({
          fecha: soloFecha(p.fecha),
          cantidad,
          normal,
          alto,
          tope: precio.cantAlto,
          neto: precio.neto,
          netoAlto: precio.netoAlto,
          importe: redondear(normal * precio.neto + alto * precio.netoAlto),
        });
        diasPorClave.set(clave, dias);
      } else {
        sumar(fila, cantidad, precio.neto, precio.bruto);
        anotarDia(fila, {
          fecha: soloFecha(p.fecha),
          cantidad,
          alto: 0,
          neto: precio.neto,
          netoAlto: null,
          importe: redondear(cantidad * precio.neto),
        });
        // Un día de antes del tope también va al detalle, sin alto
        // rendimiento: así se ven todos los días de la tarea.
        const dias = diasPorClave.get(clave) || [];
        dias.push({
          fecha: soloFecha(p.fecha),
          cantidad,
          normal: cantidad,
          alto: 0,
          tope: null,
          neto: precio.neto,
          netoAlto: null,
          importe: redondear(cantidad * precio.neto),
        });
        diasPorClave.set(clave, dias);
      }
    }

    // El detalle va en el renglón de alto rendimiento, del día más viejo al
    // más nuevo.
    for (const f of mapa.values()) {
      if (!f.alto) continue;
      const claveBase = f.clave.replace(/\|alto$/, "");
      f.dias = (diasPorClave.get(claveBase) || []).sort((a, b) => a.fecha.localeCompare(b.fecha));
    }

    // Cuántos renglones hay por persona y tarea: define si una corrección
    // huérfana se puede reubicar sin ambigüedad. El de alto rendimiento no
    // cuenta: no se corrige a mano.
    const renglonesPorTarea = new Map();
    for (const f of mapa.values()) {
      if (f.alto) continue;
      const clave = `${f.idPersona}|${f.idTarea}`;
      renglonesPorTarea.set(clave, (renglonesPorTarea.get(clave) || 0) + 1);
    }

    const lista = [...mapa.values()]
      .map((f) => {
        const conPrecio = redondear(f.cantidadConPrecio);
        // Sin precio cargado en Variables no hay importe que mostrar: va una
        // raya, no un cero que parezca trabajo sin costo.
        const hayPrecio = f.precios.size > 0;
        // Con un solo precio se muestra ese; si en el período hubo más de uno
        // (cambio de vigencia o dos clientes) se muestra el promedio de lo que
        // realmente se certificó, que es lo que cierra con el importe.
        const dePartes = !hayPrecio
          ? null
          : f.precios.size === 1
          ? [...f.precios][0]
          : conPrecio
          ? redondear(f.importe / conPrecio)
          : null;

        // Lo corregido a mano manda sobre lo que sale de los partes. Los
        // partes no se tocan: el ajuste vive aparte y se aplica acá.
        /**
         * La corrección de este renglón.
         *
         * Primero la del renglón exacto. Si no hay, se usa la de la misma
         * persona y tarea aunque sea de otro cliente, pero solo cuando ese par
         * tiene un único renglón: es el caso de haberle cambiado el cliente al
         * parte en la planilla, y la corrección no se tiene que perder. Con
         * dos clientes en juego no se reubica, porque no se sabe a cuál iba y
         * aplicarla a los dos duplicaría el importe.
         */
        const clavePorTarea = `${f.idPersona}|${f.idTarea}`;
        // El renglón de alto rendimiento sale siempre de los partes: las
        // correcciones son del renglón normal.
        const ajuste = f.alto
          ? {}
          : ajustes.porRenglon.get(claveDeFila(f.idPersona, f.idTarea, f.cliente)) ||
          (renglonesPorTarea.get(clavePorTarea) === 1
            ? ajustes.porTarea.get(clavePorTarea)
            : null) ||
          {};
        const cantidad =
          ajuste.cantidad !== undefined ? redondear(ajuste.cantidad) : redondear(f.cantidad);
        const precio = ajuste.precioUnitario !== undefined ? ajuste.precioUnitario : dePartes;
        const corregida = ajuste.cantidad !== undefined || ajuste.precioUnitario !== undefined;

        // Con algo corregido el importe se rehace de cero: la suma parte por
        // parte ya no aplica, porque el número de arriba lo puso una persona.
        const importe = corregida
          ? precio === null
            ? null
            : redondear(cantidad * precio)
          : hayPrecio
          ? redondear(f.importe)
          : null;

        return {
          ...f,
          cantidad,
          precio,
          corregida,
          cantidadCorregida: ajuste.cantidad !== undefined,
          precioCorregido: ajuste.precioUnitario !== undefined,
          variosPrecios: !corregida && f.precios.size > 1,
          // Queda marcado cuando parte de la cantidad se quedó sin precio: el
          // importe de esa fila es parcial. Corregida a mano no aplica.
          sinPrecio: corregida ? 0 : redondear(f.cantidad - conPrecio),
          importe,
          importeBruto:
            importe === null
              ? null
              : corregida
              ? redondear(importe / (1 - RETENCION))
              : redondear(f.importeBruto),
        };
      })
      .sort(
        (a, b) =>
          comparar(a.persona, b.persona) ||
          comparar(a.tarea, b.tarea) ||
          comparar(a.cliente, b.cliente) ||
          // El de alto rendimiento, abajo del normal.
          Number(a.alto) - Number(b.alto)
      );

    // El total de una persona suma solo las tareas con precio cargado; si no
    // tiene ninguno, no hay total que mostrar.
    // Solo se acumula el neto: el bruto del total no se suma, se calcula
    // después a partir de ese neto ya descontado.
    const totales = new Map();
    // La numeración de la columna # cuenta personas, no filas: acompaña al
    // nombre, que también va una sola vez por bloque.
    const numeros = new Map();
    for (const f of lista) {
      if (!numeros.has(f.idPersona)) numeros.set(f.idPersona, numeros.size + 1);
      if (f.importe === null) continue;
      totales.set(f.idPersona, redondear((totales.get(f.idPersona) || 0) + f.importe));
    }

    // Del día más viejo al más nuevo y, dentro del día, por tarea.
    for (const dias of diasPorPersona.values()) {
      dias.sort((a, b) => a.fecha.localeCompare(b.fecha) || comparar(a.tarea, b.tarea));
    }

    return { filas: lista, totalPorPersona: totales, numeroPorPersona: numeros, diasPorPersona };
}
