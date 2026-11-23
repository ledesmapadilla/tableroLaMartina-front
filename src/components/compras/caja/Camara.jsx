import { useEffect, useRef, useState } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";

/**
 * La cámara dentro de la página (23/11/2026). Con <input capture> el celular
 * abre la app de la cámara y Android, para hacerle lugar, a veces cierra la
 * pestaña: al volver la página se recarga, sin la foto y con todo cerrado.
 * Acá la cámara corre adentro del navegador (getUserMedia), sin salir.
 *
 * `onFoto(file)` recibe un File jpg. Si no hay cámara o no dan permiso,
 * `onSinCamara()` para caer en el input de siempre. Se monta solo mientras
 * está abierta (`{camara && <Camara …/>}`), así cada vez arranca de cero.
 */
export default function Camara({ onHide, onFoto, onSinCamara }) {
  const video = useRef(null);
  const flujo = useRef(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    let vigente = true;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (!vigente) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        flujo.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => {
        if (vigente) onSinCamara();
      });
    return () => {
      vigente = false;
      flujo.current?.getTracks().forEach((t) => t.stop());
      flujo.current = null;
    };
  }, [onSinCamara]);

  const sacar = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const lienzo = document.createElement("canvas");
    lienzo.width = v.videoWidth;
    lienzo.height = v.videoHeight;
    lienzo.getContext("2d").drawImage(v, 0, 0);
    lienzo.toBlob(
      (blob) => {
        if (!blob) return;
        onFoto(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onHide();
      },
      "image/jpeg",
      0.85
    );
  };

  return (
    <Modal show onHide={onHide} fullscreen contentClassName="bg-black border-0">
      <Modal.Body className="p-0 d-flex flex-column" style={{ backgroundColor: "#000" }}>
        <div className="flex-grow-1 d-flex align-items-center justify-content-center position-relative" style={{ minHeight: 0 }}>
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setLista(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {!lista && <Spinner animation="border" variant="light" className="position-absolute" />}
        </div>
        <div className="d-flex align-items-center justify-content-between px-4 py-3">
          <Button variant="outline-light" size="sm" onClick={onHide}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={sacar}
            disabled={!lista}
            aria-label="Sacar foto"
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              border: "4px solid #fff",
              backgroundColor: lista ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
            }}
          />
          <span style={{ width: 74 }}></span>
        </div>
      </Modal.Body>
    </Modal>
  );
}
