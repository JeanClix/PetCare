import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  defaultSiteContent,
  fetchSiteContent,
  mergeSiteContent,
  saveSiteContent,
  type SiteContent,
} from "@/lib/siteContent";
import { HOST_TO_PREVIEW_SOURCE, isEditorPreview, postToHost } from "@/lib/editorPreview";

type SiteContentContextValue = {
  content: SiteContent;
  loading: boolean;
  loadError: string;
  text: (key: string) => string;
  image: (key: string) => string;
  reload: () => void;
  publish: (token: string, value: SiteContent) => Promise<void>;
};

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const preview = isEditorPreview();
  const [content, setContent] = useState(defaultSiteContent);
  // En modo previsualización del editor no hay nada que cargar de la red: el contenido
  // llega por postMessage desde el editor (admin), así que no mostramos un estado de carga.
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    void fetchSiteContent().then((next) => {
      if (active) setContent(next);
    }).catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar el contenido del sitio.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadVersion, preview]);

  // Modo previsualización: avisamos al editor que estamos listos para recibir el contenido
  // en edición, y nos quedamos escuchando cada actualización que nos empuje (sin red).
  useEffect(() => {
    if (!preview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; content?: SiteContent } | undefined;
      if (data?.source !== HOST_TO_PREVIEW_SOURCE || data.type !== "content" || !data.content) return;
      setContent(mergeSiteContent(data.content));
      setLoading(false);
    };
    window.addEventListener("message", onMessage);
    postToHost({ source: "petcare-editor-preview", type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [preview]);

  useEffect(() => {
    const root = document.documentElement;
    const applyBrandColors = () => {
      // Un color inline pisa cualquier regla CSS, incluida la paleta de .dark:
      // si lo dejáramos fijo, el modo oscuro se quedaría con textos oscuros
      // sobre fondo oscuro. En oscuro dejamos que la hoja de estilos mande.
      if (root.classList.contains("dark")) {
        root.style.removeProperty("--color-primary");
        root.style.removeProperty("--color-accent");
      } else {
        root.style.setProperty("--color-primary", content.colors.primary);
        root.style.setProperty("--color-accent", content.colors.accent);
      }
    };
    applyBrandColors();
    const observer = new MutationObserver(applyBrandColors);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [content.colors]);

  const publish = useCallback(async (token: string, value: SiteContent) => {
    const saved = await saveSiteContent(token, value);
    setContent(saved);
    setLoadError("");
  }, []);

  const value = useMemo<SiteContentContextValue>(() => ({
    content,
    loading,
    loadError,
    text: (key) => content.texts[key] ?? key,
    image: (key) => content.images[key] ?? "",
    reload: () => setLoadVersion((version) => version + 1),
    publish,
  }), [content, loading, loadError, publish]);

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  const context = useContext(SiteContentContext);
  if (!context) throw new Error("useSiteContent debe usarse dentro de SiteContentProvider.");
  return context;
}
