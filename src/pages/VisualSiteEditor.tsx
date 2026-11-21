import {
  ArrowCounterClockwise,
  CheckCircle,
  CursorClick,
  DeviceMobile,
  DeviceTablet,
  FloppyDisk,
  Monitor,
  PaintBrush,
  SignOut,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { HOST_TO_PREVIEW_SOURCE, PREVIEW_TO_HOST_SOURCE, postToPreview } from "@/lib/editorPreview";
import { EDITOR_PAGES, type EditorPage } from "@/lib/editorPages";
import { fieldGroupLabel } from "@/lib/siteFieldGroups";
import {
  discardSiteDraft,
  fetchSiteDraft,
  publishSiteContent,
  saveSiteDraft,
  siteImageFields,
  siteTextFields,
  type SiteContent,
} from "@/lib/siteContent";
import { ColorField, isSafeImageSource, ProductEditorCard } from "@/pages/SiteEditor";
import { uploadSiteImage } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

type Device = "desktop" | "tablet" | "mobile";

const deviceFrame: Record<Device, string> = {
  desktop: "w-full",
  tablet: "mx-auto w-full max-w-[48rem]",
  mobile: "mx-auto w-full max-w-[24.5rem]",
};

const BRANDING_GROUP = "branding";

/** URL base del sitio público servido por esta misma app (p.ej. "/PetCare/" en producción). */
function previewBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function VisualSiteEditor({ token, onExit }: { token: string; onExit: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "draft-saved" | "published" | "discarded">("idle");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [pageId, setPageId] = useState<string>(EDITOR_PAGES[0].id);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const page = useMemo<EditorPage>(() => EDITOR_PAGES.find((item) => item.id === pageId) ?? EDITOR_PAGES[0], [pageId]);
  const changed = useMemo(() => draft && savedSnapshot ? JSON.stringify(draft) !== JSON.stringify(savedSnapshot) : false, [draft, savedSnapshot]);

  // Carga inicial: el borrador en edición (o lo publicado, si todavía no hay borrador propio).
  useEffect(() => {
    let active = true;
    fetchSiteDraft(token)
      .then(({ content }) => {
        if (!active) return;
        setDraft(content);
        setSavedSnapshot(content);
      })
      .catch((cause: unknown) => active && setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar el borrador del sitio."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  // Puente con el iframe de previsualización: espera "ready" y reenvía el contenido cada vez que cambia.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; group?: string } | undefined;
      if (data?.source !== PREVIEW_TO_HOST_SOURCE) return;
      if (data.type === "ready") {
        setPreviewReady(true);
      } else if (data.type === "select" && data.group) {
        setSelectedGroup(data.group);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (previewReady && draft && iframeRef.current) {
      postToPreview(iframeRef.current, { source: HOST_TO_PREVIEW_SOURCE, type: "content", content: draft });
    }
  }, [previewReady, draft]);

  // Cambiar de página navega el iframe ya cargado (misma app, mismo origen) sin recargar
  // ni repetir el protocolo ready/content: el contenido en memoria del iframe no cambia.
  const navigateIframe = useCallback((route: string) => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.location.hash = `#${route}`;
    }
  }, []);

  function selectPage(next: EditorPage) {
    setPageId(next.id);
    setSelectedGroup(next.sections[0]?.group ?? null);
    if (next.route) navigateIframe(next.route);
  }

  function updateText(key: string, value: string) {
    setDraft((current) => current && ({ ...current, texts: { ...current.texts, [key]: value } }));
    setStatus("idle");
  }

  function updateImage(key: string, value: string) {
    setDraft((current) => current && ({ ...current, images: { ...current.images, [key]: value } }));
    setStatus("idle");
  }

  function updateColor(key: "primary" | "accent", value: string) {
    setDraft((current) => current && ({ ...current, colors: { ...current.colors, [key]: value } }));
    setStatus("idle");
  }

  function updateProduct(id: number, patch: Partial<SiteContent["products"][number]>) {
    setDraft((current) => current && ({
      ...current,
      products: current.products.map((product) => product.id === id ? { ...product, ...patch } : product),
    }));
    setStatus("idle");
  }

  async function handleUpload(key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Usa una imagen JPG, PNG o WebP.");
    if (file.size > 5 * 1024 * 1024) return setError("La imagen debe pesar 5 MB o menos.");
    setError("");
    setUploadingImage(key);
    try {
      updateImage(key, await uploadSiteImage(token, file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir la imagen.");
    } finally {
      setUploadingImage("");
    }
  }

  async function handleProductUpload(id: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Usa una imagen JPG, PNG o WebP.");
    if (file.size > 5 * 1024 * 1024) return setError("La imagen debe pesar 5 MB o menos.");
    setError("");
    const key = `product-${id}`;
    setUploadingImage(key);
    try {
      updateProduct(id, { image: await uploadSiteImage(token, file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir la imagen.");
    } finally {
      setUploadingImage("");
    }
  }

  async function handleSaveDraft() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveSiteDraft(token, draft);
      setDraft(saved);
      setSavedSnapshot(saved);
      setStatus("draft-saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el borrador.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!draft) return;
    if (!window.confirm("¿Publicar estos cambios? Se verán de inmediato en el sitio público.")) return;
    setPublishing(true);
    setError("");
    try {
      const published = await publishSiteContent(token, draft);
      setDraft(published);
      setSavedSnapshot(published);
      setStatus("published");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron publicar los cambios.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDiscard() {
    if (!window.confirm("¿Descartar el borrador? Se perderán los cambios sin publicar y volverás a ver lo publicado.")) return;
    setDiscarding(true);
    setError("");
    try {
      const published = await discardSiteDraft(token);
      setDraft(published);
      setSavedSnapshot(published);
      setStatus("discarded");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descartar el borrador.");
    } finally {
      setDiscarding(false);
    }
  }

  const busy = saving || publishing || discarding || uploadingImage !== "";
  const disabled = loading || !!loadError || busy;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5 sm:px-5">
        <Button variant="ghost" size="sm" onClick={onExit} className="shrink-0">
          <SignOut weight="bold" /> Salir
        </Button>
        <div className="mr-auto flex items-center gap-2 text-accent">
          <PaintBrush weight="duotone" className="size-5" />
          <span className="font-display text-sm font-black text-primary">Editor visual</span>
          {changed && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">Sin publicar</span>}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          <DeviceButton active={device === "desktop"} label="Escritorio" onClick={() => setDevice("desktop")}><Monitor weight="bold" className="size-4" /></DeviceButton>
          <DeviceButton active={device === "tablet"} label="Tablet" onClick={() => setDevice("tablet")}><DeviceTablet weight="bold" className="size-4" /></DeviceButton>
          <DeviceButton active={device === "mobile"} label="Móvil" onClick={() => setDevice("mobile")}><DeviceMobile weight="bold" className="size-4" /></DeviceButton>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" disabled={disabled || !changed} onClick={() => void handleDiscard()}>
            <ArrowCounterClockwise weight="bold" /> Descartar
          </Button>
          <Button variant="outline" size="sm" disabled={disabled || !changed} onClick={() => void handleSaveDraft()}>
            <FloppyDisk weight="bold" /> {saving ? "Guardando..." : "Guardar borrador"}
          </Button>
          <Button size="sm" disabled={disabled} onClick={() => void handlePublish()}>
            <CheckCircle weight="bold" /> {publishing ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </header>

      {(error || loadError || status !== "idle") && (
        <div className="border-b border-border px-4 py-2 sm:px-5">
          {loadError && <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-danger"><WarningCircle weight="bold" /> {loadError}</p>}
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          {!error && !loadError && status === "draft-saved" && <p role="status" className="text-sm font-semibold text-accent">Borrador guardado. El sitio público no cambia hasta que publiques.</p>}
          {!error && !loadError && status === "published" && <p role="status" className="text-sm font-semibold text-accent">Cambios publicados: ya se ven en el sitio público.</p>}
          {!error && !loadError && status === "discarded" && <p role="status" className="text-sm font-semibold text-muted-foreground">Borrador descartado: se restableció lo publicado.</p>}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card py-3 lg:block">
          <button
            type="button"
            onClick={() => setSelectedGroup(BRANDING_GROUP)}
            className={cn(
              "mx-2 mb-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors",
              selectedGroup === BRANDING_GROUP ? "bg-accent-soft text-accent" : "text-foreground hover:bg-muted",
            )}
          >
            <PaintBrush weight="bold" className="size-4" /> Colores de marca
          </button>
          <div className="border-t border-border" />
          {EDITOR_PAGES.map((item) => (
            <div key={item.id} className="py-1">
              <button
                type="button"
                onClick={() => selectPage(item)}
                className={cn(
                  "mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors",
                  pageId === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
                {!item.route && <span className="text-[0.65rem] font-normal text-muted-foreground">sin vista previa</span>}
              </button>
              {pageId === item.id && (
                <ul className="mt-1 space-y-0.5 pl-5">
                  {item.sections.map((s) => (
                    <li key={s.group}>
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(s.group)}
                        className={cn(
                          "w-full rounded-md px-2.5 py-1.5 text-left text-[0.82rem] transition-colors",
                          selectedGroup === s.group ? "bg-accent-soft font-bold text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-muted/40 p-3 sm:p-6">
          {loading ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Cargando el editor…</div>
          ) : page.route ? (
            <div className={cn("h-full rounded-xl border border-border bg-card shadow-soft transition-all", deviceFrame[device])}>
              <div className="flex items-center gap-2 border-b border-border bg-sky/40 px-3 py-1.5 text-[0.72rem] text-muted-foreground">
                <CursorClick weight="bold" className="size-3.5" /> Haz clic en cualquier sección de la vista previa para editarla
              </div>
              <iframe
                ref={iframeRef}
                title="Vista previa del sitio"
                src={`${previewBaseUrl()}?editorPreview=1#${page.route}`}
                className="h-[calc(100%-1.9rem)] w-full rounded-b-xl bg-white"
                onLoad={() => setPreviewReady(false)}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              <p className="font-bold text-foreground">{page.label} no tiene vista previa en vivo aquí.</p>
              <p className="mt-1">
                {page.id === "appointments" && "Esta página requiere una sesión de cliente para reservar una cita, así que no se puede abrir dentro del editor. "}
                {page.id === "account" && "Esta página cambia según si hay una sesión de cliente iniciada, así que no se puede abrir dentro del editor. "}
                {page.id === "notFound" && "Esta página solo se ve al visitar un enlace roto, así que no se puede abrir dentro del editor. "}
                Edita sus textos desde el panel de la derecha.
              </p>
            </div>
          )}
        </main>

        <aside className="w-full max-w-sm shrink-0 overflow-y-auto border-l border-border bg-card p-4 lg:w-96">
          {!draft ? null : selectedGroup === BRANDING_GROUP ? (
            <div className="space-y-4">
              <h3 className="font-display text-base font-black text-primary">Colores de marca</h3>
              <p className="text-sm text-muted-foreground">Se aplican en todo el sitio público.</p>
              <ColorField label="Color principal" value={draft.colors.primary} disabled={disabled} onChange={(value) => updateColor("primary", value)} />
              <ColorField label="Color de acento" value={draft.colors.accent} disabled={disabled} onChange={(value) => updateColor("accent", value)} />
            </div>
          ) : selectedGroup === "shop.products" ? (
            <ProductsPanel
              products={draft.products}
              search={productSearch}
              onSearch={setProductSearch}
              selectedId={selectedProductId}
              onSelect={setSelectedProductId}
              disabled={disabled}
              uploadingImage={uploadingImage}
              onChange={updateProduct}
              onUpload={handleProductUpload}
            />
          ) : selectedGroup && !page.route ? (
            <FallbackPageFields
              page={page}
              draft={draft}
              disabled={disabled}
              uploadingImage={uploadingImage}
              onText={updateText}
              onImage={updateImage}
              onUpload={handleUpload}
            />
          ) : selectedGroup ? (
            <GroupFieldsPanel
              group={selectedGroup}
              label={page.sections.find((s) => s.group === selectedGroup)?.label ?? fieldGroupLabel(`${selectedGroup}.x`)}
              draft={draft}
              disabled={disabled}
              uploadingImage={uploadingImage}
              onText={updateText}
              onImage={updateImage}
              onUpload={handleUpload}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Selecciona una sección en la vista previa o en el panel izquierdo para editarla.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function groupOf(key: string) {
  const segments = key.split(".");
  for (let length = 2; length >= 1; length -= 1) {
    const prefix = segments.slice(0, length).join(".");
    if (prefix in GROUP_PREFIXES) return prefix;
  }
  return "other";
}

// Mismos prefijos que FIELD_GROUP_LABELS, usados aquí solo para resolver el prefijo exacto
// (y no apenas su etiqueta, que puede repetirse entre varios prefijos, p.ej. "brand" y "home.brands").
const GROUP_PREFIXES: Record<string, true> = {
  "home.hero": true, "home.highlights": true, "home.services": true, "home.travel": true,
  "home.products": true, "home.brands": true, brand: true, "home.testimonials": true, testimonial: true,
  "home.visit": true, "about.page": true, "about.intro": true, "about.values": true, "about.value": true,
  "services.page": true, "services.travel": true, service: true, "shop.page": true, "contact.page": true,
  "contact.form": true, "appointments.page": true, "account.page": true, "account.login": true,
  "account.register": true, "account.email": true, "account.username": true, "account.password": true,
  notFound: true, "global.nav": true, global: true,
};

function GroupFieldsPanel({
  group, label, draft, disabled, uploadingImage, onText, onImage, onUpload,
}: {
  group: string; label: string; draft: SiteContent; disabled: boolean; uploadingImage: string;
  onText: (key: string, value: string) => void;
  onImage: (key: string, value: string) => void;
  onUpload: (key: string, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const texts = siteTextFields.filter((field) => groupOf(field.key) === group);
  const images = siteImageFields.filter((field) => groupOf(field.key) === group);
  if (texts.length === 0 && images.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Esta sección no tiene campos editables todavía.</p>;
  }
  return (
    <div className="space-y-5">
      <h3 className="font-display text-base font-black text-primary">{label}</h3>
      {texts.map((field) => (
        <label key={field.key} className="grid gap-1.5 text-sm font-bold text-foreground">
          {field.label}
          <textarea
            rows={draft.texts[field.key]?.length > 100 ? 4 : 2}
            maxLength={3000}
            disabled={disabled}
            value={draft.texts[field.key] ?? ""}
            onChange={(event) => onText(field.key, event.target.value)}
            className="min-h-12 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-normal focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
      ))}
      {images.map((field) => {
        const source = draft.images[field.key] ?? "";
        return (
          <div key={field.key} className="space-y-2 rounded-xl border border-border p-3">
            <label className="grid gap-1.5 text-sm font-bold text-foreground">
              {field.label}
              <input
                type="url"
                value={source}
                disabled={disabled}
                onChange={(event) => onImage(field.key, event.target.value)}
                placeholder="https://..."
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:border-accent">
              <UploadSimple weight="bold" className="size-3.5" />
              {uploadingImage === field.key ? "Subiendo..." : "Subir imagen"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled || uploadingImage !== ""} onChange={(event) => onUpload(field.key, event)} />
            </label>
            {isSafeImageSource(source) && <img src={source} alt={`Vista previa: ${field.label}`} className="h-28 w-full rounded-lg bg-muted object-cover" />}
          </div>
        );
      })}
    </div>
  );
}

function FallbackPageFields({
  page, draft, disabled, uploadingImage, onText, onImage, onUpload,
}: {
  page: EditorPage; draft: SiteContent; disabled: boolean; uploadingImage: string;
  onText: (key: string, value: string) => void;
  onImage: (key: string, value: string) => void;
  onUpload: (key: string, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-6">
      {page.sections.map((section) => (
        <GroupFieldsPanel
          key={section.group}
          group={section.group}
          label={section.label}
          draft={draft}
          disabled={disabled}
          uploadingImage={uploadingImage}
          onText={onText}
          onImage={onImage}
          onUpload={onUpload}
        />
      ))}
    </div>
  );
}

function ProductsPanel({
  products, search, onSearch, selectedId, onSelect, disabled, uploadingImage, onChange, onUpload,
}: {
  products: SiteContent["products"];
  search: string;
  onSearch: (value: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  disabled: boolean;
  uploadingImage: string;
  onChange: (id: number, patch: Partial<SiteContent["products"][number]>) => void;
  onUpload: (id: number, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const visible = products.filter((product) => `${product.name} ${product.subcategory}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = visible.find((product) => product.id === selectedId) ?? visible[0];
  return (
    <div className="space-y-3">
      <h3 className="font-display text-base font-black text-primary">Catálogo de productos</h3>
      <input
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Buscar producto"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <select
        value={selected?.id ?? ""}
        disabled={disabled || visible.length === 0}
        onChange={(event) => onSelect(Number(event.target.value))}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"
      >
        {visible.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
      {selected ? (
        <ProductEditorCard
          product={selected}
          disabled={disabled}
          uploading={uploadingImage === `product-${selected.id}`}
          uploadingImage={uploadingImage !== ""}
          onChange={(patch) => onChange(selected.id, patch)}
          onUpload={(event) => onUpload(selected.id, event)}
        />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay productos con ese nombre.</p>
      )}
    </div>
  );
}

function DeviceButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-full transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
