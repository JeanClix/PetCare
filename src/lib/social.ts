import { adminRequest } from "@/lib/adminAuth";

export type SocialChannel = {
  id: string;
  name: string;
  platform: string;
  picture: string | null;
  disabled: boolean;
};

export type SocialPostState = "DRAFT" | "QUEUE" | "PUBLISHED" | "ERROR";

export type SocialPost = {
  id: string;
  content: string;
  state: SocialPostState;
  publishDate: string | null;
  error: string | null;
  channel: { id: string; name: string; platform: string; picture: string | null } | null;
};

export type SocialAttachment = { id: string; path: string };

const adminApiUrl = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "") || (import.meta.env.DEV ? "/api/admin" : "");

export function getSocialChannels(token: string) {
  return adminRequest<{ configured: boolean; channels: SocialChannel[] }>("/crm/social-channels", {}, token);
}

export function getSocialPosts(token: string, range: { startDate: string; endDate: string }) {
  return adminRequest<{ posts: SocialPost[] }>("/crm/social-posts-list", range, token);
}

export function createSocialPost(
  token: string,
  input: { content: string; channelIds: string[]; type: "draft" | "schedule" | "now"; date?: string; attachments?: SocialAttachment[] },
) {
  return adminRequest<{ ok: true }>("/crm/social-post-create", input, token);
}

export function setSocialPostStatus(token: string, input: { id: string; status: "draft" | "schedule" }) {
  return adminRequest<{ ok: true }>("/crm/social-post-status", input, token);
}

export function deleteSocialPost(token: string, input: { id: string }) {
  return adminRequest<{ ok: true }>("/crm/social-post-delete", input, token);
}

export async function uploadSocialAttachment(token: string, file: File): Promise<SocialAttachment> {
  if (!adminApiUrl) throw new Error("La función administrativa aún no está configurada.");
  let response: Response;
  try {
    response = await fetch(`${adminApiUrl}/crm/social-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type,
      },
      body: file,
    });
  } catch {
    throw new Error("No se pudo conectar con el servicio administrativo.");
  }
  const result = await response.json().catch(() => null) as { id?: string; path?: string; error?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? "No se pudo subir el archivo.");
  if (!result?.id || !result.path) throw new Error("El servicio devolvió una respuesta inválida.");
  return { id: result.id, path: result.path };
}
