/*
 * Cliente del asistente con RAG (functions/asistente, desplegado en Neon Functions).
 * La URL es pública; la clave de Groq vive solo en la función.
 */
export const assistantUrl = (import.meta.env.VITE_ASSISTANT_URL as string | undefined)?.trim() || undefined;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export interface AssistantReply {
  respuesta: string;
  productos: number[];
  servicio: string | null;
  urgente: boolean;
}

export async function askAssistant(messages: ChatTurn[]): Promise<AssistantReply> {
  const res = await fetch(assistantUrl!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error ?? "El asistente no está disponible ahora.");
  return data as AssistantReply;
}
