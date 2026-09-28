import { useState } from 'react'
import Swal from 'sweetalert2'
import { api } from '../../services/api'
import { A, litros, nombreAceite, hoy, fechaCorta } from './aceites'

/**
 * Cargar, corregir y borrar una compra o un consumo de aceite (28/09/2026).
 *
 * Lo usan las dos pantallas que vienen del Sistema de Gestión Lepa: la de los
 * consumos (con el stock arriba) y la del detalle de las compras. Cada una le
 * dice qué recargar después; el formulario es `ModalMovimientoAceite`.
 */
const MOV_VACIO = {
  fecha: hoy(),
  aceite: '',
  litros: '',
  proveedor: '',
  marca: '',
  precio: '',
  grupo: '',
  cc: '',
  observaciones: '',
}

export function useMovimientosAceite({ recargar }) {
  // La compra o el consumo que se está cargando. En null, el modal está cerrado.
  const [mov, setMov] = useState(null)
  const [movDatos, setMovDatos] = useState(MOV_VACIO)
  const [guardando, setGuardando] = useState(false)

  const setCampo = (campo, valor) => setMovDatos((d) => ({ ...d, [campo]: valor }))

  const abrir = (movimiento) => {
    setMov({ movimiento })
    setMovDatos({ ...MOV_VACIO, fecha: hoy() })
  }

  const editar = (m) => {
    setMov({ movimiento: m.movimiento, editando: m._id })
    setMovDatos({
      fecha: m.fecha ? m.fecha.slice(0, 10) : hoy(),
      aceite: m.aceite?._id || '',
      litros: m.litros ?? '',
      proveedor: m.proveedor || '',
      marca: m.marca || '',
      precio: m.precio ?? '',
      grupo: m.grupo || '',
      cc: m.cc || '',
      observaciones: m.observaciones || '',
    })
  }

  const cerrar = () => setMov(null)

  const guardar = async (e) => {
    e.preventDefault()
    // Los desplegables con buscador no son campos del formulario: lo
    // obligatorio se controla acá.
    const falta = !movDatos.aceite
      ? 'Elegí el aceite'
      : mov.movimiento === 'Entrada' && !movDatos.proveedor
        ? 'Elegí el proveedor'
        : mov.movimiento === 'Salida' && !movDatos.grupo
          ? 'Elegí el grupo'
          : null
    if (falta) return Swal.fire({ icon: 'warning', title: 'Falta un dato', text: falta })

    setGuardando(true)
    try {
      const base = `${A.API}/${movDatos.aceite}/movimientos`
      if (mov.editando) await api.put(`${base}/${mov.editando}`, movDatos)
      else await api.post(base, { ...movDatos, movimiento: mov.movimiento })
      const texto = mov.movimiento === 'Entrada' ? 'Compra' : 'Consumo'
      const editando = mov.editando
      setMov(null)
      recargar()
      Swal.fire({
        icon: 'success',
        title: editando
          ? `${texto} actualizad${texto === 'Compra' ? 'a' : 'o'}`
          : `${texto} registrad${texto === 'Compra' ? 'a' : 'o'}`,
        timer: 1200,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo guardar' })
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (m) => {
    const esCompra = m.movimiento === 'Entrada'
    const resultado = await Swal.fire({
      title: esCompra ? '¿Borrar esta compra?' : '¿Borrar este consumo?',
      text: `${litros(m.litros)} L de ${nombreAceite(m.aceite)} del ${fechaCorta(m.fecha)}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
    })
    if (!resultado.isConfirmed) return
    try {
      await api.delete(`${A.API}/${m.aceite._id}/movimientos/${m._id}`)
      recargar()
      Swal.fire({
        icon: 'success',
        title: esCompra ? 'Compra borrada' : 'Consumo borrado',
        timer: 1200,
        showConfirmButton: false,
      })
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo borrar' })
    }
  }

  return { mov, movDatos, guardando, setCampo, abrir, editar, cerrar, guardar, borrar }
}
