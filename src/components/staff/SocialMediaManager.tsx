import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowClockwise,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  FacebookLogo,
  InstagramLogo,
  PaperPlaneTilt,
  ShareNetwork,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import {
  createSocialPost,
  deleteSocialPost,
  getSocialChannels,
  getSocialPosts,
  setSocialPostStatus,
  uploadSocialAttachment,
  type SocialAttachment,
  type SocialChannel,
  type SocialPost,
} from "@/lib/social";
import { cn } from "@/lib/utils";

const stateLabels: Record<SocialPost["state"], string> = {
  DRAFT: "Borrador",
  QUEUE: "Programada",
  PUBLISHED: "Publicada",
  ERROR: "Error",
};
const stateTone: Record<SocialPost["state"], string> = {
  DRAFT: "bg-muted text-muted-foreground",
  QUEUE: "bg-brand-navy/10 text-brand-navy",
  PUBLISHED: "bg-accent-soft text-accent",
  ERROR: "bg-danger/10 text-danger",
};

function platformIcon(platform: string) {
  if (platform.includes("facebook")) return <FacebookLogo weight="fill" className="text-[#1877F2]" />;
  if (platform.includes("instagram")) return <InstagramLogo weight="fill" className="text-[#C13584]" />;
  return <ShareNetwork weight="fill" className="text-muted-foreground" />;
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}
function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}
function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function SocialMediaManager({ token }: { token: string; oauthState?: string }) {
  const [configured, setConfigured] = useState(true);
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [windowStart, setWindowStart] = useState(() => addDays(startOfDay(new Date()), -7));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const windowEnd = addDays(windowStart, 52);

  const [content, setContent] = useState("");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [postType, setPostType] = useState<"draft" | "schedule" | "now">("schedule");
  const [scheduleDate, setScheduleDate] = useState("");
  const [attachments, setAttachments] = useState<SocialAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [channelResult, postResult] = await Promise.all([
        getSocialChannels(token),
        getSocialPosts(token, { startDate: windowStart.toISOString(), endDate: windowEnd.toISOString() }),
      ]);
      setConfigured(channelResult.configured);
      setChannels(channelResult.channels);
      setPosts(postResult.posts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar Postiz.");
    } finally {
      setLoading(false);
    }
  }, [token, windowStart, windowEnd]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, windowStart]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of posts) {
      const key = post.publishDate ? dayKey(new Date(post.publishDate)) : "sin-fecha";
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const days = useMemo(() => Array.from({ length: 52 }, (_, index) => addDays(windowStart, index)), [windowStart]);

  const counts = useMemo(() => ({
    draft: posts.filter((post) => post.state === "DRAFT").length,
    queue: posts.filter((post) => post.state === "QUEUE").length,
    published: posts.filter((post) => post.state === "PUBLISHED").length,
    error: posts.filter((post) => post.state === "ERROR").length,
  }), [posts]);

  const upcoming = useMemo(
    () => posts
      .filter((post) => post.state === "QUEUE" && post.publishDate)
      .sort((a, b) => Date.parse(a.publishDate as string) - Date.parse(b.publishDate as string))
      .slice(0, 5),
    [posts],
  );

  function toggleChannel(id: string) {
    setSelectedChannelIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const attachment = await uploadSocialAttachment(token, file);
      setAttachments((current) => [...current, attachment]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((entry) => entry.id !== id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || selectedChannelIds.length === 0) return;
    if (postType === "schedule" && !scheduleDate) {
      setError("Elige la fecha y hora de la publicación.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await createSocialPost(token, {
        content: content.trim(),
        channelIds: selectedChannelIds,
        type: postType,
        date: postType === "schedule" ? new Date(scheduleDate).toISOString() : undefined,
        attachments,
      });
      setNotice(postType === "now" ? "Publicación enviada a Postiz." : postType === "schedule" ? "Publicación programada." : "Borrador guardado.");
      setContent("");
      setAttachments([]);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la publicación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(post: SocialPost) {
    setError("");
    try {
      await setSocialPostStatus(token, { id: post.id, status: "schedule" });
      setNotice("Publicación aprobada y programada.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo aprobar la publicación.");
    }
  }

  async function remove(post: SocialPost) {
    if (!window.confirm("¿Eliminar esta publicación de Postiz? Si ya fue publicada, seguirá visible en la red social.")) return;
    setError("");
    try {
      await deleteSocialPost(token, { id: post.id });
      setNotice("Publicación eliminada.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la publicación.");
    }
  }

  if (loading && !posts.length && !channels.length) {
    return <div className="h-64 animate-pulse rounded-media bg-muted" />;
  }

  if (!configured) {
    return (
      <div className="space-y-4">
        <section className="rounded-media border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
              <ShareNetwork weight="fill" className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-black text-primary">Social Media Manager</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                PetCare publica y programa contenido en Facebook, Instagram y otras redes a través de Postiz.
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">
            La integración aún no está configurada. Agrega <code>POSTIZ_API_KEY</code> (y opcionalmente <code>POSTIZ_API_BASE_URL</code> para una instancia propia) como secreto de la función <code>admin</code> en Neon; consulta <code>docs/redes-sociales.md</code>.
          </p>
        </section>
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* A. Dashboard */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-media border border-border bg-card p-5 shadow-soft">
          <p className="text-sm font-semibold text-muted-foreground">Canales conectados</p>
          <p className="mt-2 font-display text-3xl font-black text-primary">{channels.length}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {channels.map((channel) => (
              <span key={channel.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold" title={channel.platform}>
                {platformIcon(channel.platform)} {channel.name}
              </span>
            ))}
            {channels.length === 0 && <span className="text-xs text-muted-foreground">Conecta un canal en Postiz para empezar.</span>}
          </div>
        </div>
        <div className="rounded-media border border-border bg-card p-5 shadow-soft"><p className="text-sm font-semibold text-muted-foreground">Programadas</p><p className="mt-2 font-display text-3xl font-black text-brand-navy">{counts.queue}</p></div>
        <div className="rounded-media border border-border bg-card p-5 shadow-soft"><p className="text-sm font-semibold text-muted-foreground">Publicadas</p><p className="mt-2 font-display text-3xl font-black text-accent">{counts.published}</p></div>
        <div className="rounded-media border border-border bg-card p-5 shadow-soft">
          <p className="text-sm font-semibold text-muted-foreground">Borradores / Errores</p>
          <p className="mt-2 font-display text-3xl font-black text-primary">{counts.draft} <span className="text-base font-bold text-danger">· {counts.error} err.</span></p>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="rounded-media border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-base font-black text-primary">Próximas publicaciones</h3>
          <ul className="mt-3 divide-y divide-border">
            {upcoming.map((post) => (
              <li key={post.id} className="flex items-center gap-3 py-2.5 text-sm">
                {post.channel && platformIcon(post.channel.platform)}
                <span className="min-w-0 flex-1 truncate">{post.content.replace(/<[^>]+>/g, " ").trim() || "(sin texto)"}</span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {post.publishDate ? new Date(post.publishDate).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
        {/* B. Composer */}
        <form onSubmit={submit} className="space-y-4 rounded-media border border-border bg-card p-5 shadow-soft sm:p-6">
          <div>
            <h2 className="font-display text-lg font-black text-primary">Crear publicación</h2>
            <p className="mt-1 text-sm text-muted-foreground">Se envía a Postiz, que publica o programa en cada red seleccionada.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">Canales</legend>
            <div className="flex flex-wrap gap-2">
              {channels.map((channel) => (
                <label
                  key={channel.id}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold",
                    selectedChannelIds.includes(channel.id) ? "border-accent bg-accent/10 text-accent" : "border-border",
                    channel.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedChannelIds.includes(channel.id)}
                    disabled={channel.disabled}
                    onChange={() => toggleChannel(channel.id)}
                    className="accent-accent"
                  />
                  {platformIcon(channel.platform)} {channel.name}
                </label>
              ))}
              {channels.length === 0 && <p className="text-sm text-muted-foreground">No hay canales conectados en Postiz todavía.</p>}
            </div>
          </fieldset>
          <label className="block space-y-1.5 text-sm font-semibold">
            Texto
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={2200}
              rows={5}
              required
              placeholder="Escribe el texto de tu publicación..."
              className="w-full resize-y rounded-xl border-2 border-border bg-background p-3 font-normal focus:border-accent focus:outline-none"
            />
            <span className="block text-right text-xs font-normal text-muted-foreground">{content.length}/2200</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-semibold hover:border-accent">
            <UploadSimple weight="bold" className="size-5 text-accent" />
            {uploading ? "Subiendo..." : "Adjuntar imagen o video (máximo 15 MB)"}
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={(event) => void onFileChange(event)} disabled={uploading} className="sr-only" />
          </label>
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="relative">
                  <img src={attachment.path} alt="" className="size-16 rounded-lg border border-border object-cover" />
                  <button type="button" onClick={() => removeAttachment(attachment.id)} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-danger text-white">
                    <Trash weight="bold" className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1.5 w-full text-sm font-bold">Tipo de publicación</legend>
            {([["draft", "Borrador"], ["schedule", "Programar"], ["now", "Publicar ahora"]] as const).map(([value, label]) => (
              <label key={value} className={cn("cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold", postType === value ? "border-accent bg-accent/10 text-accent" : "border-border")}>
                <input type="radio" name="postType" value={value} checked={postType === value} onChange={() => setPostType(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </fieldset>
          {postType !== "draft" && (
            <label className="block space-y-1.5 text-sm font-semibold">
              {postType === "schedule" ? "Fecha y hora" : "Se publica de inmediato"}
              {postType === "schedule" && (
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  required
                  className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 font-normal focus:border-accent focus:outline-none"
                />
              )}
            </label>
          )}
          <Button type="submit" disabled={submitting || uploading || !content.trim() || selectedChannelIds.length === 0}>
            <PaperPlaneTilt weight="bold" /> {submitting ? "Guardando..." : postType === "now" ? "Publicar ahora" : postType === "schedule" ? "Programar" : "Guardar borrador"}
          </Button>
        </form>

        {/* C. Calendario editorial */}
        <section aria-label="Calendario editorial" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-black text-primary"><CalendarBlank weight="bold" /> Calendario</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setWindowStart((current) => addDays(current, -30))}><CaretLeft weight="bold" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setWindowStart(addDays(startOfDay(new Date()), -7))}>Hoy</Button>
              <Button variant="ghost" size="sm" onClick={() => setWindowStart((current) => addDays(current, 30))}><CaretRight weight="bold" /></Button>
              <Button variant="ghost" size="sm" disabled={loading} onClick={() => void refresh()}><ArrowClockwise weight="bold" className={cn(loading && "animate-spin")} /></Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{windowStart.toLocaleDateString("es-PE")} – {addDays(windowEnd, -1).toLocaleDateString("es-PE")}</p>
          <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-media border border-border bg-card p-4 shadow-soft">
            {days.map((day) => {
              const dayPosts = postsByDay.get(dayKey(day)) ?? [];
              if (dayPosts.length === 0) return null;
              return (
                <div key={dayKey(day)}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{day.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" })}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {dayPosts.map((post) => (
                      <li key={post.id} className="flex items-start gap-2 rounded-xl border border-border p-2.5 text-sm">
                        {post.channel && platformIcon(post.channel.platform)}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 whitespace-pre-wrap">{post.content.replace(/<[^>]+>/g, " ").trim() || "(sin texto)"}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Clock weight="bold" className="size-3.5" />
                            {post.publishDate ? new Date(post.publishDate).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            <span className={cn("rounded-full px-2 py-0.5 font-semibold", stateTone[post.state])}>{stateLabels[post.state]}</span>
                          </div>
                          {post.error && <p className="mt-1 flex items-center gap-1 text-xs text-danger"><WarningCircle weight="bold" /> {post.error}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {post.state === "DRAFT" && (
                            <Button variant="ghost" size="sm" onClick={() => void approve(post)} title="Aprobar y programar"><CheckCircle weight="bold" className="text-accent" /></Button>
                          )}
                          {post.state !== "PUBLISHED" && (
                            <Button variant="ghost" size="sm" onClick={() => void remove(post)} title="Eliminar"><Trash weight="bold" className="text-danger" /></Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {posts.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Sin publicaciones en este rango de fechas.
              </p>
            )}
          </div>
        </section>
      </div>

      {notice && <p role="status" className="rounded-lg bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
