import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  FacebookLogo,
  InstagramLogo,
  LinkBreak,
  PaperPlaneTilt,
  ShareNetwork,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import {
  disconnectSocialAccounts,
  getSocialMediaStatus,
  publishSocialPost,
  selectSocialPage,
  socialMediaUrl,
  startSocialConnection,
  uploadSocialImage,
  type SocialMediaStatus,
  type SocialPlatform,
} from "@/lib/social";
import { cn } from "@/lib/utils";

const platformLabels: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

export function SocialMediaManager({ token, oauthState }: { token: string; oauthState: string }) {
  const [status, setStatus] = useState<SocialMediaStatus | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(["facebook"]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [pageId, setPageId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getSocialMediaStatus(token, oauthState || undefined));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar la conexión con Meta.");
    }
  }, [oauthState, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }
    const preview = URL.createObjectURL(image);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [image]);

  useEffect(() => {
    if (!oauthState || !status?.pendingPages.length) return;
    setPageId((current) => current || status.pendingPages[0].id);
  }, [oauthState, status?.pendingPages]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    if (params.get("social") === "connected") {
      setNotice("Autorización completada. Elige la página de Facebook de Gabus Vet para terminar de conectar las cuentas.");
    } else if (params.get("social") === "error") {
      setError("Meta no pudo completar la conexión. Verifica los permisos y vuelve a intentarlo.");
    }
  }, [oauthState]);

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && file.type !== "image/jpeg") {
      setError("Meta requiere una imagen JPEG para publicar en Instagram.");
      event.target.value = "";
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError("La imagen debe pesar 5 MB o menos.");
      event.target.value = "";
      return;
    }
    setError("");
    setImage(file);
  }

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const { authorizationUrl } = await startSocialConnection(token);
      window.location.assign(authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar la conexión.");
      setBusy(false);
    }
  }

  async function choosePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!oauthState || !pageId) return;
    setBusy(true);
    setError("");
    try {
      await selectSocialPage(token, oauthState, pageId);
      setNotice("Cuentas conectadas correctamente.");
      window.location.hash = "/admin?view=social";
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la página seleccionada.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("¿Desconectar las cuentas de Facebook e Instagram de este panel?")) return;
    setBusy(true);
    setError("");
    try {
      await disconnectSocialAccounts(token);
      setNotice("Las cuentas se desconectaron de PetCare.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron desconectar las cuentas.");
    } finally {
      setBusy(false);
    }
  }

  function togglePlatform(platform: SocialPlatform) {
    setSelectedPlatforms((current) =>
      current.includes(platform) ? current.filter((entry) => entry !== platform) : [...current, platform],
    );
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image || !caption.trim() || selectedPlatforms.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const mediaId = await uploadSocialImage(token, image);
      const result = await publishSocialPost(token, {
        caption: caption.trim(),
        mediaId,
        platforms: selectedPlatforms,
      });
      const published = result.results.filter((entry) => entry.status === "published").length;
      const failed = result.results.length - published;
      if (failed) {
        setError(`${published} publicación(es) realizadas; ${failed} no se pudieron publicar. Revisa el historial para ver el detalle.`);
      } else {
        setNotice("Publicación enviada correctamente.");
        setCaption("");
        setImage(null);
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo publicar el contenido.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return error
      ? <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>
      : <div className="h-64 animate-pulse rounded-media bg-muted" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-media border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
            <ShareNetwork weight="fill" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-black text-primary">Cuentas de Gabus Vet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecta la página de Facebook y su cuenta profesional de Instagram vinculada. PetCare usará la API oficial de Meta.
            </p>
          </div>
          {status.connected ? (
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" disabled={busy} onClick={() => void disconnect()}>
              <LinkBreak weight="bold" /> Desconectar
            </Button>
          ) : status.configured ? (
            <Button size="sm" disabled={busy} onClick={() => void connect()}>
              <ShareNetwork weight="bold" /> Conectar con Meta
            </Button>
          ) : null}
        </div>
        {!status.configured && (
          <p className="mt-4 rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">
            La integración aún no está configurada. Agrega la app de Meta y sus credenciales en las variables de entorno de la función admin de Neon; consulta <code>docs/redes-sociales.md</code>.
          </p>
        )}
        {status.connected && status.page && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 font-semibold">
              <FacebookLogo weight="fill" className="text-[#1877F2]" /> {status.page.name}
            </span>
            {status.page.instagramUsername ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 font-semibold">
                <InstagramLogo weight="fill" className="text-[#C13584]" /> @{status.page.instagramUsername}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No hay una cuenta profesional de Instagram vinculada a esta página.</span>
            )}
          </div>
        )}
        {status.pendingPages.length > 0 && (
          <form onSubmit={choosePage} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-1.5 text-sm font-semibold">
              Página de Facebook
              <select
                value={pageId}
                onChange={(event) => setPageId(event.target.value)}
                className="h-11 w-full rounded-xl border-2 border-border bg-background px-3"
              >
                {status.pendingPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}{page.instagramUsername ? ` · @${page.instagramUsername}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="self-end" disabled={busy || !pageId}>
              <CheckCircle weight="bold" /> Guardar conexión
            </Button>
          </form>
        )}
      </section>

      {status.connected && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <form onSubmit={publish} className="space-y-4 rounded-media border border-border bg-card p-5 shadow-soft sm:p-6">
            <div>
              <h2 className="font-display text-lg font-black text-primary">Crear publicación</h2>
              <p className="mt-1 text-sm text-muted-foreground">La publicación se enviará de inmediato a las redes seleccionadas.</p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">Publicar en</legend>
              <div className="flex flex-wrap gap-2">
                {(["facebook", "instagram"] as const).map((platform) => {
                  const unavailable = platform === "instagram" && !status.page?.instagramId;
                  return (
                    <label
                      key={platform}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold",
                        selectedPlatforms.includes(platform) ? "border-accent bg-accent/10 text-accent" : "border-border",
                        unavailable && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform)}
                        disabled={unavailable}
                        onChange={() => togglePlatform(platform)}
                        className="accent-accent"
                      />
                      {platform === "facebook"
                        ? <FacebookLogo weight="fill" className="text-[#1877F2]" />
                        : <InstagramLogo weight="fill" className="text-[#C13584]" />}
                      {platformLabels[platform]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="block space-y-1.5 text-sm font-semibold">
              Texto
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={2200}
                rows={5}
                required
                placeholder="Escribe el texto de tu publicación..."
                className="w-full resize-y rounded-xl border-2 border-border bg-background p-3 font-normal focus:border-accent focus:outline-none"
              />
              <span className="block text-right text-xs font-normal text-muted-foreground">{caption.length}/2200</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-semibold hover:border-accent">
              <UploadSimple weight="bold" className="size-5 text-accent" />
              {image ? image.name : "Adjuntar imagen JPEG (máximo 5 MB)"}
              <input type="file" accept="image/jpeg,.jpg,.jpeg" onChange={onImageChange} className="sr-only" />
            </label>
            <p className="text-xs text-muted-foreground">
              Instagram requiere una cuenta profesional vinculada y una imagen JPEG accesible públicamente durante la publicación.
            </p>
            <Button type="submit" disabled={busy || !image || !caption.trim() || selectedPlatforms.length === 0}>
              <PaperPlaneTilt weight="bold" /> {busy ? "Publicando..." : "Publicar ahora"}
            </Button>
          </form>

          <section aria-label="Vista previa de publicación" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-black text-primary">Vista previa</h2>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>
                <ArrowClockwise weight="bold" /> Actualizar
              </Button>
            </div>
            <article className="overflow-hidden rounded-media border border-border bg-card shadow-soft">
              <div className="flex items-center gap-2 border-b border-border p-3 text-sm font-bold">
                {selectedPlatforms.map((platform) => platform === "facebook"
                  ? <FacebookLogo key={platform} weight="fill" className="size-5 text-[#1877F2]" />
                  : <InstagramLogo key={platform} weight="fill" className="size-5 text-[#C13584]" />)}
                <span>Gabus Vet</span>
              </div>
              {imagePreview
                ? <img src={imagePreview} alt="Vista previa de la publicación" className="aspect-square w-full object-cover" />
                : <div className="grid aspect-square place-items-center bg-muted text-sm text-muted-foreground">La imagen aparecerá aquí</div>}
              <p className="min-h-20 whitespace-pre-wrap p-4 text-sm">{caption || "El texto de la publicación aparecerá aquí."}</p>
            </article>
          </section>
        </div>
      )}

      <section className="rounded-media border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-lg font-black text-primary">Historial de publicaciones</h2>
        {status.history.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay publicaciones desde PetCare.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {status.history.map((post) => (
              <li key={post.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <img src={socialMediaUrl(post.mediaId)} alt="" className="size-16 shrink-0 rounded-lg bg-muted object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {post.platform === "facebook"
                      ? <FacebookLogo weight="fill" className="text-[#1877F2]" />
                      : <InstagramLogo weight="fill" className="text-[#C13584]" />}
                    <span>{platformLabels[post.platform]}</span>
                    <span className={post.status === "published" ? "text-accent" : "text-danger"}>
                      {post.status === "published" ? "Publicada" : "Error"}
                    </span>
                    <time className="font-normal text-muted-foreground" dateTime={post.createdAt}>
                      {new Date(post.createdAt).toLocaleString("es-PE")}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{post.caption}</p>
                  {post.error && <p className="mt-1 text-xs text-danger">{post.error}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notice && <p role="status" className="rounded-lg bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
