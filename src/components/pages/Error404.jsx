import { Link } from "react-router-dom";

function Error404() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1">
      <h1 className="display-1 fw-bold text-danger">404</h1>
      <h2 className="mb-4">Página no encontrada</h2>
      <Link to="/" className="btn btn-primary btn-lg">
        <i className="bi bi-house-fill me-2"></i>Volver al inicio
      </Link>
    </div>
  );
}

export default Error404;
