import { asset } from "@/lib/asset";

// Información real de PetCare Perú (petcareperu.com)
export const business = {
  name: "PetCare",
  legalName: "Gabus Vet S.A.C.",
  ruc: "20548058610",
  foundedYear: 2013,
  foundedDate: "9 de abril de 2013",
  address: "Av. Aviación 4945, Santiago de Surco, Lima",
  phone: "(01) 628 7515",
  phoneHref: "tel:+5116287515",
  emergency: "958 967 721",
  emergencyHref: "tel:+51958967721",
  whatsapp: "51958967721",
  hours: "Lunes a sábado, 9:00 a.m. a 6:00 p.m.",
  instagram: "https://www.instagram.com/petcareperu/",
  mapsEmbed:
    "https://www.google.com/maps?q=Av.+Aviaci%C3%B3n+4945,+Santiago+de+Surco,+Lima&output=embed",
  mapsLink: "https://www.google.com/maps/search/?api=1&query=Av.+Aviaci%C3%B3n+4945+Surco+Lima",
  privacyUrl: "https://petcareperu.com/politica-de-privacidad/",
  termsUrl: "https://petcareperu.com/terminos-y-condiciones/",
};

export const yearsOfExperience = new Date().getFullYear() - business.foundedYear;

export type ServiceIcon =
  | "stethoscope"
  | "bath"
  | "scissors"
  | "flask"
  | "scan"
  | "syringe"
  | "home"
  | "bed"
  | "chip"
  | "plane";

export interface Service {
  id: string;
  name: string;
  icon: ServiceIcon;
  summary: string;
  description: string;
  bullets?: string[];
  highlight?: string;
}

export const services: Service[] = [
  {
    id: "consultas",
    name: "Consultas",
    icon: "stethoscope",
    summary: "Prevención y seguimiento con médicos colegiados.",
    description:
      "Médicos veterinarios titulados y colegiados, con amplia experiencia y capacitación constante. Nos enfocamos en prevenir enfermedades y dar seguimiento a cada tratamiento.",
    bullets: [
      "Consulta médica general",
      "Consulta médica a domicilio",
      "Vacunaciones",
      "Desparasitaciones internas y externas",
      "Tratamientos",
    ],
  },
  {
    id: "banos",
    name: "Baños",
    icon: "bath",
    summary: "Baños estéticos y medicados con productos premium.",
    description:
      "Cuidamos la piel y el pelaje de tu engreído con productos de la más alta calidad. Baños estéticos y medicados, y toda la línea de shampoos y cuidado para casa.",
  },
  {
    id: "grooming",
    name: "Grooming",
    icon: "scissors",
    summary: "Cortes por raza con monitoreo por cámaras.",
    description:
      "Groomers con experiencia en cortes según raza, rebajado, corte higiénico y rapado. Puedes estar tranquilo: el servicio se monitorea con cámaras de seguridad.",
    highlight: "Monitoreo por cámaras",
  },
  {
    id: "analisis",
    name: "Análisis clínicos",
    icon: "flask",
    summary: "Hematología, bioquímica y microbiología.",
    description:
      "Los exámenes complementarios son clave para un diagnóstico preciso. Realizamos hematología, bioquímica, microbiología y cualquier tipo de examen que tu mascota necesite.",
  },
  {
    id: "ecografias",
    name: "Ecografías",
    icon: "scan",
    summary: "Equipos de última generación.",
    description:
      "Equipos ecográficos de última generación y médicos capacitados para interpretar cada informe, para que el diagnóstico sea rápido y confiable.",
  },
  {
    id: "cirugias",
    name: "Cirugías",
    icon: "syringe",
    summary: "De esterilizaciones a extracción de tumores.",
    description:
      "Profesionales capacitados para todo tipo de cirugías generales: desde esterilizaciones hasta extracción de tumores.",
  },
  {
    id: "domicilio",
    name: "Consultas a domicilio",
    icon: "home",
    summary: "Atendemos a tu mascota sin salir de casa.",
    description:
      "Ideal para mascotas que se estresan al salir, adultos mayores o agendas apretadas. Llevamos la consulta a tu hogar.",
  },
  {
    id: "hospedaje",
    name: "Hospedaje e internamiento",
    icon: "bed",
    summary: "Cuidado y monitoreo constante, como en casa.",
    description:
      "Si viajas, cuidamos, protegemos y consentimos a tu engreído a diario. Y para pacientes que requieren cuidados constantes, contamos con áreas de internamiento acondicionadas y monitoreo permanente.",
  },
  {
    id: "microchip",
    name: "Microchip",
    icon: "chip",
    summary: "Identificación única registrada a nivel nacional.",
    description:
      "Un dispositivo del tamaño de un grano de arroz con un código único en el mundo. Se registra en el Registro Nacional de Identidad Animal y ayuda a que cientos de mascotas vuelvan a casa tras perderse.",
    highlight: "Del tamaño de un grano de arroz",
  },
  {
    id: "viajes",
    name: "Trámites de viaje",
    icon: "plane",
    summary: "Dentro y fuera del país, sin estrés.",
    description:
      "Te damos todo lo necesario para que tu engreído viaje dentro y fuera del Perú. Déjalo en manos de expertos.",
    bullets: [
      "Certificados de vacuna y salud",
      "Documentos sanitarios de exportación",
      "Implantación de microchip",
      "Jaulas y accesorios de viaje",
      "Test serológico de anticuerpos de la rabia",
    ],
  },
];

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

