BEGIN;

CREATE TABLE IF NOT EXISTS public.petcare_appointment_slots (
  id UUID PRIMARY KEY,
  veterinarian_id UUID NOT NULL REFERENCES public.petcare_users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'booked', 'cancelled')),
  created_by_id UUID REFERENCES public.petcare_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

ALTER TABLE public.petcare_leads
  ADD COLUMN IF NOT EXISTS appointment_slot_id UUID
    REFERENCES public.petcare_appointment_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_price NUMERIC(10, 2);

CREATE UNIQUE INDEX IF NOT EXISTS petcare_leads_appointment_slot_idx
  ON public.petcare_leads (appointment_slot_id)
  WHERE appointment_slot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS petcare_appointment_slots_status_start_idx
  ON public.petcare_appointment_slots (status, starts_at);

COMMIT;
