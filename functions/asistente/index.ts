/*
 * Asistente de PetCare (Neon Function). Recibe la conversación del widget de la web y:
 *   1. reescribe la consulta con términos técnicos y detecta la especie (modelo rápido),
 *   2. busca en el catálogo y los servicios (retrieval.ts),
 *   3. responde solo con lo encontrado y devuelve los productos citados (modelo grande).
 * La clave de Groq vive aquí como variable de entorno: nunca llega al navegador.
 */
import type { Pet } from "../../src/data/products";
import { companyInfo, formatContext, search, type Doc } from "./retrieval";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const REWRITE_MODEL = "openai/gpt-oss-20b";
const ANSWER_MODEL = "openai/gpt-oss-120b";

const allowedOrigins = [
  "https://jeanclix.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
];

const MAX_TURNS = 8;
const MAX_CHARS = 600;
// Límite por IP para que nadie agote la cuota de Groq desde afuera
const RATE_LIMIT = { requests: 20, windowMs: 10 * 60_000 };
const hits = new Map<string, number[]>();

type Turn = { role: "user" | "assistant"; content: string };

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.requests;
}

function parseTurns(body: unknown): Turn[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const turns = messages.slice(-MAX_TURNS).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content ?? "").slice(0, MAX_CHARS).trim(),
  })) as Turn[];
  return turns.at(-1)?.role === "user" && turns.at(-1)!.content ? turns : null;
}

async function groq<T>(model: string, messages: { role: string; content: string }[], attempts = 2): Promise<T> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  // Groq a veces rechaza una generación que no valida como JSON: se reintenta una vez
  if (res.status === 400 && attempts > 1) return groq<T>(model, messages, attempts - 1);
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(data.choices[0].message.content) as T;
}

const transcript = (turns: Turn[]) => turns.map((t) => `${t.role === "user" ? "Cliente" : "Asistente"}: ${t.content}`).join("\n");

const REWRITE_PROMPT = `Conviertes la consulta de un cliente de una veterinaria en una búsqueda para su catálogo.
Devuelve JSON: {"especie": "perro" | "gato" | "exotico" | null, "busqueda": string}
- "especie": la mascota de la que habla (gata/gatito = gato; ave, conejo, hámster, cuy, reptil = exotico). null si no se sabe.
- "busqueda": 8 a 15 palabras clave en español para encontrar productos o servicios: el síntoma en palabras simples y técnicas,
  el tipo de producto (dermatológico, antimicótico, antiparasitario, pulgas, garrapatas, oftálmico, colirio, ótico, oídos,
  shampoo medicado, suplemento, vitaminas, hepatoprotector, laxante, dental, alimento, arena, ansiedad, estrés, etc.)
  y principios activos típicos (clorhexidina, gentamicina, neomicina...). Si pide un servicio (baño, grooming, cirugía,
  vacunas, análisis, viaje, microchip, hospedaje, domicilio), incluye esa palabra.
  Ejemplos: bolas de pelo → laxante lubricante; no quiere comer → estimulante apetito; hígado → hepatoprotector.`;

const ANSWER_PROMPT = `Eres el asistente virtual de PetCare, clínica veterinaria y tienda en Santiago de Surco, Lima.
Respondes en español peruano, cercano y breve (máximo 120 palabras), en texto plano sin markdown.

Reglas:
- Recomienda SOLO productos y servicios que aparezcan en el CONTEXTO, y explica en una frase por qué sirve cada uno
  según su descripción o principio activo. Como máximo 3 productos.
- Usa cada producto solo para su zona y fin: ojos solo con oftálmicos, oídos solo con óticos, piel con dermatológicos o
  shampoos. Si piden un baño o grooming sin mencionar un problema de piel, sugiere el servicio y no recomiendes
  shampoos medicados.
- Si ningún producto del contexto encaja, dilo con honestidad y sugiere el servicio del contexto que lo resuelva
  (por ejemplo, consultas incluye vacunas y desparasitaciones).
- No escribas los ids en "respuesta": nombra los productos por su nombre.
- No diagnostiques: un síntoma puede tener varias causas. Si hay síntomas, recomienda una consulta para confirmar,
  sobre todo antes de usar antibióticos, esteroides o antiparasitarios.
- No inventes dosis, frecuencias ni datos que no estén en el contexto.
- Respeta la especie: nunca sugieras un producto que no indique ser para esa mascota.
- Señales de alarma (sangrado, convulsiones, dificultad para respirar, no come ni bebe hace más de un día,
  intoxicación, atropello, vómitos o diarrea con sangre): marca "urgente" y pide llamar de inmediato.
- Preguntas sobre la empresa (quiénes son, dirección, horario, teléfono, RUC, redes): responde solo con los DATOS DE
  PETCARE, sin recomendar productos. Si el dato no está ahí, dilo y ofrece el teléfono.
- Si preguntan algo ajeno a mascotas o a PetCare, redirige amablemente.

Devuelve JSON: {"respuesta": string, "productos": [ids numéricos como texto, en orden de relevancia],
"servicio": id del servicio sugerido o null, "urgente": boolean}`;

async function answer(turns: Turn[]) {
  const query = transcript(turns);
  const rewrite = await groq<{ especie?: string | null; busqueda?: string }>(REWRITE_MODEL, [
    { role: "system", content: REWRITE_PROMPT },
    { role: "user", content: query },
  ]);
  const pet = ["perro", "gato", "exotico"].includes(rewrite.especie ?? "") ? (rewrite.especie as Pet) : undefined;
  const found = search(`${turns.at(-1)!.content} ${rewrite.busqueda ?? ""}`, { pet });

  const reply = await groq<{ respuesta?: string; productos?: unknown[]; servicio?: string | null; urgente?: boolean }>(
    ANSWER_MODEL,
    [
      { role: "system", content: ANSWER_PROMPT },
      {
        role: "user",
        content: `DATOS DE PETCARE:\n${companyInfo}\n\nCONTEXTO (catálogo de PetCare):\n${formatContext(found) || "(sin resultados)"}\n\nMASCOTA: ${pet ?? "no indicada"}\n\nCONVERSACIÓN:\n${query}`,
      },
    ],
  );

  // Solo se devuelven referencias que realmente estaban en el contexto
  const ids = (kind: Doc["kind"]) => new Set(found.filter((d) => d.kind === kind).map((d) => d.id));
  const productIds = ids("producto");
  return {
    // Por si el modelo igual cita los ids entre paréntesis
    respuesta: reply.respuesta?.replace(/\s*\(\d{3,5}\)/g, "").trim() || "No pude armar una respuesta. ¿Me cuentas un poco más sobre tu mascota?",
    productos: [...new Set((reply.productos ?? []).map(String))].filter((id) => productIds.has(id)).slice(0, 3).map(Number),
    servicio: reply.servicio && ids("servicio").has(reply.servicio) ? reply.servicio : null,
    urgente: Boolean(reply.urgente),
  };
}

export default {
  async fetch(request: Request) {
    const cors = corsHeaders(request.headers.get("Origin"));
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET") return json({ ok: true }, 200, cors);
    if (request.method !== "POST") return json({ error: "Método no permitido" }, 405, cors);

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
    if (rateLimited(ip)) return json({ error: "Demasiadas consultas. Intenta en unos minutos." }, 429, cors);

    const turns = parseTurns(await request.json().catch(() => null));
    if (!turns) return json({ error: "Consulta vacía o inválida" }, 400, cors);

    try {
      return json(await answer(turns), 200, cors);
    } catch (error) {
      console.error(error);
      return json({ error: "El asistente no está disponible ahora." }, 502, cors);
    }
  },
};
