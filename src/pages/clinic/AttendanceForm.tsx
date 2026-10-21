import { CheckCircle, Plus } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { SlideOver } from "@/components/staff/SlideOver";
import { Button } from "@/components/ui/Button";
import {
  createClinicalRecord,
  getClinicOwners,
  parseAppointmentPet,
  savePet,
  speciesLabels,
  type ClinicOwner,
} from "@/lib/clinic";
import type { Appointment } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { FormSection, localDateTime, StaffField, staffInput, staffTextarea } from "@/pages/clinic/fields";
import { OwnerPicker } from "@/pages/clinic/OwnerPicker";
import { emptyPet, PetFields, type PetDraft } from "@/pages/clinic/PetFields";

type Props = {
  token: string;
  onClose: () => void;
  onSaved: (petId: string) => void;
  /** Cita que se está atendiendo: fija el dueño y al guardar la marca como atendida */
  appointment?: Appointment;
  /** Paciente ya elegido (desde su historial) */
  petId?: string;
  ownerId?: string;
};

const NEW_PET = "new";

export function AttendanceForm({ token, onClose, onSaved, appointment, petId, ownerId }: Props) {
  const [owners, setOwners] = useState<ClinicOwner[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState(appointment?.contactId ?? ownerId ?? "");
  const [selectedPetId, setSelectedPetId] = useState(petId ?? "");
  const [petDraft, setPetDraft] = useState<PetDraft>(() => {
    const parsed = parseAppointmentPet(appointment?.pet);
    return { ...emptyPet, name: parsed.name, species: parsed.species };
  });
  const [visit, setVisit] = useState({
    visitedAt: localDateTime(),
    reason: appointment?.service ?? "",
    weightKg: "",
    temperatureC: "",
    diagnosis: "",
    treatment: "",
    comments: "",
    nextVisit: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getClinicOwners(token)
      .then((result) => {
        if (!active) return;
        setOwners(result);
        // Si el dueño ya tiene una mascota con el nombre de la cita, se elige sola
        if (!petId && appointment) {
          const owner = result.find((item) => item.id === appointment.contactId);
          const parsed = parseAppointmentPet(appointment.pet);
          const match = owner?.pets.find((pet) => pet.name.toLowerCase() === parsed.name.toLowerCase());
          setSelectedPetId(match?.id ?? (owner?.pets.length ? "" : NEW_PET));
        }
      })
      .catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : "No se pudieron cargar los dueños."))
      .finally(() => active && setLoadingOwners(false));
    return () => { active = false; };
  }, [token, appointment, petId]);

  const owner = owners.find((item) => item.id === selectedOwnerId);
  const ownerFixed = Boolean(appointment || ownerId);

  const setField = (key: keyof typeof visit, value: string) => setVisit((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOwnerId) return setError("Elige al dueño de la mascota.");
    if (!selectedPetId) return setError("Elige la mascota atendida o registra una nueva.");
    setSaving(true);
    setError("");
    try {
      const finalPetId = selectedPetId === NEW_PET
        ? await savePet(token, { ...petDraft, ownerId: selectedOwnerId })
        : selectedPetId;
      const number = (value: string) => (value.trim() ? Number(value.replace(",", ".")) : null);
      await createClinicalRecord(token, {
        petId: finalPetId,
        appointmentId: appointment?.id,
        visitedAt: new Date(visit.visitedAt).toISOString(),
        reason: visit.reason,
        weightKg: number(visit.weightKg),
        temperatureC: number(visit.temperatureC),
        diagnosis: visit.diagnosis,
        treatment: visit.treatment,
        comments: visit.comments,
        nextVisit: visit.nextVisit,
      });
      onSaved(finalPetId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la atención.");
      setSaving(false);
    }
  }

  return (
    <SlideOver
      title="Registrar atención"
      description={appointment ? `Cita de ${appointment.owner} · ${appointment.service ?? "consulta"}` : "Agrega una atención al historial clínico."}
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {appointment ? "La cita quedará marcada como atendida." : "Quedará en el historial del paciente."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="attendance-form" size="sm" disabled={saving || loadingOwners}>
              <CheckCircle weight="bold" /> {saving ? "Guardando..." : "Guardar atención"}
            </Button>
          </div>
        </div>
      )}
    >
      <form id="attendance-form" onSubmit={handleSubmit} className="space-y-7">
        <FormSection title="Dueño">
          {loadingOwners ? (
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          ) : ownerFixed ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
              <p className="font-bold">{owner?.name ?? appointment?.owner}</p>
              <p className="text-muted-foreground">{[owner?.phone ?? appointment?.phone, owner?.email ?? appointment?.email].filter(Boolean).join(" · ")}</p>
            </div>
          ) : (
            <OwnerPicker owners={owners} value={selectedOwnerId} onChange={(id) => { setSelectedOwnerId(id); setSelectedPetId(""); }} />
          )}
        </FormSection>

        {selectedOwnerId && (
          <FormSection title="Paciente">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mascota atendida">
              {owner?.pets.map((pet) => (
                <PetChip key={pet.id} active={selectedPetId === pet.id} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name} <span className="font-normal text-muted-foreground">· {speciesLabels[pet.species]}</span>
                </PetChip>
              ))}
              <PetChip active={selectedPetId === NEW_PET} onClick={() => setSelectedPetId(NEW_PET)}>
                <Plus weight="bold" className="size-4" /> Nueva mascota
              </PetChip>
            </div>
            {selectedPetId === NEW_PET && (
              <div className="rounded-xl border border-dashed border-border p-4">
                <PetFields idPrefix="attendance-pet" value={petDraft} onChange={setPetDraft} />
              </div>
            )}
          </FormSection>
        )}

        <FormSection title="Atención">
          <div className="grid gap-4 sm:grid-cols-2">
            <StaffField label="Fecha y hora" htmlFor="visit-date">
              <input id="visit-date" type="datetime-local" required max={localDateTime()} value={visit.visitedAt} onChange={(e) => setField("visitedAt", e.target.value)} className={staffInput} />
            </StaffField>
            <StaffField label="Motivo de consulta" htmlFor="visit-reason">
              <input id="visit-reason" required maxLength={300} value={visit.reason} onChange={(e) => setField("reason", e.target.value)} placeholder="Control, vacuna, vómitos…" className={staffInput} />
            </StaffField>
            <StaffField label="Peso (kg)" htmlFor="visit-weight">
              <input id="visit-weight" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={visit.weightKg} onChange={(e) => setField("weightKg", e.target.value)} placeholder="12.5" className={staffInput} />
            </StaffField>
            <StaffField label="Temperatura (°C)" htmlFor="visit-temp">
              <input id="visit-temp" inputMode="decimal" pattern="[0-9]{2}([.,][0-9])?" value={visit.temperatureC} onChange={(e) => setField("temperatureC", e.target.value)} placeholder="38.5" className={staffInput} />
            </StaffField>
          </div>
          <StaffField label="Diagnóstico" htmlFor="visit-diagnosis">
            <textarea id="visit-diagnosis" rows={3} maxLength={3000} value={visit.diagnosis} onChange={(e) => setField("diagnosis", e.target.value)} className={staffTextarea} />
          </StaffField>
          <StaffField label="Tratamiento e indicaciones" htmlFor="visit-treatment">
            <textarea id="visit-treatment" rows={3} maxLength={3000} value={visit.treatment} onChange={(e) => setField("treatment", e.target.value)} placeholder="Medicamentos, dosis, cuidados en casa…" className={staffTextarea} />
          </StaffField>
          <StaffField label="Comentarios del veterinario" htmlFor="visit-comments">
            <textarea id="visit-comments" rows={3} maxLength={5000} value={visit.comments} onChange={(e) => setField("comments", e.target.value)} placeholder="Observaciones para el seguimiento" className={staffTextarea} />
          </StaffField>
          <StaffField label="Próxima visita" htmlFor="visit-next" hint="Opcional: control, refuerzo de vacuna, retiro de puntos…" className="sm:max-w-[50%]">
            <input id="visit-next" type="date" min={new Date().toISOString().slice(0, 10)} value={visit.nextVisit} onChange={(e) => setField("nextVisit", e.target.value)} className={staffInput} />
          </StaffField>
        </FormSection>

        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
      </form>
    </SlideOver>
  );
}

function PetChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/60",
      )}
    >
      {children}
    </button>
  );
}
