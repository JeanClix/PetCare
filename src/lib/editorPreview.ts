// Puente entre el editor visual (admin) y la página pública, cuando esta se carga
// dentro del iframe de previsualización del editor (`?editorPreview=1`). Mismo origen,
// así que basta con postMessage; no hace falta autenticar al iframe.
//
// Protocolo:
//   iframe -> parent  { source: "petcare-editor-preview", type: "ready" }
//   iframe -> parent  { source: "petcare-editor-preview", type: "select", group: string }
//   parent -> iframe  { source: "petcare-editor-host", type: "content", content: SiteContent }

export const EDITOR_PREVIEW_PARAM = "editorPreview";
export const PREVIEW_TO_HOST_SOURCE = "petcare-editor-preview";
export const HOST_TO_PREVIEW_SOURCE = "petcare-editor-host";

export function isEditorPreview() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get(EDITOR_PREVIEW_PARAM) === "1";
  } catch {
    return false;
  }
}

export type PreviewToHostMessage =
  | { source: typeof PREVIEW_TO_HOST_SOURCE; type: "ready" }
  | { source: typeof PREVIEW_TO_HOST_SOURCE; type: "select"; group: string };

export type HostToPreviewMessage<T> =
  | { source: typeof HOST_TO_PREVIEW_SOURCE; type: "content"; content: T };

export function postToHost(message: PreviewToHostMessage) {
  window.parent.postMessage(message, window.location.origin);
}

export function postToPreview<T>(frame: HTMLIFrameElement, message: HostToPreviewMessage<T>) {
  frame.contentWindow?.postMessage(message, window.location.origin);
}
