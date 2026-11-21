import {
  CalendarCheck,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  PawPrint,
  PaperPlaneTilt,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" });

function dateKeyOf(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isPastDay(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/** Calendario mensual de 6 semanas (lunes a domingo) para elegir el día de la cita. */
function AppointmentCalendar({
  viewMonth,
  onChangeMonth,
  availableDates,
  selectedDate,
  onSelectDate,
}: {
  viewMonth: Date;
  onChangeMonth: (next: Date) => void;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const monthStart = startOfMonth(viewMonth);
  const leadingBlanks = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const canGoBack = !isSameMonth(monthStart, today) && monthStart > today;
  const cells: Array<{ date: Date; dateKey: string } | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    cells.push({ date, dateKey });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChangeMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
          disabled={!canGoBack}
          aria-label="Mes anterior"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
        >
          <CaretLeft weight="bold" className="size-4" />
        </button>
        <p className="font-display text-sm font-black capitalize text-primary">{MONTH_FORMATTER.format(monthStart)}</p>
        <button
          type="button"
          onClick={() => onChangeMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
          aria-label="Mes siguiente"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <CaretRight weight="bold" className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
        {WEEKDAY_LABELS.map((label, index) => <span key={`${label}-${index}`} className="py-1">{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell) return <span key={`blank-${index}`} />;
          const hasSlots = availableDates.has(cell.dateKey);
          const disabled = !hasSlots || isPastDay(cell.date);
          const isSelected = selectedDate === cell.dateKey;
          return (
            <button
              key={cell.dateKey}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(cell.dateKey)}
              aria-pressed={isSelected}
              className={cn(
                "relative aspect-square rounded-lg text-sm font-bold transition-colors",
                disabled && "cursor-not-allowed text-muted-foreground/40",
                !disabled && !isSelected && "text-foreground hover:bg-accent-soft",
                isSelected && "bg-accent text-accent-foreground shadow-soft",
              )}
            >
              {cell.date.getDate()}
              {hasSlots && !isSelected && !disabled && (
                <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const serviceSlots = selectedService ? slots.filter((slot) => slot.service === selectedService.name) : [];
  const selectedSlot = serviceSlots.find((slot) => slot.id === selectedSlotId);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, AppointmentSlot[]>();
    for (const slot of serviceSlots) {
      const key = dateKeyOf(slot.startsAt);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [serviceSlots]);
  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);
  const daySlots = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  // Al cambiar de servicio o al cargar nuevos horarios, mostramos de entrada el primer día con cupos.
  useEffect(() => {
    const firstDateKey = [...availableDates].sort()[0] ?? null;
    setSelectedDate((current) => (current && availableDates.has(current) ? current : firstDateKey));
    if (firstDateKey) {
      const [year, month] = firstDateKey.split("-").map(Number);
      setViewMonth(new Date(year, month - 1, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, availableDates.size]);

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
        group="appointments.page"
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
                      <div className="h-56 animate-pulse rounded-xl bg-muted" />
                    ) : serviceSlots.length === 0 ? (
                      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">No hay horarios para este servicio todavía.</p>
                    ) : (
                      <div className="space-y-4">
                        <AppointmentCalendar
                          viewMonth={viewMonth}
                          onChangeMonth={setViewMonth}
                          availableDates={availableDates}
                          selectedDate={selectedDate}
                          onSelectDate={(dateKey) => {
                            setSelectedDate(dateKey);
                            setSelectedSlotId((current) => {
                              const stillValid = (slotsByDate.get(dateKey) ?? []).some((slot) => slot.id === current);
                              return stillValid ? current : "";
                            });
                          }}
                        />
                        <div>
                          <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                            {selectedDate
                              ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })
                              : "Elige un día en el calendario"}
                          </p>
                          {daySlots.length === 0 ? (
                            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Elige un día marcado con un punto para ver sus horarios.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {daySlots.map((slot) => {
                                const active = slot.id === selectedSlotId;
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setSelectedSlotId(slot.id)}
                                    className={cn(
                                      "flex flex-col items-start rounded-xl border-2 px-3.5 py-2 text-left transition-colors",
                                      active ? "border-accent bg-accent-soft" : "border-border bg-background hover:border-accent/60",
                                    )}
                                  >
                                    <span className="text-sm font-bold text-foreground">
                                      {new Date(slot.startsAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{slot.veterinarianName || "Personal por asignar"}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <input type="hidden" name="appointment_slot" value={selectedSlotId} />
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
