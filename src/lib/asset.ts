/** Ruta a un archivo de /public respetando la base del build (la web puede vivir en una subcarpeta, ej. GitHub Pages) */
export function asset(path: string) {
  // Fuera de Vite (la función del asistente corre en Node) import.meta.env no existe
  return `${import.meta.env?.BASE_URL ?? "/"}${path.replace(/^\//, "")}`;
}
