import { useParams } from "react-router-dom";
import Error404 from "../pages/Error404";
import { cosechaDeParam } from "../../utils/cosechas";

/**
 * Las pantallas de una cosecha de Reparaciones San Pablo
 * (/reparaciones/sanpablo/:cosecha/...): si la cosecha de la dirección no es
 * válida va el 404, así las pantallas no tienen que controlarlo.
 */
export default function RutaCosecha({ children }) {
  const { cosecha } = useParams();
  return cosechaDeParam(cosecha) ? children : <Error404 />;
}
