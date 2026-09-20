import { nuevoWorkbook } from '../../helpers/excel'

/**
 * La precarga de artículos del almacén desde un Excel (20/09/2026).
 *
 * Lee la primera hoja y busca las columnas por su encabezado, sin importar el
 * orden ni las mayúsculas ni los acentos: alcanza con que la primera fila diga
 * de qué es cada columna. La única obligatoria es el nombre del artículo.
 *
 * Con la plantilla de `columnasPlantilla` se baja un Excel ya con los
 * encabezados puestos, que es la forma de no pelearse con los nombres.
 */

// Cómo se puede llamar cada columna en el Excel que traiga el usuario.
const COLUMNAS = {
  nombre: ['articulo', 'artículo', 'nombre', 'repuesto', 'descripcion', 'descripción', 'detalle'],
  seccion: ['seccion', 'sección', 'grupo', 'rubro', 'equipo'],
  unidad: ['unidad', 'un', 'medida'],
  cantidad: ['cantidad', 'cant', 'stock', 'existencia', 'saldo'],
  minimo: ['minimo', 'mínimo', 'stock minimo', 'stock mínimo', 'min'],
  ubicacion: ['ubicacion', 'ubicación', 'lugar', 'estante', 'deposito', 'depósito'],
}

export const columnasPlantilla = [
  { titulo: 'Articulo', ancho: 34 },
  { titulo: 'Seccion', ancho: 18 },
  { titulo: 'Unidad', ancho: 10 },
  { titulo: 'Cantidad', ancho: 12 },
  { titulo: 'Minimo', ancho: 12 },
  { titulo: 'Ubicacion', ancho: 20 },
]

const normalizar = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** El texto de una celda, venga como venga (fórmula, texto enriquecido…). */
const textoDeCelda = (celda) => {
  const v = celda?.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('')
    if (v.text) return v.text
    if (v.result !== undefined) return String(v.result)
    return ''
  }
  return String(v)
}

const numeroDeCelda = (celda) => {
  const n = Number(String(textoDeCelda(celda)).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Lee el archivo y devuelve { articulos, problemas }.
 *
 * No guarda nada: es para mostrar antes qué se va a cargar. Cada artículo sale
 * como { nombre, seccion, unidad, cantidad, minimo, ubicacion, fila }.
 */
export const leerExcelDeArticulos = async (file) => {
  const wb = await nuevoWorkbook()
  await wb.xlsx.load(await file.arrayBuffer())

  const hoja = wb.worksheets[0]
  if (!hoja) return { articulos: [], problemas: ['El archivo no tiene ninguna hoja.'] }

  // La primera fila con algo escrito manda: ahí están los encabezados.
  const encabezado = hoja.getRow(1)
  const dondeEsta = {}
  encabezado.eachCell((celda, columna) => {
    const texto = normalizar(textoDeCelda(celda))
    for (const [campo, nombres] of Object.entries(COLUMNAS)) {
      if (dondeEsta[campo] === undefined && nombres.includes(texto)) dondeEsta[campo] = columna
    }
  })

  if (dondeEsta.nombre === undefined) {
    return {
      articulos: [],
      problemas: [
        'No se encontró la columna del artículo. La primera fila tiene que decir el nombre de cada columna (Articulo, Seccion, Unidad, Cantidad, Minimo, Ubicacion).',
      ],
    }
  }

  const articulos = []
  const problemas = []

  hoja.eachRow((fila, numero) => {
    if (numero === 1) return
    const nombre = textoDeCelda(fila.getCell(dondeEsta.nombre)).trim()
    if (!nombre) return

    articulos.push({
      fila: numero,
      nombre,
      seccion: dondeEsta.seccion ? textoDeCelda(fila.getCell(dondeEsta.seccion)).trim() : '',
      unidad: dondeEsta.unidad ? textoDeCelda(fila.getCell(dondeEsta.unidad)).trim() : '',
      cantidad: dondeEsta.cantidad ? numeroDeCelda(fila.getCell(dondeEsta.cantidad)) : 0,
      minimo: dondeEsta.minimo ? numeroDeCelda(fila.getCell(dondeEsta.minimo)) : 0,
      ubicacion: dondeEsta.ubicacion ? textoDeCelda(fila.getCell(dondeEsta.ubicacion)).trim() : '',
    })
  })

  if (articulos.length === 0) problemas.push('No se encontró ningún artículo debajo de los encabezados.')

  return { articulos, problemas }
}

/**
 * Separa lo que se va a dar de alta de lo que ya está, comparando el nombre
 * sin acentos ni mayúsculas. Un artículo repetido no se carga dos veces: en una
 * precarga es más sano saltearlo y avisar que sumar cantidades sin querer.
 */
export const separarRepetidos = (articulos, existentes) => {
  const yaEstan = new Set(existentes.map((a) => normalizar(a.nombre)))
  const nuevos = []
  const repetidos = []
  const vistos = new Set()

  for (const a of articulos) {
    const clave = normalizar(a.nombre)
    if (yaEstan.has(clave) || vistos.has(clave)) repetidos.push(a)
    else {
      vistos.add(clave)
      nuevos.push(a)
    }
  }
  return { nuevos, repetidos }
}
