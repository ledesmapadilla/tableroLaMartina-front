/**
 * El ayudamemoria de cada columna de las Comparativas de Contable
 * (12/11/2026): de dónde sale el dato y cómo se calcula. Lo muestra el ícono
 * ⓘ de cada encabezado (shared/AyudaColumna.jsx).
 *
 * Los textos cambian según la comparativa: en la de costos lo de LM es lo que
 * se le paga a la gente (Contable - Pagos); en la volumétrica, lo certificado.
 * Si se cambia un cálculo en ContableComparativa.jsx, cambiar acá el texto.
 */
export function ayudasComparativa({ esCostos }) {
  const cantLM = {
    origen:
      "Los partes de la planilla de carga de este campo, entre las Fechas LM (por defecto, las de la certificación del mes).",
    calculo:
      "Suma de las cantidades de los partes de la tarea, con el mismo cálculo que Contable - Pagos: con las correcciones a mano, sin \"Uso interno\" y sin las personas marcadas \"sin contar\".",
  };
  const subLM = esCostos
    ? {
        origen: "Contable - Pagos (Producción): el $ total neto de cada renglón (persona, tarea y cliente).",
        calculo:
          "Suma exacta de esos importes; no es cantidad × precio. Cada renglón ya trae su precio del cliente, la vigencia, el alto rendimiento y las correcciones a mano. Los renglones sin precio en Variables no suman. Desc/Antic. y Ret. Judicial no se restan (en Pagos son de la persona, no de la tarea).",
      }
    : {
        origen: "La cantidad certificada en LM y el precio unitario de Ctv de la misma tarea.",
        calculo: "Cant. certificada × Precio unitario de Ctv: lo que valdría lo certificado al precio que paga Citrusvil.",
      };
  const precioLM = esCostos
    ? {
        origen: "Contable - Pagos: lo que se le pagó a la gente por esta tarea.",
        calculo:
          "Con un solo precio en el período, ese mismo. Con varios (cliente, vigencia, alto Rto. o correcciones), el ponderado Subtotal ÷ Cant., entre paréntesis y con ≈, por ejemplo (≈ $ 94,65); el subtotal es exacto igual. Sin partes en el período: el precio vigente en Variables de remuneración al último día de Fechas LM, cliente Citrusvil, en gris y con (Variables).",
      }
    : {
        origen: "El precio unitario de la solapa Pagado por Ctv, de la misma tarea de La Martina.",
        calculo: "Es el de Ctv, no el que se le paga a la gente. Una tarea que no está en Ctv queda sin precio.",
      };
  const precioCtv = {
    origen: "El Excel de Contable del mes: columnas Cant. y Precio unitario de cada fila del grupo.",
    calculo:
      "Promedio ponderado: Σ (Cant. × Precio unitario) ÷ Σ Cant. Con una sola tarifa, esa misma; con varias (o en varios almacenes), cada fila pesa según su cantidad.",
  };
  const subCtv = {
    origen: "El Excel de Contable del mes.",
    calculo:
      "Suma de Cant. × Precio unitario de cada fila del grupo, calculado al subir el Excel (no se usa la columna Subtotal que trae el Excel).",
  };
  const unidad = {
    origen: "La tarea de La Martina (Altas › Tareas).",
    calculo: "Una tarea de Citrusvil sin equivalencia queda con la unidad que trae el Excel.",
  };
  const verdeRojo = "Verde: Ctv pagó más que LM. Rojo: pagó menos.";
  const nombreLM = esCostos ? "lo pagado al personal" : "lo certificado";

  return {
    // Solapa "Pagado por Ctv"
    ctv: {
      almacen: {
        origen: "Columna \"Denominación almacén\" del Excel de Contable del mes.",
        calculo: "Solo entran las filas cuyo almacén es de este campo (sin mirar mayúsculas, acentos ni espacios).",
      },
      tarea: {
        origen: "La tarea de Citrusvil del Excel, pasada a la de La Martina con Contable › Equivalencias tareas.",
        calculo:
          "Las tareas de Citrusvil que van a la misma de La Martina se juntan en una fila. Sin equivalencia queda con el nombre de Citrusvil, en ámbar.",
      },
      cantidad: {
        origen: "Columna \"Cant.\" del Excel de Contable del mes.",
        calculo: "Suma de las cantidades de todas las filas del grupo (mismo almacén y misma tarea de La Martina).",
      },
      unidad,
      precio: precioCtv,
      subtotal: subCtv,
    },
    // Solapa "Certificado en LM"
    lm: {
      almacen: {
        origen: "El campo de esta comparativa.",
        calculo: "Todas las filas son del mismo campo: los partes se traen solo de él.",
      },
      tarea: {
        origen: "La tarea de los partes de La Martina.",
        calculo:
          "Las tareas de La Martina que comparten una de Citrusvil van juntas (\"A + B\"), porque lo de Ctv no se puede repartir. En ámbar, las que no tienen ninguna de Citrusvil.",
      },
      cantidad: cantLM,
      unidad: { origen: "La tarea de La Martina (Altas › Tareas).", calculo: "" },
      precio: precioLM,
      subtotal: subLM,
    },
    // Solapa "Comparativa" (y el historial día por día)
    comp: {
      tarea: {
        origen: "Una fila por tarea de La Martina, con lo de Ctv y lo de LM juntos por Contable › Equivalencias tareas.",
        calculo: esCostos
          ? "Con \"LM en costos\" (Equivalencias › Ctv → LM), lo de Ctv se compara con otra tarea de LM: abajo dice \"LM: …\"."
          : "Sin equivalencia queda en ámbar: solo tiene uno de los dos lados.",
      },
      unidad,
      precioCtv: {
        ...precioCtv,
        calculo: "Subtotal Ctv ÷ Cant. pagado Ctv: el promedio ponderado de todas las filas del Excel de la tarea.",
      },
      precioLM,
      cantCtv: {
        origen: "La Cant. de la solapa Pagado por Ctv.",
        calculo: "Suma de la columna Cant. del Excel de las tareas de Citrusvil que van a esta de La Martina.",
      },
      cantLM: {
        ...cantLM,
        calculo: `${cantLM.calculo} Con equivalencia y sin partes en el período, 0.`,
      },
      difCant: {
        origen: "Las dos columnas de cantidad de esta tabla.",
        calculo: "Cant. Ctv − Cant. LM. Verde: Ctv pagó más cantidad que la de LM. Rojo: pagó menos.",
      },
      subCtv: { ...subCtv, origen: "El Subtotal de la solapa Pagado por Ctv (Excel de Contable del mes)." },
      subLM,
      dif: {
        origen: `El Subtotal Ctv y el Subtotal LM (${nombreLM}).`,
        calculo: `Subtotal Ctv − Subtotal LM; lo que falta de un lado cuenta como cero. ${verdeRojo}`,
      },
      fecha: {
        origen: "La fecha de las filas del Excel de Ctv y la de los partes de LM.",
        calculo:
          "Un renglón por día. \"Correcciones a mano\" es lo corregido en Contable - Pagos, que no es de un día: la diferencia entre el total y la suma de los días.",
      },
    },
  };
}
