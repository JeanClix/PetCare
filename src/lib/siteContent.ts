import { adminRequest, getPublicSiteContent } from "@/lib/adminAuth";
import { products as catalogProducts, type Product } from "@/data/products";
import { brands as brandCatalog, services as serviceCatalog, testimonials as testimonialCatalog, type Service } from "@/data/site";

const serviceTextDefaults = Object.fromEntries(serviceCatalog.flatMap((service) => [
  [`service.${service.id}.name`, service.name],
  [`service.${service.id}.summary`, service.summary],
  [`service.${service.id}.description`, service.description],
  [`service.${service.id}.bullets`, service.bullets?.join("\n") ?? ""],
  [`service.${service.id}.highlight`, service.highlight ?? ""],
]));

const testimonialTextDefaults = Object.fromEntries(testimonialCatalog.flatMap((testimonial, index) => [
  [`testimonial.${index}.quote`, testimonial.quote],
  [`testimonial.${index}.name`, testimonial.name],
  [`testimonial.${index}.detail`, testimonial.detail],
]));

const brandTextDefaults = Object.fromEntries(brandCatalog.map((brand, index) => [`brand.${index}.name`, brand.name]));

export type SiteContent = {
  texts: Record<string, string>;
  images: Record<string, string>;
  products: Product[];
  colors: {
    primary: string;
    accent: string;
  };
};

