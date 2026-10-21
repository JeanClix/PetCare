import { adminRequest } from "@/lib/adminAuth";
import { business } from "@/data/site";

export type WhatsappLogEntry = {
  id: string;
  body: string;
  status: "sent" | "failed";
  error: string;
  sentByName: string;
  createdAt: string;
  phone?: string;
  contactName?: string;
};

export type WhatsappStatus = {
  configured: boolean;
  reachable?: boolean;
  error?: string;
  status?: "starting" | "qr" | "connecting" | "open" | "logged_out";
  qr?: string | null;
  phone?: string | null;
  name?: string | null;
  lastError?: string | null;
  recent: WhatsappLogEntry[];
};

export function getWhatsappStatus(token: string) {
  return adminRequest<WhatsappStatus>("/crm/whatsapp-status", {}, token);
}

export function logoutWhatsapp(token: string) {
  return adminRequest<{ ok: true }>("/crm/whatsapp-logout", {}, token);
}

export function sendWhatsapp(token: string, contactId: string, message: string) {
  return adminRequest<{ ok: true }>("/crm/whatsapp-send", { contactId, message }, token);
}

export async function getWhatsappHistory(token: string, contactId: string) {
  const result = await adminRequest<{ messages: WhatsappLogEntry[] }>("/crm/whatsapp-history", { contactId }, token);
  return result.messages;
}

export type WhatsappContext = {
  name: string;
  service?: string;
  pet?: string;
  nextVisit?: string | null;
  total?: number;
};

export type WhatsappTemplate = { id: string; label: string; build: (context: WhatsappContext) => string };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const visitDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

/** Plantillas base; el mensaje siempre se puede editar antes de enviarlo */
export function whatsappTemplates(context: WhatsappContext): WhatsappTemplate[] {
  const greeting = `Hola ${firstName(context.name)}, te escribimos de PetCare.`;
  const templates: WhatsappTemplate[] = [];
  if (context.service || context.pet) {
    templates.push({
      id: "appointment",
      label: "Coordinar cita",
      build: () =>
        `${greeting} Recibimos tu solicitud de ${context.service ?? "cita"}${context.pet ? ` para ${context.pet}` : ""}. ¿Qué día y hora te acomodan? Atendemos ${business.hours.toLowerCase().replace(/\.$/, "")}.`,
    });
  }
  if (context.nextVisit) {
    templates.push({
      id: "reminder",
      label: "Recordar control",
      build: () =>
        `${greeting} Te recordamos que ${context.pet ?? "tu mascota"} tiene su control el ${visitDate(context.nextVisit!)}. Si necesitas cambiar la fecha, respóndenos por aquí.`,
    });
  }
  if (context.total !== undefined) {
    templates.push({
      id: "order",
      label: "Pedido listo",
      build: () =>
        `${greeting} Tu pedido está listo (total S/ ${context.total!.toFixed(2)}). ¿Prefieres recogerlo en ${business.address} o que te lo enviemos?`,
    });
  }
  templates.push({ id: "free", label: "Mensaje libre", build: () => `${greeting} ` });
  return templates;
}
