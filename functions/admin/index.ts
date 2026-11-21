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

const ACCOUNT_ROLES = ["customer", "admin", "veterinarian", "sales"] as const;
type AccountRole = typeof ACCOUNT_ROLES[number];

// Historia clínica: solo veterinarios y administradores (ventas no ve datos clínicos)
const CLINIC_ACTIONS = ["clinic-owners", "patients", "patient", "pet-save", "clinical-record"];
const PET_SPECIES = ["perro", "gato", "exotico", "otro"];
const PET_SEXES = ["macho", "hembra", "desconocido"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// WhatsApp: todo el equipo escribe a clientes; solo el administrador enlaza o desvincula el número
const WHATSAPP_SEND_ACTIONS = ["whatsapp-send", "whatsapp-history"];
const SOCIAL_ADMIN_ACTIONS = [
  "social-channels", "social-posts-list", "social-post-create", "social-post-status", "social-post-delete", "social-upload",
];
const SITE_ADMIN_ACTIONS = [
  "site-content", "site-image-upload",
  "site-draft", "site-draft-save", "site-publish", "site-discard-draft",
];
const SITE_LARGE_BODY_ACTIONS = new Set(["site-content", "site-draft", "site-draft-save", "site-publish", "site-discard-draft"]);
const SITE_CONTENT_KEY = /^[a-zA-Z0-9._-]{1,100}$/;
const SITE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Métodos de pago simulados: no se procesa dinero real, solo se registra la preferencia del cliente
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia bancaria",
  tarjeta: "Tarjeta (simulado)",
};

// Qué secciones del panel interno puede usar cada rol de staff
const STAFF_PERMISSIONS: Record<Exclude<AccountRole, "customer">, ReadonlySet<string>> = {
  admin: new Set([
    "accounts", "account-role", "update-account", "read", "appointments", "appointment-status", "appointment-slots",
    "appointment-slot-create", "appointment-slot-cancel", "update-appointment-slot", "marketing-test-send", "marketing-send",
    "lifecycle", "contact-notes", "message-status", "lead-status", "clear", "import-lead", "purchase-create",
    ...CLINIC_ACTIONS, ...WHATSAPP_SEND_ACTIONS, "whatsapp-status", "whatsapp-logout",
    ...SOCIAL_ADMIN_ACTIONS, ...SITE_ADMIN_ACTIONS,
  ]),
  sales: new Set([
    "read", "appointments", "appointment-status", "appointment-slots", "marketing-test-send", "marketing-send",
    "lifecycle", "contact-notes", "message-status", "lead-status", "purchase-create", ...WHATSAPP_SEND_ACTIONS,
  ]),
  veterinarian: new Set([
    "appointments", "appointment-status", "appointment-slots", "appointment-slot-create", "appointment-slot-cancel",
    "update-appointment-slot", ...CLINIC_ACTIONS, ...WHATSAPP_SEND_ACTIONS,
  ]),
};