export const defaultSiteContent: SiteContent = {
  texts: {
    ...serviceTextDefaults,
    ...testimonialTextDefaults,
    ...brandTextDefaults,
    "global.hours": "Lunes a sábado, 9:00 a.m. a 6:00 p.m.",
    "global.phone": "(01) 628 7515",
    "global.emergency": "958 967 721",
    "global.nav.home": "Inicio",
    "global.nav.shop": "Tienda",
    "global.nav.services": "Servicios",
    "global.nav.appointments": "Citas",
    "global.nav.about": "Nosotros",
    "global.nav.contact": "Contacto",
    "home.hero.eyebrow": "Clínica veterinaria en Surco",
    "home.hero.title": "Cuidamos a tu mascota en cada etapa",
    "home.hero.description": "Consultas, grooming y farmacia para perros, gatos y mascotas exóticas.",
    "home.hero.primaryCta": "Agendar cita",
    "home.hero.secondaryCta": "Ver la tienda",
    "home.hero.beagleAlt": "Beagle sonriendo",
    "home.hero.catAlt": "Gato blanco y negro",
    "home.hero.guineaPigsAlt": "Dos cuyes comiendo zanahoria",
    "home.highlights.title": "Todo lo que necesita, en un solo lugar",
    "home.highlights.services": "10 servicios",
    "home.highlights.servicesLabel": "Salud, grooming y más",
    "home.highlights.cameras": "Con cámaras",
    "home.highlights.camerasLabel": "Seguimiento durante el grooming",
    "home.highlights.homeVisits": "A domicilio",
    "home.highlights.homeVisitsLabel": "Consultas sin salir de casa",
    "home.services.link": "Ver los 10 servicios",
    "home.travel.eyebrow": "Trámites de viaje y microchip",
    "home.travel.title": "¿Viajas con tu mascota? Nosotros vemos los papeles.",
    "home.travel.description": "Te ayudamos a preparar los documentos y requisitos para viajar con tu mascota.",
    "home.travel.imageAlt": "Perro viajando dentro de una maleta con su dueño",
    "home.products.title": "Recomendados por nuestros médicos",
    "home.products.description": "Alimentos, farmacia y cuidado recomendados por nuestros médicos.",
    "home.brands.title": "Marcas que encuentras en PetCare",
    "home.testimonials.eyebrow": "Familias PetCare",
    "home.testimonials.title": "Lo que cuentan los dueños",
    "home.visit.title": "Agenda la próxima visita de tu engreído",
    "home.visit.description": "Elige un horario disponible y reserva en línea.",
    "home.visit.addressLabel": "Sede Surco",
    "home.visit.phoneLabel": "Teléfono",
    "home.visit.emergencyLabel": "Emergencias",
    "services.page.title": "Servicios veterinarios en Surco",
    "services.page.description": "Atención médica, grooming y más para perros, gatos y mascotas exóticas.",
    "services.travel.title": "Así preparamos el viaje de tu mascota",
    "services.travel.description": "Te guiamos con los requisitos y documentos para viajar con tu mascota.",
    "shop.page.title": "Tienda y farmacia veterinaria",
    "shop.page.description": "Alimentos, farmacia, higiene y accesorios para perros, gatos y exóticos, recomendados por nuestros médicos.",
    "about.page.heading": "Cuidamos a tu mascota con experiencia",
    "about.page.description": "PetCare nació en Surco para ofrecer atención veterinaria cercana y confiable.",
    "about.intro.title": "Desde el 9 de abril de 2013",
    "about.intro.description": "Empezamos distribuyendo productos veterinarios y crecimos hasta convertirnos en una clínica dedicada al bienestar de cada paciente.",
    "about.values.title": "Lo que nos mueve",
    "about.value.0.title": "Cariño genuino",
    "about.value.0.description": "Ver a nuestros pacientes sanos y felices es lo más gratificante de nuestro trabajo.",
    "about.value.1.title": "Formación continua",
    "about.value.1.description": "Médicos titulados y colegiados que se capacitan constantemente.",
    "about.value.2.title": "Diagnóstico preciso",
    "about.value.2.description": "Laboratorio y ecografía con equipos de última generación.",
    "about.value.3.title": "Transparencia",
    "about.value.3.description": "Te explicamos cada tratamiento y su costo antes de empezar.",
    "contact.page.title": "Contáctanos",
    "contact.page.description": "¿Tienes una consulta? Escríbenos y nuestro equipo te responderá.",
    "contact.form.title": "Envíanos un mensaje",
    "contact.form.description": "Completa tus datos y te responderemos pronto.",
    "appointments.page.title": "Agenda tu cita",
    "appointments.page.description": "Elige un horario disponible y consulta el estado de tu reserva desde Mi cuenta.",
    "account.page.title": "Mi cuenta",
    "account.page.description": "Tu sesión de cliente está activa.",
    "account.login.title": "Inicia sesión",
    "account.login.description": "Entra para hacer pedidos y ver tu cuenta.",
    "account.register.title": "Crea tu cuenta",
    "account.register.description": "Regístrate para hacer pedidos en la tienda.",
    "account.login.appointmentDescription": "Inicia sesión o crea tu cuenta para reservar y seguir tu cita.",
    "account.login.tab": "Iniciar sesión",
    "account.register.tab": "Registrarme",
    "account.email.label": "Correo electrónico",
    "account.username.label": "Usuario",
    "account.password.label": "Contraseña",
    "notFound.title": "No encontramos esta página",
    "notFound.description": "Puede que el enlace haya cambiado. Vuelve al inicio o revisa nuestros servicios.",
  },
  images: {
    "home.hero.beagle": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1100&q=75",
    "home.hero.cat": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=700&q=75",
    "home.hero.guineaPigs": "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=700&q=75",
    "home.services.consultation": "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=1000&q=75",
    "home.services.bath": "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1000&q=75",
    "home.travel.image": "/img/services/pet-travel-pexels.jpg",
    "home.testimonials.image": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1000&q=75",
    "about.image": "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1000&q=75",
    "contact.image": "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=800&q=75",
    "appointments.image": "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=800&q=75",
    ...Object.fromEntries(brandCatalog.map((brand, index) => [`brand.${index}.logo`, brand.logo])),
  },
  products: catalogProducts,
  colors: {
    primary: "#13396a",
    accent: "#007a64",
  },
};

export function sitePhoneHref(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("51") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  return national ? `tel:+51${national}` : "tel:";
}

