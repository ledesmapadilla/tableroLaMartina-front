import Swal from 'sweetalert2'

/**
 * Un ítem en "Para retirar" abre su orden de compra al hacer click en el
 * estado. Cuando no hay ninguna que abrir, el click no hacía nada y parecía un
 * botón roto: esto lo explica.
 *
 * Pasa en dos casos:
 *  - El ítem quedó en "Para retirar" sin `oc`, porque no salió del circuito que
 *    genera la orden (es el que se la escribe al ítem).
 *  - La fila está agrupada y los ítems del pedido salieron en órdenes
 *    distintas, así que `oc` viene colapsado como "Varios".
 */
/**
 * Los ítems que se retiran al abrir la OC desde una fila: el ítem mismo, o los
 * del pedido que están para retirar con esa orden. Viaja en el state de la
 * navegación para que VerOC no marque los demás ítems de la OC.
 */
export const idsARetirar = (fila) =>
  (fila._agrupado ? fila._items : [fila])
    .filter((i) => i.estado === 'Para retirar' && i.oc === fila.oc)
    .map((i) => String(i._id))

export const avisarSinOC = (item) =>
  Swal.fire({
    icon: 'info',
    title: 'Sin orden de compra',
    text:
      item.oc === 'Varios'
        ? 'Los ítems de este pedido salieron en órdenes de compra distintas. Abrí el pedido con el ojo, al lado del número, y tocá el estado de cada ítem para ver su orden.'
        : 'Este ítem quedó en "Para retirar" sin una orden de compra asociada, así que no hay ninguna para abrir.',
    confirmButtonText: 'Cerrar',
    buttonsStyling: false,
    customClass: { confirmButton: 'btn btn-outline-secondary' },
  })
