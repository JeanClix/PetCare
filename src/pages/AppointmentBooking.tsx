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
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  ConsentFields,
  Field,
  inputClass,
} from "@/components/ui/Form";
import type { Pet } from "@/data/products";
import { business, photos, services } from "@/data/site";
import { useAuth } from "@/context/AuthContext";
import { bookAppointment, getAppointmentSlots, type AppointmentSlot } from "@/lib/crm";
import { whatsappLink } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; owner: string }
  | { kind: "error"; message: string };

const petOptions: [Pet, string][] = [
  ["perro", "Perro"],
  ["gato", "Gato"],
  ["exotico", "Exótico (ave, reptil, roedor…)"],
];

export function AppointmentBooking() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const preselected = services.find((s) => s.id === params.get("servicio"))?.id ?? services[0].id;
  const [selectedServiceId, setSelectedServiceId] = useState(preselected);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotError, setSlotError] = useState("");
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const serviceSlots = selectedService ? slots.filter((slot) => slot.service === selectedService.name) : [];

  useEffect(() => {
    setSelectedServiceId(preselected);
  }, [preselected]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const service = params.get("servicio");
      const query = service ? `&servicio=${encodeURIComponent(service)}` : "";
      navigate(`/cuenta?next=%2Fcitas${query}`, { replace: true });
    } else if (user.role !== "customer") {
      navigate("/admin", { replace: true });
    }
  }, [ready, user, params, navigate]);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    let active = true;
    setSlotsLoading(true);
    setSlotError("");
    getAppointmentSlots(user.token)
      .then((result) => active && setSlots(result.filter((slot) => slot.status === "available")))
      .catch((cause: unknown) => active && setSlotError(cause instanceof Error ? cause.message : "No se pudieron cargar los horarios."))
      .finally(() => active && setSlotsLoading(false));
    return () => { active = false; };
  }, [user]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get("phone") ?? "").trim();
    if (!/^(9\d{8}|0?1\d{7})$/.test(phone.replace(/\D/g, "")) || data.get("consent") !== "on") {
      setStatus({ kind: "error", message: data.get("consent") !== "on"
        ? "Autoriza el uso de tus datos para gestionar la cita."
        : "Revisa tu número de teléfono." });
      return;
    }

    const get = (k: string) => String(data.get(k) ?? "").trim();
    const service = services.find((s) => s.id === get("servicio_interes"));
    const pet = `${get("nombre_mascota") || "sin nombre"} (${petOptions.find(([v]) => v === get("tipo_mascota"))?.[1] ?? "Mascota"})`;
    const slotId = get("appointment_slot");
    if (!service || slotId !== selectedSlotId || !serviceSlots.some((slot) => slot.id === slotId)) {
      setStatus({ kind: "error", message: "Elige un horario disponible para el servicio seleccionado." });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      if (!user || user.role !== "customer") throw new Error("Inicia sesión con una cuenta de cliente para reservar.");
      await bookAppointment(user.token, {
        slotId,
        service: service.name,
        pet,
        phone,
        details: get("message") || undefined,
        consent: true,
        marketingConsent: data.get("marketing") === "on",
      });
    } catch (cause) {
      setStatus({
        kind: "error",
        message: cause instanceof Error ? cause.message : "No pudimos guardar tu solicitud.",
      });
      if (user?.role === "customer") {
        void getAppointmentSlots(user.token)
          .then((available) => setSlots(available.filter((slot) => slot.status === "available")))
          .catch((refreshError: unknown) => setSlotError(refreshError instanceof Error ? refreshError.message : "No se pudieron actualizar los horarios."));
      }
      return;
    }

    setStatus({ kind: "sent", owner: user?.firstname || "cliente" });
    form.reset();
    setSelectedSlotId("");
  }

  if (!ready || !user || user.role !== "customer") {
    return <Container className="py-20 text-center text-muted-foreground">Abriendo la agenda de citas...</Container>;
  }

  return (
    <>
      <PageHeader
        title="Agenda tu cita"
        description="Elige un horario disponible y consulta el estado de tu reserva desde Mi cuenta."
        image={{ src: photos.corgi, alt: "Corgi mirando a la cámara" }}
      />

      <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          {status.kind === "sent" ? (
            <SentPanel owner={status.owner} onReset={() => setStatus({ kind: "idle" })} />
          ) : (
            <form noValidate onSubmit={handleSubmit} className="h-fit space-y-5 rounded-media bg-card p-6 shadow-soft sm:p-8">
              <p className="text-sm text-muted-foreground">Reserva para {`${user.firstname} ${user.lastname}`.trim()} · {user.email}</p>
              <div className="border-t border-border pt-6">
                <fieldset className="space-y-5">
                  <legend className="mb-4 font-display text-xl font-black">Elige tu cita</legend>
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
                      <select
                        id="servicio_interes"
                        name="servicio_interes"
                        value={selectedServiceId}
                        onChange={(event) => {
                          setSelectedServiceId(event.target.value);
                          setSelectedSlotId("");
                        }}
                        className={inputClass}
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Horario disponible" name="appointment_slot" className="sm:col-span-2">
                      {slotsLoading ? (
                        <div className="h-12 animate-pulse rounded-xl bg-muted" />
                      ) : (
                        <select
                          id="appointment_slot"
                          name="appointment_slot"
                          required
                          value={selectedSlotId}
                          onChange={(event) => setSelectedSlotId(event.target.value)}
                          className={inputClass}
                          disabled={serviceSlots.length === 0}
                        >
                          <option value="" disabled>{serviceSlots.length ? "Selecciona un horario" : "No hay horarios para este servicio"}</option>
                          {serviceSlots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {new Date(slot.startsAt).toLocaleString("es-PE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {slot.veterinarianName || "Personal por asignar"}
                            </option>
                          ))}
                        </select>
                      )}
                      {slotError && <p role="alert" className="text-sm font-semibold text-danger">{slotError}</p>}
                    </Field>
                    <Field label="Celular" name="phone" hint="Para coordinar tu cita">
                      <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={user.phone} placeholder="987 654 321" className={inputClass} />
                    </Field>
                    <p className="self-end text-sm text-muted-foreground">
                      El costo lo confirmará el equipo de ventas antes de aprobar la cita.
                    </p>
                  </div>
                  <Field label="Mensaje" name="message" hint="Opcional. Cuéntanos qué necesita tu engreído.">
                    <textarea id="message" name="message" rows={3} className={`${inputClass} h-auto resize-y py-3`} />
                  </Field>
                </fieldset>
              </div>

              <ConsentFields />

              <Button type="submit" size="lg" className="w-full" disabled={status.kind === "sending" || slotsLoading || serviceSlots.length === 0}>
                {status.kind === "sending" ? (
                  <>
                    <CircleNotch weight="bold" className="animate-spin" /> Reservando
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt weight="bold" /> Reservar cita
                  </>
                )}
              </Button>

              {status.kind === "error" && (
                <div role="alert" className="rounded-xl border-2 border-danger/30 px-4 py-3 text-sm">
                  <p className="font-bold text-danger">{status.message}</p>
                </div>
              )}
              {serviceSlots.length === 0 && !slotsLoading && !slotError && (
                <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  No hay horarios publicados para {selectedService?.name ?? "este servicio"}. Vuelve a revisar más tarde o llámanos.
                </p>
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
  owner: string;
  onReset: () => void;
}) {
  return (
    <div role="status" className="space-y-6 rounded-media bg-card p-6 shadow-soft sm:p-9">
      <div className="flex gap-4">
        <CheckCircle weight="fill" className="size-10 shrink-0 text-accent" />
        <div>
          <h2 className="text-2xl font-black">Reserva enviada, {owner}</h2>
          <p className="mt-1.5 text-muted-foreground">
            La cita quedó pendiente de confirmación. Verás la fecha, el veterinario y el costo en tu cuenta.
          </p>
        </div>
      </div>
      <ButtonLink to="/cuenta">Ver seguimiento en Mi cuenta</ButtonLink>
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
