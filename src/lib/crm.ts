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

export type PurchaseItem = {
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type CustomerPurchase = {
  id: string;
  contactId: string;
  customerName: string;
  email: string;
  phone: string;
  items: PurchaseItem[];
  total: number;
  recordedBy: string;
  createdAt: string;
};

export type CrmData = {
  contacts: ContactRecord[];
  messages: ContactMessage[];
  leads: CrmLead[];
  purchases: CustomerPurchase[];
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

type CrmApiData = Omit<CrmData, "leads" | "purchases"> & {
  leads: Array<Omit<CrmLead, "total"> & { total?: number | string | null }>;
  purchases?: Array<Omit<CustomerPurchase, "total"> & { total: number | string }>;
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

export type PublicContactInput = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent: true;
  marketingConsent: boolean;
};

export function sendPublicContact(input: PublicContactInput) {
  return adminRequest<{ ok: true }>("/contact", input);
}

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
    purchases: (result.purchases ?? []).map((purchase) => {
      const total = typeof purchase.total === "number" ? purchase.total : Number(purchase.total);
      if (
        !Number.isFinite(total) ||
        !Array.isArray(purchase.items) ||
        purchase.items.some((item) =>
          !item ||
          typeof item.name !== "string" ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          typeof item.unitPrice !== "number" ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0
        )
      ) {
        throw new Error("El CRM devolviÃ³ un registro de compra invÃ¡lido.");
      }
      return { ...purchase, total, createdAt: new Date(purchase.createdAt).toISOString() };
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

export function createCustomerPurchase(token: string, purchase: { contactId: string; items: PurchaseItem[] }) {
  return adminRequest<{ id: string }>("/crm/purchase-create", purchase, token);
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

export type Appointment = Pick<CrmLead, "id" | "contactId" | "owner" | "email" | "phone" | "status" | "channel" | "service" | "pet" | "details" | "createdAt"> & {
  recordId: string | null;
  recordPetId: string | null;
  slotId: string | null;
  scheduledAt: string | null;
  endsAt: string | null;
  veterinarianName: string | null;
  price: number | null;
};

export type AppointmentSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "reserved" | "booked" | "cancelled";
  veterinarianId: string | null;
  service: string;
  veterinarianName: string;
};

export type CustomerAppointment = {
  id: string;
  status: CrmLeadStatus;
  service: string;
  pet: string;
  createdAt: string;
  scheduledAt: string | null;
  endsAt: string | null;
  veterinarianName: string | null;
  price: number | null;
};

function normalizeAppointmentPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const price = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(price) || price < 0) throw new Error("El CRM devolvió un costo de cita inválido.");
  return price;
}

export async function getAppointments(token: string): Promise<Appointment[]> {
  const result = await adminRequest<{ appointments: Array<Omit<Appointment, "price"> & { price?: number | string | null }> }>("/crm/appointments", {}, token);
  return result.appointments.map((appointment) => ({
    ...appointment,
    createdAt: new Date(appointment.createdAt).toISOString(),
    scheduledAt: appointment.scheduledAt ? new Date(appointment.scheduledAt).toISOString() : null,
    endsAt: appointment.endsAt ? new Date(appointment.endsAt).toISOString() : null,
    price: normalizeAppointmentPrice(appointment.price),
  }));
}

export async function getAppointmentSlots(token: string): Promise<AppointmentSlot[]> {
  const result = await adminRequest<{ slots: Array<Omit<AppointmentSlot, "service"> & { service?: string }> }>("/appointment-slots", {}, token);
  return result.slots.map((slot) => ({
    ...slot,
    service: slot.service || "Consultas",
    startsAt: new Date(slot.startsAt).toISOString(),
    endsAt: new Date(slot.endsAt).toISOString(),
  }));
}

export async function createAppointmentSlot(
  token: string,
  slot: { startsAt: string; endsAt: string; service: string; veterinarianId?: string },
) {
  return adminRequest<{ id: string }>("/appointment-slot-create", slot, token);
}

export async function cancelAppointmentSlot(token: string, id: string) {
  await adminRequest("/appointment-slot-cancel", { id }, token);
}

export async function bookAppointment(
  token: string,
  appointment: {
    slotId: string;
    service: string;
    pet: string;
    phone: string;
    details?: string;
    consent: true;
    marketingConsent: boolean;
  },
) {
  return adminRequest<{ ok: true; appointmentId: string }>("/book-appointment", appointment, token);
}

export async function getMyAppointments(token: string): Promise<CustomerAppointment[]> {
  const result = await adminRequest<{ appointments: Array<Omit<CustomerAppointment, "price"> & { price?: number | string | null }> }>("/my-appointments", {}, token);
  return result.appointments.map((appointment) => ({
    ...appointment,
    createdAt: new Date(appointment.createdAt).toISOString(),
    scheduledAt: appointment.scheduledAt ? new Date(appointment.scheduledAt).toISOString() : null,
    endsAt: appointment.endsAt ? new Date(appointment.endsAt).toISOString() : null,
    price: normalizeAppointmentPrice(appointment.price),
  }));
}

export async function setAppointmentStatus(token: string, id: string, status: CrmLeadStatus, price?: number) {
  await adminRequest("/crm/appointment-status", { id, status, price }, token);
}
