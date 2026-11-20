import {
  CalendarCheck,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  PawPrint,
  PaperPlaneTilt,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  ConsentFields,
  Field,
  inputClass,
} from "@/components/ui/Form";
import { ServiceIcon } from "@/components/icons";
import type { Pet } from "@/data/products";
import { services } from "@/data/site";
import { useAuth } from "@/context/AuthContext";
import { bookAppointment, getAppointmentSlots, type AppointmentSlot } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/context/SiteContentContext";

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
  const { text, image } = useSiteContent();
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
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState<Pet>("perro");
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const serviceSlots = selectedService ? slots.filter((slot) => slot.service === selectedService.name) : [];
  const selectedSlot = serviceSlots.find((slot) => slot.id === selectedSlotId);

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
    setPetName("");
    setPetType("perro");
  }

  if (!ready || !user || user.role !== "customer") {
    return <Container className="py-20 text-center text-muted-foreground">Abriendo la agenda de citas...</Container>;
  }

  return (
    <>
      <PageHeader
        title={text("appointments.page.title")}
        description={text("appointments.page.description")}
        image={{ src: image("appointments.image"), alt: "Corgi mirando a la cámara" }}
      />

      <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-6">
          {status.kind === "sent" ? (
            <SentPanel owner={status.owner} onReset={() => setStatus({ kind: "idle" })} />
          ) : (
            <form noValidate onSubmit={handleSubmit} className="h-fit space-y-8 rounded-media bg-card p-6 shadow-soft sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-5">
                <h2 className="font-display text-2xl font-black">Elige tu cita</h2>
                <p className="text-sm text-muted-foreground">
                  {`${user.firstname} ${user.lastname}`.trim()} · {user.email}
                </p>
              </div>

              <fieldset className="space-y-4">
                <SectionLabel icon={<PawPrint weight="fill" />}>Tu mascota</SectionLabel>
                <div className="grid gap-5 rounded-card bg-muted/40 p-5 sm:grid-cols-2">
                  <Field label="Nombre de tu mascota" name="nombre_mascota" hint="Opcional">
                    <input
                      id="nombre_mascota"
                      name="nombre_mascota"
                      placeholder="Toby"
                      value={petName}
                      onChange={(event) => setPetName(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Es un" name="tipo_mascota">
                    <select
                      id="tipo_mascota"
                      name="tipo_mascota"
                      value={petType}
                      onChange={(event) => setPetType(event.target.value as Pet)}
                      className={inputClass}
                    >
                      {petOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <SectionLabel icon={<CalendarCheck weight="fill" />}>Servicio y horario</SectionLabel>
                <div className="grid gap-5 rounded-card bg-muted/40 p-5">
                  <Field label="Servicio" name="servicio_interes">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {services.map((s) => {
                        const active = s.id === selectedServiceId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              setSelectedServiceId(s.id);
                              setSelectedSlotId("");
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border-2 bg-background px-4 py-3 text-left transition-colors",
                              active ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/60",
                            )}
                          >
                            <ServiceIcon name={s.icon} className="size-6 shrink-0 text-accent" />
                            <span className="min-w-0 truncate text-sm font-bold">{text(`service.${s.id}.name`)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <input type="hidden" name="servicio_interes" value={selectedServiceId} />
                  </Field>
                  <Field label="Horario disponible" name="appointment_slot">
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
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <SectionLabel icon={<ClipboardText weight="fill" />}>Contacto y detalles</SectionLabel>
                <div className="grid gap-5 rounded-card bg-muted/40 p-5">
                  <Field label="Celular" name="phone" hint="Para coordinar tu cita">
                    <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={user.phone} placeholder="987 654 321" className={inputClass} />
                  </Field>
                  <Field label="Mensaje" name="message" hint="Opcional. Cuéntanos qué necesita tu engreído.">
                    <textarea id="message" name="message" rows={3} className={`${inputClass} h-auto resize-y py-3`} />
                  </Field>
                </div>
              </fieldset>

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

        <aside className="lg:sticky lg:top-24">
          <div className="space-y-6 rounded-media bg-primary p-6 text-primary-foreground shadow-soft sm:p-7">
            <p className="flex items-center gap-2 font-display text-lg font-black">
              <ClipboardText weight="fill" className="size-6" /> Resumen de tu cita
            </p>

            <div className="flex items-start gap-3 border-t border-white/15 pt-5">
              {selectedService && <ServiceIcon name={selectedService.icon} className="size-7 shrink-0 text-accent" />}
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-primary-foreground/60 uppercase">Servicio</p>
                <p className="truncate font-display font-black">{selectedService ? text(`service.${selectedService.id}.name`) : "—"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <PawPrint weight="fill" className="size-7 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-primary-foreground/60 uppercase">Mascota</p>
                <p className="truncate font-display font-black">
                  {petName || "Sin nombre"} · {petOptions.find(([v]) => v === petType)?.[1]}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CalendarCheck weight="fill" className="size-7 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-primary-foreground/60 uppercase">Horario</p>
                {selectedSlot ? (
                  <>
                    <p className="font-display font-black">
                      {new Date(selectedSlot.startsAt).toLocaleString("es-PE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-sm text-primary-foreground/70">{selectedSlot.veterinarianName || "Personal por asignar"}</p>
                  </>
                ) : (
                  <p className="font-display font-black text-primary-foreground/60">Por elegir</p>
                )}
              </div>
            </div>

            <p className="flex items-start gap-2 border-t border-white/15 pt-5 text-sm text-primary-foreground/70">
              <ShieldCheck weight="fill" className="mt-0.5 size-5 shrink-0 text-accent" />
              El costo lo confirmará el equipo de ventas antes de aprobar la cita. Verás el estado y el detalle en tu cuenta.
            </p>
          </div>
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

function SectionLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-display text-sm font-black tracking-wide text-accent uppercase">
      <span className="[&_svg]:size-5">{icon}</span>
      {children}
    </p>
  );
}
