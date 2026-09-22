import { useState } from 'react'
import Swal from 'sweetalert2'
import { api } from '../../services/api'

/**
 * Las entradas y salidas de un artículo del almacén (22/09/2026).
 *
 * Mover el saldo se hace igual desde cualquier lado, así que la lógica está una
 * vez sola acá y la usan la pantalla del rubro y el catálogo general. Lo único
 * que cambia entre las dos es a qué URL va cada artículo —el catálogo tiene
 * mezclados los seis rubros— y qué hay que recargar después.
 *
 * `apiDe(articulo)` devuelve la base del rubro de ese artículo y `recargar()`
 * vuelve a traer la lista, que es donde se ve la existencia nueva.
 */
const hoy = () => new Date().toISOString().slice(0, 10)

// El movimiento arranca con la fecha de hoy y uno solo: es lo que más pasa.
export const MOV_VACIO = { fecha: hoy(), persona: '', grupo: '', cc: '', cantidad: 1, observaciones: '' }

export function useMovimientos({ apiDe, recargar }) {
  // La entrada o la salida que se está cargando: qué artículo, si entra o sale
  // y los datos del formulario. En null, el modal está cerrado.
  const [mov, setMov] = useState(null)
  const [movDatos, setMovDatos] = useState(MOV_VACIO)
  const [guardando, setGuardando] = useState(false)
  // El cartel con los movimientos ya cargados. En null, cerrado.
  const [historial, setHistorial] = useState(null)

  const error = (e, sino) =>
    Swal.fire({ icon: 'error', title: 'Error', text: e.message || sino })

  // El artículo que devuelve el servidor no trae de qué rubro salió: el
  // catálogo se lo había pegado del lado de acá. Se conserva lo que ya se sabía.
  const actualizado = (antes, despues) => (despues ? { ...antes, ...despues } : antes)

  const abrirHistorial = async (articulo) => {
    setHistorial({ articulo, movimientos: [], cargando: true })
    try {
      const movimientos = await api.get(`${apiDe(articulo)}/${articulo._id}/movimientos`)
      setHistorial({ articulo, movimientos, cargando: false })
    } catch (e) {
      setHistorial(null)
      error(e, 'No se pudieron traer los movimientos')
    }
  }

  const abrir = (articulo, movimiento) => {
    setMov({ articulo, movimiento })
    setMovDatos({ ...MOV_VACIO, fecha: hoy() })
  }

  // Corregir uno ya cargado. El cartel se cierra mientras se edita y vuelve a
  // abrirse al guardar o al cancelar: dos modales encimados no se leen.
  const editar = (m) => {
    setMov({
      articulo: historial.articulo,
      movimiento: m.movimiento,
      editando: m._id,
      volver: true,
    })
    setMovDatos({
      fecha: (m.fecha || '').slice(0, 10),
      persona: m.persona || '',
      grupo: m.grupo || '',
      cc: m.cc || '',
      cantidad: m.cantidad,
      observaciones: m.observaciones || '',
    })
    setHistorial(null)
  }

  const cerrar = () => {
    const volverA = mov?.volver ? mov.articulo : null
    setMov(null)
    setMovDatos(MOV_VACIO)
    if (volverA) abrirHistorial(volverA)
  }

  const setCampo = (campo, valor) => setMovDatos((d) => ({ ...d, [campo]: valor }))

  // Cambiar de grupo deja sin sentido el CC que estaba elegido: era de la otra
  // lista.
  const elegirGrupo = (grupo) => setMovDatos((d) => ({ ...d, grupo, cc: '' }))

  const guardar = async (e) => {
    e.preventDefault()
    const cantidad = Number(movDatos.cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      Swal.fire({ icon: 'warning', title: 'Cantidad', text: 'Poné un número mayor que cero' })
      return
    }
    setGuardando(true)
    const base = `${apiDe(mov.articulo)}/${mov.articulo._id}/movimientos`
    try {
      const cuerpo = { movimiento: mov.movimiento, ...movDatos, cantidad }
      const respuesta = mov.editando
        ? await api.put(`${base}/${mov.editando}`, cuerpo)
        : await api.post(base, cuerpo)
      const volver = mov.volver ? actualizado(mov.articulo, respuesta.articulo) : null
      setMov(null)
      setMovDatos(MOV_VACIO)
      recargar()
      if (volver) abrirHistorial(volver)
      Swal.fire({
        icon: 'success',
        title: mov.editando
          ? 'Movimiento corregido'
          : mov.movimiento === 'Entrada'
            ? 'Entrada registrada'
            : 'Salida registrada',
        timer: 1400,
        showConfirmButton: false,
      })
    } catch (e) {
      error(e, 'No se pudo registrar')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (m) => {
    const articulo = historial.articulo
    const resultado = await Swal.fire({
      title: '¿Borrar el movimiento?',
      text:
        m.movimiento === 'Entrada'
          ? `La existencia va a bajar ${m.cantidad}`
          : `La existencia va a subir ${m.cantidad}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) return
    try {
      const respuesta = await api.delete(
        `${apiDe(articulo)}/${articulo._id}/movimientos/${m._id}`
      )
      recargar()
      abrirHistorial(actualizado(articulo, respuesta.articulo))
      Swal.fire({ icon: 'success', title: 'Movimiento borrado', timer: 1200, showConfirmButton: false })
    } catch (e) {
      error(e, 'No se pudo borrar')
    }
  }

  return {
    mov,
    movDatos,
    guardando,
    historial,
    abrir,
    abrirHistorial,
    cerrarHistorial: () => setHistorial(null),
    editar,
    borrar,
    cerrar,
    setCampo,
    elegirGrupo,
    guardar,
  }
}
