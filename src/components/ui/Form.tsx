import type { ReactNode } from "react";
import { business } from "@/data/site";
import { hubspot, marketingText } from "@/lib/hubspot";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-[0.95rem] placeholder:text-muted-foreground/80 transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-danger";

export type ContactErrors = Partial<Record<"firstname" | "lastname" | "email" | "phone" | "consent", string>>;

/** Validación común de los datos del dueño (cita y pedido) */
export function validateContact(data: FormData): ContactErrors {
  const errors: ContactErrors = {};
  const text = (k: string) => String(data.get(k) ?? "").trim();
  if (text("firstname").length < 2) errors.firstname = "Escribe tu nombre.";
  if (text("lastname").length < 2) errors.lastname = "Escribe tu apellido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text("email"))) errors.email = "Revisa el correo, por ejemplo carla@gmail.com.";
  if (!/^(9\d{8}|0?1\d{7})$/.test(text("phone").replace(/\D/g, "")))
    errors.phone = "Usa un celular de 9 dígitos (987 654 321) o un fijo de Lima.";
  if (!data.get("consent")) errors.consent = "Necesitamos tu autorización para atender la solicitud.";
  return errors;
}

export function Field({
  label,
  name,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={name} className="block text-sm font-bold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Props de accesibilidad para un input con posible error */
export function errorProps(name: string, error?: string) {
  return { id: name, name, "aria-invalid": !!error, "aria-describedby": error ? `${name}-error` : undefined };
}

export function OwnerFields({ errors, compact = false }: { errors: ContactErrors; compact?: boolean }) {
  return (
    <div className={cn("grid gap-5", !compact && "sm:grid-cols-2")}>
      <Field label="Nombre" name="firstname" error={errors.firstname}>
        <input {...errorProps("firstname", errors.firstname)} autoComplete="given-name" placeholder="Carla" className={inputClass} />
      </Field>
      <Field label="Apellido" name="lastname" error={errors.lastname}>
        <input {...errorProps("lastname", errors.lastname)} autoComplete="family-name" placeholder="Mendoza" className={inputClass} />
      </Field>
      <Field label="Correo" name="email" error={errors.email}>
        <input {...errorProps("email", errors.email)} type="email" autoComplete="email" placeholder="carla@gmail.com" className={inputClass} />
      </Field>
      <Field label="Celular" name="phone" error={errors.phone}>
        <input
          {...errorProps("phone", errors.phone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="987 654 321"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

export function ConsentFields({ error }: { error?: string }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="consent"
            aria-invalid={!!error}
            aria-describedby={error ? "consent-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          {/* Mismo texto que consentText, que es el que queda registrado en HubSpot */}
          <span className="text-muted-foreground">
            Autorizo a Gabus Vet S.A.C. a tratar mis datos personales para gestionar mi solicitud, conforme a la Ley
            N.° 29733 y su{" "}
            <a href={business.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-2">
              política de privacidad
            </a>
            .
          </span>
        </label>
        {error && (
          <p id="consent-error" className="mt-1.5 pl-8 font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
      {hubspot.marketingSubscriptionId && (
        <label className="flex gap-3">
          <input type="checkbox" name="marketing" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
          <span className="text-muted-foreground">{marketingText}</span>
        </label>
      )}
    </div>
  );
}
