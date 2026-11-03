import { adminRequest } from "@/lib/adminAuth";

export type SocialPlatform = "facebook" | "instagram";

export type SocialPage = {
  id: string;
  name: string;
  instagramId: string | null;
  instagramUsername: string | null;
};

export type SocialPost = {
  id: string;
  platform: SocialPlatform;
  caption: string;
  mediaId: string;
  providerId: string | null;
  status: "published" | "failed";
  error: string;
  createdAt: string;
};

export type SocialMediaStatus = {
  configured: boolean;
  connected: boolean;
  page: SocialPage | null;
  pendingPages: SocialPage[];
  history: SocialPost[];
};

const adminApiUrl = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "") || (import.meta.env.DEV ? "/api/admin" : "");

export function socialMediaUrl(mediaId: string) {
  return `${adminApiUrl}/social-media/${encodeURIComponent(mediaId)}`;
}

export function getSocialMediaStatus(token: string, state?: string) {
  return adminRequest<SocialMediaStatus>(
    "/crm/social-status",
    state ? { state } : {},
    token,
  );
}

export function startSocialConnection(token: string) {
  return adminRequest<{ authorizationUrl: string }>("/crm/social-connect", {}, token);
}

export function selectSocialPage(token: string, state: string, pageId: string) {
  return adminRequest<{ ok: true }>("/crm/social-select", { state, pageId }, token);
}

export function disconnectSocialAccounts(token: string) {
  return adminRequest<{ ok: true }>("/crm/social-disconnect", {}, token);
}

export async function uploadSocialImage(token: string, image: File) {
  if (!adminApiUrl) throw new Error("La función administrativa aún no está configurada.");
  let response: Response;
  try {
    response = await fetch(`${adminApiUrl}/crm/social-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": image.type,
      },
      body: image,
    });
  } catch {
    throw new Error("No se pudo conectar con el servicio administrativo.");
  }
  const result = await response.json().catch(() => null) as { mediaId?: string; error?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? "No se pudo guardar la imagen.");
  if (!result?.mediaId) throw new Error("El servicio devolvió una respuesta inválida.");
  return result.mediaId;
}

export function publishSocialPost(
  token: string,
  input: { caption: string; mediaId: string; platforms: SocialPlatform[] },
) {
  return adminRequest<{ results: SocialPost[] }>("/crm/social-publish", input, token);
}
