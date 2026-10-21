import { CheckCircle, PaperPlaneRight, WarningCircle, WhatsappLogo } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { SlideOver } from "@/components/staff/SlideOver";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  getWhatsappHistory,
  sendWhatsapp,
  whatsappTemplates,
  type WhatsappContext,
  type WhatsappLogEntry,
} from "@/lib/whatsapp";

/** Panel para escribirle al cliente por el WhatsApp de la clínica, con plantillas e historial */
export function WhatsappComposer({
  token,
  contactId,
  phone,
  context,
  onClose,
}: {
  token: string;
  contactId: string;
  phone?: string;
  context: WhatsappContext;
  onClose: () => void;
}) {
  const templates = useMemo(() => whatsappTemplates(context), [context]);
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [message, setMessage] = useState(() => templates[0].build(context));
  const [history, setHistory] = useState<WhatsappLogEntry[] | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    getWhatsappHistory(token, contactId)
      .then((messages) => active && setHistory(messages))
      .catch(() => active && setHistory([]));
    return () => { active = false; };
  }, [token, contactId]);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      await sendWhatsapp(token, contactId, message);
      setResult({ ok: true, text: "Mensaje enviado." });
      setHistory(await getWhatsappHistory(token, contactId).catch(() => history ?? []));
    } catch (cause) {
      setResult({ ok: false, text: cause instanceof Error ? cause.message : "No se pudo enviar el mensaje." });
      setHistory(await getWhatsappHistory(token, contactId).catch(() => history ?? []));
    } finally {
      setSending(false);
    }
  }

  return (
    <SlideOver
      title="Enviar WhatsApp"
      description={`A ${context.name}${phone ? ` · ${phone}` : ""}, desde el número de la clínica`}
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">{message.length}/2000</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
            <Button type="button" variant="whatsapp" size="sm" disabled={sending || !message.trim() || message.length > 2000} onClick={() => void send()}>
              <PaperPlaneRight weight="fill" /> {sending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">Plantilla</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                aria-pressed={templateId === template.id}
                onClick={() => {
                  setTemplateId(template.id);
                  setMessage(template.build(context));
                  setResult(null);
                }}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-bold transition-colors",
                  templateId === template.id ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/60",
                )}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="whatsapp-message" className="block text-sm font-bold">Mensaje</label>
          <textarea
            id="whatsapp-message"
            rows={7}
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-muted-foreground">Revisa el texto antes de enviarlo. Las respuestas del cliente llegan al WhatsApp de la clínica.</p>
        </div>

        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold",
              result.ok ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger",
            )}
          >
            {result.ok ? <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0" /> : <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />}
            {result.text}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">Enviados a este cliente</p>
          {history === null ? (
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se le ha escrito desde el panel.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => <WhatsappLogItem key={entry.id} entry={entry} />)}
            </ul>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

export function WhatsappLogItem({ entry, showContact = false }: { entry: WhatsappLogEntry; showContact?: boolean }) {
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <WhatsappLogo weight="fill" className={cn("size-4 shrink-0", entry.status === "sent" ? "text-[#128C4B]" : "text-danger")} />
          {showContact && entry.contactName ? <strong className="text-foreground">{entry.contactName}</strong> : null}
          <span className="truncate">{entry.sentByName}</span>
        </span>
        <time className="shrink-0 tabular-nums">
          {new Date(entry.createdAt).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap">{entry.body}</p>
      {entry.status === "failed" && <p className="mt-1 text-xs font-semibold text-danger">No enviado: {entry.error}</p>}
    </li>
  );
}
