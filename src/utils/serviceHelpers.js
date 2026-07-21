export const getIntervalKm = (patente, kmsService, odoActual) => {
  const patClean = (patente || "").replace(/\s+/g, "").toUpperCase();
  if (patClean === "AI245HB") {
    const baseKms = kmsService ?? odoActual ?? 0;
    if (baseKms < 45000) {
      return 15000;
    }
  }
  return 10000;
};

export const getEstado = (odoActual, kmsService, patente) => {
  if (odoActual == null || kmsService == null) return null;
  const diff = odoActual - kmsService;
  const interval = getIntervalKm(patente, kmsService, odoActual);
  if (diff >= interval)        return { label: "Atrasado",   bg: "#8b4a4a", color: "#fff" };
  if (diff >= interval - 1000) return { label: "a 1.000 Km", bg: "#b89840", color: "#333" };
  return                               { label: "Al día",    bg: "#52735a", color: "#fff" };
};
