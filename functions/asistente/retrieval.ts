/*
 * Recuperación del RAG: indexa el catálogo y los servicios de la web y los busca con BM25.
 * Groq no ofrece embeddings, así que la búsqueda es léxica; para que "salpullido" encuentre
 * "dermatológico" o "antimicótico", el modelo reescribe antes la consulta con términos técnicos.
 */
import rawProducts from "../../src/data/products.json" with { type: "json" };
import type { Pet, Product } from "../../src/data/products";
import { business, services } from "../../src/data/site";

export type Doc =
  | { kind: "producto"; id: string; pets: Pet[]; text: string; product: Product }
  | { kind: "servicio"; id: string; pets: Pet[]; text: string };

const petNames: Record<Pet, string> = { perro: "perros", gato: "gatos", exotico: "exóticos (aves, reptiles, roedores)" };

const docs: Doc[] = [
  ...(rawProducts as Product[]).map((p): Doc => ({
    kind: "producto",
    id: String(p.id),
    pets: p.pets,
    product: p,
    text: [p.name, p.subcategory, p.category, `Para ${p.pets.map((x) => petNames[x]).join(", ")}`, p.description].join(". "),
  })),
  ...services.map((s): Doc => ({
    kind: "servicio",
    id: s.id,
    pets: ["perro", "gato", "exotico"],
    text: [`Servicio: ${s.name}`, s.summary, s.description, ...(s.bullets ?? [])].join(". "),
  })),
];

const stopwords = new Set(
  "de la el los las un una unos unas y o a en con por para que se su sus mi mis tu es son al del lo le les como mas pero muy ya x ml gr".split(" "),
);

/** Minúsculas, sin tildes, sin palabras vacías y con un recorte simple de plurales */
export function tokenize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !stopwords.has(t))
    .map((t) => (t.length > 4 ? t.replace(/(es|s)$/, "") : t));
}

// Índice BM25 construido una sola vez al cargar la función
const K1 = 1.4;
const B = 0.75;
const docTokens = docs.map((d) => tokenize(d.text));
const avgLen = docTokens.reduce((n, t) => n + t.length, 0) / docs.length;
const docFreq = new Map<string, number>();
for (const tokens of docTokens) for (const t of new Set(tokens)) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);

function idf(term: string) {
  const df = docFreq.get(term) ?? 0;
  return Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
}

export function search(query: string, { pet, products = 8, services = 2 }: { pet?: Pet; products?: number; services?: number }) {
  const terms = [...new Set(tokenize(query))];
  const scored = docs
    .map((doc, i) => {
      const tokens = docTokens[i];
      let score = 0;
      for (const term of terms) {
        const tf = tokens.filter((t) => t === term).length;
        if (tf) score += idf(term) * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * tokens.length) / avgLen)));
      }
      return { doc, score };
    })
    // Nunca se ofrece un producto que no sea para la especie de la consulta
    .filter(({ doc, score }) => score > 0 && (!pet || doc.pets.includes(pet)))
    .sort((a, b) => b.score - a.score);

  return [
    ...scored.filter((s) => s.doc.kind === "producto").slice(0, products),
    ...scored.filter((s) => s.doc.kind === "servicio").slice(0, services),
  ].map((s) => s.doc);
}

/** Contexto que ve el modelo: cada documento con su referencia para poder citarlo */
export function formatContext(found: Doc[]) {
  return found
    .map((d) =>
      d.kind === "producto"
        ? `[producto ${d.id}] ${d.text} Precio: S/ ${d.product.price.toFixed(2)}${d.product.priceMax ? ` a S/ ${d.product.priceMax.toFixed(2)}` : ""}.`
        : `[servicio ${d.id}] ${d.text}`,
    )
    .join("\n\n");
}

/** Datos de la empresa: van siempre en el prompt (son pocos), para responder dónde están, horario, RUC, etc. */
export const companyInfo = [
  `Nombre comercial: ${business.name}. Razón social: ${business.legalName}. RUC: ${business.ruc}.`,
  `Clínica veterinaria y tienda de productos para mascotas, fundada el ${business.foundedDate}. Nació de la experiencia en una distribuidora de productos veterinarios.`,
  `Atiende perros, gatos y exóticos, con médicos veterinarios titulados y colegiados.`,
  `Dirección: ${business.address} (sede Surco). Google Maps: ${business.mapsLink}`,
  `Horario: ${business.hours}.`,
  `Teléfono: ${business.phone}. Emergencias y WhatsApp: ${business.emergency}.`,
  `Instagram: ${business.instagram}`,
  `Servicios: ${services.map((x) => x.name).join(", ")}.`,
].join("\n");
