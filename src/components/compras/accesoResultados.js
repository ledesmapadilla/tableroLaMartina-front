// Lo compartido por Compras › Resultados y su resumen (11/10/2026). Va
// aparte de los .jsx (exportar componentes y constantes juntos rompe el hot
// reload de Vite) y con otro nombre: "resultados.js" le ganaba a
// Resultados.jsx al importar sin extensión, porque Windows no distingue
// mayúsculas y Vite prueba .js antes que .jsx.

// "AAAA-MM-DD" → "DD/MM/AAAA".
export const fechaCorta = (s) => (s ? s.split('-').reverse().join('/') : '')
