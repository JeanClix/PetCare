import { CalendarBlank, ClipboardText, NotePencil, PawPrint, Phone, WhatsappLogo } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { getAppointments, setAppointmentStatus, type Appointment, type CrmLeadStatus } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { AttendanceForm } from "@/pages/clinic/AttendanceForm";
import { WhatsappComposer } from "@/components/staff/WhatsappComposer";

const columns: Array<{ status: CrmLeadStatus; label: string; hint: string }> = [
  { status: "new", label: "Por confirmar", hint: "Solicitudes recién llegadas" },
  { status: "contacted", label: "Contactadas", hint: "Ya se habló con el dueño" },
  { status: "qualified", label: "Confirmadas", hint: "Fecha y hora acordadas" },
  { status: "closed", label: "Atendidas", hint: "Cita realizada o cerrada" },
];

export function AppointmentsBoard({
  token,
  clinicAccess,
  onOpenPatient,
}: {
  token: string;
  /** Veterinario y administrador registran atenciones; ventas solo ve el estado */
  clinicAccess: boolean;
  onOpenPatient: (petId: string) => void;
}) {
  const [attending, setAttending] = useState<Appointment | null>(null);
  const [messaging, setMessaging] = useState<Appointment | null>(null);
  const [reload, setReload] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CrmLeadStatus | "open">("open");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAppointments(token)
      .then((result) => active && setAppointments(result))
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "No se pudieron cargar las citas."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, reload]);

  const counts = useMemo(
    () => Object.fromEntries(columns.map(({ status }) => [status, appointments.filter((item) => item.status === status).length])) as Record<CrmLeadStatus, number>,
    [appointments],
  );
  const visible = appointments.filter((item) => (filter === "open" ? item.status !== "closed" : item.status === filter));

  async function updateStatus(appointment: Appointment, status: CrmLeadStatus) {
    setSavingId(appointment.id);
    setError("");
    try {
      await setAppointmentStatus(token, appointment.id, status);
      setAppointments((current) => current.map((item) => (item.id === appointment.id ? { ...item, status } : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la cita.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-5" aria-label="Citas">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {columns.map(({ status, label, hint }) => (
          <button
            key={status}
            type="button"
            aria-pressed={filter === status}
            onClick={() => setFilter((current) => (current === status ? "open" : status))}
            className={cn(
              "rounded-card border bg-card p-4 text-left transition-colors",
              filter === status ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/60",
            )}
          >
            <span className="block text-sm font-semibold text-muted-foreground">{label}</span>
            <span className="mt-1 block font-display text-3xl font-black text-primary tabular-nums">{loading ? "–" : counts[status]}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {filter === "open"
          ? "Mostrando citas pendientes (sin las atendidas). Toca un estado para filtrar."
          : `Mostrando: ${columns.find((column) => column.status === filter)?.label}.`}
      </p>

      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => <div key={index} className="h-40 animate-pulse rounded-card bg-muted" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-media border border-dashed border-border bg-card px-6 py-14 text-center">
          <CalendarBlank weight="duotone" className="mx-auto size-10 text-accent" />
          <p className="mt-3 font-display text-lg font-black text-primary">No hay citas en esta vista</p>
          <p className="mt-1 text-sm text-muted-foreground">Las solicitudes que lleguen desde el formulario de contacto aparecerán aquí.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((appointment) => (
            <li key={appointment.id} className="flex flex-col rounded-card border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-black text-primary">{appointment.service || "Consulta general"}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <PawPrint weight="fill" className="size-4 text-accent" />
                    {appointment.pet || "Mascota sin especificar"}
                  </p>
                </div>
                <time className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                  {new Date(appointment.createdAt).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              {appointment.details && <p className="mt-3 line-clamp-3 text-sm whitespace-pre-wrap text-foreground/80">{appointment.details}</p>}
              <div className="mt-4 border-t border-border pt-3 text-sm">
                <p className="font-bold">{appointment.owner}</p>
                <p className="text-muted-foreground">{appointment.email}</p>
              </div>
              {clinicAccess && (
                <div className="mt-4">
                  {appointment.recordPetId ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => onOpenPatient(appointment.recordPetId!)}>
                      <ClipboardText weight="bold" /> Ver historial clínico
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => setAttending(appointment)}>
                      <NotePencil weight="bold" /> Registrar atención
                    </Button>
                  )}
                </div>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <label className="sr-only" htmlFor={`appointment-${appointment.id}`}>Estado de la cita</label>
                <select
                  id={`appointment-${appointment.id}`}
                  value={appointment.status}
                  disabled={savingId === appointment.id}
                  onChange={(event) => void updateStatus(appointment, event.target.value as CrmLeadStatus)}
                  className="h-9 rounded-full border border-border bg-background px-3 text-sm font-semibold focus:border-accent focus:outline-none"
                >
                  {columns.map(({ status, label }) => <option key={status} value={status}>{label}</option>)}
                </select>
                {appointment.phone && (
                  <>
                    <a
                      href={`tel:${appointment.phone}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <Phone weight="bold" /> Llamar
                    </a>
                    <button
                      type="button"
                      onClick={() => setMessaging(appointment)}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <WhatsappLogo weight="fill" className="text-[#128C4B]" /> WhatsApp
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {messaging && (
        <WhatsappComposer
          token={token}
          contactId={messaging.contactId}
          phone={messaging.phone}
          context={{ name: messaging.owner, service: messaging.service, pet: messaging.pet?.replace(/\s*\([^)]*\)\s*$/, "") }}
          onClose={() => setMessaging(null)}
        />
      )}

      {attending && (
        <AttendanceForm
          token={token}
          appointment={attending}
          onClose={() => setAttending(null)}
          onSaved={() => {
            setAttending(null);
            setReload((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}
