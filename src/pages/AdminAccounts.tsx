import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getManagedAccounts,
  setManagedAccountRole,
  type ManagedAccount,
} from "@/lib/adminAuth";

export function AdminAccounts({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ManagedAccount["role"]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  return (
    <section className="space-y-5" aria-labelledby="account-roles-heading">
      <div>
        <h2 id="account-roles-heading" className="font-display text-2xl font-black text-primary">Cuentas y roles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo el administrador puede otorgar o retirar el rol veterinario. El registro público siempre crea cuentas de cliente.
        </p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{message}</p>}
      {loading ? (
        <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground">
          Cargando cuentas...
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-media border border-border bg-card px-6 py-12 text-center text-muted-foreground">
          Todavía no hay cuentas registradas.
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
              {accounts.map((account) => {
                const role = drafts[account.id] ?? account.role;
                return (
                  <tr key={account.id}>
                    <td className="px-4 py-4">
                      <p className="font-bold">{`${account.firstname} ${account.lastname}`.trim()}</p>
                      <p className="text-muted-foreground">{account.email}</p>
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
                        className="h-10 rounded-xl border border-border bg-background px-3"
                      >
                        <option value="customer">Cliente</option>
                        <option value="veterinarian">Veterinario</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        size="sm"
                        disabled={role === account.role || savingId !== null}
                        onClick={() => void saveRole(account)}
                      >
                        {savingId === account.id ? "Guardando..." : "Guardar"}
                      </Button>
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
