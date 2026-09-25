/** Ruta a un archivo de /public respetando la base del build (la web puede vivir en una subcarpeta, ej. GitHub Pages) */
export function asset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
