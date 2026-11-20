import { CheckCircle, FloppyDisk, ImageSquare, MagnifyingGlass, PaintBrush, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useSiteContent } from "@/context/SiteContentContext";
import { defaultSiteContent, siteImageFields, siteTextFields, type SiteContent } from "@/lib/siteContent";
import { uploadSiteImage } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";
import type { Product } from "@/data/products";

const sections = ["Inicio", "Servicios", "Tienda", "Nosotros", "Contacto", "Citas", "Cuenta", "Otros", "Información pública"];

function isSafeImageSource(source: string) {
  try {
    const url = new URL(source, window.location.origin);
    return url.protocol === "https:" || (
      url.origin === window.location.origin &&
      (source.startsWith("/") || source.startsWith("./")) &&
      !source.startsWith("//")
    );
  } catch {
    return false;
  }
}

export function SiteEditor({ token }: { token: string }) {
  const { content, loading, loadError, reload, publish } = useSiteContent();
  const [draft, setDraft] = useState<SiteContent>(content);
  const [section, setSection] = useState(sections[0]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const changed = useMemo(() => JSON.stringify(content) !== JSON.stringify(draft), [content, draft]);
  const textFields = siteTextFields.filter((field) => field.section === section);
  const imageFields = siteImageFields.filter((field) => field.section === section);
  const visibleProducts = draft.products.filter((product) =>
    `${product.name} ${product.subcategory}`.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );
  const selectedProduct = visibleProducts.find((product) => product.id === selectedProductId) ?? visibleProducts[0];

  useEffect(() => setDraft(content), [content]);

  function updateText(key: string, value: string) {
    setDraft((current) => ({ ...current, texts: { ...current.texts, [key]: value } }));
    setSaved(false);
  }

  function updateImage(key: string, value: string) {
    setDraft((current) => ({ ...current, images: { ...current.images, [key]: value } }));
    setSaved(false);
  }

  function updateColor(key: "primary" | "accent", value: string) {
    setDraft((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
    setSaved(false);
  }

  function updateProduct(id: number, patch: Partial<Product>) {
    setDraft((current) => ({
      ...current,
      products: current.products.map((product) => product.id === id ? { ...product, ...patch } : product),
    }));
    setSaved(false);
  }

  async function handleProductUpload(id: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Usa una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen debe pesar 5 MB o menos.");
      return;
    }
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

  async function handleUpload(key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Usa una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen debe pesar 5 MB o menos.");
      return;
    }
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

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await publish(token, draft);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    setDraft(structuredClone(defaultSiteContent));
    setSaved(false);
    setError("");
  }

  return (
    <section className="space-y-6" aria-labelledby="site-editor-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-accent">
            <PaintBrush weight="duotone" className="size-6" />
            <span className="text-sm font-bold uppercase tracking-wide">Editor visual</span>
          </div>
          <h2 id="site-editor-heading" className="mt-1 font-display text-2xl font-black text-primary">Personaliza tu sitio</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Edita textos, fotos y colores del sitio público. Los cambios publicados se comparten con todos tus visitantes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={saving || uploadingImage !== "" || !changed} onClick={resetDraft}>Restablecer</Button>
          <Button disabled={saving || uploadingImage !== "" || loading || !!loadError || !changed} onClick={() => void handleSave()}>
            <FloppyDisk weight="bold" /> {saving ? "Publicando..." : "Publicar cambios"}
          </Button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <span className="flex items-start gap-2"><WarningCircle weight="bold" className="mt-0.5 shrink-0" /> No se pudo cargar la última versión publicada: {loadError}</span>
          <Button variant="outline" size="sm" onClick={reload}>Reintentar</Button>
        </div>
      )}
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      {saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"><CheckCircle weight="fill" /> Cambios publicados correctamente.</p>}
      {changed && <p className="text-sm font-semibold text-amber-700">Tienes cambios sin publicar.</p>}

      <nav className="flex gap-2 overflow-x-auto border-b border-border pb-2" aria-label="Páginas del sitio">
        {sections.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={section === item}
            onClick={() => setSection(item)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors",
              section === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </nav>

      {section === "Información pública" && (
        <section className="grid gap-4 rounded-media border border-border bg-card p-5 shadow-soft sm:grid-cols-2" aria-label="Colores del sitio">
          <ColorField label="Color principal" value={draft.colors.primary} disabled={loading || !!loadError} onChange={(value) => updateColor("primary", value)} />
          <ColorField label="Color de acento" value={draft.colors.accent} disabled={loading || !!loadError} onChange={(value) => updateColor("accent", value)} />
        </section>
      )}

      {textFields.length > 0 && (
        <section className="grid gap-4 rounded-media border border-border bg-card p-5 shadow-soft md:grid-cols-2" aria-label={`Textos de ${section}`}>
          {textFields.map((field) => (
            <label key={field.key} className="grid gap-1.5 text-sm font-bold text-foreground">
              {field.label}
              <textarea
                rows={draft.texts[field.key].length > 100 ? 3 : 2}
                maxLength={3000}
                disabled={loading || !!loadError}
                value={draft.texts[field.key]}
                onChange={(event) => updateText(field.key, event.target.value)}
                className="min-h-12 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-normal focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>
          ))}
        </section>
      )}

      {imageFields.length > 0 && (
        <section className="grid gap-4 rounded-media border border-border bg-card p-5 shadow-soft md:grid-cols-2" aria-label={`Imágenes de ${section}`}>
          {imageFields.map((field) => {
            const source = draft.images[field.key];
            return (
              <div key={field.key} className="space-y-3 rounded-xl border border-border p-4">
                <label className="grid gap-1.5 text-sm font-bold text-foreground">
                  <span className="flex items-center gap-2"><ImageSquare weight="duotone" className="size-5 text-accent" />{field.label}</span>
                  <input
                    type="url"
                    value={source}
                    disabled={loading || !!loadError}
                    onChange={(event) => updateImage(field.key, event.target.value)}
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 font-normal focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-bold hover:border-accent">
                  {uploadingImage === field.key ? "Subiendo imagen..." : "Subir imagen"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={loading || !!loadError || uploadingImage !== ""} onChange={(event) => void handleUpload(field.key, event)} />
                </label>
                {isSafeImageSource(source) && <img src={source} alt={`Vista previa: ${field.label}`} className="h-36 w-full rounded-xl bg-muted object-cover" />}
              </div>
            );
          })}
        </section>
      )}

      {section === "Tienda" && (
        <section className="space-y-4 rounded-media border border-border bg-card p-5 shadow-soft" aria-label="Catálogo de productos">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-black text-primary">Catálogo de productos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Edita el nombre, precio, descripción e imagen de cada producto. Los cambios también se reflejan en el carrito.</p>
            </div>
            <label className="relative min-w-52">
              <span className="sr-only">Buscar producto</span>
              <MagnifyingGlass weight="bold" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar producto" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </label>
          </div>
          <label className="grid max-w-xl gap-1 text-xs font-bold text-muted-foreground">Producto
            <select
              value={selectedProduct?.id ?? ""}
              disabled={loading || !!loadError || visibleProducts.length === 0}
              onChange={(event) => setSelectedProductId(Number(event.target.value))}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"
            >
              {visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          {selectedProduct ? (
            <ProductEditorCard
              product={selectedProduct}
              disabled={loading || !!loadError}
              uploading={uploadingImage === `product-${selectedProduct.id}`}
              uploadingImage={uploadingImage !== ""}
              onChange={(patch) => updateProduct(selectedProduct.id, patch)}
              onUpload={(event) => void handleProductUpload(selectedProduct.id, event)}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay productos con ese nombre.</p>
          )}
        </section>
      )}
    </section>
  );
}

function ProductEditorCard({
  product,
  disabled,
  uploading,
  uploadingImage,
  onChange,
  onUpload,
}: {
  product: Product;
  disabled: boolean;
  uploading: boolean;
  uploadingImage: boolean;
  onChange: (patch: Partial<Product>) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <article className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[10rem_1fr]">
      <div className="space-y-2">
        <img src={isSafeImageSource(product.image) ? product.image : undefined} alt="" className="aspect-square w-full rounded-xl bg-muted object-contain p-2" />
        <label className={cn("block rounded-full border border-border px-3 py-2 text-center text-xs font-bold hover:border-accent", (disabled || uploadingImage) ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
          {uploading ? "Subiendo..." : "Cambiar imagen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled || uploadingImage} onChange={onUpload} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-muted-foreground sm:col-span-2">Nombre
          <input value={product.name} maxLength={300} disabled={disabled} onChange={(event) => onChange({ name: event.target.value })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">Categoría / variante
          <input value={product.subcategory} maxLength={200} disabled={disabled} onChange={(event) => onChange({ subcategory: event.target.value })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">Precio (S/)
          <input type="number" min="0" step="0.01" value={product.price} disabled={disabled} onChange={(event) => {
            const price = Number(event.target.value);
            if (!Number.isFinite(price) || price < 0) return;
            onChange({ price, priceMax: product.priceMax !== null && product.priceMax < price ? price : product.priceMax });
          }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground sm:col-span-2">Precio máximo, si aplica (S/)
          <input type="number" min={product.price} step="0.01" value={product.priceMax ?? ""} disabled={disabled} onChange={(event) => onChange({ priceMax: event.target.value ? Number(event.target.value) : null })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground sm:col-span-2">Descripción
          <textarea rows={3} maxLength={5000} value={product.description} disabled={disabled} onChange={(event) => onChange({ description: event.target.value })} className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
        </label>
      </div>
    </article>
  );
}

function ColorField({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm font-bold">
      {label}
      <span className="flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} disabled={disabled} className="size-10 cursor-pointer rounded-lg border-0 bg-transparent" />
        <span className="font-mono text-xs font-normal text-muted-foreground">{value.toUpperCase()}</span>
      </span>
    </label>
  );
}
