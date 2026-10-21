import { useMemo, useState } from "react";
import type { ClinicOwner } from "@/lib/clinic";
import { staffInput } from "@/pages/clinic/fields";

/** Buscador de dueños (contactos del CRM) para registrar mascotas sin una cita previa */
export function OwnerPicker({ owners, value, onChange }: { owners: ClinicOwner[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return owners
      .filter((item) => !normalized || [item.name, item.email, item.phone].some((field) => field?.toLowerCase().includes(normalized)))
      .slice(0, 50);
  }, [owners, query]);

  if (owners.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay contactos. Los dueños se crean cuando solicitan una cita o se registran en la web.</p>;
  }
  return (
    <div className="space-y-2">
      <input
        type="search"
        aria-label="Buscar dueño"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre, correo o celular"
        className={staffInput}
      />
      <select
        aria-label="Dueño"
        required
        size={Math.min(6, Math.max(2, filtered.length))}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-background p-1 text-sm focus:border-accent focus:outline-none"
      >
        {filtered.map((item) => (
          <option key={item.id} value={item.id} className="rounded px-2 py-1.5">
            {item.name} — {item.phone || item.email}
          </option>
        ))}
      </select>
    </div>
  );
}
