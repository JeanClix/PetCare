import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  defaultSiteContent,
  fetchSiteContent,
  saveSiteContent,
  type SiteContent,
} from "@/lib/siteContent";

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
  const [content, setContent] = useState(defaultSiteContent);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
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
  }, [loadVersion]);

  useEffect(() => {
    document.documentElement.style.setProperty("--color-primary", content.colors.primary);
    document.documentElement.style.setProperty("--color-accent", content.colors.accent);
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
