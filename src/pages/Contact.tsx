import { CheckCircle, CircleNotch, InstagramLogo, MapPin, PaperPlaneTilt, Phone } from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  ConsentFields,
  Field,
  inputClass,
  OwnerFields,
  validateContact,
  type ContactErrors,
} from "@/components/ui/Form";
import { business } from "@/data/site";
import { sendPublicContact } from "@/lib/crm";
import { whatsappLink } from "@/lib/utils";
import { useSiteContent } from "@/context/SiteContentContext";
import { sitePhoneHref } from "@/lib/siteContent";

type FormStatus = "idle" | "sending" | "sent";

export function Contact() {
  const { text, image } = useSiteContent();
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors = validateContact(data);
    setErrors(nextErrors);
    setError("");
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const value = (key: string) => String(data.get(key) ?? "").trim();
    const message = value("message");
    if (message.length < 5) {
      setError("Cuéntanos brevemente en qué podemos ayudarte.");
      form.querySelector<HTMLElement>('[name="message"]')?.focus();
      return;
    }

    setStatus("sending");
    try {
      await sendPublicContact({
        firstname: value("firstname"),
        lastname: value("lastname"),
        email: value("email"),
        phone: value("phone"),
        subject: value("subject") || "Consulta desde la página de contacto",
        message,
        consent: true,
        marketingConsent: data.get("marketing") === "on",
      });
      setStatus("sent");
      form.reset();
    } catch (cause) {
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "No se pudo enviar tu mensaje. Inténtalo nuevamente.");
    }
  }

  return (
    <>
      <PageHeader
        title={text("contact.page.title")}
        description={text("contact.page.description")}
        image={{ src: image("contact.image"), alt: "Corgi mirando a la cámara" }}
      />

      <Container className="grid gap-8 py-10 sm:py-14 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="h-fit rounded-media border border-border bg-card p-5 shadow-soft sm:p-8" aria-labelledby="contact-form-title">
          {status === "sent" ? (
            <div role="status" className="space-y-5">
              <div className="flex items-start gap-3">
                <CheckCircle weight="fill" className="mt-0.5 size-8 shrink-0 text-accent" />
                <div>
                  <h2 id="contact-form-title" className="font-display text-xl font-black text-primary">Mensaje enviado</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Gracias por escribirnos. Nuestro equipo se pondrá en contacto contigo.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Enviar otro mensaje</Button>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 id="contact-form-title" className="font-display text-xl font-black text-primary">{text("contact.form.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{text("contact.form.description")}</p>
              </div>
              <OwnerFields errors={errors} />
              <Field label="Asunto" name="subject" hint="Opcional">
                <input id="subject" name="subject" maxLength={200} placeholder="¿Sobre qué trata tu consulta?" className={inputClass} />
              </Field>
              <Field label="Mensaje" name="message">
                <textarea id="message" name="message" required minLength={5} maxLength={3000} rows={4} placeholder="Escribe aquí tu consulta..." className={`${inputClass} h-auto resize-y py-3`} />
              </Field>
              <ConsentFields error={errors.consent} />
              {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? <><CircleNotch weight="bold" className="animate-spin" /> Enviando...</> : <><PaperPlaneTilt weight="bold" /> Enviar mensaje</>}
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">¿Necesitas una consulta veterinaria?</p>
            <ButtonLink to="/citas" variant="outline" size="sm" className="mt-3">Agendar cita médica</ButtonLink>
          </div>
        </section>

        <aside className="space-y-6">
          <ul className="space-y-5 rounded-media border border-border bg-card p-5 shadow-soft sm:p-7">
            <InfoRow icon={<MapPin weight="duotone" />} title="Sede Surco">
              <a href={business.mapsLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{business.address}</a>
            </InfoRow>
            <InfoRow icon={<Phone weight="duotone" />} title="Teléfono">
              <a href={sitePhoneHref(text("global.phone"))} className="hover:text-accent">{text("global.phone")}</a>
            </InfoRow>
            <InfoRow icon={<InstagramLogo weight="duotone" />} title="Instagram">
              <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-accent">@petcareperu</a>
            </InfoRow>
            <li className="border-t border-border pt-5">
              <p className="font-display font-extrabold text-primary">¿Prefieres escribir por WhatsApp?</p>
              <a href={whatsappLink("Hola PetCare, tengo una consulta.")} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-bold text-accent underline underline-offset-2">
                Iniciar conversación
              </a>
            </li>
          </ul>
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

function InfoRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="text-accent [&_svg]:size-6">{icon}</span>
      <div>
        <p className="font-display font-extrabold text-primary">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
