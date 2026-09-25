import {
  CheckCircle,
  CircleNotch,
  Clock,
  InstagramLogo,
  MapPin,
  PaperPlaneTilt,
  Phone,
  Siren,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  ConsentFields,
  Field,
  inputClass,
  OwnerFields,
  validateContact,
  type ContactErrors,
} from "@/components/ui/Form";
import type { Pet } from "@/data/products";
import { business, photos, services } from "@/data/site";
import { hubspot, submitHubSpotForm, toHubSpotPhone } from "@/lib/hubspot";
import { whatsappLink } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; owner: { firstname: string; lastname: string; email: string } }
  | { kind: "whatsapp" }
  | { kind: "error"; message: string; whatsappMessage: string };

// Los valores coinciden con las opciones internas de la propiedad tipo_mascota en HubSpot
const petOptions: [Pet, string][] = [
  ["perro", "Perro"],
  ["gato", "Gato"],
  ["exotico", "Exótico (ave, reptil, roedor…)"],
];

const crmEnabled = Boolean(hubspot.portalId && hubspot.appointmentFormId);

export function Contact() {
  const [params] = useSearchParams();
  const preselected = services.find((s) => s.id === params.get("servicio"))?.id ?? services[0].id;
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const found = validateContact(data);
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const get = (k: string) => String(data.get(k) ?? "").trim();
    const service = services.find((s) => s.id === get("servicio_interes"))!;
    const whatsappMessage = [
      "Hola PetCare, quisiera agendar una cita.",
      `Nombre: ${get("firstname")} ${get("lastname")}`,
      `Mascota: ${get("nombre_mascota") || "sin nombre"} (${petOptions.find(([v]) => v === get("tipo_mascota"))![1]})`,
      `Servicio: ${service.name}`,
      get("message") ? `Mensaje: ${get("message")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Sin HubSpot configurado, la solicitud se envía por WhatsApp como antes
    if (!crmEnabled) {
      window.open(whatsappLink(whatsappMessage), "_blank", "noopener");
      setStatus({ kind: "whatsapp" });
      return;
    }

    setStatus({ kind: "sending" });
    const result = await submitHubSpotForm(
      hubspot.appointmentFormId,
      {
        firstname: get("firstname"),
        lastname: get("lastname"),
        email: get("email"),
        phone: toHubSpotPhone(get("phone")),
        tipo_mascota: get("tipo_mascota"),
        nombre_mascota: get("nombre_mascota"),
        servicio_interes: get("servicio_interes"),
        message: get("message"),
      },
      { marketing: data.get("marketing") === "on" },
    );

    if (result.status === "error") {
      setStatus({ kind: "error", message: result.message, whatsappMessage });
      return;
    }
    setStatus({ kind: "sent", owner: { firstname: get("firstname"), lastname: get("lastname"), email: get("email") } });
    form.reset();
  }

  return (
    <>
      <PageHeader
        title="Agenda tu cita"
        description="Déjanos tus datos y los de tu mascota, y coordinamos contigo el horario. Si es una emergencia, llámanos directamente."
        image={{ src: photos.corgi, alt: "Corgi mirando a la cámara" }}
      />

      <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          {status.kind === "sent" ? (
            <SentPanel owner={status.owner} onReset={() => setStatus({ kind: "idle" })} />
          ) : (
            <form noValidate onSubmit={handleSubmit} className="h-fit space-y-6 rounded-media bg-card p-6 shadow-soft sm:p-9">
              <fieldset className="space-y-5">
                <legend className="mb-5 font-display text-xl font-black">Tus datos</legend>
                <OwnerFields errors={errors} />
              </fieldset>

              <div className="border-t border-border pt-6">
                <fieldset className="space-y-5">
                  <legend className="mb-5 font-display text-xl font-black">Tu mascota</legend>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Nombre de tu mascota" name="nombre_mascota" hint="Opcional">
                      <input id="nombre_mascota" name="nombre_mascota" placeholder="Toby" className={inputClass} />
                    </Field>
                    <Field label="Es un" name="tipo_mascota">
                      <select id="tipo_mascota" name="tipo_mascota" defaultValue="perro" className={inputClass}>
                        {petOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Servicio" name="servicio_interes" className="sm:col-span-2">
                      <select id="servicio_interes" name="servicio_interes" key={preselected} defaultValue={preselected} className={inputClass}>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Mensaje" name="message" hint="Opcional. Cuéntanos qué necesita tu engreído.">
                    <textarea id="message" name="message" rows={3} className={`${inputClass} h-auto resize-y py-3`} />
                  </Field>
                </fieldset>
              </div>

              <ConsentFields error={errors.consent} />

              <Button type="submit" size="lg" className="w-full" disabled={status.kind === "sending"}>
                {status.kind === "sending" ? (
                  <>
                    <CircleNotch weight="bold" className="animate-spin" /> Enviando
                  </>
                ) : crmEnabled ? (
                  <>
                    <PaperPlaneTilt weight="bold" /> Enviar solicitud
                  </>
                ) : (
                  <>
                    <WhatsappLogo weight="fill" /> Enviar por WhatsApp
                  </>
                )}
              </Button>

              {status.kind === "whatsapp" && (
                <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-center text-sm font-bold text-accent">
                  Abrimos WhatsApp con tu solicitud. Solo falta presionar enviar.
                </p>
              )}
              {status.kind === "error" && (
                <div role="alert" className="rounded-xl border-2 border-danger/30 px-4 py-3 text-sm">
                  <p className="font-bold text-danger">{status.message}</p>
                  <p className="mt-1 text-muted-foreground">
                    Inténtalo de nuevo o{" "}
                    <a
                      href={whatsappLink(status.whatsappMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-accent underline underline-offset-2"
                    >
                      envíala por WhatsApp
                    </a>
                    .
                  </p>
                </div>
              )}
            </form>
          )}
        </div>

        <aside className="space-y-8">
          <ul className="space-y-6">
            <InfoRow icon={<MapPin weight="duotone" />} title="Sede Surco">
              <a href={business.mapsLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                {business.address}
              </a>
            </InfoRow>
            <InfoRow icon={<Clock weight="duotone" />} title="Horario">{business.hours}</InfoRow>
            <InfoRow icon={<Phone weight="duotone" />} title="Teléfono">
              <a href={business.phoneHref} className="hover:text-accent">{business.phone}</a>
            </InfoRow>
            <InfoRow icon={<InstagramLogo weight="duotone" />} title="Instagram">
              <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                @petcareperu
              </a>
            </InfoRow>
          </ul>

          <div className="rounded-media bg-accent-soft p-6">
            <p className="flex items-center gap-2 font-display text-lg font-black">
              <Siren weight="fill" className="size-6 text-danger" /> ¿Es una emergencia?
            </p>
            <p className="mt-1.5 text-muted-foreground">Llámanos y te atiende una persona de nuestro equipo.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonAnchor href={business.emergencyHref} target="_self">
                <Phone weight="bold" /> {business.emergency}
              </ButtonAnchor>
              <ButtonAnchor href={whatsappLink("Hola PetCare, tengo una emergencia con mi mascota.")} variant="whatsapp">
                <WhatsappLogo weight="fill" /> WhatsApp
              </ButtonAnchor>
            </div>
          </div>

          <iframe
            title="Ubicación de PetCare en Google Maps"
            src={business.mapsEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-64 w-full rounded-media border-0 shadow-soft"
          />
        </aside>
      </Container>
    </>
  );
}

function SentPanel({
  owner,
  onReset,
}: {
  owner: { firstname: string; lastname: string; email: string };
  onReset: () => void;
}) {
  // Meetings acepta los datos del contacto por URL para no pedirlos dos veces
  const meetingsSrc = hubspot.meetingsUrl
    ? `${hubspot.meetingsUrl}?${new URLSearchParams({ embed: "true", ...owner })}`
    : null;

  return (
    <div role="status" className="space-y-6 rounded-media bg-card p-6 shadow-soft sm:p-9">
      <div className="flex gap-4">
        <CheckCircle weight="fill" className="size-10 shrink-0 text-accent" />
        <div>
          <h2 className="text-2xl font-black">Recibimos tu solicitud, {owner.firstname}</h2>
          <p className="mt-1.5 text-muted-foreground">
            {meetingsSrc
              ? "Si quieres, elige ahora el horario que más te acomode."
              : `Te contactaremos al celular que dejaste, en nuestro horario de atención (${business.hours.toLowerCase()}).`}
          </p>
        </div>
      </div>
      {meetingsSrc && (
        <iframe title="Elige el horario de tu cita" src={meetingsSrc} className="h-[680px] w-full rounded-card border-0" />
      )}
      <Button variant="outline" size="sm" onClick={onReset}>
        Agendar otra cita
      </Button>
    </div>
  );
}

function InfoRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="text-accent [&_svg]:size-7">{icon}</span>
      <div>
        <p className="font-display font-extrabold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
