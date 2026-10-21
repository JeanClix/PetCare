-- Historia clínica: mascotas (pacientes) por dueño y registros de cada atención veterinaria.
-- Idempotente: la función admin crea lo mismo al atender su primera solicitud.
BEGIN;

CREATE TABLE IF NOT EXISTS public.petcare_pets (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.petcare_contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'otro' CHECK (species IN ('perro', 'gato', 'exotico', 'otro')),
  breed TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL DEFAULT 'desconocido' CHECK (sex IN ('macho', 'hembra', 'desconocido')),
  birth_date DATE,
  background TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petcare_clinical_records (
  id UUID PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.petcare_pets(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.petcare_leads(id) ON DELETE SET NULL,
  veterinarian_id TEXT NOT NULL,
  veterinarian_name TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  weight_kg NUMERIC(6, 2),
  temperature_c NUMERIC(4, 1),
  diagnosis TEXT NOT NULL DEFAULT '',
  treatment TEXT NOT NULL DEFAULT '',
  comments TEXT NOT NULL DEFAULT '',
  next_visit DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS petcare_pets_contact_idx ON public.petcare_pets (contact_id);
CREATE INDEX IF NOT EXISTS petcare_clinical_records_pet_idx ON public.petcare_clinical_records (pet_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS petcare_clinical_records_appointment_idx ON public.petcare_clinical_records (appointment_id);

COMMIT;
