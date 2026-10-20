BEGIN;

ALTER TABLE public.petcare_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

UPDATE public.petcare_users
SET role = 'customer'
WHERE role IS NULL;

ALTER TABLE public.petcare_users
  ALTER COLUMN role SET DEFAULT 'customer',
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.petcare_users
  DROP CONSTRAINT IF EXISTS petcare_users_role_check;

ALTER TABLE public.petcare_users
  ADD CONSTRAINT petcare_users_role_check
  CHECK (role IN ('customer', 'veterinarian'));

COMMIT;
