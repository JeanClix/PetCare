// Agrupa los campos de texto/imagen del contenido editable por bloque de la página,
// para que secciones largas (como "Inicio") no se vean como una lista plana de 50+
// campos sin relación aparente entre ellos. Esta misma taxonomía de prefijos se usa
// para instrumentar las páginas públicas con `data-site-group="<prefijo>"`, de modo
// que el editor visual pueda resaltar y seleccionar la sección correcta en la vista previa.
export const FIELD_GROUP_LABELS: Record<string, string> = {
  "home.hero": "Portada principal",
  "home.highlights": "Datos destacados",
  "home.services": "Servicios en la portada",
  "home.travel": "Sección de viajes",
  "home.products": "Productos destacados",
  "home.brands": "Marcas que trabajamos",
  "brand": "Marcas que trabajamos",
  "home.testimonials": "Testimonios",
  "testimonial": "Testimonios",
  "home.visit": "Cómo visitarnos",
  "about.page": "Encabezado de la página",
  "about.intro": "Nuestra historia",
  "about.values": "Nuestros valores",
  "about.value": "Nuestros valores",
  "services.page": "Encabezado de la página",
  "services.travel": "Servicio de viajes",
  "service": "Servicios por tipo",
  "shop.page": "Encabezado de la página",
  "contact.page": "Encabezado de la página",
  "contact.form": "Formulario de contacto",
  "appointments.page": "Encabezado de la página",
  "account.page": "Encabezado de la página",
  "account.login": "Inicio de sesión",
  "account.register": "Registro",
  "account.email": "Campos del formulario",
  "account.username": "Campos del formulario",
  "account.password": "Campos del formulario",
  "notFound": "Página no encontrada",
  "global.nav": "Menú de navegación",
  global: "Datos de contacto generales",
};

export function fieldGroupLabel(key: string) {
  const segments = key.split(".");
  for (let length = 2; length >= 1; length -= 1) {
    const prefix = segments.slice(0, length).join(".");
    if (FIELD_GROUP_LABELS[prefix]) return FIELD_GROUP_LABELS[prefix];
  }
  return "Otros textos";
}

/** Devuelve el prefijo de grupo (p.ej. "home.hero") que corresponde a una clave de campo. */
export function fieldGroupKey(key: string) {
  const segments = key.split(".");
  for (let length = 2; length >= 1; length -= 1) {
    const prefix = segments.slice(0, length).join(".");
    if (FIELD_GROUP_LABELS[prefix]) return prefix;
  }
  return "other";
}

export function groupFields<T extends { key: string }>(fields: T[]) {
  const groups = new Map<string, T[]>();
  for (const field of fields) {
    const label = fieldGroupLabel(field.key);
    groups.set(label, [...(groups.get(label) ?? []), field]);
  }
  return [...groups.entries()];
}
