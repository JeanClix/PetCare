import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const SESSION_LIFETIME_SECONDS = 60 * 60 * 2;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const CAPTURE_LIMIT = { requests: 30, windowMs: 10 * 60_000 };
const CAMPAIGN_MAX_RECIPIENTS = 500;
const CAMPAIGN_BATCH_SIZE = 100;
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

type SessionClaims = {
  sub: string;
  exp: number;
  role: "admin" | "customer";
  id: string;
  firstname: string;
  lastname: string;
  phone: string;
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
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function unsubscribeToken(email: string, secret: string) {
  return sign(`marketing-unsubscribe:${email.trim().toLowerCase()}`, secret);
}

function verifyResendWebhook(rawBody: string, request: Request, secret: string) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatures = request.headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !/^whsec_[A-Za-z0-9+/=]+$/.test(secret)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 5 * 60) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signatures.split(" ").some((signature) => {
    const candidate = signature.split(",", 2);
    return candidate[0] === "v1" && candidate[1] !== undefined && equalSecret(candidate[1], expected);
  });
}

function createSession(
  subject: string,
  secret: string,
  identity: Omit<SessionClaims, "sub" | "exp">,
) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    iat: now,
    exp: now + SESSION_LIFETIME_SECONDS,
    ...identity,
  })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function readSession(token: string, secret: string): SessionClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !equalSecret(signature, sign(payload, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionClaims>;
    if (
      typeof session.sub !== "string" ||
      typeof session.exp !== "number" ||
      session.exp <= Date.now() / 1000 ||
      (session.role !== "admin" && session.role !== "customer") ||
      typeof session.id !== "string" ||
      typeof session.firstname !== "string" ||
      typeof session.lastname !== "string" ||
      typeof session.phone !== "string"
    ) return null;
    return session as SessionClaims;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash, extra] = stored.split(":");
  if (!salt || !hash || extra || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
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
  accountId?: string;
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
    CREATE TABLE IF NOT EXISTS petcare_users (
      id UUID PRIMARY KEY,
      firstname TEXT NOT NULL,
      lastname TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_contacts (
      id UUID PRIMARY KEY,
      account_id UUID REFERENCES petcare_users(id) ON DELETE SET NULL,
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
      marketing_unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes TEXT NOT NULL DEFAULT ''
    )
  `;
  await sql`ALTER TABLE petcare_contacts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES petcare_users(id) ON DELETE SET NULL`;
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
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_marketing_campaigns (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      recipient TEXT NOT NULL,
      segment TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT '',
      cta_url TEXT NOT NULL DEFAULT '',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      provider_id TEXT,
      error TEXT NOT NULL DEFAULT '',
      is_test BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE petcare_marketing_campaigns ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE petcare_contacts ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE petcare_marketing_campaigns ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE petcare_marketing_campaigns ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE petcare_marketing_campaigns ADD COLUMN IF NOT EXISTS cta_label TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE petcare_marketing_campaigns ADD COLUMN IF NOT EXISTS cta_url TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE petcare_marketing_campaigns ADD COLUMN IF NOT EXISTS recipient_count INTEGER NOT NULL DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_marketing_recipients (
      id UUID PRIMARY KEY,
      campaign_id UUID NOT NULL REFERENCES petcare_marketing_campaigns(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES petcare_contacts(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      provider_id TEXT,
      error TEXT NOT NULL DEFAULT '',
      sent_at TIMESTAMPTZ,
      UNIQUE (campaign_id, email)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_marketing_events (
      id TEXT PRIMARY KEY,
      recipient_id UUID REFERENCES petcare_marketing_recipients(id) ON DELETE SET NULL,
      campaign_id UUID REFERENCES petcare_marketing_campaigns(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      provider_email_id TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS petcare_marketing_recipients_campaign_idx ON petcare_marketing_recipients (campaign_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_marketing_events_campaign_idx ON petcare_marketing_events (campaign_id, event_type)`;
  await sql`ALTER TABLE petcare_messages ADD COLUMN IF NOT EXISTS external_id TEXT`;
  await sql`ALTER TABLE petcare_leads ADD COLUMN IF NOT EXISTS external_id TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS petcare_messages_external_id_idx ON petcare_messages (external_id) WHERE external_id IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS petcare_leads_external_id_idx ON petcare_leads (external_id) WHERE external_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_messages_contact_created_idx ON petcare_messages (contact_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_leads_contact_created_idx ON petcare_leads (contact_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_marketing_campaigns_sent_idx ON petcare_marketing_campaigns (sent_at DESC) WHERE status = 'sent'`;
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
        id, account_id, firstname, lastname, email, phone, source, lifecycle, lifecycle_updated_at,
        lifecycle_reason, engagement_count, order_request_count, marketing_consent,
        marketing_consent_at, marketing_consent_source, created_at, last_seen_at, notes
      ) VALUES (
        ${contactId}, ${metadata.accountId ?? null}::uuid, ${input.firstname}, ${input.lastname}, ${input.email}, ${input.phone}, ${source},
        ${lifecycle}, ${now},
        ${text(metadata.lifecycleReason, 300) || (input.type === "order" ? "Inició una solicitud de pedido" : "Primer contacto capturado")},
        1, ${input.type === "order" ? 1 : 0}, ${input.marketingConsent},
        ${input.marketingConsent ? consentAt : null},
        ${input.marketingConsent ? metadata.marketingConsentSource ?? source : null}, ${now}, ${now},
        ${text(metadata.notes, 5000)}
      )
      ON CONFLICT (email) DO UPDATE SET
        account_id = COALESCE(EXCLUDED.account_id, petcare_contacts.account_id),
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
        marketing_unsubscribed_at = CASE
          WHEN EXCLUDED.marketing_consent THEN NULL
          ELSE petcare_contacts.marketing_unsubscribed_at
        END,
        marketing_consent_at = CASE
          WHEN EXCLUDED.marketing_consent AND (
            NOT petcare_contacts.marketing_consent OR petcare_contacts.marketing_unsubscribed_at IS NOT NULL
          ) THEN EXCLUDED.marketing_consent_at
          ELSE petcare_contacts.marketing_consent_at
        END,
        marketing_consent_source = CASE
          WHEN EXCLUDED.marketing_consent AND (
            NOT petcare_contacts.marketing_consent OR petcare_contacts.marketing_unsubscribed_at IS NOT NULL
          ) THEN EXCLUDED.marketing_consent_source
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
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const route = path.split("/").filter(Boolean);
    const action = route.at(-1) ?? "";
    if (origin && !allowedOrigins.has(origin) && action !== "unsubscribe" && action !== "resend") {
      return response({ error: "Origen no permitido" }, 403, null);
    }
    if (request.method === "OPTIONS") return response(null, 204, origin);

    const config = getConfig();
    if (!config) return response({ error: "Autenticación administrativa no configurada" }, 503, origin);

    const sql = neon(config.databaseUrl);
    if (action === "unsubscribe" && request.method === "GET") {
      const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
      const token = url.searchParams.get("token") ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !equalSecret(token, unsubscribeToken(email, config.secret))) {
        return new Response("El enlace para cancelar la suscripción no es válido.", {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      await ensureSchema(sql);
      return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Preferencias de correo PetCare</title><body style="font:16px system-ui;max-width:560px;margin:4rem auto;padding:1rem;color:#13396a"><h1>Cancelar suscripción</h1><p>Confirma si deseas dejar de recibir emails de marketing de PetCare.</p><form method="post" action="${url.origin}${path}"><input type="hidden" name="email" value="${escapeHtml(email)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button style="background:#007a64;color:white;border:0;border-radius:999px;padding:.8rem 1.2rem;font:inherit" type="submit">Dejar de recibir emails</button></form></body></html>`, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (request.method !== "POST") return response({ error: "Método no permitido" }, 405, origin);

    if (action === "unsubscribe") {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 4096) return response({ error: "Solicitud demasiado grande." }, 413, origin);
      let email = "";
      let token = "";
      if (request.headers.get("Content-Type")?.includes("application/x-www-form-urlencoded")) {
        const values = new URLSearchParams(raw);
        if (values.get("List-Unsubscribe") === "One-Click") {
          email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
          token = url.searchParams.get("token") ?? "";
        } else {
          email = (values.get("email") ?? "").trim().toLowerCase();
          token = values.get("token") ?? "";
        }
      } else {
        try {
          const values = JSON.parse(raw) as Record<string, unknown>;
          email = text(values.email, 254).toLowerCase();
          token = text(values.token, 200);
        } catch {
          return response({ error: "Solicitud de baja inválida." }, 400, origin);
        }
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !equalSecret(token, unsubscribeToken(email, config.secret))) {
        return response({ error: "El enlace para cancelar la suscripción no es válido." }, 400, origin);
      }
      try {
        await ensureSchema(sql);
        await sql`
          UPDATE petcare_contacts SET marketing_consent = false, marketing_unsubscribed_at = now()
          WHERE lower(email) = ${email}
        `;
        if (request.headers.get("Content-Type")?.includes("application/x-www-form-urlencoded")) {
          return new Response("<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Suscripción cancelada</title><body style=\"font:16px system-ui;max-width:560px;margin:4rem auto;padding:1rem;color:#13396a\"><h1>Suscripción cancelada</h1><p>Ya no recibirás emails de marketing de PetCare.</p></body></html>", {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
        return response({ ok: true }, 200, origin);
      } catch (error) {
        console.error("No se pudo procesar la baja de marketing", error);
        return response({ error: "No se pudo guardar la baja. Inténtalo nuevamente." }, 503, origin);
      }
    }

    if (action === "resend") {
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
      if (!webhookSecret) return response({ error: "Webhook no configurado." }, 503, origin);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 64 * 1024 || !verifyResendWebhook(raw, request, webhookSecret)) {
        return response({ error: "Firma del webhook inválida." }, 400, origin);
      }
      try {
        const event = JSON.parse(raw) as { type?: unknown; data?: { email_id?: unknown; to?: unknown } };
        const eventType = text(event.type, 100);
        const providerEmailId = text(event.data?.email_id, 200);
        const eventRecipients = event.data?.to;
        const email = (typeof eventRecipients === "string"
          ? text(eventRecipients, 254)
          : Array.isArray(eventRecipients) ? text(eventRecipients[0], 254) : "").toLowerCase();
        const eventId = request.headers.get("svix-id")!;
        if (!eventType.startsWith("email.") || !providerEmailId) return response({ error: "Evento de Resend inválido." }, 400, origin);
        await ensureSchema(sql);
        const recipients = await sql`
          SELECT r.id, r.campaign_id, r.email FROM petcare_marketing_recipients r
          WHERE r.provider_id = ${providerEmailId} LIMIT 1
        `;
        const recipient = recipients[0];
        const recipientEmail = email || String(recipient?.email ?? "");
        await sql`
          INSERT INTO petcare_marketing_events (id, recipient_id, campaign_id, event_type, provider_email_id, email, payload)
          VALUES (
            ${eventId}, ${recipient?.id ?? null}::uuid, ${recipient?.campaign_id ?? null}::uuid,
            ${eventType}, ${providerEmailId}, ${recipientEmail}, ${raw}::jsonb
          ) ON CONFLICT (id) DO NOTHING
        `;
        if (recipient && eventType === "email.bounced") {
          await sql`
            UPDATE petcare_marketing_recipients SET status = 'bounced'
            WHERE id = ${String(recipient.id)}::uuid
          `;
        }
        if ((eventType === "email.complained" || eventType === "email.bounced") && recipientEmail) {
          await sql`
            UPDATE petcare_contacts SET marketing_consent = false, marketing_unsubscribed_at = now()
            WHERE lower(email) = ${recipientEmail.toLowerCase()}
          `;
        }
        return response({ ok: true }, 200, origin);
      } catch (error) {
        console.error("No se pudo guardar el evento de Resend", error);
        return response({ error: "No se pudo guardar el evento de email." }, 503, origin);
      }
    }

    if (action === "login") {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
      if (isRateLimited(ip)) return response({ error: "Demasiados intentos. Prueba nuevamente en 15 minutos." }, 429, origin);
      const contentLength = Number(request.headers.get("Content-Length") ?? 0);
      if (contentLength > 4096) return response({ error: "Solicitud demasiado grande." }, 413, origin);

      const body = await parseJsonBody(request);
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      if (!email || !password) return response({ error: "Correo o contraseña incorrectos." }, 401, origin);
      if (equalSecret(email, config.email)) {
        if (!equalSecret(password, config.password)) {
          return response({ error: "Correo o contraseña incorrectos." }, 401, origin);
        }
        loginAttempts.delete(ip);
        return response({
          token: createSession(config.email, config.secret, {
            role: "admin",
            id: "admin",
            firstname: "Administrador",
            lastname: "",
            phone: "",
          }),
          expiresIn: SESSION_LIFETIME_SECONDS,
          role: "admin",
          email: config.email,
          firstname: "Administrador",
          lastname: "",
          phone: "",
        }, 200, origin);
      }

      try {
        await ensureSchema(sql);
        const users = await sql`
          SELECT id, firstname, lastname, email, password_hash, phone
          FROM petcare_users WHERE email = ${email} LIMIT 1
        `;
        const user = users[0];
        if (!user || !verifyPassword(password, String(user.password_hash))) {
          return response({ error: "Correo o contraseña incorrectos." }, 401, origin);
        }
        loginAttempts.delete(ip);
        const identity = {
          role: "customer" as const,
          id: String(user.id),
          firstname: String(user.firstname),
          lastname: String(user.lastname),
          phone: String(user.phone ?? ""),
        };
        return response({
          token: createSession(email, config.secret, identity),
          expiresIn: SESSION_LIFETIME_SECONDS,
          ...identity,
          email,
        }, 200, origin);
      } catch (error) {
        console.error("No se pudo iniciar sesión del cliente", error);
        return response({ error: "No se pudo completar el inicio de sesión." }, 503, origin);
      }
    }

    if (action === "register") {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
      if (isRateLimited(ip)) return response({ error: "Demasiados intentos. Prueba nuevamente en 15 minutos." }, 429, origin);
      const contentLength = Number(request.headers.get("Content-Length") ?? 0);
      if (contentLength > 4096) return response({ error: "Solicitud demasiado grande." }, 413, origin);

      const body = await parseJsonBody(request);
      const name = text(body?.name, 120);
      const email = text(body?.email, 254).toLowerCase();
      const password = typeof body?.password === "string" ? body.password : "";
      if (
        name.length < 2 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
        password.length < 12 ||
        password.length > 128
      ) {
        return response({ error: "Ingresa un nombre, correo válido y una contraseña de al menos 12 caracteres." }, 400, origin);
      }
      if (equalSecret(email, config.email)) {
        return response({ error: "Ese correo está reservado para la cuenta administrativa." }, 409, origin);
      }

      const [firstname, ...lastnames] = name.trim().split(/\s+/);
      const lastname = lastnames.join(" ");
      const id = crypto.randomUUID();
      const contactId = crypto.randomUUID();
      try {
        await ensureSchema(sql);
        const users = await sql`
          WITH new_user AS (
            INSERT INTO petcare_users (id, firstname, lastname, email, password_hash)
            VALUES (${id}::uuid, ${firstname}, ${lastname}, ${email}, ${hashPassword(password)})
            ON CONFLICT (email) DO NOTHING
            RETURNING id, firstname, lastname, email, phone
          ),
          linked_contact AS (
            INSERT INTO petcare_contacts (
              id, account_id, firstname, lastname, email, source, lifecycle,
              lifecycle_reason, engagement_count, marketing_consent
            )
            SELECT ${contactId}::uuid, id, firstname, lastname, email, 'registration', 'lead',
              'Creó una cuenta de cliente', 1, false
            FROM new_user
            ON CONFLICT (email) DO UPDATE SET account_id = EXCLUDED.account_id
            RETURNING id
          )
          SELECT id, firstname, lastname, email, phone FROM new_user
        `;
        const user = users[0];
        if (!user) return response({ error: "Ya existe una cuenta con ese correo. Inicia sesión." }, 409, origin);
        loginAttempts.delete(ip);
        const identity = {
          role: "customer" as const,
          id: String(user.id),
          firstname: String(user.firstname),
          lastname: String(user.lastname),
          phone: String(user.phone ?? ""),
        };
        return response({
          token: createSession(email, config.secret, identity),
          expiresIn: SESSION_LIFETIME_SECONDS,
          ...identity,
          email,
        }, 201, origin);
      } catch (error) {
        console.error("No se pudo registrar la cuenta de cliente", error);
        return response({ error: "No se pudo crear la cuenta. Inténtalo nuevamente." }, 503, origin);
      }
    }

    if (action === "capture") {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
      if (isCaptureRateLimited(ip)) return response({ error: "Demasiadas solicitudes. Intenta más tarde." }, 429, origin);
      const input = validateCapture(await parseJsonBody(request));
      if (!input || input.type !== "appointment") {
        return response({ error: "Solo se aceptan solicitudes de cita públicas; inicia sesión para enviar un pedido." }, 400, origin);
      }
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
    const session = token ? readSession(token, config.secret) : null;
    if (!session) {
      return response({ error: "La sesión venció. Inicia sesión nuevamente." }, 401, origin);
    }
    if (action === "verify") {
      const { sub, exp: _expiresAt, ...identity } = session;
      return response({ authenticated: true, email: sub, ...identity }, 200, origin);
    }

    if (action === "order") {
      if (session.role !== "customer") return response({ error: "Inicia sesión con una cuenta de cliente para hacer un pedido." }, 403, origin);
      const body = await parseJsonBody(request);
      const phone = text(body?.phone, 32).replace(/\D/g, "");
      const items = Array.isArray(body?.items) ? body.items.slice(0, 50).map((item) => text(item, 300)).filter(Boolean) : [];
      const total = typeof body?.total === "number" && Number.isFinite(body.total) ? body.total : Number.NaN;
      const input = validateCapture({
        firstname: session.firstname,
        lastname: session.lastname || session.firstname,
        email: session.sub,
        phone,
        source: "checkout",
        subject: "Pedido de tienda",
        message: items.join("\n"),
        channel: "form",
        marketingConsent: body?.marketingConsent === true,
        type: "order",
        total,
        items,
        consent: body?.consent,
      });
      if (!input) return response({ error: "Revisa el teléfono del pedido y autoriza el tratamiento para gestionarlo." }, 400, origin);

      try {
        await ensureSchema(sql);
        await capture(sql, input, { accountId: session.id });
        await sql`UPDATE petcare_users SET phone = ${input.phone} WHERE id = ${session.id}::uuid`;
        return response({ ok: true }, 201, origin);
      } catch (error) {
        console.error("No se pudo guardar el pedido de cliente", error);
        return response({ error: "No pudimos registrar el pedido. Inténtalo nuevamente." }, 503, origin);
      }
    }

    if (session.role !== "admin") {
      return response({ error: "No tienes permisos para administrar el CRM." }, 403, origin);
    }

    try {
      await ensureSchema(sql);
      if (action === "read") {
        const [contacts, messages, leads, campaignStats, segmentCounts, campaignHistory] = await Promise.all([
          sql`SELECT id, firstname, lastname, email, phone, source, lifecycle,
            lifecycle_updated_at AS "lifecycleUpdatedAt", lifecycle_reason AS "lifecycleReason",
            engagement_count AS "engagementCount", order_request_count AS "orderRequestCount",
            marketing_consent AS "marketingConsent", marketing_consent_at AS "marketingConsentAt",
            marketing_consent_source AS "marketingConsentSource",
            marketing_unsubscribed_at AS "marketingUnsubscribedAt", created_at AS "createdAt",
            last_seen_at AS "lastSeenAt", notes FROM petcare_contacts ORDER BY created_at DESC`,
          sql`SELECT id, contact_id AS "contactId", subject, body, source, channel, status,
            created_at AS "createdAt" FROM petcare_messages ORDER BY created_at DESC`,
          sql`SELECT l.id, l.contact_id AS "contactId",
            concat_ws(' ', c.firstname, c.lastname) AS owner, c.email, c.phone,
            l.type, l.status, l.channel, l.service, l.pet, l.total,
            l.items, l.details, l.created_at AS "createdAt"
            FROM petcare_leads l JOIN petcare_contacts c ON c.id = l.contact_id
            ORDER BY l.created_at DESC`,
          sql`SELECT
            (SELECT count(*)::int FROM petcare_marketing_campaigns
              WHERE NOT is_test AND status IN ('sent', 'partial')) AS campaigns,
            (SELECT count(*)::int FROM petcare_marketing_recipients r
              JOIN petcare_marketing_campaigns c ON c.id = r.campaign_id
              WHERE NOT c.is_test AND r.status IN ('sent', 'bounced')) AS emails,
            (SELECT count(*)::int FROM petcare_marketing_campaigns
              WHERE is_test AND status = 'sent') AS test_emails,
            (SELECT count(DISTINCT e.recipient_id)::int FROM petcare_marketing_events e
              JOIN petcare_marketing_campaigns c ON c.id = e.campaign_id
              WHERE NOT c.is_test AND e.event_type = 'email.delivered') AS delivered,
            (SELECT count(DISTINCT e.recipient_id)::int FROM petcare_marketing_events e
              JOIN petcare_marketing_campaigns c ON c.id = e.campaign_id
              WHERE NOT c.is_test AND e.event_type = 'email.opened') AS opened,
            (SELECT count(DISTINCT e.recipient_id)::int FROM petcare_marketing_events e
              JOIN petcare_marketing_campaigns c ON c.id = e.campaign_id
              WHERE NOT c.is_test AND e.event_type = 'email.clicked') AS clicked,
            (SELECT count(DISTINCT e.recipient_id)::int FROM petcare_marketing_events e
              JOIN petcare_marketing_campaigns c ON c.id = e.campaign_id
              WHERE NOT c.is_test AND e.event_type = 'email.bounced') AS bounced,
            (SELECT count(DISTINCT e.recipient_id)::int FROM petcare_marketing_events e
              JOIN petcare_marketing_campaigns c ON c.id = e.campaign_id
              WHERE NOT c.is_test AND e.event_type = 'email.complained') AS complaints`,
          sql`SELECT
            count(DISTINCT lower(email)) FILTER (
              WHERE marketing_consent AND marketing_unsubscribed_at IS NULL
                AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            )::int AS all,
            count(DISTINCT lower(email)) FILTER (
              WHERE marketing_consent AND marketing_unsubscribed_at IS NULL AND lifecycle IN ('lead', 'interesado')
                AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            )::int AS unconverted,
            count(DISTINCT lower(email)) FILTER (
              WHERE marketing_consent AND marketing_unsubscribed_at IS NULL AND lifecycle = 'cliente'
                AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            )::int AS new_customers,
            count(DISTINCT lower(email)) FILTER (
              WHERE marketing_consent AND marketing_unsubscribed_at IS NULL AND lifecycle = 'cliente_recurrente'
                AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            )::int AS recurring_customers,
            count(DISTINCT lower(email)) FILTER (
              WHERE marketing_consent AND marketing_unsubscribed_at IS NULL AND lifecycle = 'cliente_fidelizado'
                AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            )::int AS loyal_customers,
            count(DISTINCT lower(email)) FILTER (
              WHERE marketing_consent AND marketing_unsubscribed_at IS NULL
                AND created_at >= now() - interval '30 days'
                AND email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            )::int AS new_contacts
            FROM petcare_contacts`,
          sql`WITH recipient_stats AS (
              SELECT campaign_id,
                count(*) FILTER (WHERE status = 'sent')::int AS sent,
                count(*) FILTER (WHERE status = 'failed')::int AS failed,
                count(*) FILTER (WHERE status = 'skipped')::int AS skipped
              FROM petcare_marketing_recipients GROUP BY campaign_id
            ), event_stats AS (
              SELECT campaign_id,
                count(DISTINCT recipient_id) FILTER (WHERE event_type = 'email.delivered')::int AS delivered,
                count(DISTINCT recipient_id) FILTER (WHERE event_type = 'email.opened')::int AS opened,
                count(DISTINCT recipient_id) FILTER (WHERE event_type = 'email.clicked')::int AS clicked,
                count(DISTINCT recipient_id) FILTER (WHERE event_type = 'email.bounced')::int AS bounced,
                count(DISTINCT recipient_id) FILTER (WHERE event_type = 'email.complained')::int AS complaints
              FROM petcare_marketing_events GROUP BY campaign_id
            )
            SELECT c.id, c.name, c.subject, c.segment, c.status,
              c.recipient_count AS "recipientCount", c.created_at AS "createdAt",
              COALESCE(r.sent, 0)::int AS sent, COALESCE(r.failed, 0)::int AS failed,
              COALESCE(r.skipped, 0)::int AS skipped,
              COALESCE(e.delivered, 0)::int AS delivered, COALESCE(e.opened, 0)::int AS opened,
              COALESCE(e.clicked, 0)::int AS clicked, COALESCE(e.bounced, 0)::int AS bounced,
              COALESCE(e.complaints, 0)::int AS complaints
            FROM petcare_marketing_campaigns c
            LEFT JOIN recipient_stats r ON r.campaign_id = c.id
            LEFT JOIN event_stats e ON e.campaign_id = c.id
            WHERE NOT c.is_test ORDER BY c.created_at DESC LIMIT 20`,
        ]);
        return response({
          contacts,
          messages,
          leads,
          marketing: {
            available: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_MARKETING_FROM?.trim()),
            webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
            campaignsSent: Number(campaignStats[0]?.campaigns ?? 0),
            emailsSent: Number(campaignStats[0]?.emails ?? 0),
            testEmailsSent: Number(campaignStats[0]?.test_emails ?? 0),
            delivered: Number(campaignStats[0]?.delivered ?? 0),
            opened: Number(campaignStats[0]?.opened ?? 0),
            clicked: Number(campaignStats[0]?.clicked ?? 0),
            bounced: Number(campaignStats[0]?.bounced ?? 0),
            complaints: Number(campaignStats[0]?.complaints ?? 0),
            segmentCounts: {
              all: Number(segmentCounts[0]?.all ?? 0),
              newContacts: Number(segmentCounts[0]?.new_contacts ?? 0),
              unconverted: Number(segmentCounts[0]?.unconverted ?? 0),
              newCustomers: Number(segmentCounts[0]?.new_customers ?? 0),
              recurringCustomers: Number(segmentCounts[0]?.recurring_customers ?? 0),
              loyalCustomers: Number(segmentCounts[0]?.loyal_customers ?? 0),
            },
            campaignHistory,
          },
        }, 200, origin);
      }

      const body = await parseJsonBody(request);
      if (action === "marketing-test-send") {
        const apiKey = process.env.RESEND_API_KEY?.trim();
        const from = process.env.EMAIL_MARKETING_FROM?.trim();
        if (!apiKey || !from) {
          return response({ error: "El proveedor de correo no está configurado." }, 503, origin);
        }
        const subject = text(body?.subject, 160);
        const message = text(body?.message, 5000);
        if (!subject || /[\r\n]/.test(subject) || !message) {
          return response({ error: "Ingresa un asunto y un mensaje de hasta 5000 caracteres." }, 400, origin);
        }

        const id = crypto.randomUUID();
        const recipient = "aylin_santacruz@hotmail.com";
        const testSubject = `[PRUEBA] ${subject}`;
        await sql`
          INSERT INTO petcare_marketing_campaigns (id, subject, body, recipient, status, is_test)
          VALUES (${id}::uuid, ${testSubject}, ${message}, ${recipient}, 'sending', true)
        `;
        try {
          const result = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ from, to: [recipient], subject: testSubject, text: message }),
          });
          const detail = await result.json().catch(() => null) as { id?: unknown; message?: unknown } | null;
          if (!result.ok) {
            const error = text(detail?.message, 500) || `Resend respondió ${result.status}.`;
            await sql`UPDATE petcare_marketing_campaigns SET status = 'failed', error = ${error} WHERE id = ${id}::uuid`;
            console.error("Resend rechazó la campaña", { status: result.status, error });
            return response({ error: "El proveedor no pudo enviar el correo. Revisa la configuración de Resend." }, 502, origin);
          }
          await sql`
            UPDATE petcare_marketing_campaigns
            SET status = 'sent', provider_id = ${typeof detail?.id === "string" ? detail.id : null}, sent_at = now()
            WHERE id = ${id}::uuid
          `;
          return response({ ok: true }, 200, origin);
        } catch (error) {
          console.error("No se pudo enviar la campaña", error);
          await sql`UPDATE petcare_marketing_campaigns SET status = 'failed', error = 'Error de conexión con Resend.' WHERE id = ${id}::uuid`;
          return response({ error: "No se pudo conectar con el proveedor de correo." }, 502, origin);
        }
      }
      if (action === "marketing-send") {
        const apiKey = process.env.RESEND_API_KEY?.trim();
        const from = process.env.EMAIL_MARKETING_FROM?.trim();
        if (!apiKey || !from) return response({ error: "El proveedor de correo no está configurado." }, 503, origin);

        const name = text(body?.name, 120);
        const subject = text(body?.subject, 160);
        const message = text(body?.message, 6000);
        const segment = text(body?.segment, 32);
        const ctaLabel = text(body?.ctaLabel, 60);
        const ctaUrl = text(body?.ctaUrl, 1000);
        const validSegments = ["all", "new_contacts", "unconverted", "new_customers", "recurring_customers", "loyal_customers"];
        if (!name || !subject || /[\r\n]/.test(subject) || !message || !validSegments.includes(segment)) {
          return response({ error: "Completa el nombre, asunto, contenido y segmento de la campaña." }, 400, origin);
        }
        if (Boolean(ctaLabel) !== Boolean(ctaUrl)) {
          return response({ error: "Completa tanto el texto como la URL del botón o deja ambos vacíos." }, 400, origin);
        }
        if (ctaUrl) {
          try {
            if (new URL(ctaUrl).protocol !== "https:") throw new Error("URL no segura");
          } catch {
            return response({ error: "La URL del botón debe ser un enlace HTTPS válido." }, 400, origin);
          }
        }

        const recipients = await sql`
          SELECT DISTINCT ON (lower(c.email))
            c.id, c.firstname, lower(c.email) AS email
          FROM petcare_contacts c
          WHERE c.marketing_consent = true
            AND c.marketing_unsubscribed_at IS NULL
            AND c.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
            AND (
              ${segment === "all"}
              OR (${segment === "new_contacts"} AND c.created_at >= now() - interval '30 days')
              OR (${segment === "unconverted"} AND c.lifecycle IN ('lead', 'interesado'))
              OR (${segment === "new_customers"} AND c.lifecycle = 'cliente')
              OR (${segment === "recurring_customers"} AND c.lifecycle = 'cliente_recurrente')
              OR (${segment === "loyal_customers"} AND c.lifecycle = 'cliente_fidelizado')
            )
          ORDER BY lower(c.email), c.marketing_consent_at DESC NULLS LAST, c.created_at DESC
        `;
        if (recipients.length === 0) return response({ error: "No hay contactos con consentimiento activo y correo válido en ese segmento." }, 400, origin);
        if (recipients.length > CAMPAIGN_MAX_RECIPIENTS) {
          return response({ error: `El segmento contiene ${recipients.length} contactos. El límite seguro por campaña es ${CAMPAIGN_MAX_RECIPIENTS}; reduce el segmento antes de enviar.` }, 400, origin);
        }

        const campaignId = crypto.randomUUID();
        const campaignRecipients = recipients.map((recipient) => ({
          id: crypto.randomUUID(),
          contact_id: String(recipient.id),
          email: String(recipient.email).trim().toLowerCase(),
        }));
        await sql.transaction([
          sql`
            INSERT INTO petcare_marketing_campaigns (
              id, name, subject, body, recipient, segment, cta_label, cta_url,
              recipient_count, status, is_test
            ) VALUES (
              ${campaignId}::uuid, ${name}, ${subject}, ${message}, '', ${segment},
              ${ctaLabel}, ${ctaUrl}, ${campaignRecipients.length}, 'sending', false
            )
          `,
          sql`
            INSERT INTO petcare_marketing_recipients (id, campaign_id, contact_id, email)
            SELECT entry.id, ${campaignId}::uuid, entry.contact_id, entry.email
            FROM jsonb_to_recordset(${JSON.stringify(campaignRecipients)}::jsonb)
              AS entry(id uuid, contact_id uuid, email text)
          `,
        ]);

        let sent = 0;
        let failed = 0;
        let skipped = 0;
        const unsubscribeBase = `${url.origin}/unsubscribe`;
        for (let offset = 0; offset < campaignRecipients.length; offset += CAMPAIGN_BATCH_SIZE) {
          const batch = campaignRecipients.slice(offset, offset + CAMPAIGN_BATCH_SIZE);
          const stillEligible = await sql`
            SELECT c.id FROM petcare_contacts c
            WHERE c.marketing_consent = true AND c.marketing_unsubscribed_at IS NULL
              AND c.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$'
              AND EXISTS (
                SELECT 1 FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
                  AS entry(contact_id uuid, email text)
                WHERE entry.contact_id = c.id AND entry.email = lower(c.email)
              )
          `;
          const eligibleIds = new Set(stillEligible.map((contact) => String(contact.id)));
          const eligibleBatch = batch.filter((recipient) => eligibleIds.has(recipient.contact_id));
          const skippedBatch = batch.filter((recipient) => !eligibleIds.has(recipient.contact_id));
          skipped += skippedBatch.length;
          for (const recipient of skippedBatch) {
            await sql`UPDATE petcare_marketing_recipients SET status = 'skipped' WHERE id = ${recipient.id}::uuid`;
          }
          if (eligibleBatch.length === 0) continue;
          if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 600));

          const emails = eligibleBatch.map((recipient) => {
            const contact = recipients.find((entry) => String(entry.id) === recipient.contact_id);
            const firstName = String(contact?.firstname ?? "").trim() || "amigo/a";
            const personalize = (value: string) => value.replace(/\{\{\s*nombre\s*\}\}/gi, firstName);
            const token = unsubscribeToken(recipient.email, config.secret);
            const unsubscribeUrl = `${unsubscribeBase}?email=${encodeURIComponent(recipient.email)}&token=${encodeURIComponent(token)}`;
            const safeBody = escapeHtml(personalize(message)).replace(/\r?\n/g, "<br>");
            const button = ctaUrl
              ? `<p style="margin:28px 0"><a href="${escapeHtml(ctaUrl)}" style="background:#007a64;color:#fff;padding:12px 20px;text-decoration:none;border-radius:24px">${escapeHtml(personalize(ctaLabel))}</a></p>`
              : "";
            const html = `<div style="font:16px/1.6 Arial,sans-serif;color:#13396a;max-width:600px;margin:auto;padding:24px"><p>Hola ${escapeHtml(firstName)},</p><p>${safeBody}</p>${button}<hr style="border:0;border-top:1px solid #ddd;margin-top:32px"><p style="font-size:12px;color:#666">Recibes este correo porque aceptaste recibir comunicaciones de marketing de PetCare. <a href="${unsubscribeUrl}">Dejar de recibir estos correos</a>.</p></div>`;
            return {
              from,
              to: [recipient.email],
              subject: personalize(subject),
              html,
              text: `Hola ${firstName},\n\n${personalize(message)}${ctaUrl ? `\n\n${personalize(ctaLabel)}: ${ctaUrl}` : ""}\n\nDejar de recibir estos correos: ${unsubscribeUrl}`,
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            };
          });

          try {
            const result = await fetch("https://api.resend.com/emails/batch", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify(emails),
            });
            const detail = await result.json().catch(() => null) as { data?: Array<{ id?: unknown }>; message?: unknown } | null;
            if (!result.ok || !Array.isArray(detail?.data) || detail.data.length !== eligibleBatch.length) {
              const error = text(detail?.message, 500) || `Resend respondió ${result.status} con un resultado incompleto.`;
              failed += eligibleBatch.length;
              console.error("Resend rechazó un lote de campaña", { status: result.status, error });
              for (const recipient of eligibleBatch) {
                await sql`UPDATE petcare_marketing_recipients SET status = 'failed', error = ${error} WHERE id = ${recipient.id}::uuid`;
              }
              continue;
            }
            for (let index = 0; index < eligibleBatch.length; index += 1) {
              const recipient = eligibleBatch[index];
              const providerId = typeof detail.data[index]?.id === "string" ? detail.data[index].id : null;
              await sql`
                UPDATE petcare_marketing_recipients
                SET status = 'sent', provider_id = ${providerId}, sent_at = now()
                WHERE id = ${recipient.id}::uuid
              `;
              if (providerId) {
                await sql`
                  UPDATE petcare_marketing_events SET recipient_id = ${recipient.id}::uuid, campaign_id = ${campaignId}::uuid
                  WHERE provider_email_id = ${providerId} AND recipient_id IS NULL
                `;
              }
              sent += 1;
            }
          } catch (error) {
            console.error("No se pudo enviar un lote de campaña", error);
            failed += eligibleBatch.length;
            for (const recipient of eligibleBatch) {
              await sql`
                UPDATE petcare_marketing_recipients
                SET status = 'failed', error = 'Error de conexión con Resend.'
                WHERE id = ${recipient.id}::uuid
              `;
            }
          }
        }

        const status = sent === 0 ? "failed" : failed > 0 ? "partial" : "sent";
        await sql`
          UPDATE petcare_marketing_campaigns SET status = ${status}, sent_at = CASE WHEN ${sent > 0} THEN now() ELSE NULL END
          WHERE id = ${campaignId}::uuid
        `;
        return response({ ok: sent > 0, campaignId, status, sent, failed, skipped }, sent > 0 ? 200 : 502, origin);
      }
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
