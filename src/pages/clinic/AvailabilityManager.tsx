import { CalendarBlank, CircleNotch, Plus, Trash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { services } from "@/data/site";
import { getManagedAccounts, type ManagedAccount, type StaffRole } from "@/lib/adminAuth";
import {
  cancelAppointmentSlot,
  createAppointmentSlot,
  getAppointmentSlots,
  type AppointmentSlot,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";

function slotDate(value: string) {
  return new Date(value).toLocaleString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AvailabilityManager({ token, role }: { token: string; role: StaffRole }) {
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [veterinarians, setVeterinarians] = useState<ManagedAccount[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [veterinarianId, setVeterinarianId] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSlots, accounts] = await Promise.all([
        getAppointmentSlots(token),
        role === "admin" ? getManagedAccounts(token) : Promise.resolve([]),
      ]);
      setSlots(nextSlots);
      const availableVeterinarians = accounts.filter((account) => account.role === "veterinarian");
      setVeterinarians(availableVeterinarians);
      setVeterinarianId((current) => availableVeterinarians.some((account) => account.id === current) ? current : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la disponibilidad.");
    } finally {
      setLoading(false);
    }
  }, [role, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) {
      setError("Elige un inicio futuro y una hora final posterior.");
      return;
    }
    const service = services.find((entry) => entry.id === serviceId);
    if (!service) {
      setError("Selecciona el servicio para este horario.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createAppointmentSlot(token, {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        service: service.name,
        ...(role === "admin" && veterinarianId ? { veterinarianId } : {}),
      });
      setStartsAt("");
      setEndsAt("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo publicar el horario.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(slot: AppointmentSlot) {
    setError("");
    try {
      await cancelAppointmentSlot(token, slot.id);
      setSlots((current) => current.filter((entry) => entry.id !== slot.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar el horario.");
    }
  }

  const statusLabels = {
    available: "Disponible",
    reserved: "Esperando confirmación",
    booked: "Confirmada",
    cancelled: "Cancelada",
  } as const;

  return (
    <section className="space-y-5">
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-card border border-border bg-card p-4 shadow-soft sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)_auto] lg:items-end">
        <label className="block space-y-1.5 text-sm font-bold">
          <span>Desde</span>
          <input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1.5 text-sm font-bold">
          <span>Hasta</span>
          <input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1.5 text-sm font-bold">
          <span>Servicio</span>
          <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={inputClass}>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        {role === "admin" && (
          <label className="block space-y-1.5 text-sm font-bold">
            <span>Veterinario <span className="font-normal text-muted-foreground">(opcional)</span></span>
            <select value={veterinarianId} onChange={(event) => setVeterinarianId(event.target.value)} className={inputClass}>
              <option value="">Sin asignar</option>
              {veterinarians.map((vet) => (
                <option key={vet.id} value={vet.id}>{`${vet.firstname} ${vet.lastname}`.trim() || vet.email}</option>
              ))}
            </select>
          </label>
        )}
        {role === "veterinarian" && <p className="text-sm text-muted-foreground sm:self-center lg:col-span-1">El cupo se publicará a tu nombre.</p>}
        <Button type="submit" disabled={saving || loading || !services.length} className="w-full lg:w-auto">
          {saving ? <CircleNotch weight="bold" className="animate-spin" /> : <Plus weight="bold" />}
          Publicar horario
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">El veterinario es opcional: puedes publicar cupos generales por servicio y asignar al profesional después.</p>
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}

      {loading ? (
        <div className="h-28 animate-pulse rounded-card bg-muted" />
      ) : slots.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card p-8 text-center">
          <CalendarBlank weight="duotone" className="mx-auto size-9 text-accent" />
          <p className="mt-2 font-display font-black text-primary">Aún no hay horarios publicados</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => (
            <li key={slot.id} className="flex items-start justify-between gap-3 rounded-card border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="font-bold text-primary">{slot.service}</p>
                <p className="mt-1 font-semibold capitalize text-primary">{slotDate(slot.startsAt)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Hasta {new Date(slot.endsAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="mt-2 text-sm text-muted-foreground">{slot.veterinarianName || "Sin veterinario asignado"}</p>
                <span className={cn(
                  "mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                  slot.status === "available" ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground",
                )}>{statusLabels[slot.status]}</span>
              </div>
              {slot.status === "available" && (
                <button
                  type="button"
                  onClick={() => void removeSlot(slot)}
                  aria-label="Quitar horario"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash weight="bold" className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