export const siteTextFields = [
  { section: "Inicio", key: "home.hero.eyebrow", label: "Antetítulo principal" },
  { section: "Inicio", key: "home.hero.title", label: "Título principal" },
  { section: "Inicio", key: "home.hero.description", label: "Descripción principal" },
  { section: "Inicio", key: "home.hero.primaryCta", label: "Botón principal" },
  { section: "Inicio", key: "home.hero.secondaryCta", label: "Enlace secundario" },
  { section: "Inicio", key: "home.hero.beagleAlt", label: "Texto alternativo: perro" },
  { section: "Inicio", key: "home.hero.catAlt", label: "Texto alternativo: gato" },
  { section: "Inicio", key: "home.hero.guineaPigsAlt", label: "Texto alternativo: cuyes" },
  { section: "Inicio", key: "home.highlights.title", label: "Título de servicios" },
  { section: "Inicio", key: "home.highlights.services", label: "Dato destacado: servicios" },
  { section: "Inicio", key: "home.highlights.servicesLabel", label: "Descripción: servicios" },
  { section: "Inicio", key: "home.highlights.cameras", label: "Dato destacado: cámaras" },
  { section: "Inicio", key: "home.highlights.camerasLabel", label: "Descripción: cámaras" },
  { section: "Inicio", key: "home.highlights.homeVisits", label: "Dato destacado: domicilio" },
  { section: "Inicio", key: "home.highlights.homeVisitsLabel", label: "Descripción: domicilio" },
  { section: "Inicio", key: "home.services.link", label: "Enlace a servicios" },
  { section: "Inicio", key: "home.travel.eyebrow", label: "Antetítulo de viajes" },
  { section: "Inicio", key: "home.travel.title", label: "Título de viajes" },
  { section: "Inicio", key: "home.travel.description", label: "Descripción de viajes" },
  { section: "Inicio", key: "home.travel.imageAlt", label: "Texto alternativo: viajes" },
  { section: "Inicio", key: "home.products.title", label: "Título de productos" },
  { section: "Inicio", key: "home.products.description", label: "Descripción de productos" },
  { section: "Inicio", key: "home.brands.title", label: "Título de marcas" },
  ...brandCatalog.map((brand, index) => ({ section: "Inicio", key: `brand.${index}.name`, label: `Marca ${index + 1}: nombre (${brand.name})` })),
  { section: "Inicio", key: "home.testimonials.eyebrow", label: "Antetítulo de testimonios" },
  { section: "Inicio", key: "home.testimonials.title", label: "Título de testimonios" },
  ...testimonialCatalog.flatMap((_testimonial, index) => [
    { section: "Inicio", key: `testimonial.${index}.quote`, label: `Testimonio ${index + 1}: comentario` },
    { section: "Inicio", key: `testimonial.${index}.name`, label: `Testimonio ${index + 1}: nombre` },
    { section: "Inicio", key: `testimonial.${index}.detail`, label: `Testimonio ${index + 1}: detalle` },
  ]),
  { section: "Inicio", key: "home.visit.title", label: "Título de contacto" },
  { section: "Inicio", key: "home.visit.description", label: "Descripción de contacto" },
  { section: "Inicio", key: "home.visit.addressLabel", label: "Etiqueta de dirección" },
  { section: "Inicio", key: "home.visit.phoneLabel", label: "Etiqueta de teléfono" },
  { section: "Inicio", key: "home.visit.emergencyLabel", label: "Etiqueta de emergencias" },
  { section: "Servicios", key: "services.page.title", label: "Título de página" },
  { section: "Servicios", key: "services.page.description", label: "Descripción de página" },
  { section: "Servicios", key: "services.travel.title", label: "Título de viajes" },
  { section: "Servicios", key: "services.travel.description", label: "Descripción de viajes" },
  ...serviceCatalog.flatMap((service) => [
    { section: "Servicios", key: `service.${service.id}.name`, label: `${service.name}: nombre` },
    { section: "Servicios", key: `service.${service.id}.summary`, label: `${service.name}: resumen` },
    { section: "Servicios", key: `service.${service.id}.description`, label: `${service.name}: descripción` },
    ...(service.bullets ? [{ section: "Servicios", key: `service.${service.id}.bullets`, label: `${service.name}: lista (un elemento por línea)` }] : []),
    ...(service.highlight ? [{ section: "Servicios", key: `service.${service.id}.highlight`, label: `${service.name}: destacado` }] : []),
  ]),
  { section: "Tienda", key: "shop.page.title", label: "Título de página" },
  { section: "Tienda", key: "shop.page.description", label: "Descripción de página" },
  { section: "Nosotros", key: "about.page.heading", label: "Título principal" },
  { section: "Nosotros", key: "about.page.description", label: "Descripción principal" },
  { section: "Nosotros", key: "about.intro.title", label: "Título de historia" },
  { section: "Nosotros", key: "about.intro.description", label: "Historia de PetCare" },
  { section: "Nosotros", key: "about.values.title", label: "Título de valores" },
  ...["Cariño genuino", "Formación continua", "Diagnóstico preciso", "Transparencia"].flatMap((_label, index) => [
    { section: "Nosotros", key: `about.value.${index}.title`, label: `Valor ${index + 1}: título` },
    { section: "Nosotros", key: `about.value.${index}.description`, label: `Valor ${index + 1}: descripción` },
  ]),
  { section: "Contacto", key: "contact.page.title", label: "Título de página" },
  { section: "Contacto", key: "contact.page.description", label: "Descripción de página" },
  { section: "Contacto", key: "contact.form.title", label: "Título del formulario" },
  { section: "Contacto", key: "contact.form.description", label: "Descripción del formulario" },
  { section: "Citas", key: "appointments.page.title", label: "Título de página" },
  { section: "Citas", key: "appointments.page.description", label: "Descripción de página" },
  { section: "Cuenta", key: "account.page.title", label: "Título de cuenta" },
  { section: "Cuenta", key: "account.page.description", label: "Descripción de cuenta" },
  { section: "Cuenta", key: "account.login.title", label: "Título de inicio de sesión" },
  { section: "Cuenta", key: "account.login.description", label: "Descripción de inicio de sesión" },
  { section: "Cuenta", key: "account.register.title", label: "Título de registro" },
  { section: "Cuenta", key: "account.register.description", label: "Descripción de registro" },
  { section: "Cuenta", key: "account.login.appointmentDescription", label: "Descripción para reservar citas" },
  { section: "Cuenta", key: "account.login.tab", label: "Pestaña de inicio de sesión" },
  { section: "Cuenta", key: "account.register.tab", label: "Pestaña de registro" },
  { section: "Cuenta", key: "account.email.label", label: "Etiqueta de correo" },
  { section: "Cuenta", key: "account.username.label", label: "Etiqueta de usuario local" },
  { section: "Cuenta", key: "account.password.label", label: "Etiqueta de contraseña" },
  { section: "Otros", key: "notFound.title", label: "Título de página no encontrada" },
  { section: "Otros", key: "notFound.description", label: "Descripción de página no encontrada" },
  { section: "Información pública", key: "global.hours", label: "Horario de atención" },
  { section: "Información pública", key: "global.phone", label: "Teléfono" },
  { section: "Información pública", key: "global.emergency", label: "Teléfono de emergencias" },
  { section: "Información pública", key: "global.nav.home", label: "Menú: inicio" },
  { section: "Información pública", key: "global.nav.shop", label: "Menú: tienda" },
  { section: "Información pública", key: "global.nav.services", label: "Menú: servicios" },
  { section: "Información pública", key: "global.nav.appointments", label: "Menú: citas" },
  { section: "Información pública", key: "global.nav.about", label: "Menú: nosotros" },
  { section: "Información pública", key: "global.nav.contact", label: "Menú: contacto" },
] as const;

