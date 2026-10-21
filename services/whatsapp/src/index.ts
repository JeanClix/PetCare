import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import { clearAuthState, useNeonAuthState } from "./neonAuthState.js";

/*
 * Servicio de WhatsApp de PetCare.
 * Mantiene una sesión de WhatsApp Web (Baileys, sin navegador) enlazada al número de la clínica
 * y expone una API mínima que solo usa la función admin de Neon (token compartido).
 * La sesión vive en Neon, así que sobrevive a reinicios y despliegues en Render.
 */

const PORT = Number(process.env.PORT ?? 10000);
const TOKEN = process.env.WHATSAPP_SERVICE_TOKEN ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
// Pausa mínima entre mensajes: enviar en ráfaga es lo que más bloqueos provoca
const SEND_INTERVAL_MS = Number(process.env.WHATSAPP_SEND_INTERVAL_MS ?? 4000);
const MAX_MESSAGE_LENGTH = 2000;

if (TOKEN.length < 32 || !DATABASE_URL) {
  console.error("Configura WHATSAPP_SERVICE_TOKEN (mínimo 32 caracteres) y DATABASE_URL.");
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL ?? "warn" });

type ServiceState = {
  status: "starting" | "qr" | "connecting" | "open" | "logged_out";
  qr: string | null;
  qrUpdatedAt: string | null;
  phone: string | null;
  name: string | null;
  lastError: string | null;
};

const state: ServiceState = { status: "starting", qr: null, qrUpdatedAt: null, phone: null, name: null, lastError: null };
let socket: WASocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

/** Inicia la conexión y, si falla (por ejemplo, Neon no responde), reintenta sin tumbar el proceso */
function startConnection(delayMs = 0) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((error: unknown) => {
      state.lastError = error instanceof Error ? error.message : String(error);
      console.error("No se pudo iniciar WhatsApp; reintento en 15 s:", state.lastError);
      startConnection(15_000);
    });
  }, delayMs);
}

async function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const { state: authState, saveCreds } = await useNeonAuthState(DATABASE_URL);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const current = makeWASocket({
    ...(version ? { version } : {}),
    auth: { creds: authState.creds, keys: makeCacheableSignalKeyStore(authState.keys, logger) },
    browser: Browsers.ubuntu("PetCare"),
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  socket = current;
  state.status = "connecting";

  current.ev.on("creds.update", saveCreds);
  current.ev.on("connection.update", async (update) => {
    if (update.qr) {
      state.status = "qr";
      state.qr = await QRCode.toDataURL(update.qr, { margin: 1, width: 320 });
      state.qrUpdatedAt = new Date().toISOString();
    }
    if (update.connection === "open") {
      state.status = "open";
      state.qr = null;
      state.lastError = null;
      state.phone = current.user?.id.split(":")[0].split("@")[0] ?? null;
      state.name = current.user?.name ?? null;
      console.log(`WhatsApp conectado como ${state.phone}`);
    }
    if (update.connection === "close") {
      const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      state.lastError = update.lastDisconnect?.error?.message ?? null;
      if (socket !== current) return;
      if (code === DisconnectReason.loggedOut) {
        // El número se desvinculó desde el teléfono: se borra la sesión y se genera un QR nuevo
        state.status = "logged_out";
        state.phone = null;
        state.name = null;
        await clearAuthState(DATABASE_URL);
        startConnection(2000);
      } else {
        state.status = "connecting";
        startConnection(code === DisconnectReason.restartRequired ? 500 : 5000);
      }
    }
  });
}

/** Celular peruano (9 dígitos) o número con código de país → JID de WhatsApp */
function toJid(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const international = /^9\d{8}$/.test(digits) ? `51${digits}` : digits;
  if (!/^\d{10,15}$/.test(international)) return null;
  return `${international}@s.whatsapp.net`;
}

/** Tras despertar (Render gratis), la sesión tarda unos segundos en reconectarse desde Neon */
async function waitUntilOpen(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (state.status !== "open" && Date.now() < deadline) {
    if (state.status === "qr" || state.status === "logged_out") return false;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return state.status === "open";
}

// Cola: un mensaje a la vez, con pausa entre envíos
let queue: Promise<unknown> = Promise.resolve();
let lastSentAt = 0;

function enqueueSend(jid: string, text: string) {
  const task = queue.then(async () => {
    const wait = lastSentAt + SEND_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (!socket || state.status !== "open") throw new Error("WhatsApp no está conectado.");
    const [registered] = (await socket.onWhatsApp(jid.split("@")[0])) ?? [];
    if (!registered?.exists) throw new Error("Ese número no tiene WhatsApp.");
    const sent = await socket.sendMessage(registered.jid, { text });
    lastSentAt = Date.now();
    return sent?.key.id ?? null;
  });
  queue = task.catch(() => undefined);
  return task;
}

function authorized(request: IncomingMessage) {
  const header = request.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return provided.length > 0 && timingSafeEqual(digest(provided), digest(TOKEN));
}

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Solicitud demasiado grande.");
  }
  return JSON.parse(raw || "{}") as Record<string, unknown>;
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  try {
    // Público y sin datos: Render lo usa como health check
    if (path === "/health") return reply(response, 200, { ok: true });
    if (!authorized(request)) return reply(response, 401, { error: "No autorizado." });

    if (path === "/status" && request.method === "GET") {
      return reply(response, 200, state);
    }
    if (path === "/send" && request.method === "POST") {
      const body = await readJson(request);
      const jid = typeof body.phone === "string" ? toJid(body.phone) : null;
      const text = typeof body.message === "string" ? body.message.trim() : "";
      if (!jid || !text || text.length > MAX_MESSAGE_LENGTH) {
        return reply(response, 400, { error: "Revisa el número y el mensaje (máximo 2000 caracteres)." });
      }
      if (!(await waitUntilOpen(25_000))) {
        return reply(response, 503, { error: "WhatsApp no está conectado. El administrador debe escanear el QR desde el panel." });
      }
      const id = await enqueueSend(jid, text);
      return reply(response, 200, { ok: true, id });
    }
    if (path === "/logout" && request.method === "POST") {
      const current = socket;
      socket = null;
      await current?.logout().catch(() => undefined);
      current?.end(undefined);
      await clearAuthState(DATABASE_URL);
      Object.assign(state, { status: "starting", qr: null, phone: null, name: null });
      startConnection();
      return reply(response, 200, { ok: true });
    }
    return reply(response, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    return reply(response, message.includes("WhatsApp") ? 422 : 500, { error: message });
  }
});

server.listen(PORT, () => console.log(`Servicio de WhatsApp escuchando en :${PORT}`));
startConnection();
