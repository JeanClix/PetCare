import { adminRequest } from "@/lib/adminAuth";

export type ContactLifecycle = "visitante" | "lead" | "interesado" | "cliente" | "cliente_recurrente" | "cliente_fidelizado";
export type MessageStatus = "nuevo" | "leído" | "contactado" | "resuelto";
export type ContactSource = "contact_form" | "whatsapp" | "checkout" | "purchase" | "newsletter" | "registration";

export type ContactRecord = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  source: ContactSource;
  lifecycle: ContactLifecycle;
  lifecycleUpdatedAt: string;
  lifecycleReason: string;
  engagementCount: number;
  orderRequestCount: number;
  marketingConsent: boolean;
  marketingConsentAt?: string;
  marketingConsentSource?: string;
  marketingUnsubscribedAt?: string;
  createdAt: string;
  lastSeenAt: string;
  notes?: string;
};

export type ContactMessage = {
  id: string;
  contactId: string;
  subject: string;
  body: string;
  source: ContactSource;
  channel: "form" | "whatsapp";
  status: MessageStatus;
  createdAt: string;
};

export type CrmLeadType = "appointment" | "order";
export type CrmLeadStatus = "new" | "contacted" | "qualified" | "closed";
export type CrmLeadChannel = "form" | "whatsapp";

export type CrmLead = {
  id: string;
  contactId: string;
  owner: string;
  email: string;
  phone: string;
  createdAt: string;
  type: CrmLeadType;
  status: CrmLeadStatus;
  channel: CrmLeadChannel;
  service?: string;
  pet?: string;
  total?: number;
  items?: string[];
  details?: string;
};

export type CrmData = {
  contacts: ContactRecord[];
  messages: ContactMessage[];
  leads: CrmLead[];
  marketing: {
    available: boolean;
    webhookConfigured: boolean;
    campaignsSent: number;
    emailsSent: number;
    testEmailsSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complaints: number;
    segmentCounts: Record<"all" | "newContacts" | "unconverted" | "newCustomers" | "recurringCustomers" | "loyalCustomers", number>;
    campaignHistory: Array<{
      id: string;
      name: string;
      subject: string;
      segment: string;
      status: string;
      recipientCount: number;
      createdAt: string;
      sent: number;
      failed: number;
      skipped: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
      complaints: number;
    }>;
  };
};

type CrmApiData = Omit<CrmData, "leads"> & {
  leads: Array<Omit<CrmLead, "total"> & { total?: number | string | null }>;
};

export type CaptureLeadInput = {
  type: CrmLeadType;
  channel: CrmLeadChannel;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  service?: string;
  pet?: string;
  total?: number;
  items?: string[];
  details?: string;
  consent: boolean;
  marketingConsent: boolean;
};

export async function getCrmData(token: string): Promise<CrmData> {
  const result = await adminRequest<CrmApiData>("/crm/read", {}, token);
  return {
    contacts: result.contacts.map((contact) => ({ ...contact, createdAt: new Date(contact.createdAt).toISOString(), lastSeenAt: new Date(contact.lastSeenAt).toISOString() })),
    messages: result.messages.map((message) => ({ ...message, createdAt: new Date(message.createdAt).toISOString() })),
    leads: result.leads.map((lead) => {
      let total: number | undefined;
      if (lead.total !== undefined && lead.total !== null) {
        total = typeof lead.total === "number" ? lead.total : Number(lead.total);
        if (!Number.isFinite(total)) throw new Error("El CRM devolvió un monto de pedido inválido.");
      }
      return { ...lead, total, createdAt: new Date(lead.createdAt).toISOString() };
    }),
    marketing: result.marketing ?? {
      available: false,
      webhookConfigured: false,
      campaignsSent: 0,
      emailsSent: 0,
      testEmailsSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complaints: 0,
      segmentCounts: { all: 0, newContacts: 0, unconverted: 0, newCustomers: 0, recurringCustomers: 0, loyalCustomers: 0 },
      campaignHistory: [],
    },
  };
}

export function captureCrmLead(input: CaptureLeadInput) {
  const source = input.type === "order" ? "checkout" : input.channel === "whatsapp" ? "whatsapp" : "contact_form";
  const details = [
    input.service && `Servicio: ${input.service}`,
    input.pet && `Mascota: ${input.pet}`,
    input.items?.length && `Productos:\n${input.items.join("\n")}`,
    input.details,
  ].filter(Boolean).join("\n");
  return adminRequest<{ ok: true }>("/crm/capture", {
    ...input,
    source,
    subject: input.type === "order" ? "Pedido de tienda" : "Solicitud de cita",
    message: details || (input.type === "order" ? "Solicitud de pedido" : "Solicitud de cita"),
  });
}

