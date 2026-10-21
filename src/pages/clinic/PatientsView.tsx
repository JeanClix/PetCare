import {
  ArrowLeft,
  CalendarPlus,
  Cat,
  Dog,
  FirstAidKit,
  MagnifyingGlass,
  PawPrint,
  PencilSimple,
  Phone,
  Plus,
  Stethoscope,
  Thermometer,
  Scales,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getPatient,
  getPatients,
  petAge,
  sexLabels,
  speciesLabels,
  type ClinicalRecord,
  type PatientDetail,
  type PatientSummary,
  type PetSpecies,
} from "@/lib/clinic";
import { cn } from "@/lib/utils";
import { AttendanceForm } from "@/pages/clinic/AttendanceForm";
import { formatDay, staffInput } from "@/pages/clinic/fields";
import { PetForm } from "@/pages/clinic/PetForm";
import { WhatsappComposer } from "@/components/staff/WhatsappComposer";

function SpeciesIcon({ species, className }: { species: PetSpecies; className?: string }) {
  const Icon = species === "perro" ? Dog : species === "gato" ? Cat : PawPrint;
  return <Icon weight="duotone" className={className} />;
}

export function PatientsView({
  token,
  selectedId,
  onSelect,
}: {
  token: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    getPatients(token)
      .then((result) => active && setPatients(result))
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "No se pudieron cargar los pacientes."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, version]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return patients.filter((patient) => !normalized || [patient.name, patient.ownerName, patient.breed, patient.ownerPhone]
      .some((value) => value?.toLowerCase().includes(normalized)));
  }, [patients, query]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section aria-label="Lista de pacientes" className={cn("space-y-3", selectedId && "hidden xl:block")}>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar paciente</span>
            <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mascota, dueño o raza"
              className={cn(staffInput, "pl-9")}
            />
          </label>
          <Button size="sm" className="h-10" onClick={() => setCreating(true)}>
            <Plus weight="bold" /> Nuevo
          </Button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((index) => <div key={index} className="h-[4.5rem] animate-pulse rounded-card bg-muted" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card px-5 py-10 text-center">
            <Stethoscope weight="duotone" className="mx-auto size-9 text-accent" />
            <p className="mt-2 font-display font-black text-primary">{patients.length ? "Sin resultados" : "Aún no hay pacientes"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {patients.length ? "Prueba con otro nombre." : "Se crean al registrar la atención de una cita o con “Nuevo”."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => onSelect(patient.id)}
                  aria-current={selectedId === patient.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-card border bg-card p-3 text-left transition-colors",
                    selectedId === patient.id ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/60",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <SpeciesIcon species={patient.species} className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display font-black text-primary">{patient.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {patient.ownerName} · {patient.recordCount} {patient.recordCount === 1 ? "atención" : "atenciones"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {patient.nextVisit ? (
                      <span className="font-bold text-accent">Control {formatDay(patient.nextVisit)}</span>
                    ) : patient.lastVisitAt ? formatDay(patient.lastVisitAt) : "Sin visitas"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedId ? (
        <PatientRecord
          key={`${selectedId}-${version}`}
          token={token}
          id={selectedId}
          onBack={() => onSelect(null)}
          onChanged={() => setVersion((value) => value + 1)}
        />
      ) : (
        <div className="hidden min-h-80 place-items-center rounded-media border border-dashed border-border bg-card p-10 text-center xl:grid">
          <div>
            <FirstAidKit weight="duotone" className="mx-auto size-10 text-accent" />
            <p className="mt-3 font-display text-lg font-black text-primary">Elige un paciente</p>
            <p className="mt-1 text-sm text-muted-foreground">Verás sus datos, antecedentes y todas sus atenciones.</p>
          </div>
        </div>
      )}

      {creating && (
        <PetForm
          token={token}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            setVersion((value) => value + 1);
            onSelect(id);
          }}
        />
      )}
    </div>
  );
}

function PatientRecord({ token, id, onBack, onChanged }: { token: string; id: string; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ patient: PatientDetail; records: ClinicalRecord[] } | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"attendance" | "edit" | "whatsapp" | null>(null);

  useEffect(() => {
    let active = true;
    getPatient(token, id)
      .then((result) => active && setData(result))
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial."));
    return () => { active = false; };
  }, [token, id]);

  if (error) return <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>;
  if (!data) return <div className="h-96 animate-pulse rounded-media bg-muted" />;

  const { patient, records } = data;
  const age = petAge(patient.birthDate);
  const lastWeight = records.find((record) => record.weightKg !== null)?.weightKg;
  const nextVisit = records.map((record) => record.nextVisit).filter((value): value is string => Boolean(value) && value! >= new Date().toISOString().slice(0, 10)).sort()[0];

  return (
    <section aria-label={`Historial de ${patient.name}`} className="min-w-0 space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-accent xl:hidden">
        <ArrowLeft weight="bold" /> Todos los pacientes
      </button>

      <div className="rounded-media border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <SpeciesIcon species={patient.species} className="size-8" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-black tracking-tight text-primary">{patient.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[speciesLabels[patient.species], patient.breed, patient.sex !== "desconocido" && sexLabels[patient.sex], age].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPanel("edit")}>
              <PencilSimple weight="bold" /> Editar
            </Button>
            <Button size="sm" onClick={() => setPanel("attendance")}>
              <CalendarPlus weight="bold" /> Registrar atención
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-bold text-muted-foreground">Dueño</dt>
            <dd className="mt-0.5 font-bold">{patient.ownerName}</dd>
            <dd className="text-muted-foreground">
              {patient.ownerPhone ? (
                <a href={`tel:${patient.ownerPhone}`} className="inline-flex items-center gap-1 hover:text-accent"><Phone className="size-3.5" />{patient.ownerPhone}</a>
              ) : patient.ownerEmail}
            </dd>
            {patient.ownerPhone && (
              <dd className="mt-1">
                <button type="button" onClick={() => setPanel("whatsapp")} className="inline-flex items-center gap-1 text-sm font-bold text-[#128C4B] hover:underline">
                  <WhatsappLogo weight="fill" className="size-4" /> Escribir por WhatsApp
                </button>
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground">Último peso</dt>
            <dd className="mt-0.5 font-display text-xl font-black text-primary tabular-nums">{lastWeight != null ? `${lastWeight} kg` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground">Próxima visita</dt>
            <dd className={cn("mt-0.5 font-display text-xl font-black tabular-nums", nextVisit ? "text-accent" : "text-primary")}>
              {nextVisit ? formatDay(nextVisit) : "—"}
            </dd>
          </div>
        </dl>

        {patient.background && (
          <div className="mt-5 rounded-xl bg-[#fff6e5] px-4 py-3 text-sm text-[#7a4b00] dark:bg-[#3a2a0a] dark:text-[#f5cf8a]">
            <p className="text-xs font-bold tracking-wide uppercase">Antecedentes y alergias</p>
            <p className="mt-1 whitespace-pre-wrap">{patient.background}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 font-display text-lg font-black text-primary">
          Historial clínico <span className="text-muted-foreground">({records.length})</span>
        </h3>
        {records.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay atenciones registradas para {patient.name}.
          </div>
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[0.6rem] before:w-px before:bg-border">
            {records.map((record) => <RecordItem key={record.id} record={record} />)}
          </ol>
        )}
      </div>

      {panel === "attendance" && (
        <AttendanceForm
          token={token}
          petId={patient.id}
          ownerId={patient.ownerId}
          onClose={() => setPanel(null)}
          onSaved={() => { setPanel(null); onChanged(); }}
        />
      )}
      {panel === "whatsapp" && (
        <WhatsappComposer
          token={token}
          contactId={patient.ownerId}
          phone={patient.ownerPhone}
          context={{ name: patient.ownerName, pet: patient.name, nextVisit }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "edit" && (
        <PetForm
          token={token}
          patient={patient}
          onClose={() => setPanel(null)}
          onSaved={() => { setPanel(null); onChanged(); }}
        />
      )}
    </section>
  );
}

function RecordItem({ record }: { record: ClinicalRecord }) {
  const visited = new Date(record.visitedAt);
  return (
    <li className="relative pl-8">
      <span aria-hidden="true" className="absolute top-1.5 left-0 grid size-5 place-items-center rounded-full border-2 border-accent bg-card">
        <span className="size-1.5 rounded-full bg-accent" />
      </span>
      <article className="rounded-card border border-border bg-card p-4 sm:p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h4 className="font-display text-base font-black text-primary">{record.reason}</h4>
          <p className="text-xs text-muted-foreground tabular-nums">
            {visited.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            {visited.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })} · {record.veterinarianName}
          </p>
        </header>
        {(record.weightKg !== null || record.temperatureC !== null || record.appointmentService) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
            {record.weightKg !== null && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 tabular-nums"><Scales className="size-3.5" />{record.weightKg} kg</span>}
            {record.temperatureC !== null && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 tabular-nums"><Thermometer className="size-3.5" />{record.temperatureC} °C</span>}
            {record.appointmentService && <span className="rounded-md bg-accent-soft px-2 py-1 text-accent">Cita: {record.appointmentService}</span>}
          </div>
        )}
        <dl className="mt-3 space-y-2.5 text-sm">
          {record.diagnosis && <RecordText label="Diagnóstico" value={record.diagnosis} />}
          {record.treatment && <RecordText label="Tratamiento" value={record.treatment} />}
          {record.comments && <RecordText label="Comentarios" value={record.comments} />}
        </dl>
        {record.nextVisit && (
          <p className="mt-3 border-t border-border pt-3 text-sm">
            <span className="font-bold text-accent">Próxima visita:</span> {formatDay(record.nextVisit)}
          </p>
        )}
      </article>
    </li>
  );
}

function RecordText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
