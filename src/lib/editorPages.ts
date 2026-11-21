// Registro de páginas que el editor visual puede mostrar en la vista previa en vivo.
// Cada entrada mapea una página del sitio público a su ruta (para cargarla en el iframe)
// y a los grupos de campos (data-site-group) que existen en esa ruta, en el orden en que
// aparecen. El panel izquierdo del editor usa este registro para construir la navegación
// de "páginas y secciones"; cuando el usuario hace clic en una sección dentro del iframe,
// el grupo seleccionado se resuelve contra esta misma lista.
export type EditorPageSection = {
  /** Prefijo data-site-group, p.ej. "home.hero". */
  group: string;
  /** Etiqueta amigable mostrada en el panel izquierdo (debe calzar con FIELD_GROUP_LABELS). */
  label: string;
};

export type EditorPage = {
  id: string;
  label: string;
  /** Ruta pública (hash) a cargar en el iframe de previsualización. null = sin vista en vivo. */
  route: string | null;
  sections: EditorPageSection[];
};

export const EDITOR_PAGES: EditorPage[] = [
  {
    id: "home",
    label: "Inicio",
    route: "/",
    sections: [
      { group: "home.hero", label: "Portada principal" },
      { group: "home.highlights", label: "Datos destacados" },
      { group: "home.services", label: "Servicios en la portada" },
      { group: "home.travel", label: "Sección de viajes" },
      { group: "home.products", label: "Productos destacados" },
      { group: "home.brands", label: "Marcas que trabajamos" },
      { group: "home.testimonials", label: "Testimonios" },
      { group: "home.visit", label: "Cómo visitarnos" },
    ],
  },
  {
    id: "services",
    label: "Servicios",
    route: "/servicios",
    sections: [
      { group: "services.page", label: "Encabezado de la página" },
      { group: "service", label: "Servicios por tipo" },
      { group: "services.travel", label: "Servicio de viajes" },
      { group: "home.visit", label: "Cómo visitarnos" },
    ],
  },
  {
    id: "shop",
    label: "Tienda",
    route: "/tienda",
    sections: [
      { group: "shop.page", label: "Encabezado de la página" },
      { group: "shop.products", label: "Catálogo de productos" },
    ],
  },
  {
    id: "about",
    label: "Nosotros",
    route: "/nosotros",
    sections: [
      { group: "about.page", label: "Encabezado de la página" },
      { group: "about.intro", label: "Nuestra historia" },
      { group: "about.values", label: "Nuestros valores" },
      { group: "home.visit", label: "Cómo visitarnos" },
    ],
  },
  {
    id: "contact",
    label: "Contacto",
    route: "/contacto",
    sections: [
      { group: "contact.page", label: "Encabezado de la página" },
      { group: "contact.form", label: "Formulario de contacto" },
    ],
  },
  {
    id: "appointments",
    label: "Citas",
    // Requiere sesión de cliente para reservar; se edita como lista de campos, sin vista en vivo.
    route: null,
    sections: [{ group: "appointments.page", label: "Encabezado de la página" }],
  },
  {
    id: "account",
    label: "Cuenta",
    route: null,
    sections: [
      { group: "account.page", label: "Encabezado de la página" },
      { group: "account.login", label: "Inicio de sesión" },
      { group: "account.register", label: "Registro" },
      { group: "account.email", label: "Campos del formulario" },
      { group: "account.username", label: "Campos del formulario" },
      { group: "account.password", label: "Campos del formulario" },
    ],
  },
  {
    id: "global",
    label: "Encabezado y pie de página",
    // Visibles en todas las rutas; se editan desde Inicio pero aparecen aquí para encontrarlos fácil.
    route: "/",
    sections: [
      { group: "global.nav", label: "Menú de navegación" },
      { group: "global", label: "Datos de contacto generales" },
    ],
  },
  {
    id: "notFound",
    label: "Página no encontrada",
    route: null,
    sections: [{ group: "notFound", label: "Página no encontrada" }],
  },
];
