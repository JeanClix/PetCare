import { useEffect, useState } from "react";
import { NotePencil, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import {
  accountRoles,
  getManagedAccounts,
  roleLabels,
  setManagedAccountRole,
  updateManagedAccount,
  type AccountRole,
  type ManagedAccount,
} from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

type AccountDraft = { firstname: string; lastname: string; email: string; phone: string };

const roleDescriptions: Record<AccountRole, string> = {
  customer: "Compra en la tienda y gestiona su cuenta.",
  admin: "Acceso completo al panel, incluidas cuentas y roles.",
  veterinarian: "Ve y actualiza las citas de los clientes.",
  sales: "Pedidos, contactos, mensajes y email marketing.",
};

export function AdminAccounts({ token, currentEmail }: { token: string; currentEmail: string }) {
  const [roleFilter, setRoleFilter] = useState<AccountRole | "all">("all");
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ManagedAccount["role"]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AccountDraft | null>(null);
  const [editError, setEditError] = useState("");

  async function loadAccounts() {
    setLoading(true);
    setError("");
    try {
      const result = await getManagedAccounts(token);
      setAccounts(result);
      setDrafts(Object.fromEntries(result.map((account) => [account.id, account.role])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las cuentas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [token]);

  async function saveRole(account: ManagedAccount) {
    const role = drafts[account.id] ?? account.role;
    if (role === account.role) return;
    if (role === "admin" && !window.confirm(`¿Dar acceso completo de administrador a ${account.email}?`)) return;
    setSavingId(account.id);
    setError("");
    setMessage("");
    try {
      await setManagedAccountRole(token, account.id, role);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, role } : item));
      setMessage(`Se actualizó el rol de ${account.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el rol.");
    } finally {
      setSavingId(null);
    }
  }

  function startEditing(account: ManagedAccount) {
    setEditingId(account.id);
    setEditError("");
    setEditDraft({ firstname: account.firstname, lastname: account.lastname, email: account.email, phone: account.phone });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDraft(null);
    setEditError("");
  }

  async function saveEdit(account: ManagedAccount) {
    if (!editDraft) return;
    if (!editDraft.firstname.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(editDraft.email.trim())) {
      setEditError("Completa el nombre y un correo válido.");
      return;
    }
    setSavingId(account.id);
    setEditError("");
    try {
      const patch = {
        firstname: editDraft.firstname.trim(),
        lastname: editDraft.lastname.trim(),
        email: editDraft.email.trim().toLowerCase(),
        phone: editDraft.phone.trim(),
      };
      await updateManagedAccount(token, account.id, patch);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, ...patch } : item));
      setMessage(`Se actualizaron los datos de ${patch.email}.`);
      cancelEditing();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios.");
    } finally {
      setSavingId(null);
    }
  }

  const visibleAccounts = accounts.filter((account) => roleFilter === "all" || account.role === roleFilter);

  return (
    <section className="space-y-5" aria-label="Cuentas y roles">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {accountRoles.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={roleFilter === option}
            onClick={() => setRoleFilter((current) => (current === option ? "all" : option))}
            className={cn(
              "rounded-card border bg-card p-4 text-left transition-colors",
              roleFilter === option ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/60",
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-display font-black text-primary">{roleLabels[option]}</span>
              <span className="font-display text-2xl font-black text-primary tabular-nums">
                {loading ? "–" : accounts.filter((account) => account.role === option).length}
              </span>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{roleDescriptions[option]}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        El registro público siempre crea cuentas de cliente. Desde aquí asignas los roles internos; los cambios cierran la sesión activa de esa cuenta.
      </p>
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{message}</p>}
      {loading ? (
        <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground">
          Cargando cuentas...
        </div>
      ) : visibleAccounts.length === 0 ? (
        <div className="rounded-media border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          {accounts.length === 0 ? "Todavía no hay cuentas registradas." : "No hay cuentas con este rol."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-media border border-border bg-card shadow-soft">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Cuenta</th>
                <th scope="col" className="px-4 py-3">Registro</th>
                <th scope="col" className="px-4 py-3">Rol</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Guardar rol</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleAccounts.map((account) => {
                const role = drafts[account.id] ?? account.role;
                const isSelf = account.email === currentEmail;
                const isEditing = editingId === account.id;
                if (isEditing && editDraft) {
                  return (
                    <tr key={account.id} className="bg-accent-soft/40">
                      <td className="px-4 py-4" colSpan={4}>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="grid gap-1 text-xs font-bold text-muted-foreground">Nombre
                            <input
                              value={editDraft.firstname}
                              onChange={(event) => setEditDraft((current) => current && { ...current, firstname: event.target.value })}
                              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-muted-foreground">Apellido
                            <input
                              value={editDraft.lastname}
                              onChange={(event) => setEditDraft((current) => current && { ...current, lastname: event.target.value })}
                              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-muted-foreground">Correo
                            <input
                              type="email"
                              value={editDraft.email}
                              onChange={(event) => setEditDraft((current) => current && { ...current, email: event.target.value })}
                              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-muted-foreground">Teléfono
                            <input
                              value={editDraft.phone}
                              onChange={(event) => setEditDraft((current) => current && { ...current, phone: event.target.value })}
                              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground"
                            />
                          </label>
                        </div>
                        {editError && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{editError}</p>}
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" disabled={savingId === account.id} onClick={() => void saveEdit(account)}>
                            {savingId === account.id ? "Guardando..." : "Guardar datos"}
                          </Button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-muted"
                          >
                            <X weight="bold" className="size-4" /> Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={account.id}>
                    <td className="px-4 py-4">
                      <p className="font-bold">{`${account.firstname} ${account.lastname}`.trim()}</p>
                      <p className="text-muted-foreground">{account.email}</p>
                      {account.phone && <p className="text-xs text-muted-foreground">{account.phone}</p>}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {new Date(account.createdAt).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-4">
                      <label className="sr-only" htmlFor={`account-role-${account.id}`}>Rol de {account.email}</label>
                      <select
                        id={`account-role-${account.id}`}
                        value={role}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [account.id]: event.target.value as ManagedAccount["role"],
                        }))}
                        disabled={isSelf}
                        title={isSelf ? "No puedes cambiar el rol de tu propia cuenta" : undefined}
                        className="h-10 rounded-xl border border-border bg-background px-3 disabled:opacity-60"
                      >
                        {accountRoles.map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(account)}
                          aria-label={`Editar datos de ${account.email}`}
                          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent"
                        >
                          <NotePencil weight="bold" className="size-4" />
                        </button>
                        <Button
                          size="sm"
                          disabled={role === account.role || savingId !== null}
                          onClick={() => void saveRole(account)}
                        >
                          {savingId === account.id ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
