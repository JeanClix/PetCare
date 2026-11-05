import { CalendarBlank, CircleNotch, Stethoscope } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { getMyAppointments, type CustomerAppointment } from "@/lib/crm";
import { formatPrice } from "@/lib/utils";

const statusLabels = {
  new: "Pendiente de confirmación",
  contacted: "En coordinación",
  qualified: "Confirmada",
  closed: "Atendida",
} as const;

function formatAppointmentDate(value: string) {
  return new Date(value).toLocaleString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CustomerAppointments({ token }: { token: string }) {
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAppointments(await getMyAppointments(token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus citas.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-4 rounded-media border border-border bg-card p-5 shadow-soft sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black text-primary">Mis citas</h2>
        <ButtonLink to="/citas" variant="outline" size="sm">Agendar cita</ButtonLink>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleNotch className="animate-spin" /> Cargando citas...</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tus reservas y su estado aparecerán aquí.</p>
      ) : (
        <ul className="space-y-3">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-primary">{appointment.service || "Consulta veterinaria"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{appointment.pet}</p>
                </div>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                  {statusLabels[appointment.status]}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p className="flex items-start gap-2 text-muted-foreground">
                  <CalendarBlank weight="duotone" className="mt-0.5 size-4 shrink-0 text-accent" />
                  {appointment.scheduledAt ? formatAppointmentDate(appointment.scheduledAt) : "Horario pendiente"}
                </p>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <Stethoscope weight="duotone" className="mt-0.5 size-4 shrink-0 text-accent" />
                  {appointment.veterinarianName || "Veterinario por confirmar"}
                </p>
                <p className="font-semibold text-foreground sm:col-span-2">
                  {appointment.price === null ? "Costo por confirmar" : `Costo: ${formatPrice(appointment.price)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