type SessionClaims = {
  sub: string;
  exp: number;
  role: AccountRole;
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
      !accountRole(session.role) ||
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

function whatsappService() {
  const url = process.env.WHATSAPP_SERVICE_URL?.trim().replace(/\/+$/, "");
  const token = process.env.WHATSAPP_SERVICE_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

function postizConfig() {
  const apiKey = process.env.POSTIZ_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.POSTIZ_API_BASE_URL?.trim() || "https://api.postiz.com/public/v1").replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function postizRequest<T>(
  postiz: { apiKey: string; baseUrl: string },
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; query?: Record<string, string>; formData?: FormData } = {},
): Promise<T> {
  const target = new URL(`${postiz.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (options.query) for (const [key, value] of Object.entries(options.query)) target.searchParams.set(key, value);
  const headers: Record<string, string> = { Authorization: postiz.apiKey };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  let result: Response;
  try {
    result = await fetch(target, { method: options.method ?? "GET", headers, body, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error("No se pudo conectar con Postiz. Inténtalo nuevamente.");
  }
  const raw = await result.text();
  const data = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
  if (!result.ok) {
    const message = data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
      ? text((data as { message: string }).message, 500)
      : "";
    throw new Error(message || `Postiz rechazó la solicitud (${result.status}).`);
  }
  return (data ?? {}) as T;
}

/** Llama al servicio de WhatsApp (Render); con body hace POST, sin body hace GET */
async function callWhatsapp(service: { url: string; token: string }, path: string, body?: unknown) {
  let result: Response;
  try {
    result = await fetch(`${service.url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${service.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Render gratis tarda en despertar; el envío además espera su turno en la cola
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("El servicio de WhatsApp no responde. Si está en Render gratis, puede estar despertando: intenta en un minuto.");
  }
  const data = await result.json().catch(() => null) as { error?: string } | null;
  if (!result.ok) throw new Error(data?.error ?? "El servicio de WhatsApp rechazó la solicitud.");
  return data ?? {};
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function accountRole(value: unknown): AccountRole | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
  return ACCOUNT_ROLES.includes(normalized as AccountRole) ? (normalized as AccountRole) : null;
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
  appointmentSlotId?: string;
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
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE petcare_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'`;
  // Reemplaza la restricción anterior (customer/veterinarian) por la de los cuatro roles
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'petcare_users'::regclass AND conname = 'petcare_users_role_check'
          AND pg_get_constraintdef(oid) LIKE '%sales%'
      ) THEN
        ALTER TABLE petcare_users DROP CONSTRAINT IF EXISTS petcare_users_role_check;
        ALTER TABLE petcare_users ADD CONSTRAINT petcare_users_role_check
          CHECK (role IN ('customer', 'admin', 'veterinarian', 'sales'));
      END IF;
    END $$
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
    CREATE TABLE IF NOT EXISTS petcare_purchases (
      id UUID PRIMARY KEY,
      contact_id UUID NOT NULL REFERENCES petcare_contacts(id) ON DELETE CASCADE,
      items JSONB NOT NULL,
      total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
      recorded_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS petcare_purchases_contact_date_idx ON petcare_purchases (contact_id, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_appointment_slots (
      id UUID PRIMARY KEY,
      veterinarian_id UUID REFERENCES petcare_users(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      service TEXT NOT NULL DEFAULT 'Consultas',
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'booked', 'cancelled')),
      created_by_id UUID REFERENCES petcare_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (ends_at > starts_at)
    )
  `;
  await sql`ALTER TABLE petcare_appointment_slots ALTER COLUMN veterinarian_id DROP NOT NULL`;
  await sql`ALTER TABLE petcare_appointment_slots ADD COLUMN IF NOT EXISTS service TEXT NOT NULL DEFAULT 'Consultas'`;
  await sql`ALTER TABLE petcare_leads ADD COLUMN IF NOT EXISTS appointment_slot_id UUID REFERENCES petcare_appointment_slots(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE petcare_leads ADD COLUMN IF NOT EXISTS appointment_price NUMERIC(10, 2)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS petcare_leads_appointment_slot_idx ON petcare_leads (appointment_slot_id) WHERE appointment_slot_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_appointment_slots_status_start_idx ON petcare_appointment_slots (status, starts_at)`;
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
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_pets (
      id UUID PRIMARY KEY,
      contact_id UUID NOT NULL REFERENCES petcare_contacts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      species TEXT NOT NULL DEFAULT 'otro' CHECK (species IN ('perro', 'gato', 'exotico', 'otro')),
      breed TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL DEFAULT 'desconocido' CHECK (sex IN ('macho', 'hembra', 'desconocido')),
      birth_date DATE,
      background TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_clinical_records (
      id UUID PRIMARY KEY,
      pet_id UUID NOT NULL REFERENCES petcare_pets(id) ON DELETE CASCADE,
      appointment_id UUID REFERENCES petcare_leads(id) ON DELETE SET NULL,
      veterinarian_id TEXT NOT NULL,
      veterinarian_name TEXT NOT NULL,
      visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reason TEXT NOT NULL,
      weight_kg NUMERIC(6, 2),
      temperature_c NUMERIC(4, 1),
      diagnosis TEXT NOT NULL DEFAULT '',
      treatment TEXT NOT NULL DEFAULT '',
      comments TEXT NOT NULL DEFAULT '',
      next_visit DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS petcare_pets_contact_idx ON petcare_pets (contact_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_whatsapp_messages (
      id UUID PRIMARY KEY,
      contact_id UUID REFERENCES petcare_contacts(id) ON DELETE SET NULL,
      phone TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
      error TEXT NOT NULL DEFAULT '',
      provider_id TEXT,
      sent_by_id TEXT NOT NULL,
      sent_by_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS petcare_whatsapp_messages_contact_idx ON petcare_whatsapp_messages (contact_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_clinical_records_pet_idx ON petcare_clinical_records (pet_id, visited_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS petcare_clinical_records_appointment_idx ON petcare_clinical_records (appointment_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_site_content (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      content JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Borrador del editor visual: separado de lo publicado para que las ediciones
  // no afecten el sitio público hasta que el administrador confirme "Publicar".
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_site_content_draft (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      content JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petcare_site_images (
      id UUID PRIMARY KEY,
      mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function validateSiteContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const content = value as { texts?: unknown; images?: unknown; colors?: unknown };
  if (
    !content.texts || typeof content.texts !== "object" || Array.isArray(content.texts) ||
    !content.images || typeof content.images !== "object" || Array.isArray(content.images) ||
    !content.colors || typeof content.colors !== "object" || Array.isArray(content.colors)
  ) return null;

  const texts = Object.entries(content.texts as Record<string, unknown>);
  const images = Object.entries(content.images as Record<string, unknown>);
  const products = content.products;
  const colors = content.colors as Record<string, unknown>;
  if (
    texts.length > 100 ||
    images.length > 100 ||
    !Array.isArray(products) ||
    products.length > 200 ||
    texts.some(([key, text]) => !SITE_CONTENT_KEY.test(key) || typeof text !== "string" || text.length > 3000) ||
    images.some(([key, image]) => !SITE_CONTENT_KEY.test(key) || typeof image !== "string" || image.length > 2000) ||
    !/^#[\da-f]{6}$/i.test(String(colors.primary ?? "")) ||
    !/^#[\da-f]{6}$/i.test(String(colors.accent ?? ""))
  ) return null;

  for (const [, image] of images) {
    try {
      const url = new URL(String(image), "https://petcare.invalid");
      if (url.protocol !== "https:" && !(
        url.origin === "https://petcare.invalid" &&
        (String(image).startsWith("/") || String(image).startsWith("./")) &&
        !String(image).startsWith("//")
      )) {
        return null;
      }
    } catch {
      return null;
    }
  }
  const productIds = new Set<number>();
  for (const product of products) {
    if (!product || typeof product !== "object" || Array.isArray(product)) return null;
    const item = product as Record<string, unknown>;
    if (
      !Number.isInteger(item.id) || Number(item.id) < 1 || productIds.has(Number(item.id)) ||
      typeof item.name !== "string" || item.name.length > 300 ||
      !Array.isArray(item.pets) || item.pets.some((pet) => !["perro", "gato", "exotico"].includes(String(pet))) ||
      !["alimento", "farmacia", "higiene", "accesorio"].includes(String(item.category)) ||
      typeof item.subcategory !== "string" || item.subcategory.length > 200 ||
      typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 ||
      !(item.priceMax === null || (typeof item.priceMax === "number" && Number.isFinite(item.priceMax) && item.priceMax >= item.price)) ||
      typeof item.image !== "string" || item.image.length > 2000 ||
      typeof item.description !== "string" || item.description.length > 5000
    ) return null;
    try {
      const url = new URL(item.image, "https://petcare.invalid");
      if (url.protocol !== "https:" && !(
        url.origin === "https://petcare.invalid" &&
        (item.image.startsWith("/") || item.image.startsWith("./")) &&
        !item.image.startsWith("//")
      )) {
        return null;
      }
    } catch {
      return null;
    }
    productIds.add(Number(item.id));
  }
  return {
    texts: Object.fromEntries(texts),
    images: Object.fromEntries(images),
    products,
    colors: { primary: colors.primary, accent: colors.accent },
  };
}

async function capture(sql: NeonQueryFunction<false, false>, input: ContactInput, metadata: CaptureMetadata = {}): Promise<string> {
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
    if (existing.length > 0) return String(existing[0].id);
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
      INSERT INTO petcare_leads (
        id, external_id, contact_id, type, status, channel, service, pet, total, items, details, appointment_slot_id, created_at
      )
      SELECT ${leadId}, ${metadata.externalId ?? null}, id, ${input.type}, ${leadStatus}, ${input.channel}, ${input.service ?? null},
        ${input.pet ?? null}, ${input.total ?? null}, ${JSON.stringify(input.items ?? [])}, ${input.message},
        ${metadata.appointmentSlotId ?? null}::uuid, ${now}
      FROM petcare_contacts WHERE email = ${input.email}
      ON CONFLICT DO NOTHING
    `,
  ]);
  return leadId;
}

async function parseJsonBody(request: Request, maxBytes = 64 * 1024) {
  const body = await request.text().catch(() => "");
  if (new TextEncoder().encode(body).byteLength > maxBytes) return null;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readBoundedBody(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export default {
  async fetch(request: Request) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const route = path.split("/").filter(Boolean);
    const action = route.at(-1) ?? "";
    const siteImageId = route.at(-2) === "site-image" ? action : "";
    const isPublicSiteImage = UUID_PATTERN.test(siteImageId);
    if (
      origin &&
      !allowedOrigins.has(origin) &&
      action !== "unsubscribe" &&
      action !== "resend" &&
      !isPublicSiteImage
    ) {
      return response({ error: "Origen no permitido" }, 403, null);
    }
    if (request.method === "OPTIONS") return response(null, 204, origin);

    const config = getConfig();
    if (!config) return response({ error: "Autenticación administrativa no configurada" }, 503, origin);

    const sql = neon(config.databaseUrl);
    if (isPublicSiteImage && request.method === "GET") {
      try {
        await ensureSchema(sql);
        const rows = await sql`
          SELECT mime_type, data_base64 FROM petcare_site_images WHERE id = ${siteImageId}::uuid LIMIT 1
        `;
        const row = rows[0];
        if (!row) return new Response("No se encontró la imagen.", { status: 404 });
        return new Response(new Uint8Array(Buffer.from(String(row.data_base64), "base64")), {
          status: 200,
          headers: {
            "Content-Type": String(row.mime_type),
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        console.error("No se pudo servir una imagen del sitio", error);
        return new Response("No se pudo recuperar la imagen.", { status: 503 });
      }
    }
    if (action === "site-content" && request.method === "GET") {
      try {
        await ensureSchema(sql);
        const rows = await sql`SELECT content FROM petcare_site_content WHERE id = 1 LIMIT 1`;
        return response({ content: rows[0]?.content ?? null }, 200, origin);
      } catch (error) {
        console.error("No se pudo cargar el contenido del sitio", error);
        return response({ error: "No se pudo cargar el contenido del sitio." }, 503, origin);
      }
    }
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

    if (action === "contact") {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
      if (isCaptureRateLimited(ip)) {
        return response({ error: "Recibimos muchas consultas desde tu conexión. Inténtalo nuevamente en unos minutos." }, 429, origin);
      }
      const contentLength = Number(request.headers.get("Content-Length") ?? 0);
      if (contentLength > 8192) return response({ error: "El mensaje es demasiado grande." }, 413, origin);
      const body = await parseJsonBody(request);
      const firstname = text(body?.firstname, 100);
      const lastname = text(body?.lastname, 100);
      const email = text(body?.email, 254).toLowerCase();
      const phone = text(body?.phone, 32).replace(/\D/g, "");
      const subject = text(body?.subject, 200) || "Consulta desde la página de contacto";
      const message = text(body?.message, 3000);
      if (
        firstname.length < 2 ||
        lastname.length < 2 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
        !/^(9\d{8}|0?1\d{7})$/.test(phone) ||
        message.length < 5 ||
        body?.consent !== true
      ) {
        return response({ error: "Revisa tus datos, el mensaje y la autorización para tratar tus datos." }, 400, origin);
      }

      try {
        await ensureSchema(sql);
        const now = new Date().toISOString();
        const marketingConsent = body.marketingConsent === true;
        await sql.transaction([
          sql`
            INSERT INTO petcare_contacts (
              id, firstname, lastname, email, phone, source, lifecycle, lifecycle_updated_at,
              lifecycle_reason, engagement_count, order_request_count, marketing_consent,
              marketing_consent_at, marketing_consent_source, created_at, last_seen_at
            ) VALUES (
              ${crypto.randomUUID()}::uuid, ${firstname}, ${lastname}, ${email}, ${phone},
              'contact_form', 'lead', ${now}, 'Consulta recibida desde el formulario de contacto',
              1, 0, ${marketingConsent}, ${marketingConsent ? now : null},
              ${marketingConsent ? "contact_form" : null}, ${now}, ${now}
            )
            ON CONFLICT (email) DO UPDATE SET
              firstname = EXCLUDED.firstname,
              lastname = EXCLUDED.lastname,
              phone = EXCLUDED.phone,
              source = 'contact_form',
              lifecycle = CASE
                WHEN petcare_contacts.lifecycle = 'visitante' THEN 'lead'
                ELSE petcare_contacts.lifecycle
              END,
              lifecycle_updated_at = CASE
                WHEN petcare_contacts.lifecycle = 'visitante' THEN EXCLUDED.lifecycle_updated_at
                ELSE petcare_contacts.lifecycle_updated_at
              END,
              lifecycle_reason = CASE
                WHEN petcare_contacts.lifecycle = 'visitante' THEN EXCLUDED.lifecycle_reason
                ELSE petcare_contacts.lifecycle_reason
              END,
              engagement_count = petcare_contacts.engagement_count + 1,
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
              last_seen_at = EXCLUDED.last_seen_at
          `,
          sql`
            INSERT INTO petcare_messages (id, contact_id, subject, body, source, channel, status, created_at)
            SELECT ${crypto.randomUUID()}::uuid, id, ${subject}, ${message}, 'contact_form', 'form', 'nuevo', ${now}
            FROM petcare_contacts WHERE email = ${email}
          `,
        ]);
        return response({ ok: true }, 201, origin);
      } catch (error) {
        console.error("No se pudo guardar el mensaje del formulario de contacto", error);
        return response({ error: "No pudimos guardar tu mensaje. Inténtalo nuevamente." }, 503, origin);
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
          SELECT id, firstname, lastname, email, password_hash, phone, role
          FROM petcare_users WHERE email = ${email} LIMIT 1
        `;
        const user = users[0];
        if (!user || !verifyPassword(password, String(user.password_hash))) {
          return response({ error: "Correo o contraseña incorrectos." }, 401, origin);
        }
        const role = accountRole(user.role);
        if (!role) return response({ error: "La cuenta tiene un rol inválido." }, 403, origin);
        loginAttempts.delete(ip);
        const identity = {
          role,
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
            RETURNING id, firstname, lastname, email, phone, role
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
          SELECT id, firstname, lastname, email, phone, role FROM new_user
        `;
        const user = users[0];
        if (!user) return response({ error: "Ya existe una cuenta con ese correo. Inicia sesión." }, 409, origin);
        const role = accountRole(user.role);
        if (role !== "customer") {
          return response({ error: "No se pudo crear una cuenta de cliente." }, 503, origin);
        }
        loginAttempts.delete(ip);
        const identity = {
          role,
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

    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const session = token ? readSession(token, config.secret) : null;
    if (!session) {
      return response({ error: "La sesión venció. Inicia sesión nuevamente." }, 401, origin);
    }

    let activeSession: SessionClaims;
    try {
      await ensureSchema(sql);
      if (session.role === "admin") {
        if (session.id !== "admin" || session.sub !== config.email) {
          return response({ error: "La sesión venció. Inicia sesión nuevamente." }, 401, origin);
        }
        activeSession = session;
      } else {
        const users = await sql`
          SELECT id, email, firstname, lastname, phone, role
          FROM petcare_users
          WHERE id = ${session.id}::uuid AND email = ${session.sub}
          LIMIT 1
        `;
        const user = users[0];
        const role = accountRole(user?.role);
        if (!user || !role || role !== session.role) {
          return response({ error: "Tu rol cambió. Inicia sesión nuevamente." }, 401, origin);
        }
        activeSession = {
          ...session,
          firstname: String(user.firstname),
          lastname: String(user.lastname),
          phone: String(user.phone ?? ""),
        };
      }
    } catch (error) {
      console.error("No se pudo validar la cuenta", error);
      return response({ error: "No se pudo validar la cuenta." }, 503, origin);
    }

    if (action === "verify") {
      const { sub, exp: _expiresAt, ...identity } = activeSession;
      return response({ authenticated: true, email: sub, ...identity }, 200, origin);
    }

    if (action === "order") {
      if (activeSession.role !== "customer") return response({ error: "Inicia sesión con una cuenta de cliente para hacer un pedido." }, 403, origin);
      const body = await parseJsonBody(request);
      const phone = text(body?.phone, 32).replace(/\D/g, "");
      const items = Array.isArray(body?.items) ? body.items.slice(0, 50).map((item) => text(item, 300)).filter(Boolean) : [];
      const total = typeof body?.total === "number" && Number.isFinite(body.total) ? body.total : Number.NaN;
      const paymentMethodKey = text(body?.paymentMethod, 20);
      const paymentMethodLabel = PAYMENT_METHOD_LABELS[paymentMethodKey];
      if (!paymentMethodLabel) return response({ error: "Elige un método de pago válido." }, 400, origin);
      const input = validateCapture({
        firstname: activeSession.firstname,
        lastname: activeSession.lastname || activeSession.firstname,
        email: activeSession.sub,
        phone,
        source: "checkout",
        subject: "Pedido de tienda",
        message: [`Método de pago: ${paymentMethodLabel}`, ...items].join("\n"),
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
        const appointmentId = await capture(sql, input, { accountId: activeSession.id });
        await sql`UPDATE petcare_users SET phone = ${input.phone} WHERE id = ${activeSession.id}::uuid`;
        return response({ ok: true, orderId: appointmentId, paymentMethod: paymentMethodLabel }, 201, origin);
      } catch (error) {
        console.error("No se pudo guardar el pedido de cliente", error);
        return response({ error: "No pudimos registrar el pedido. Inténtalo nuevamente." }, 503, origin);
      }
    }

    const permissions = activeSession.role === "customer" ? null : STAFF_PERMISSIONS[activeSession.role];
    const customerAppointmentAction = activeSession.role === "customer" &&
      ["appointment-slots", "my-appointments", "book-appointment", "my-orders"].includes(action);
    if (!customerAppointmentAction && !permissions?.has(action)) {
      return response({ error: "Tu rol no tiene acceso a esta sección." }, 403, origin);
    }

    try {
      await ensureSchema(sql);
      if (action === "appointment-slots") {
        // Los veterinarios solo deben ver los cupos que ellos mismos publicaron o que
        // ya tienen asignados; el resto del personal (admin) y los clientes ven todos los disponibles.
        const veterinarianId = activeSession.role === "veterinarian" ? activeSession.id : null;
        const slots = await sql`
          SELECT s.id, s.starts_at AS "startsAt", s.ends_at AS "endsAt", s.status,
            s.veterinarian_id AS "veterinarianId",
            s.service,
            concat_ws(' ', v.firstname, v.lastname) AS "veterinarianName"
          FROM petcare_appointment_slots s
          LEFT JOIN petcare_users v ON v.id = s.veterinarian_id
          WHERE s.starts_at >= now()
            AND s.starts_at < now() + interval '90 days'
            AND s.status <> 'cancelled'
            AND (
              ${veterinarianId}::uuid IS NULL
              OR s.veterinarian_id = ${veterinarianId}::uuid
              OR s.created_by_id = ${veterinarianId}::uuid
            )
            AND (${activeSession.role !== "customer"} OR s.status = 'available')
          ORDER BY s.starts_at
          LIMIT 300
        `;
        return response({ slots }, 200, origin);
      }
      if (action === "my-appointments") {
        if (activeSession.role !== "customer") return response({ error: "Solo los clientes pueden ver sus citas." }, 403, origin);
        const appointments = await sql`
          SELECT l.id, l.status, l.service, l.pet, l.created_at AS "createdAt",
            s.starts_at AS "scheduledAt", s.ends_at AS "endsAt",
            concat_ws(' ', v.firstname, v.lastname) AS "veterinarianName",
            l.appointment_price AS price
          FROM petcare_leads l
          JOIN petcare_contacts c ON c.id = l.contact_id AND c.account_id = ${activeSession.id}::uuid
          LEFT JOIN petcare_appointment_slots s ON s.id = l.appointment_slot_id
          LEFT JOIN petcare_users v ON v.id = s.veterinarian_id
          WHERE l.type = 'appointment'
          ORDER BY s.starts_at DESC NULLS LAST, l.created_at DESC
          LIMIT 100
        `;
        return response({ appointments }, 200, origin);
      }
      if (action === "my-orders") {
        if (activeSession.role !== "customer") return response({ error: "Solo los clientes pueden ver sus pedidos." }, 403, origin);
        const orders = await sql`
          SELECT l.id, l.status, l.total, l.details AS message, l.created_at AS "createdAt"
          FROM petcare_leads l
          JOIN petcare_contacts c ON c.id = l.contact_id AND c.account_id = ${activeSession.id}::uuid
          WHERE l.type = 'order'
          ORDER BY l.created_at DESC
          LIMIT 100
        `;
        return response({ orders }, 200, origin);
      }
      if (action === "site-image-upload") {
        const mimeType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
        if (!SITE_IMAGE_TYPES.has(mimeType)) {
          return response({ error: "Usa una imagen JPG, PNG o WebP." }, 415, origin);
        }
        const image = await readBoundedBody(request, 5 * 1024 * 1024);
        if (!image?.byteLength) return response({ error: "La imagen debe pesar 5 MB o menos." }, 413, origin);
        const validImage = mimeType === "image/jpeg"
          ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
          : mimeType === "image/png"
            ? image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47 &&
              image[4] === 0x0d && image[5] === 0x0a && image[6] === 0x1a && image[7] === 0x0a
            : image[0] === 0x52 && image[1] === 0x49 && image[2] === 0x46 && image[3] === 0x46 &&
              image[8] === 0x57 && image[9] === 0x45 && image[10] === 0x42 && image[11] === 0x50;
        if (!validImage) return response({ error: "El archivo no coincide con su formato de imagen." }, 415, origin);
        const imageId = crypto.randomUUID();
        await sql`
          INSERT INTO petcare_site_images (id, mime_type, data_base64)
          VALUES (${imageId}::uuid, ${mimeType}, ${Buffer.from(image).toString("base64")})
        `;
        const imagePath = url.pathname.replace(/\/site-image-upload\/?$/, `/site-image/${imageId}`);
        return response({ url: `${url.origin}${imagePath}` }, 201, origin);
      }
      if (action === "social-upload") {
        const postiz = postizConfig();
        if (!postiz) return response({ error: "Postiz aún no está configurado en Neon." }, 503, origin);
        const mimeType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
        const extensionByMime: Record<string, string> = {
          "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov",
        };
        const extension = extensionByMime[mimeType];
        if (!extension) return response({ error: "Usa una imagen JPG, PNG o WebP, o un video MP4 o MOV." }, 415, origin);
        const file = await readBoundedBody(request, 15 * 1024 * 1024);
        if (!file?.byteLength) return response({ error: "El archivo debe pesar 15 MB o menos." }, 413, origin);
        const formData = new FormData();
        formData.append("file", new Blob([file], { type: mimeType }), `petcare-${Date.now()}.${extension}`);
        try {
          const uploaded = await postizRequest<{ id?: unknown; path?: unknown; status?: unknown }>(postiz, "/upload", { method: "POST", formData });
          const mediaId = text(uploaded.id, 200);
          const mediaPath = text(uploaded.path, 2000);
          if (!mediaId || !mediaPath) throw new Error("Postiz no devolvió el archivo subido.");
          return response({ id: mediaId, path: mediaPath }, 201, origin);
        } catch (error) {
          return response({ error: error instanceof Error ? error.message : "No se pudo subir el archivo a Postiz." }, 502, origin);
        }
      }

      const body = await parseJsonBody(request, SITE_LARGE_BODY_ACTIONS.has(action) ? 1024 * 1024 : undefined);
      if (action === "site-content") {
        const content = validateSiteContent(body?.content);
        if (!content) return response({ error: "Revisa los textos, imágenes y colores antes de publicar." }, 400, origin);
        await sql`
          INSERT INTO petcare_site_content (id, content, updated_at)
          VALUES (1, ${JSON.stringify(content)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
        `;
        return response({ content }, 200, origin);
      }
      if (action === "site-draft") {
        const draftRows = await sql`SELECT content FROM petcare_site_content_draft WHERE id = 1 LIMIT 1`;
        if (draftRows[0]?.content) return response({ content: draftRows[0].content, hasDraft: true }, 200, origin);
        // Sin borrador todavía: se parte de lo publicado para que el editor abra mostrando el sitio real.
        const publishedRows = await sql`SELECT content FROM petcare_site_content WHERE id = 1 LIMIT 1`;
        return response({ content: publishedRows[0]?.content ?? null, hasDraft: false }, 200, origin);
      }
      if (action === "site-draft-save") {
        const content = validateSiteContent(body?.content);
        if (!content) return response({ error: "Revisa los textos, imágenes y colores antes de guardar el borrador." }, 400, origin);
        await sql`
          INSERT INTO petcare_site_content_draft (id, content, updated_at)
          VALUES (1, ${JSON.stringify(content)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
        `;
        return response({ content }, 200, origin);
      }
      if (action === "site-publish") {
        const content = validateSiteContent(body?.content);
        if (!content) return response({ error: "Revisa los textos, imágenes y colores antes de publicar." }, 400, origin);
        await sql`
          INSERT INTO petcare_site_content (id, content, updated_at)
          VALUES (1, ${JSON.stringify(content)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
        `;
        // Publicar también deja el borrador alineado con lo recién publicado.
        await sql`
          INSERT INTO petcare_site_content_draft (id, content, updated_at)
          VALUES (1, ${JSON.stringify(content)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
        `;
        return response({ content }, 200, origin);
      }
      if (action === "site-discard-draft") {
        const publishedRows = await sql`SELECT content FROM petcare_site_content WHERE id = 1 LIMIT 1`;
        const content = publishedRows[0]?.content ?? null;
        if (content) {
          await sql`
            INSERT INTO petcare_site_content_draft (id, content, updated_at)
            VALUES (1, ${JSON.stringify(content)}::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
          `;
        } else {
          await sql`DELETE FROM petcare_site_content_draft WHERE id = 1`;
        }
        return response({ content }, 200, origin);
      }
      if (action === "book-appointment") {
        if (activeSession.role !== "customer") return response({ error: "Inicia sesión con tu cuenta de cliente para reservar." }, 403, origin);
        const slotId = text(body?.slotId, 36);
        const service = text(body?.service, 200);
        const pet = text(body?.pet, 200);
        const phone = text(body?.phone, 32).replace(/\D/g, "");
        const details = text(body?.details, 3000);
        if (
          !UUID_PATTERN.test(slotId) || !service || !pet ||
          !/^(9\d{8}|0?1\d{7})$/.test(phone) || body?.consent !== true
        ) {
          return response({ error: "Revisa el servicio, la mascota, el teléfono y la autorización de datos." }, 400, origin);
        }

        const reserved = await sql`
          UPDATE petcare_appointment_slots SET status = 'reserved'
          WHERE id = ${slotId}::uuid AND status = 'available' AND starts_at > now() AND service = ${service}
          RETURNING id
        `;
        if (!reserved.length) return response({ error: "Ese horario ya no está disponible. Elige otro cupo." }, 409, origin);

        const detailsText = [
          `Servicio: ${service}`,
          `Mascota: ${pet}`,
          details,
        ].filter(Boolean).join("\n");
        const input: ContactInput = {
          firstname: activeSession.firstname,
          lastname: activeSession.lastname || activeSession.firstname,
          email: activeSession.sub,
          phone,
          source: "contact_form",
          subject: `Solicitud de cita: ${service}`,
          message: detailsText,
          channel: "form",
          marketingConsent: body?.marketingConsent === true,
          service,
          pet,
          type: "appointment",
        };
        try {
          await sql`UPDATE petcare_users SET phone = ${phone} WHERE id = ${activeSession.id}::uuid`;
          const appointmentId = await capture(sql, input, {
            accountId: activeSession.id,
            appointmentSlotId: slotId,
          });
          return response({ ok: true, appointmentId }, 201, origin);
        } catch (error) {
          try {
            await sql`
              UPDATE petcare_appointment_slots SET status = 'available'
              WHERE id = ${slotId}::uuid AND status = 'reserved'
            `;
          } catch (rollbackError) {
            console.error("No se pudo liberar el horario tras fallar la reserva", rollbackError);
          }
          throw error;
        }
      }
      if (action === "appointment-slot-create") {
        if (activeSession.role !== "admin" && activeSession.role !== "veterinarian") {
          return response({ error: "Solo administración y veterinarios pueden publicar horarios." }, 403, origin);
        }
        const startsAt = text(body?.startsAt, 40);
        const endsAt = text(body?.endsAt, 40);
        const service = text(body?.service, 200);
        const start = Date.parse(startsAt);
        const end = Date.parse(endsAt);
        const duration = end - start;
        if (
          !Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() || !service ||
          start > Date.now() + 90 * 24 * 60 * 60 * 1000 ||
          duration < 15 * 60 * 1000 || duration > 4 * 60 * 60 * 1000
        ) {
          return response({ error: "El horario debe durar entre 15 minutos y 4 horas, dentro de los próximos 90 días." }, 400, origin);
        }
        const veterinarianId = activeSession.role === "veterinarian" ? activeSession.id : text(body?.veterinarianId, 36);
        if (veterinarianId && !UUID_PATTERN.test(veterinarianId)) return response({ error: "Elige un veterinario válido." }, 400, origin);
        if (veterinarianId) {
          const veterinarian = await sql`
            SELECT id FROM petcare_users WHERE id = ${veterinarianId}::uuid AND role = 'veterinarian' LIMIT 1
          `;
          if (!veterinarian.length) return response({ error: "No se encontró la cuenta del veterinario." }, 404, origin);
        }
        const createdBy = UUID_PATTERN.test(activeSession.id) ? activeSession.id : null;
        const inserted = await sql`
          WITH schedule_lock AS (
            SELECT pg_advisory_xact_lock(hashtextextended(lock_key, 0))
            FROM (VALUES
              (${`service:${service.toLowerCase()}`}),
              (${veterinarianId ? `vet:${veterinarianId}` : `service:${service.toLowerCase()}`})
            ) AS lock_keys(lock_key)
            ORDER BY lock_key
          ),
          new_slot AS (
            INSERT INTO petcare_appointment_slots (id, veterinarian_id, starts_at, ends_at, service, created_by_id)
            SELECT ${crypto.randomUUID()}::uuid, ${veterinarianId || null}::uuid,
              ${new Date(start).toISOString()}, ${new Date(end).toISOString()}, ${service}, ${createdBy}::uuid
            FROM (SELECT count(*) FROM schedule_lock) AS locks
            WHERE NOT EXISTS (
              SELECT 1 FROM petcare_appointment_slots
              WHERE status <> 'cancelled'
                AND starts_at < ${new Date(end).toISOString()}
                AND ends_at > ${new Date(start).toISOString()}
                AND (
                  service = ${service}
                  OR (${veterinarianId || null}::uuid IS NOT NULL AND veterinarian_id = ${veterinarianId || null}::uuid)
                )
            )
            RETURNING id
          )
          SELECT id FROM new_slot
        `;
        if (!inserted.length) return response({ error: "El veterinario ya tiene un horario que se cruza con ese cupo." }, 409, origin);
        return response({ id: String(inserted[0].id) }, 201, origin);
      }
      if (action === "appointment-slot-cancel") {
        if (activeSession.role !== "admin" && activeSession.role !== "veterinarian") {
          return response({ error: "Solo administración y veterinarios pueden cambiar la disponibilidad." }, 403, origin);
        }
        const slotId = text(body?.id, 36);
        if (!UUID_PATTERN.test(slotId)) return response({ error: "Horario inválido." }, 400, origin);
        const veterinarianId = activeSession.role === "veterinarian" ? activeSession.id : null;
        const cancelled = await sql`
          UPDATE petcare_appointment_slots SET status = 'cancelled'
          WHERE id = ${slotId}::uuid AND status = 'available' AND starts_at > now()
            AND (
              ${veterinarianId}::uuid IS NULL
              OR veterinarian_id = ${veterinarianId}::uuid
              OR created_by_id = ${veterinarianId}::uuid
            )
          RETURNING id
        `;
        if (!cancelled.length) return response({ error: "Solo se pueden quitar horarios disponibles y futuros." }, 409, origin);
        return response({ ok: true }, 200, origin);
      }
      if (action === "update-appointment-slot") {
        if (activeSession.role !== "admin" && activeSession.role !== "veterinarian") {
          return response({ error: "Solo administración y veterinarios pueden cambiar la disponibilidad." }, 403, origin);
        }
        const slotId = text(body?.id, 36);
        if (!UUID_PATTERN.test(slotId)) return response({ error: "Horario inválido." }, 400, origin);
        const startsAt = text(body?.startsAt, 40);
        const endsAt = text(body?.endsAt, 40);
        const service = text(body?.service, 200);
        const start = Date.parse(startsAt);
        const end = Date.parse(endsAt);
        const duration = end - start;
        if (
          !Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() || !service ||
          start > Date.now() + 90 * 24 * 60 * 60 * 1000 ||
          duration < 15 * 60 * 1000 || duration > 4 * 60 * 60 * 1000
        ) {
          return response({ error: "El horario debe durar entre 15 minutos y 4 horas, dentro de los próximos 90 días." }, 400, origin);
        }
        // Un veterinario solo puede editar sus propios cupos (los que publicó o tiene asignados)
        // y no puede reasignarlos a otro profesional; solo administración puede hacerlo.
        let nextVeterinarianId: string | null;
        if (activeSession.role === "veterinarian") {
          nextVeterinarianId = activeSession.id;
        } else {
          const rawVeterinarianId = text(body?.veterinarianId, 36);
          nextVeterinarianId = rawVeterinarianId || null;
          if (nextVeterinarianId && !UUID_PATTERN.test(nextVeterinarianId)) {
            return response({ error: "Elige un veterinario válido." }, 400, origin);
          }
          if (nextVeterinarianId) {
            const veterinarian = await sql`
              SELECT id FROM petcare_users WHERE id = ${nextVeterinarianId}::uuid AND role = 'veterinarian' LIMIT 1
            `;
            if (!veterinarian.length) return response({ error: "No se encontró la cuenta del veterinario." }, 404, origin);
          }
        }
        const ownerFilterId = activeSession.role === "veterinarian" ? activeSession.id : null;
        const updated = await sql`
          UPDATE petcare_appointment_slots
          SET starts_at = ${new Date(start).toISOString()}, ends_at = ${new Date(end).toISOString()},
            service = ${service}, veterinarian_id = ${nextVeterinarianId}::uuid
          WHERE id = ${slotId}::uuid AND status = 'available' AND starts_at > now()
            AND NOT EXISTS (
              SELECT 1 FROM petcare_appointment_slots other
              WHERE other.id <> ${slotId}::uuid
                AND other.status <> 'cancelled'
                AND other.starts_at < ${new Date(end).toISOString()}
                AND other.ends_at > ${new Date(start).toISOString()}
                AND (
                  other.service = ${service}
                  OR (${nextVeterinarianId}::uuid IS NOT NULL AND other.veterinarian_id = ${nextVeterinarianId}::uuid)
                )
            )
            AND (
              ${ownerFilterId}::uuid IS NULL
              OR veterinarian_id = ${ownerFilterId}::uuid
              OR created_by_id = ${ownerFilterId}::uuid
            )
          RETURNING id
        `;
        if (!updated.length) {
          return response({ error: "No se pudo editar el horario: ya fue reservado, venció, o se cruza con otro cupo." }, 409, origin);
        }
        return response({ ok: true }, 200, origin);
      }
      if (action === "social-channels") {
        const postiz = postizConfig();
        if (!postiz) return response({ configured: false, channels: [] }, 200, origin);
        try {
          const integrations = await postizRequest<Array<Record<string, unknown>>>(postiz, "/integrations");
          const channels = (Array.isArray(integrations) ? integrations : []).map((entry) => ({
            id: text(entry.id, 200),
            name: text(entry.name, 200) || "Canal sin nombre",
            platform: text(entry.identifier ?? entry.providerIdentifier, 100),
            picture: text(entry.picture, 2000) || null,
            disabled: Boolean(entry.disabled),
          })).filter((channel) => channel.id);
          return response({ configured: true, channels }, 200, origin);
        } catch (error) {
          return response({ error: error instanceof Error ? error.message : "No se pudo consultar Postiz." }, 502, origin);
        }
      }
      if (action === "social-posts-list") {
        const postiz = postizConfig();
        if (!postiz) return response({ error: "Postiz aún no está configurado en Neon." }, 503, origin);
        const startDate = text(body?.startDate, 40);
        const endDate = text(body?.endDate, 40);
        if (!startDate || !endDate || Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
          return response({ error: "Indica un rango de fechas válido." }, 400, origin);
        }
        try {
          const result = await postizRequest<{ posts?: Array<Record<string, unknown>> }>(postiz, "/posts", {
            query: { startDate, endDate },
          });
          const posts = (result.posts ?? []).map((entry) => {
            const integration = entry.integration as Record<string, unknown> | undefined;
            return {
              id: text(entry.id, 200),
              content: text(entry.content, 5000),
              state: text(entry.state, 40) || "DRAFT",
              publishDate: text(entry.publishDate, 40) || null,
              error: text(entry.error, 1000) || null,
              channel: integration
                ? { id: text(integration.id, 200), name: text(integration.name, 200), platform: text(integration.providerIdentifier, 100), picture: text(integration.picture, 2000) || null }
                : null,
            };
          }).filter((post) => post.id);
          return response({ posts }, 200, origin);
        } catch (error) {
          return response({ error: error instanceof Error ? error.message : "No se pudo consultar las publicaciones de Postiz." }, 502, origin);
        }
      }
      if (action === "social-post-create") {
        const postiz = postizConfig();
        if (!postiz) return response({ error: "Postiz aún no está configurado en Neon." }, 503, origin);
        const content = text(body?.content, 2200);
        const type = body?.type === "draft" || body?.type === "schedule" || body?.type === "now" ? body.type : "";
        const channelIds = Array.isArray(body?.channelIds)
          ? [...new Set(body.channelIds.filter((value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200))]
          : [];
        const attachments = Array.isArray(body?.attachments)
          ? body.attachments.slice(0, 10).flatMap((entry: unknown) => {
              const id = text((entry as Record<string, unknown> | null)?.id, 200);
              const mediaPath = text((entry as Record<string, unknown> | null)?.path, 2000);
              return id && mediaPath ? [{ id, path: mediaPath }] : [];
            })
          : [];
        if (!content || !type || !channelIds.length) {
          return response({ error: "Escribe el contenido, elige al menos un canal y el tipo de publicación." }, 400, origin);
        }
        const date = type === "now" ? new Date().toISOString() : text(body?.date, 40);
        if (type !== "draft" && (!date || Number.isNaN(Date.parse(date)))) {
          return response({ error: "Indica una fecha y hora válidas para programar la publicación." }, 400, origin);
        }
        const htmlContent = content.split(/\r?\n+/).filter((line) => line.length > 0).map((line) => `<p>${escapeHtml(line)}</p>`).join("") || `<p>${escapeHtml(content)}</p>`;
        try {
          const created = await postizRequest<unknown>(postiz, "/posts", {
            method: "POST",
            body: {
              type,
              date: date || new Date().toISOString(),
              shortLink: false,
              tags: [],
              posts: channelIds.map((integrationId) => ({
                integration: { id: integrationId },
                value: [{ content: htmlContent, image: attachments }],
              })),
            },
          });
          return response({ ok: true, result: created }, 201, origin);
        } catch (error) {
          return response({ error: error instanceof Error ? error.message : "No se pudo crear la publicación en Postiz." }, 502, origin);
        }
      }
      if (action === "social-post-status") {
        const postiz = postizConfig();
        if (!postiz) return response({ error: "Postiz aún no está configurado en Neon." }, 503, origin);
        const id = text(body?.id, 200);
        const status = body?.status === "draft" || body?.status === "schedule" ? body.status : "";
        if (!id || !status) return response({ error: "Indica la publicación y el nuevo estado." }, 400, origin);
        try {
          await postizRequest(postiz, `/posts/${encodeURIComponent(id)}/status`, { method: "PUT", body: { status } });
          return response({ ok: true }, 200, origin);
        } catch (error) {
          return response({ error: error instanceof Error ? error.message : "No se pudo actualizar la publicación en Postiz." }, 502, origin);
        }
      }
      if (action === "social-post-delete") {
        const postiz = postizConfig();
        if (!postiz) return response({ error: "Postiz aún no está configurado en Neon." }, 503, origin);
        const id = text(body?.id, 200);
        if (!id) return response({ error: "Indica la publicación a eliminar." }, 400, origin);
        try {
          await postizRequest(postiz, `/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
          return response({ ok: true }, 200, origin);
        } catch (error) {
          return response({ error: error instanceof Error ? error.message : "No se pudo eliminar la publicación en Postiz." }, 502, origin);
        }
      }
      if (action === "accounts") {
        const rows = await sql`
          SELECT id, firstname, lastname, email, phone, role, created_at AS "createdAt"
          FROM petcare_users
          ORDER BY created_at DESC, lower(email)
        `;
        const accounts = rows.flatMap((row) => {
          const role = accountRole(row.role);
          if (!role) {
            console.warn(`Cuenta ${row.id} tiene un rol inválido en la base de datos: ${JSON.stringify(row.role)}`);
            return [];
          }
          return [{
            id: String(row.id),
            firstname: String(row.firstname),
            lastname: String(row.lastname),
            email: String(row.email),
            phone: row.phone ? String(row.phone) : "",
            role,
            createdAt: new Date(String(row.createdAt)).toISOString(),
          }];
        });
        return response({
          accounts,
        }, 200, origin);
      }
      if (action === "account-role") {
        const id = text(body?.id, 36);
        const role = accountRole(body?.role);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !role) {
          return response({ error: "Cuenta o rol inválido." }, 400, origin);
        }
        if (id === activeSession.id) {
          return response({ error: "No puedes cambiar el rol de tu propia cuenta." }, 409, origin);
        }
        const updated = await sql`
          UPDATE petcare_users SET role = ${role}
          WHERE id = ${id}::uuid
          RETURNING id
        `;
        if (!updated.length) return response({ error: "No se encontró la cuenta." }, 404, origin);
        return response({ ok: true }, 200, origin);
      }
      if (action === "update-account") {
        const id = text(body?.id, 36);
        if (!UUID_PATTERN.test(id)) return response({ error: "Cuenta inválida." }, 400, origin);
        const firstname = text(body?.firstname, 100);
        const lastname = text(body?.lastname, 100);
        const phone = text(body?.phone, 30);
        const email = text(body?.email, 200).trim().toLowerCase();
        if (!firstname || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return response({ error: "Completa el nombre y un correo válido." }, 400, origin);
        }
        const duplicate = await sql`
          SELECT id FROM petcare_users WHERE lower(email) = ${email} AND id <> ${id}::uuid LIMIT 1
        `;
        if (duplicate.length) return response({ error: "Ya existe otra cuenta con ese correo." }, 409, origin);
        const updated = await sql`
          UPDATE petcare_users SET firstname = ${firstname}, lastname = ${lastname}, phone = ${phone}, email = ${email}
          WHERE id = ${id}::uuid
          RETURNING id
        `;
        if (!updated.length) return response({ error: "No se encontró la cuenta." }, 404, origin);
        return response({ ok: true }, 200, origin);
      }
      if (action === "appointments") {
        // Un veterinario solo debe ver las citas que tiene asignadas (por el veterinario del cupo);
        // administración y ventas coordinan la agenda completa y ven todas.
        const veterinarianId = activeSession.role === "veterinarian" ? activeSession.id : null;
        const appointments = await sql`
          SELECT l.id, l.contact_id AS "contactId",
            concat_ws(' ', c.firstname, c.lastname) AS owner, c.email, c.phone,
            l.type, l.status, l.channel, l.service, l.pet, l.details, l.created_at AS "createdAt",
            l.appointment_slot_id AS "slotId", s.starts_at AS "scheduledAt", s.ends_at AS "endsAt",
            concat_ws(' ', v.firstname, v.lastname) AS "veterinarianName",
            l.appointment_price AS price,
            r.id AS "recordId", r.pet_id AS "recordPetId"
          FROM petcare_leads l JOIN petcare_contacts c ON c.id = l.contact_id
          LEFT JOIN petcare_appointment_slots s ON s.id = l.appointment_slot_id
          LEFT JOIN petcare_users v ON v.id = s.veterinarian_id
          LEFT JOIN LATERAL (
            SELECT id, pet_id FROM petcare_clinical_records
            WHERE appointment_id = l.id ORDER BY created_at DESC LIMIT 1
          ) r ON true
          WHERE l.type = 'appointment'
            AND (${veterinarianId}::uuid IS NULL OR s.veterinarian_id = ${veterinarianId}::uuid)
          ORDER BY l.created_at DESC
          LIMIT 500
        `;
        return response({ appointments }, 200, origin);
      }
      if (action === "whatsapp-status" || action === "whatsapp-logout") {
        const recent = await sql`
          SELECT m.id, m.phone, m.body, m.status, m.error, m.sent_by_name AS "sentByName", m.created_at AS "createdAt",
            concat_ws(' ', c.firstname, c.lastname) AS "contactName"
          FROM petcare_whatsapp_messages m LEFT JOIN petcare_contacts c ON c.id = m.contact_id
          ORDER BY m.created_at DESC LIMIT 30
        `;
        const service = whatsappService();
        if (!service) return response({ configured: false, recent }, 200, origin);
        try {
          const result = await callWhatsapp(service, action === "whatsapp-logout" ? "/logout" : "/status", action === "whatsapp-logout" ? {} : undefined);
          if (action === "whatsapp-logout") return response({ ok: true }, 200, origin);
          return response({ configured: true, reachable: true, ...(result as object), recent }, 200, origin);
        } catch (error) {
          return response({
            configured: true,
            reachable: false,
            error: error instanceof Error ? error.message : "El servicio de WhatsApp no responde.",
            recent,
          }, 200, origin);
        }
      }
      if (action === "whatsapp-history") {
        const contactId = text(body?.contactId, 36);
        if (!UUID_PATTERN.test(contactId)) return response({ error: "Contacto inválido." }, 400, origin);
        const messages = await sql`
          SELECT id, body, status, error, sent_by_name AS "sentByName", created_at AS "createdAt"
          FROM petcare_whatsapp_messages WHERE contact_id = ${contactId}::uuid
          ORDER BY created_at DESC LIMIT 20
        `;
        return response({ messages }, 200, origin);
      }
      if (action === "whatsapp-send") {
        const contactId = text(body?.contactId, 36);
        const message = text(body?.message, 2000);
        if (!UUID_PATTERN.test(contactId) || !message) return response({ error: "Escribe el mensaje antes de enviarlo." }, 400, origin);
        const service = whatsappService();
        if (!service) return response({ error: "WhatsApp aún no está configurado. Pide al administrador que lo conecte." }, 503, origin);
        const contacts = await sql`SELECT phone FROM petcare_contacts WHERE id = ${contactId}::uuid`;
        const phone = String(contacts[0]?.phone ?? "").replace(/\D/g, "");
        if (!contacts.length) return response({ error: "No se encontró el contacto." }, 404, origin);
        if (!/^9\d{8}$/.test(phone)) return response({ error: "El contacto no tiene un celular válido para WhatsApp." }, 422, origin);
        const sentByName = `${activeSession.firstname} ${activeSession.lastname}`.trim() || activeSession.sub;
        let providerId: string | null = null;
        let failure = "";
        try {
          const result = await callWhatsapp(service, "/send", { phone, message }) as { id?: string | null };
          providerId = result.id ?? null;
        } catch (error) {
          failure = error instanceof Error ? error.message : "No se pudo enviar el mensaje.";
        }
        await sql`
          INSERT INTO petcare_whatsapp_messages (id, contact_id, phone, body, status, error, provider_id, sent_by_id, sent_by_name)
          VALUES (${crypto.randomUUID()}::uuid, ${contactId}::uuid, ${phone}, ${message}, ${failure ? "failed" : "sent"},
            ${failure}, ${providerId}, ${activeSession.id}, ${sentByName})
        `;
        if (failure) return response({ error: failure }, 502, origin);
        return response({ ok: true }, 200, origin);
      }
      if (action === "clinic-owners") {
        const owners = await sql`
          SELECT c.id, concat_ws(' ', c.firstname, c.lastname) AS name, c.email, c.phone,
            COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name, 'species', p.species) ORDER BY p.name)
              FILTER (WHERE p.id IS NOT NULL), '[]') AS pets
          FROM petcare_contacts c LEFT JOIN petcare_pets p ON p.contact_id = c.id
          GROUP BY c.id ORDER BY lower(c.firstname), lower(c.lastname) LIMIT 1000
        `;
        return response({ owners }, 200, origin);
      }
      if (action === "patients") {
        const patients = await sql`
          SELECT p.id, p.name, p.species, p.breed, p.sex, p.birth_date AS "birthDate",
            p.contact_id AS "ownerId", concat_ws(' ', c.firstname, c.lastname) AS "ownerName", c.phone AS "ownerPhone",
            count(r.id)::int AS "recordCount", max(r.visited_at) AS "lastVisitAt",
            (SELECT min(next_visit) FROM petcare_clinical_records WHERE pet_id = p.id AND next_visit >= current_date) AS "nextVisit"
          FROM petcare_pets p JOIN petcare_contacts c ON c.id = p.contact_id
          LEFT JOIN petcare_clinical_records r ON r.pet_id = p.id
          GROUP BY p.id, c.id
          ORDER BY max(r.visited_at) DESC NULLS LAST, p.created_at DESC
          LIMIT 1000
        `;
        return response({ patients }, 200, origin);
      }
      if (action === "patient") {
        const id = text(body?.id, 36);
        if (!UUID_PATTERN.test(id)) return response({ error: "Paciente inválido." }, 400, origin);
        const [pets, records] = await Promise.all([
          sql`
            SELECT p.id, p.name, p.species, p.breed, p.sex, p.birth_date AS "birthDate", p.background,
              p.contact_id AS "ownerId", concat_ws(' ', c.firstname, c.lastname) AS "ownerName",
              c.email AS "ownerEmail", c.phone AS "ownerPhone", p.created_at AS "createdAt"
            FROM petcare_pets p JOIN petcare_contacts c ON c.id = p.contact_id
            WHERE p.id = ${id}::uuid
          `,
          sql`
            SELECT r.id, r.appointment_id AS "appointmentId", r.veterinarian_name AS "veterinarianName",
              r.visited_at AS "visitedAt", r.reason, r.weight_kg AS "weightKg", r.temperature_c AS "temperatureC",
              r.diagnosis, r.treatment, r.comments, r.next_visit AS "nextVisit", l.service AS "appointmentService"
            FROM petcare_clinical_records r LEFT JOIN petcare_leads l ON l.id = r.appointment_id
            WHERE r.pet_id = ${id}::uuid
            ORDER BY r.visited_at DESC
          `,
        ]);
        if (!pets.length) return response({ error: "No se encontró el paciente." }, 404, origin);
        return response({ patient: pets[0], records }, 200, origin);
      }
      if (action === "pet-save") {
        const petId = text(body?.id, 36);
        const ownerId = text(body?.ownerId, 36);
        const name = text(body?.name, 80);
        const species = text(body?.species, 20);
        const sex = text(body?.sex, 20) || "desconocido";
        const birthDate = text(body?.birthDate, 10);
        if (
          !name || !PET_SPECIES.includes(species) || !PET_SEXES.includes(sex) ||
          (petId ? !UUID_PATTERN.test(petId) : !UUID_PATTERN.test(ownerId)) ||
          (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Date.parse(birthDate) > Date.now()))
        ) {
          return response({ error: "Revisa el nombre, la especie y la fecha de nacimiento de la mascota." }, 400, origin);
        }
        const values = { breed: text(body?.breed, 80), background: text(body?.background, 3000), birthDate: birthDate || null };
        const saved = petId
          ? await sql`
              UPDATE petcare_pets SET name = ${name}, species = ${species}, breed = ${values.breed}, sex = ${sex},
                birth_date = ${values.birthDate}::date, background = ${values.background}, updated_at = now()
              WHERE id = ${petId}::uuid RETURNING id
            `
          : await sql`
              INSERT INTO petcare_pets (id, contact_id, name, species, breed, sex, birth_date, background)
              SELECT ${crypto.randomUUID()}::uuid, id, ${name}, ${species}, ${values.breed}, ${sex}, ${values.birthDate}::date, ${values.background}
              FROM petcare_contacts WHERE id = ${ownerId}::uuid
              RETURNING id
            `;
        if (!saved.length) return response({ error: petId ? "No se encontró el paciente." : "No se encontró el dueño." }, 404, origin);
        return response({ id: String(saved[0].id) }, petId ? 200 : 201, origin);
      }
      if (action === "clinical-record") {
        const petId = text(body?.petId, 36);
        const appointmentId = text(body?.appointmentId, 36);
        const reason = text(body?.reason, 300);
        const number = (value: unknown, min: number, max: number) =>
          typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
        const weight = body?.weightKg === undefined || body?.weightKg === null ? null : number(body.weightKg, 0.01, 999);
        const temperature = body?.temperatureC === undefined || body?.temperatureC === null ? null : number(body.temperatureC, 30, 45);
        const visitedAt = text(body?.visitedAt, 40);
        const nextVisit = text(body?.nextVisit, 10);
        if (
          !UUID_PATTERN.test(petId) || (appointmentId && !UUID_PATTERN.test(appointmentId)) || !reason ||
          (body?.weightKg != null && weight === null) || (body?.temperatureC != null && temperature === null) ||
          (visitedAt && (!Number.isFinite(Date.parse(visitedAt)) || Date.parse(visitedAt) > Date.now() + 60_000)) ||
          (nextVisit && !/^\d{4}-\d{2}-\d{2}$/.test(nextVisit))
        ) {
          return response({ error: "Revisa el motivo, el peso (kg), la temperatura (°C) y las fechas de la atención." }, 400, origin);
        }
        const recordId = crypto.randomUUID();
        const veterinarianName = `${activeSession.firstname} ${activeSession.lastname}`.trim() || activeSession.sub;
        const inserted = await sql`
          INSERT INTO petcare_clinical_records (
            id, pet_id, appointment_id, veterinarian_id, veterinarian_name, visited_at, reason,
            weight_kg, temperature_c, diagnosis, treatment, comments, next_visit
          )
          SELECT ${recordId}::uuid, p.id, ${appointmentId || null}::uuid, ${activeSession.id}, ${veterinarianName},
            ${visitedAt ? new Date(visitedAt).toISOString() : new Date().toISOString()}, ${reason},
            ${weight}, ${temperature}, ${text(body?.diagnosis, 3000)}, ${text(body?.treatment, 3000)},
            ${text(body?.comments, 5000)}, ${nextVisit || null}::date
          FROM petcare_pets p
          WHERE p.id = ${petId}::uuid AND (
            ${appointmentId || null}::uuid IS NULL OR EXISTS (
              SELECT 1 FROM petcare_leads l
              WHERE l.id = ${appointmentId || null}::uuid AND l.type = 'appointment' AND l.contact_id = p.contact_id
            )
          )
          RETURNING id
        `;
        if (!inserted.length) return response({ error: "La mascota no corresponde al dueño de esta cita." }, 404, origin);
        if (appointmentId) {
          await sql`UPDATE petcare_leads SET status = 'closed' WHERE id = ${appointmentId}::uuid AND type = 'appointment'`;
        }
        return response({ id: recordId }, 201, origin);
      }
      if (action === "appointment-status") {
        const id = text(body?.id, 64);
        const status = text(body?.status, 24);
        if (!id || !["new", "contacted", "qualified", "closed"].includes(status)) return response({ error: "Estado de cita inválido." }, 400, origin);
        if (status === "qualified" && activeSession.role === "veterinarian") {
          return response({ error: "Solo ventas o administración pueden confirmar una cita." }, 403, origin);
        }
        const price = typeof body?.price === "number" && Number.isFinite(body.price) && body.price >= 0 && body.price <= 100000
          ? body.price
          : null;
        if (status === "qualified" && price === null) return response({ error: "Indica el costo antes de confirmar la cita." }, 400, origin);
        const updated = await sql`
          UPDATE petcare_leads
          SET status = ${status}, appointment_price = COALESCE(${price}, appointment_price)
          WHERE id = ${id}::uuid AND type = 'appointment'
          RETURNING id, appointment_slot_id AS "slotId"
        `;
        if (!updated.length) return response({ error: "No se encontró la cita." }, 404, origin);
        if (updated[0].slotId) {
          await sql`
            UPDATE petcare_appointment_slots SET status = ${status === "qualified" || status === "closed" ? "booked" : "reserved"}
            WHERE id = ${updated[0].slotId}::uuid
          `;
        }
        return response({ ok: true }, 200, origin);
      }
      if (action === "read") {
        const [contacts, messages, leads, purchases, campaignStats, segmentCounts, campaignHistory] = await Promise.all([
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
          sql`SELECT p.id, p.contact_id AS "contactId",
            concat_ws(' ', c.firstname, c.lastname) AS "customerName", c.email, c.phone,
            p.items, p.total, p.recorded_by AS "recordedBy", p.created_at AS "createdAt"
            FROM petcare_purchases p JOIN petcare_contacts c ON c.id = p.contact_id
            ORDER BY p.created_at DESC`,
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
          purchases,
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
          lifecycle_reason = ${`Etapa actualizada por ${activeSession.firstname || "el equipo"}`} WHERE id = ${id}::uuid`;
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
      if (action === "purchase-create") {
        const contactId = text(body?.contactId, 36);
        const rawItems = Array.isArray(body?.items) ? body.items : [];
        if (!UUID_PATTERN.test(contactId) || rawItems.length === 0 || rawItems.length > 50) {
          return response({ error: "Selecciona un cliente y agrega al menos un producto." }, 400, origin);
        }
        const items: Array<{ productId: number | null; name: string; quantity: number; unitPrice: number }> = [];
        let totalCents = 0;
        for (const rawItem of rawItems) {
          if (!rawItem || typeof rawItem !== "object") return response({ error: "Hay un producto con datos invÃ¡lidos." }, 400, origin);
          const item = rawItem as Record<string, unknown>;
          const productId = typeof item.productId === "number" && Number.isSafeInteger(item.productId) && item.productId > 0
            ? item.productId
            : null;
          const name = text(item.name, 200);
          const quantity = typeof item.quantity === "number" && Number.isSafeInteger(item.quantity) ? item.quantity : 0;
          const unitPrice = typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) ? item.unitPrice : Number.NaN;
          if (!name || quantity < 1 || quantity > 1000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) {
            return response({ error: "Revisa el nombre, la cantidad y el precio de cada producto." }, 400, origin);
          }
          const unitPriceCents = Math.round(unitPrice * 100);
          totalCents += unitPriceCents * quantity;
          items.push({ productId, name, quantity, unitPrice: unitPriceCents / 100 });
        }
        const total = totalCents / 100;
        const recordedBy = `${activeSession.firstname} ${activeSession.lastname}`.trim() || activeSession.sub;
        const saved = await sql`
          INSERT INTO petcare_purchases (id, contact_id, items, total, recorded_by)
          SELECT ${crypto.randomUUID()}::uuid, c.id, ${JSON.stringify(items)}::jsonb, ${total}, ${recordedBy}
          FROM petcare_contacts c WHERE c.id = ${contactId}::uuid
          RETURNING id
        `;
        if (!saved.length) return response({ error: "No se encontrÃ³ el cliente seleccionado." }, 404, origin);
        return response({ id: String(saved[0].id) }, 201, origin);
      }
      if (action === "clear") {
        await sql.transaction([
          sql`DELETE FROM petcare_purchases`,
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
