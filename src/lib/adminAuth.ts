const configuredAdminApiUrl = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)?.trim().replace(/\/+$/, "");
const adminApiUrl = configuredAdminApiUrl || (import.meta.env.DEV ? "/api/admin" : undefined);

export type AdminSession = { token: string; expiresIn: number };

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

  const result = await response.json().catch(() => null) as { error?: string; token?: string; expiresIn?: number; authenticated?: boolean } | null;
  if (!response.ok) throw new Error(result?.error ?? "No se pudo validar la sesión.");
  return result as T;
}

export function isAdminAuthConfigured() {
  return Boolean(adminApiUrl);
}

export const isDevelopmentAdminAuth = import.meta.env.DEV && !configuredAdminApiUrl;

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  const result = await adminRequest<AdminSession>("/login", { email, password });
  if (!result?.token || !result.expiresIn) throw new Error("El servicio devolvió una sesión inválida.");
  return { token: result.token, expiresIn: result.expiresIn };
}

export async function verifyAdminSession(token: string) {
  const result = await adminRequest<{ authenticated?: boolean }>("/verify", {}, token);
  return result?.authenticated === true;
}