export const siteImageFields = [
  { section: "Inicio", key: "home.hero.beagle", label: "Foto principal del perro" },
  { section: "Inicio", key: "home.hero.cat", label: "Foto del gato" },
  { section: "Inicio", key: "home.hero.guineaPigs", label: "Foto de los cuyes" },
  { section: "Inicio", key: "home.services.consultation", label: "Foto de consulta veterinaria" },
  { section: "Inicio", key: "home.services.bath", label: "Foto de baño" },
  { section: "Inicio", key: "home.travel.image", label: "Foto de viajes" },
  { section: "Inicio", key: "home.testimonials.image", label: "Foto de testimonios" },
  { section: "Nosotros", key: "about.image", label: "Foto de nosotros" },
  { section: "Contacto", key: "contact.image", label: "Foto de contacto" },
  { section: "Citas", key: "appointments.image", label: "Foto de citas" },
  ...brandCatalog.map((brand, index) => ({ section: "Inicio", key: `brand.${index}.logo`, label: `Logotipo: ${brand.name}` })),
] as const;

export function editableService(service: Service, text: (key: string) => string): Service {
  const bullets = text(`service.${service.id}.bullets`).split(/\r?\n/).map((bullet) => bullet.trim()).filter(Boolean);
  return {
    ...service,
    name: text(`service.${service.id}.name`),
    summary: text(`service.${service.id}.summary`),
    description: text(`service.${service.id}.description`),
    bullets: service.bullets ? bullets : undefined,
    highlight: text(`service.${service.id}.highlight`) || undefined,
  };
}

