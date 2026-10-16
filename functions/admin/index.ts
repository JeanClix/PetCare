import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const SESSION_LIFETIME_SECONDS = 60 * 60 * 2;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const CAPTURE_LIMIT = { requests: 30, windowMs: 10 * 60_000 };
const allowedOrigins = new Set([
  "https://jeanclix.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const loginAttempts = new Map<string, number[]>();
const captureAttempts = new Map<string, number[]>();

type AdminConfig = {
  email: string;
  password: string;
  secret: string;
  databaseUrl: string;
};

function getConfig(): AdminConfig | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  if (!email || !password || !secret || password.length < 14 || secret.length < 32 || !databaseUrl) return null;
  return { email, password, secret, databaseUrl };
}

function response(body: unknown, status: number, origin: string | null) {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Vary", "Origin");
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function equalSecret(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSession(email: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: email, iat: now, exp: now + SESSION_LIFETIME_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function isValidSession(token: string, secret: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  if (!equalSecret(signature, sign(payload, secret))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    return typeof session.sub === "string" && typeof session.exp === "number" && session.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

function isRateLimited(ip: string) {
  return exceedsLimit(loginAttempts, ip, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
}

function isCaptureRateLimited(ip: string) {
  return exceedsLimit(captureAttempts, ip, CAPTURE_LIMIT.requests, CAPTURE_LIMIT.windowMs);
}

function exceedsLimit(bucket: Map<string, number[]>, ip: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (bucket.get(ip) ?? []).filter((attempt) => now - attempt < windowMs);
  recent.push(now);
  bucket.set(ip, recent);
  return recent.length > limit;
}

type ContactInput = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  source: string;
  subject: string;
  message: string;
  channel: "form" | "whatsapp";
  marketingConsent: boolean;
  service?: string;
  pet?: string;
  type: "appointment" | "order";
  total?: number;
  items?: string[];
};

type CaptureMetadata = {
  externalId?: string;
  createdAt?: string;
  status?: string;
  marketingConsentAt?: string;
  marketingConsentSource?: string;
  lifecycle?: string;
  lifecycleReason?: string;
  notes?: string;
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validateCapture(value: unknown): ContactInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const firstname = text(body.firstname, 100);
  const lastname = text(body.lastname, 100);
  const email = text(body.email, 254).toLowerCase();
  const phone = text(body.phone, 32).replace(/\D/g, "");
  const type = body.type === "order" ? "order" : body.type === "appointment" ? "appointment" : null;
  const source = body.source === "checkout" ? "checkout" : body.source === "whatsapp" ? "whatsapp" : body.source === "contact_form" ? "contact_form" : null;
  if (
    !firstname ||
    !lastname ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
    !/^(9\d{8}|0?1\d{7})$/.test(phone) ||
    !type ||
    !source ||
    body.consent !== true
  ) return null;
  const items = Array.isArray(body.items) ? body.items.slice(0, 50).map((item) => text(item, 300)).filter(Boolean) : [];
  return {
    firstname,
    lastname,
    email,
    phone,
    source,
    subject: text(body.subject, 200) || (type === "order" ? "Pedido de tienda" : "Solicitud de cita"),
    message: text(body.message, 5000),
    channel: body.channel === "whatsapp" ? "whatsapp" : "form",
    marketingConsent: body.marketingConsent === true,
    service: text(body.service, 200) || undefined,
    pet: text(body.pet, 200) || undefined,
    type,
    total: typeof body.total === "number" && Number.isFinite(body.total) && body.total >= 0 ? body.total : undefined,
    items,
  };
}

async function ensureSchema(sql: NeonQueryFunction<false, false>) {
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_contacts (
      id UUID PRIMARY KEY,
      firstname TEXT NOT NULL,
      lastname TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL,
      lifecycle TEXT NOT NULL DEFAULT 'lead',
      lifecycle_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      lifecycle_reason TEXT NOT NULL DEFAULT '',
      engagement_count INTEGER NOT NULL DEFAULT 1,
      order_request_count INTEGER NOT NULL DEFAULT 0,
      marketing_consent BOOLEAN NOT NULL DEFAULT false,
      marketing_consent_at TIMESTAMPTZ,
      marketing_consent_source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes TEXT NOT NULL DEFAULT ''
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_messages (
      id UUID PRIMARY KEY,
      external_id TEXT UNIQUE,
      contact_id UUID NOT NULL REFERENCES petcare_contacts(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'nuevo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_leads (
      id UUID PRIMARY KEY,
      external_id TEXT UNIQUE,
      contact_id UUID NOT NULL REFERENCES petcare_contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      channel TEXT NOT NULL,
      service TEXT,
      pet TEXT,
      total NUMERIC(12, 2),
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      details TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE petcare_messages ADD COLUMN IF NOT EXISTS external_id TEXT`;
  await sql`ALTER TABLE petcare_leads ADD COLUMN IF NOT EXISTS external_id TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS petcare_messages_external_id_idx ON petcare_messages (external_id) WHERE external_id IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS petcare_leads_external_id_idx ON petcare_leads (external_id) WHERE external_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_messages_contact_created_idx ON petcare_messages (contact_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_leads_contact_created_idx ON petcare_leads (contact_id, created_at DESC)`;
}

async function capture(sql: NeonQueryFunction<false, false>, input: ContactInput, metadata: CaptureMetadata = {}) {
  const createdAt = metadata.createdAt && Number.isFinite(Date.parse(metadata.createdAt))
    ? new Date(metadata.createdAt).toISOString()
    : new Date().toISOString();
  const leadStatus = ["new", "contacted", "qualified", "closed"].includes(metadata.status ?? "")
    ? metadata.status!
    : "new";
  const lifecycle = ["visitante", "lead", "interesado", "cliente", "cliente_recurrente", "cliente_fidelizado"].includes(metadata.lifecycle ?? "")
    ? metadata.lifecycle!
    : input.type === "order" ? "interesado" : "lead";
  const now = createdAt;
  const consentAt = metadata.marketingConsentAt && Number.isFinite(Date.parse(metadata.marketingConsentAt))
    ? new Date(metadata.marketingConsentAt).toISOString()
    : now;
  if (metadata.externalId) {
    const existing = await sql`SELECT id FROM petcare_leads WHERE external_id = ${metadata.externalId} LIMIT 1`;
    if (existing.length > 0) return;
  }
  const contactId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const source = input.source;

  await sql.transaction([
    sql`
      INSERT INTO petcare_contacts (
        id, firstname, lastname, email, phone, source, lifecycle, lifecycle_updated_at,
        lifecycle_reason, engagement_count, order_request_count, marketing_consent,
        marketing_consent_at, marketing_consent_source, created_at, last_seen_at, notes
      ) VALUES (
        ${contactId}, ${input.firstname}, ${input.lastname}, ${input.email}, ${input.phone}, ${source},
        ${lifecycle}, ${now},
        ${text(metadata.lifecycleReason, 300) || (input.type === "order" ? "Inició una solicitud de pedido" : "Primer contacto capturado")},
        1, ${input.type === "order" ? 1 : 0}, ${input.marketingConsent},
        ${input.marketingConsent ? consentAt : null},
        ${input.marketingConsent ? metadata.marketingConsentSource ?? source : null}, ${now}, ${now},
        ${text(metadata.notes, 5000)}
      )
      ON CONFLICT (email) DO UPDATE SET
        firstname = EXCLUDED.firstname,
        lastname = EXCLUDED.lastname,
        phone = EXCLUDED.phone,
        source = EXCLUDED.source,
        lifecycle = CASE
          WHEN ${Boolean(metadata.lifecycle)} THEN ${lifecycle}
          WHEN petcare_contacts.lifecycle = 'visitante' THEN 'lead'
          WHEN petcare_contacts.lifecycle = 'lead' AND (EXCLUDED.order_request_count > 0 OR petcare_contacts.engagement_count >= 1) THEN 'interesado'
          ELSE petcare_contacts.lifecycle
        END,
        lifecycle_updated_at = CASE
          WHEN ${Boolean(metadata.lifecycle)} THEN ${now}
          WHEN petcare_contacts.lifecycle IN ('visitante', 'lead') THEN EXCLUDED.lifecycle_updated_at
          ELSE petcare_contacts.lifecycle_updated_at
        END,
        lifecycle_reason = CASE
          WHEN ${Boolean(metadata.lifecycle)} THEN ${text(metadata.lifecycleReason, 300)}
          WHEN EXCLUDED.order_request_count > 0 THEN 'Inició una solicitud de pedido'
          WHEN petcare_contacts.lifecycle IN ('visitante', 'lead') THEN 'Nuevo contacto capturado'
          ELSE petcare_contacts.lifecycle_reason
        END,
        engagement_count = petcare_contacts.engagement_count + 1,
        order_request_count = petcare_contacts.order_request_count + EXCLUDED.order_request_count,
        marketing_consent = petcare_contacts.marketing_consent OR EXCLUDED.marketing_consent,
        marketing_consent_at = CASE
          WHEN EXCLUDED.marketing_consent AND NOT petcare_contacts.marketing_consent THEN EXCLUDED.marketing_consent_at
          ELSE petcare_contacts.marketing_consent_at
        END,
        marketing_consent_source = CASE
          WHEN EXCLUDED.marketing_consent AND NOT petcare_contacts.marketing_consent THEN EXCLUDED.marketing_consent_source
          ELSE petcare_contacts.marketing_consent_source
        END,
        notes = CASE WHEN ${Boolean(metadata.notes)} THEN ${text(metadata.notes, 5000)} ELSE petcare_contacts.notes END,
        last_seen_at = EXCLUDED.last_seen_at
    `,
    sql`
      INSERT INTO petcare_messages (id, external_id, contact_id, subject, body, source, channel, status, created_at)
      SELECT ${messageId}, ${metadata.externalId ? `${metadata.externalId}:message` : null}, id, ${input.subject}, ${input.message}, ${source}, ${input.channel}, 'nuevo', ${now}
      FROM petcare_contacts WHERE email = ${input.email}
      ON CONFLICT DO NOTHING
    `,
    sql`
      INSERT INTO petcare_leads (id, external_id, contact_id, type, status, channel, service, pet, total, items, details, created_at)
      SELECT ${leadId}, ${metadata.externalId ?? null}, id, ${input.type}, ${leadStatus}, ${input.channel}, ${input.service ?? null},
        ${input.pet ?? null}, ${input.total ?? null}, ${JSON.stringify(input.items)}, ${input.message}, ${now}
      FROM petcare_contacts WHERE email = ${input.email}
      ON CONFLICT DO NOTHING
    `,
  ]);
}

async function parseJsonBody(request: Request) {
  const body = await request.text().catch(() => "");
  if (new TextEncoder().encode(body).byteLength > 64 * 1024) return null;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request) {
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) return response({ error: "Origen no permitido" }, 403, null);
    if (request.method === "OPTIONS") return response(null, 204, origin);
    if (request.method !== "POST") return response({ error: "Método no permitido" }, 405, origin);

    const config = getConfig();
    if (!config) return response({ error: "Autenticación administrativa no configurada" }, 503, origin);

    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    const sql = neon(config.databaseUrl);
    const route = path.split("/").filter(Boolean);
    const action = route.at(-1) ?? "";

    if (action === "login") {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
      if (isRateLimited(ip)) return response({ error: "Demasiados intentos. Prueba nuevamente en 15 minutos." }, 429, origin);
      const contentLength = Number(request.headers.get("Content-Length") ?? 0);
      if (contentLength > 4096) return response({ error: "Solicitud demasiado grande." }, 413, origin);

      const body = await parseJsonBody(request);
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      if (!equalSecret(email, config.email) || !equalSecret(password, config.password)) {
        return response({ error: "Correo o contraseña incorrectos." }, 401, origin);
      }
      loginAttempts.delete(ip);
      return response({ token: createSession(config.email, config.secret), expiresIn: SESSION_LIFETIME_SECONDS }, 200, origin);
    }

    if (action === "capture") {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
      if (isCaptureRateLimited(ip)) return response({ error: "Demasiadas solicitudes. Intenta más tarde." }, 429, origin);
      const input = validateCapture(await parseJsonBody(request));
      if (!input) return response({ error: "Revisa los datos y autoriza el tratamiento para gestionar tu solicitud." }, 400, origin);
      try {
        await ensureSchema(sql);
        await capture(sql, input);
        return response({ ok: true }, 201, origin);
      } catch (error) {
        console.error("No se pudo guardar la solicitud CRM", error);
        return response({ error: "No pudimos registrar la solicitud. Inténtalo nuevamente." }, 503, origin);
      }
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token || !isValidSession(token, config.secret)) {
      return response({ error: "La sesión venció. Inicia sesión nuevamente." }, 401, origin);
    }
    if (action === "verify") return response({ authenticated: true }, 200, origin);

    try {
      await ensureSchema(sql);
      if (action === "read") {
        const [contacts, messages, leads] = await Promise.all([
          sql`SELECT id, firstname, lastname, email, phone, source, lifecycle,
            lifecycle_updated_at AS "lifecycleUpdatedAt", lifecycle_reason AS "lifecycleReason",
            engagement_count AS "engagementCount", order_request_count AS "orderRequestCount",
            marketing_consent AS "marketingConsent", marketing_consent_at AS "marketingConsentAt",
            marketing_consent_source AS "marketingConsentSource", created_at AS "createdAt",
            last_seen_at AS "lastSeenAt", notes FROM petcare_contacts ORDER BY created_at DESC`,
          sql`SELECT id, contact_id AS "contactId", subject, body, source, channel, status,
            created_at AS "createdAt" FROM petcare_messages ORDER BY created_at DESC`,
          sql`SELECT l.id, l.contact_id AS "contactId",
            concat_ws(' ', c.firstname, c.lastname) AS owner, c.email, c.phone,
            l.type, l.status, l.channel, l.service, l.pet, l.total,
            l.items, l.details, l.created_at AS "createdAt"
            FROM petcare_leads l JOIN petcare_contacts c ON c.id = l.contact_id
            ORDER BY l.created_at DESC`,
        ]);
        return response({ contacts, messages, leads }, 200, origin);
      }

      const body = await parseJsonBody(request);
      if (action === "lifecycle") {
        const id = text(body?.id, 64);
        const lifecycle = text(body?.lifecycle, 32);
        const allowed = ["visitante", "lead", "interesado", "cliente", "cliente_recurrente", "cliente_fidelizado"];
        if (!id || !allowed.includes(lifecycle)) return response({ error: "Etapa de contacto inválida." }, 400, origin);
        await sql`UPDATE petcare_contacts SET lifecycle = ${lifecycle}, lifecycle_updated_at = now(),
          lifecycle_reason = 'Etapa actualizada por el administrador' WHERE id = ${id}::uuid`;
        return response({ ok: true }, 200, origin);
      }
      if (action === "contact-notes") {
        const id = text(body?.id, 64);
        const notes = text(body?.notes, 5000);
        if (!id) return response({ error: "Contacto inválido." }, 400, origin);
        await sql`UPDATE petcare_contacts SET notes = ${notes} WHERE id = ${id}::uuid`;
        return response({ ok: true }, 200, origin);
      }
      if (action === "message-status") {
        const id = text(body?.id, 64);
        const status = text(body?.status, 24);
        if (!id || !["nuevo", "leído", "contactado", "resuelto"].includes(status)) return response({ error: "Estado de mensaje inválido." }, 400, origin);
        await sql`UPDATE petcare_messages SET status = ${status} WHERE id = ${id}::uuid`;
        return response({ ok: true }, 200, origin);
      }
      if (action === "lead-status") {
        const id = text(body?.id, 64);
        const status = text(body?.status, 24);
        if (!id || !["new", "contacted", "qualified", "closed"].includes(status)) return response({ error: "Estado de lead inválido." }, 400, origin);
        await sql`UPDATE petcare_leads SET status = ${status} WHERE id = ${id}::uuid`;
        return response({ ok: true }, 200, origin);
      }
      if (action === "clear") {
        await sql.transaction([
          sql`DELETE FROM petcare_leads`,
          sql`DELETE FROM petcare_messages`,
          sql`DELETE FROM petcare_contacts`,
        ]);
        return response({ ok: true }, 200, origin);
      }
      if (action === "import-lead") {
        const input = validateCapture(body);
        const externalId = text(body?.externalId, 100);
        if (!input || !/^[\w:-]{1,100}$/.test(externalId)) {
          return response({ error: "El registro histórico no tiene datos válidos." }, 400, origin);
        }
        await capture(sql, input, {
          externalId: `browser-v1:${externalId}`,
          createdAt: text(body?.createdAt, 50),
          status: text(body?.status, 24),
          marketingConsentAt: text(body?.marketingConsentAt, 50) || undefined,
          marketingConsentSource: text(body?.marketingConsentSource, 100) || undefined,
          lifecycle: text(body?.lifecycle, 32) || undefined,
          lifecycleReason: text(body?.lifecycleReason, 300) || undefined,
          notes: text(body?.notes, 5000) || undefined,
        });
        return response({ ok: true }, 200, origin);
      }
      return response({ error: "Ruta no encontrada" }, 404, origin);
    } catch (error) {
      console.error("Error en la API del CRM", error);
      return response({ error: "No se pudo completar la operación del CRM." }, 503, origin);
    }
  },
};
