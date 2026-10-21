import { FloppyDisk } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { SlideOver } from "@/components/staff/SlideOver";
import { Button } from "@/components/ui/Button";
import { getClinicOwners, savePet, type ClinicOwner, type PatientDetail } from "@/lib/clinic";
import { FormSection } from "@/pages/clinic/fields";
import { OwnerPicker } from "@/pages/clinic/OwnerPicker";
import { emptyPet, PetFields, type PetDraft } from "@/pages/clinic/PetFields";

/** Alta de un paciente nuevo o edición de sus datos generales */
export function PetForm({
  token,
  patient,
  onClose,
  onSaved,
}: {
  token: string;
  patient?: PatientDetail;
  onClose: () => void;
  onSaved: (petId: string) => void;
}) {
  const [draft, setDraft] = useState<PetDraft>(() => patient
    ? {
        name: patient.name,
        species: patient.species,
        breed: patient.breed,
        sex: patient.sex,
        birthDate: patient.birthDate ?? "",
        background: patient.background,
      }
    : emptyPet);
  const [owners, setOwners] = useState<ClinicOwner[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (patient) return;
    getClinicOwners(token)
      .then(setOwners)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar los dueños."));
  }, [token, patient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patient && !ownerId) return setError("Elige al dueño de la mascota.");
    setSaving(true);
    setError("");
    try {
      const id = await savePet(token, patient ? { ...draft, id: patient.id } : { ...draft, ownerId });
      onSaved(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el paciente.");
      setSaving(false);
    }
  }

  return (
    <SlideOver
      title={patient ? `Editar a ${patient.name}` : "Nuevo paciente"}
      description={patient ? `Dueño: ${patient.ownerName}` : "Registra una mascota para empezar su historial clínico."}
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="pet-form" size="sm" disabled={saving}>
            <FloppyDisk weight="bold" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      )}
    >
      <form id="pet-form" onSubmit={handleSubmit} className="space-y-7">
        {!patient && (
          <FormSection title="Dueño">
            <OwnerPicker owners={owners} value={ownerId} onChange={setOwnerId} />
          </FormSection>
        )}
        <FormSection title="Mascota">
          <PetFields idPrefix="pet-form" value={draft} onChange={setDraft} />
        </FormSection>
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
      </form>
    </SlideOver>
  );
}