// Fotos revisadas una por una (perros, gatos y exóticos, sin marcas de terceros)
export const photos = {
  beagle: unsplash("1543466835-00a7907e9de1", 1100),
  cat: unsplash("1514888286974-6c03e2ca1dba", 700),
  guineaPigs: unsplash("1548767797-d8c844163c4c", 700),
  puppy: unsplash("1576201836106-db1758fd1c97", 1000),
  bath: unsplash("1516734212186-a967f81ad0d7", 1000),
  frenchie: unsplash("1583337130417-3346a1be7dee", 1000),
  corgi: unsplash("1537151608828-ea2b11777ee8", 800),
  aussie: unsplash("1587300003388-59208cc962cb", 1000),
  friends: unsplash("1450778869180-41d0601e046e", 1000),
};

// Logos descargados de petcareperu.com/marcas
export const brands = [
  { name: "Brit", logo: asset("/img/brands/brit.png") },
  { name: "Bayer", logo: asset("/img/brands/bayer.png") },
  { name: "Beaphar", logo: asset("/img/brands/beaphar.png") },
  { name: "Bravecto", logo: asset("/img/brands/bravecto.png") },
  { name: "Cat-Licious", logo: asset("/img/brands/cat-licious.png") },
  { name: "Canbo", logo: asset("/img/brands/canbo.png") },
  { name: "Aranda Pets", logo: asset("/img/brands/aranda-pets.png") },
  { name: "Brouwer", logo: asset("/img/brands/brouwer.png") },
  { name: "Cat Zone", logo: asset("/img/brands/cat-zone.png") },
  { name: "Biomont", logo: asset("/img/brands/biomont.jpg") },
];

// Testimonios de ejemplo para el proyecto del curso
export const testimonials = [
  {
    quote:
      "Toby se estresa en el auto y la consulta a domicilio fue la solución. Llegaron puntuales y lo trataron con mucho cariño.",
    name: "María Fernanda Quispe",
    detail: "Dueña de Toby, golden retriever",
  },
  {
    quote: "Nos ayudaron con todos los papeles para llevar a Luna a Madrid. Todo salió en regla y a tiempo.",
    name: "Renzo Alvarado",
    detail: "Viajó con Luna, gata europea",
  },
  {
    quote: "En el grooming puedo ver a mi perrita por cámara. Esa tranquilidad no la encontré en otro lado.",
    name: "Lucía Paredes",
    detail: "Dueña de Nala, shih tzu",
  },
];