export async function setContactLifecycle(token: string, id: string, lifecycle: ContactLifecycle) {
  await adminRequest("/crm/lifecycle", { id, lifecycle }, token);
}

export async function setContactNotes(token: string, id: string, notes: string) {
  await adminRequest("/crm/contact-notes", { id, notes }, token);
}

export async function setMessageStatus(token: string, id: string, status: MessageStatus) {
  await adminRequest("/crm/message-status", { id, status }, token);
}

export async function setCrmLeadStatus(token: string, id: string, status: CrmLeadStatus) {
  await adminRequest("/crm/lead-status", { id, status }, token);
}

export function sendMarketingTest(token: string, subject: string, message: string) {
  return adminRequest<{ ok: true }>("/crm/marketing-test-send", { subject, message }, token);
}

export function sendMarketingCampaign(
  token: string,
  campaign: { name: string; subject: string; message: string; segment: string; ctaLabel?: string; ctaUrl?: string },
) {
  return adminRequest<{ ok: boolean; status: string; sent: number; failed: number; skipped: number }>(
    "/crm/marketing-send",
    campaign,
    token,
  );
}

export async function clearCrmData(token: string) {
  await adminRequest("/crm/clear", {}, token);
}

type LegacyLead = {
  id: string;
  createdAt: string;
  type: CrmLeadType;
  status: CrmLeadStatus;
  channel: CrmLeadChannel;
  owner: string;
  email: string;
  phone: string;
  service?: string;
  pet?: string;
  total?: number;
  items?: string[];
  details?: string;
};

function readLegacyLeads(): LegacyLead[] {
  if (typeof window === "undefined" || window.localStorage.getItem("petcare.crm.migratedToNeon") === "true") return [];
  const raw = window.localStorage.getItem("petcare.crm.leads");
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Los leads locales guardados tienen un formato inválido.");
  return parsed.filter((value): value is LegacyLead =>
    Boolean(value) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    (value.type === "appointment" || value.type === "order") &&
    typeof value.owner === "string" &&
    typeof value.email === "string" &&
    typeof value.phone === "string",
  );
}

export function getLegacyCrmMigrationCount() {
  return readLegacyLeads().length;
}

export async function migrateLegacyCrm(token: string) {
  const leads = readLegacyLeads();
  if (leads.length === 0) return 0;
  const rawContacts = window.localStorage.getItem("petcare.crm.contacts");
  const parsedContacts: unknown = rawContacts ? JSON.parse(rawContacts) : [];
  if (!Array.isArray(parsedContacts)) throw new Error("Los contactos locales guardados tienen un formato inválido.");
  const contacts = parsedContacts as Array<{
    email?: string;
    marketingConsent?: boolean;
    marketingConsentAt?: string;
    marketingConsentSource?: string;
    lifecycle?: ContactLifecycle;
    lifecycleReason?: string;
    notes?: string;
  }>;

  for (const lead of leads) {
    const [firstname = "", ...lastname] = lead.owner.trim().split(/\s+/);
    const contact = contacts.find((entry) => entry.email?.trim().toLowerCase() === lead.email.trim().toLowerCase());
    await adminRequest("/crm/import-lead", {
      externalId: lead.id,
      createdAt: lead.createdAt,
      status: lead.status,
      type: lead.type,
      channel: lead.channel,
      firstname,
      lastname: lastname.join(" "),
      email: lead.email,
      phone: lead.phone,
      source: lead.type === "order" ? "checkout" : lead.channel === "whatsapp" ? "whatsapp" : "contact_form",
      service: lead.service,
      pet: lead.pet,
      total: lead.total,
      items: lead.items,
      message: lead.details ?? "",
      subject: lead.type === "order" ? "Pedido de tienda" : "Solicitud de cita",
      consent: true,
      marketingConsent: contact?.marketingConsent === true,
      marketingConsentAt: contact?.marketingConsentAt,
      marketingConsentSource: contact?.marketingConsentSource,
      lifecycle: contact?.lifecycle,
      lifecycleReason: contact?.lifecycleReason,
      notes: contact?.notes,
    }, token);
  }

  window.localStorage.setItem("petcare.crm.migratedToNeon", "true");
  return leads.length;
}
