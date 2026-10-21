import { adminRequest } from "@/lib/adminAuth";

export type PetSpecies = "perro" | "gato" | "exotico" | "otro";
export type PetSex = "macho" | "hembra" | "desconocido";

export const speciesLabels: Record<PetSpecies, string> = {
  perro: "Perro",
  gato: "Gato",
  exotico: "Exótico",
  otro: "Otro",
};

export const sexLabels: Record<PetSex, string> = {
  macho: "Macho",
  hembra: "Hembra",
  desconocido: "Sin dato",
};

export type ClinicOwner = {
  id: string;
  name: string;
  email: string;
  phone: string;
  pets: Array<{ id: string; name: string; species: PetSpecies }>;
};

export type PatientSummary = {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string;
  sex: PetSex;
  birthDate: string | null;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  recordCount: number;
  lastVisitAt: string | null;
  nextVisit: string | null;
};

export type PatientDetail = {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string;
  sex: PetSex;
  birthDate: string | null;
  background: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
};

export type ClinicalRecord = {
  id: string;
  appointmentId: string | null;
  appointmentService: string | null;
  veterinarianName: string;
  visitedAt: string;
  reason: string;
  weightKg: number | null;
  temperatureC: number | null;
  diagnosis: string;
  treatment: string;
  comments: string;
  nextVisit: string | null;
};

export type PetInput = {
  id?: string;
  ownerId?: string;
  name: string;
  species: PetSpecies;
  breed: string;
  sex: PetSex;
  birthDate: string;
  background: string;
};

export type ClinicalRecordInput = {
  petId: string;
  appointmentId?: string;
  visitedAt: string;
  reason: string;
  weightKg: number | null;
  temperatureC: number | null;
  diagnosis: string;
  treatment: string;
  comments: string;
  nextVisit: string;
};

// Postgres devuelve DATE como texto o fecha completa; el panel solo usa AAAA-MM-DD
const dateOnly = (value: string | null) => (value ? String(value).slice(0, 10) : null);
const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export async function getClinicOwners(token: string) {
  const result = await adminRequest<{ owners: ClinicOwner[] }>("/crm/clinic-owners", {}, token);
  return result.owners;
}

export async function getPatients(token: string): Promise<PatientSummary[]> {
  const result = await adminRequest<{ patients: PatientSummary[] }>("/crm/patients", {}, token);
  return result.patients.map((patient) => ({
    ...patient,
    birthDate: dateOnly(patient.birthDate),
    nextVisit: dateOnly(patient.nextVisit),
  }));
}

export async function getPatient(token: string, id: string) {
  const result = await adminRequest<{ patient: PatientDetail; records: ClinicalRecord[] }>("/crm/patient", { id }, token);
  return {
    patient: { ...result.patient, birthDate: dateOnly(result.patient.birthDate) },
    records: result.records.map((record) => ({
      ...record,
      weightKg: toNumber(record.weightKg),
      temperatureC: toNumber(record.temperatureC),
      nextVisit: dateOnly(record.nextVisit),
    })),
  };
}

export async function savePet(token: string, pet: PetInput) {
  const result = await adminRequest<{ id: string }>("/crm/pet-save", pet, token);
  return result.id;
}

export async function createClinicalRecord(token: string, record: ClinicalRecordInput) {
  const result = await adminRequest<{ id: string }>("/crm/clinical-record", record, token);
  return result.id;
}

/** Edad legible a partir de la fecha de nacimiento (AAAA-MM-DD) */
export function petAge(birthDate: string | null) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

/** Intenta separar "Toby (Perro)" en nombre y especie, como lo guarda el formulario de citas */
export function parseAppointmentPet(pet: string | undefined): { name: string; species: PetSpecies } {
  const match = pet?.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const name = (match?.[1] ?? pet ?? "").trim();
  const kind = (match?.[2] ?? "").toLowerCase();
  const species: PetSpecies = kind.startsWith("perro") ? "perro" : kind.startsWith("gato") ? "gato" : kind.startsWith("ex") ? "exotico" : "otro";
  return { name: name === "sin nombre" ? "" : name, species };
}
