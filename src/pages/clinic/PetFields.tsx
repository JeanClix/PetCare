import { sexLabels, speciesLabels, type PetInput, type PetSex, type PetSpecies } from "@/lib/clinic";
import { StaffField, staffInput, staffTextarea } from "@/pages/clinic/fields";

export type PetDraft = Omit<PetInput, "id" | "ownerId">;

export const emptyPet: PetDraft = { name: "", species: "perro", breed: "", sex: "desconocido", birthDate: "", background: "" };

export function PetFields({ value, onChange, idPrefix }: { value: PetDraft; onChange: (next: PetDraft) => void; idPrefix: string }) {
  const set = <Key extends keyof PetDraft>(key: Key, next: PetDraft[Key]) => onChange({ ...value, [key]: next });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StaffField label="Nombre" htmlFor={`${idPrefix}-name`}>
        <input id={`${idPrefix}-name`} required maxLength={80} value={value.name} onChange={(e) => set("name", e.target.value)} className={staffInput} />
      </StaffField>
      <StaffField label="Especie" htmlFor={`${idPrefix}-species`}>
        <select id={`${idPrefix}-species`} value={value.species} onChange={(e) => set("species", e.target.value as PetSpecies)} className={staffInput}>
          {Object.entries(speciesLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </StaffField>
      <StaffField label="Raza" htmlFor={`${idPrefix}-breed`}>
        <input id={`${idPrefix}-breed`} maxLength={80} value={value.breed} onChange={(e) => set("breed", e.target.value)} placeholder="Mestizo" className={staffInput} />
      </StaffField>
      <StaffField label="Sexo" htmlFor={`${idPrefix}-sex`}>
        <select id={`${idPrefix}-sex`} value={value.sex} onChange={(e) => set("sex", e.target.value as PetSex)} className={staffInput}>
          {Object.entries(sexLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </StaffField>
      <StaffField label="Fecha de nacimiento" htmlFor={`${idPrefix}-birth`} hint="Aproximada si no se conoce">
        <input id={`${idPrefix}-birth`} type="date" max={today} value={value.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={staffInput} />
      </StaffField>
      <StaffField label="Antecedentes y alergias" htmlFor={`${idPrefix}-background`} className="sm:col-span-2">
        <textarea
          id={`${idPrefix}-background`}
          rows={3}
          maxLength={3000}
          value={value.background}
          onChange={(e) => set("background", e.target.value)}
          placeholder="Alergias, enfermedades crónicas, vacunas, esterilización…"
          className={staffTextarea}
        />
      </StaffField>
    </div>
  );
}
