/*
 * Integración con HubSpot usando solo datos públicos (Portal ID y GUID de formularios).
 * Cada función queda inactiva mientras su variable de entorno no esté definida,
 * así la web sigue funcionando con WhatsApp hasta que se configure HubSpot.
 * Nunca pongas aquí un token de "private app": todo lo que empieza con VITE_ llega al navegador.
 */

const env = import.meta.env;

export const hubspot = {
  portalId: env.VITE_HUBSPOT_PORTAL_ID as string | undefined,
  /** "na1" (app.hubspot.com) o "eu1" (app-eu1.hubspot.com) */
  region: (env.VITE_HUBSPOT_REGION as string | undefined) ?? "na1",
  appointmentFormId: env.VITE_HUBSPOT_APPOINTMENT_FORM_ID as string | undefined,
  orderFormId: env.VITE_HUBSPOT_ORDER_FORM_ID as string | undefined,
  meetingsUrl: env.VITE_HUBSPOT_MEETINGS_URL as string | undefined,
  /** ID del tipo de suscripción para correos de marketing (opcional) */
  marketingSubscriptionId: env.VITE_HUBSPOT_MARKETING_SUBSCRIPTION_ID as string | undefined,
};

export const consentText =
  "Autorizo a Gabus Vet S.A.C. a tratar mis datos personales para gestionar mi solicitud, conforme a la Ley N.° 29733 y su política de privacidad.";
export const marketingText = "Quiero recibir recordatorios de vacunas, promociones y consejos por correo.";

declare global {
  interface Window {
    _hsq?: unknown[][];
  }
}

/** Carga el código de seguimiento (visitas, fuentes, banner de cookies configurado en HubSpot) */
export function loadHubSpotTracking() {
  if (!hubspot.portalId || document.getElementById("hs-script-loader")) return;
  const script = document.createElement("script");
  script.id = "hs-script-loader";
  script.async = true;
  script.defer = true;
  const host = hubspot.region === "eu1" ? "js-eu1.hs-scripts.com" : "js.hs-scripts.com";
  script.src = `https://${host}/${hubspot.portalId}.js`;
  document.body.appendChild(script);
}

/** Registra una vista de página en la navegación interna (la web usa rutas con #) */
export function trackPageView(path: string) {
  if (!hubspot.portalId) return;
  window._hsq = window._hsq ?? [];
  window._hsq.push(["setPath", path]);
  window._hsq.push(["trackPageView"]);
}

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

export type SubmitResult = { status: "sent" } | { status: "skipped" } | { status: "error"; message: string };

/**
 * Envía un formulario a HubSpot (Forms API v3, endpoint público sin autenticación).
 * Los nombres de campo deben coincidir con los nombres internos de las propiedades en HubSpot.
 */
export async function submitHubSpotForm(
  formId: string | undefined,
  fields: Record<string, string>,
  consent: { marketing: boolean },
): Promise<SubmitResult> {
  if (!hubspot.portalId || !formId) return { status: "skipped" };

  const host = hubspot.region === "eu1" ? "api-eu1.hsforms.com" : "api.hsforms.com";
  const hutk = readCookie("hubspotutk");
  const body = {
    fields: Object.entries(fields)
      .filter(([, value]) => value !== "")
      .map(([name, value]) => ({ objectTypeId: "0-1", name, value })),
    context: {
      ...(hutk ? { hutk } : {}),
      pageUri: window.location.href,
      pageName: document.title,
    },
    legalConsentOptions: {
      consent: {
        consentToProcess: true,
        text: consentText,
        communications: hubspot.marketingSubscriptionId
          ? [{ value: consent.marketing, subscriptionTypeId: Number(hubspot.marketingSubscriptionId), text: marketingText }]
          : [],
      },
    },
  };

  try {
    const res = await fetch(`https://${host}/submissions/v3/integration/submit/${hubspot.portalId}/${formId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { status: "sent" };
    const detail = await res.json().catch(() => null);
    console.error("HubSpot rechazó el formulario", detail);
    return { status: "error", message: "No pudimos registrar tu solicitud." };
  } catch {
    return { status: "error", message: "No hay conexión con el servidor." };
  }
}