export function mergeSiteContent(value: unknown): SiteContent {
  if (!value || typeof value !== "object") return defaultSiteContent;
  const content = value as Partial<SiteContent>;
  const validTexts = Object.fromEntries(
    Object.keys(defaultSiteContent.texts).flatMap((key) => {
      const text = content.texts?.[key];
      return typeof text === "string" && text.length <= 3000 ? [[key, text]] : [];
    }),
  );
  const validImages = Object.fromEntries(
    Object.keys(defaultSiteContent.images).flatMap((key) => {
      const image = content.images?.[key];
      if (typeof image !== "string" || image.length > 2000) return [];
      try {
        const url = new URL(image, window.location.origin);
        return url.protocol === "https:" || (url.origin === window.location.origin && image.startsWith("/") && !image.startsWith("//"))
          ? [[key, image]]
          : [];
      } catch {
        return [];
      }
    }),
  );
  const productUpdates: Product[] = Array.isArray(content.products) ? content.products : [];
  const validProducts = catalogProducts.map((product) => {
    const updated = productUpdates.find((item) => item.id === product.id);
    if (!updated) return product;
    const imageIsSafe = (source: string) => {
      try {
        const url = new URL(source, window.location.origin);
        return url.protocol === "https:" || (
          url.origin === window.location.origin &&
          (source.startsWith("/") || source.startsWith("./")) &&
          !source.startsWith("//")
        );
      } catch {
        return false;
      }
    };
    return {
      ...product,
      name: typeof updated.name === "string" && updated.name.length <= 300 ? updated.name : product.name,
      subcategory: typeof updated.subcategory === "string" && updated.subcategory.length <= 200 ? updated.subcategory : product.subcategory,
      price: typeof updated.price === "number" && Number.isFinite(updated.price) && updated.price >= 0 ? updated.price : product.price,
      priceMax: updated.priceMax === null || (typeof updated.priceMax === "number" && Number.isFinite(updated.priceMax) && updated.priceMax >= updated.price)
        ? updated.priceMax
        : product.priceMax,
      image: typeof updated.image === "string" && updated.image.length <= 2000 && imageIsSafe(updated.image) ? updated.image : product.image,
      description: typeof updated.description === "string" && updated.description.length <= 5000 ? updated.description : product.description,
    };
  });
  const isHexColor = (color: unknown): color is string => typeof color === "string" && /^#[\da-f]{6}$/i.test(color);
  return {
    texts: { ...defaultSiteContent.texts, ...validTexts },
    images: { ...defaultSiteContent.images, ...validImages },
    products: validProducts,
    colors: {
      primary: isHexColor(content.colors?.primary) ? content.colors.primary : defaultSiteContent.colors.primary,
      accent: isHexColor(content.colors?.accent) ? content.colors.accent : defaultSiteContent.colors.accent,
    },
  };
}

export async function fetchSiteContent() {
  return mergeSiteContent(await getPublicSiteContent());
}

export async function saveSiteContent(token: string, content: SiteContent) {
  const result = await adminRequest<{ content: SiteContent }>("/site-content", { content }, token);
  return mergeSiteContent(result.content);
}
