-- Roles de cuenta: cliente, administrador, veterinario y ventas.
-- Idempotente: puede repetirse aunque la función admin ya haya aplicado el cambio.
BEGIN;

ALTER TABLE public.petcare_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE public.petcare_users
  DROP CONSTRAINT IF EXISTS petcare_users_role_check;

ALTER TABLE public.petcare_users
  ADD CONSTRAINT petcare_users_role_check
  CHECK (role IN ('customer', 'admin', 'veterinarian', 'sales'));

COMMIT;
