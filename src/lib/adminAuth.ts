const configuredAdminApiUrl = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)?.trim().replace(/\/+$/, "");
const adminApiUrl = configuredAdminApiUrl || (import.meta.env.DEV ? "/api/admin" : undefined);

export type AccountSession = {
  token: string;
  expiresIn: number;
  role: "admin" | "customer" | "veterinarian";
  email: string;
  firstname: string;
  lastname: string;
  phone: string;
};

export type ManagedAccount = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: "customer" | "veterinarian";
  createdAt: string;
};

type AuthResponse = Partial<AccountSession> & { error?: string; authenticated?: boolean };

export async function adminRequest<T = { error?: string }>(path: string, body: unknown, token?: string): Promise<T> {
  if (!adminApiUrl) throw new Error("La autenticación administrativa aún no está configurada.");

  let response: Response;
  try {
    response = await fetch(`${adminApiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No se pudo conectar con el servicio de autenticación.");
  }

  const result = await response.json().catch(() => null) as AuthResponse | null;
  if (!response.ok) throw new Error(result?.error ?? "No se pudo validar la sesión.");
  if (!result) throw new Error("El servicio devolvió una respuesta inválida.");
  return result as T;
}

export function isAdminAuthConfigured() {
  return Boolean(adminApiUrl);
}

export const isDevelopmentAdminAuth = import.meta.env.DEV && !configuredAdminApiUrl;

function parseAccountSession(result: Partial<AccountSession>, email: string): AccountSession {
  if (!result.token || !result.expiresIn) throw new Error("El servicio devolvió una sesión inválida.");
  const role = result.role ?? (isDevelopmentAdminAuth ? "admin" : undefined);
  if (role !== "admin" && role !== "customer" && role !== "veterinarian") throw new Error("El servicio devolvió un tipo de cuenta inválido.");
  return {
    token: result.token,
    expiresIn: result.expiresIn,
    role,
    email: result.email ?? email.trim().toLowerCase(),
    firstname: result.firstname ?? (role === "admin" ? "Administrador" : ""),
    lastname: result.lastname ?? "",
    phone: result.phone ?? "",
  };
}

export async function loginAccount(email: string, password: string): Promise<AccountSession> {
  const result = await adminRequest<Partial<AccountSession>>("/login", { email, password });
  return parseAccountSession(result, email);
}

export async function registerAccount(name: string, email: string, password: string): Promise<AccountSession> {
  const result = await adminRequest<Partial<AccountSession>>("/register", { name, email, password });
  return parseAccountSession(result, email);
}

export async function createCustomerOrder(
  token: string,
  order: { phone: string; total: number; items: string[]; consent: true; marketingConsent: boolean },
) {
  return adminRequest<{ ok: true }>("/account/order", order, token);
}

export async function verifyAccountSession(token: string, email: string) {
  const result = await adminRequest<Partial<AccountSession> & { authenticated?: boolean }>("/verify", {}, token);
  if (!result.authenticated) throw new Error("La sesión venció. Inicia sesión nuevamente.");
  const role = result.role ?? (isDevelopmentAdminAuth ? "admin" : undefined);
  if (role !== "admin" && role !== "customer" && role !== "veterinarian") throw new Error("El servicio devolvió un tipo de cuenta inválido.");
  return {
    role,
    email: result.email ?? email,
    firstname: result.firstname ?? (role === "admin" ? "Administrador" : ""),
    lastname: result.lastname ?? "",
    phone: result.phone ?? "",
  };
}

export function getManagedAccounts(token: string) {
  return adminRequest<{ users: ManagedAccount[] }>("/crm/users", {}, token);
}

export function setManagedAccountRole(token: string, id: string, role: ManagedAccount["role"]) {
  return adminRequest<{ ok: true }>("/crm/user-role", { id, role }, token);
}
