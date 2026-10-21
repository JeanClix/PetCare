import { ArrowClockwise, DeviceMobile, LinkBreak, WhatsappLogo } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { WhatsappLogItem } from "@/components/staff/WhatsappComposer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getWhatsappStatus, logoutWhatsapp, type WhatsappStatus } from "@/lib/whatsapp";

const statusLabels: Record<NonNullable<WhatsappStatus["status"]>, string> = {
  starting: "Iniciando",
  connecting: "Conectando",
  qr: "Esperando que escanees el QR",
  open: "Conectado",
  logged_out: "Desvinculado",
};

/** Conexión del número de WhatsApp de la clínica (solo administrador) */
export function WhatsappSettings({ token }: { token: string }) {
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getWhatsappStatus(token));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar WhatsApp.");
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Mientras se espera el QR o la conexión, se consulta cada 5 s (el QR de WhatsApp cambia cada ~20 s)
  const waiting = status?.reachable && status.status !== "open";
  useEffect(() => {
    if (!waiting) return;
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [waiting, refresh]);

  async function unlink() {
    if (!window.confirm("¿Desvincular el número de WhatsApp? Habrá que escanear un QR nuevo para volver a enviar mensajes.")) return;
    setBusy(true);
    try {
      await logoutWhatsapp(token);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo desvincular.");
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
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-media border border-border bg-card p-6 shadow-soft">
        {!status.configured ? (
          <div className="space-y-2">
            <h2 className="font-display text-lg font-black text-primary">Falta conectar el servicio de WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              Despliega <code className="rounded bg-muted px-1">services/whatsapp</code> en Render y configura
              <code className="mx-1 rounded bg-muted px-1">WHATSAPP_SERVICE_URL</code> y
              <code className="mx-1 rounded bg-muted px-1">WHATSAPP_SERVICE_TOKEN</code> en la función admin de Neon. Los pasos están en docs/whatsapp.md.
            </p>
          </div>
        ) : !status.reachable ? (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-black text-primary">El servicio no responde</h2>
            <p className="text-sm text-muted-foreground">{status.error}</p>
            <Button variant="outline" size="sm" onClick={() => void refresh()}><ArrowClockwise weight="bold" /> Reintentar</Button>
          </div>
        ) : status.status === "open" ? (
          <div className="flex flex-wrap items-center gap-5">
            <span className="grid size-16 place-items-center rounded-2xl bg-[#128C4B]/10 text-[#128C4B]">
              <WhatsappLogo weight="fill" className="size-9" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#128C4B]">Conectado</p>
              <p className="font-display text-2xl font-black text-primary tabular-nums">+{status.phone}</p>
              {status.name && <p className="text-sm text-muted-foreground">{status.name}</p>}
            </div>
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" disabled={busy} onClick={() => void unlink()}>
              <LinkBreak weight="bold" /> Desvincular
            </Button>
          </div>
        ) : (
          <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="grid size-64 place-items-center rounded-2xl border border-border bg-white p-3">
              {status.qr
                ? <img src={status.qr} alt="Código QR para enlazar WhatsApp" className="size-full" />
                : <ArrowClockwise className="size-8 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-3">
              <p className={cn("text-sm font-bold", status.status === "qr" ? "text-accent" : "text-muted-foreground")}>
                {statusLabels[status.status ?? "starting"]}
              </p>
              <h2 className="font-display text-xl font-black text-primary">Enlaza el WhatsApp de la clínica</h2>
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                <li>Abre WhatsApp en el celular de la clínica.</li>
                <li>Ve a <strong className="text-foreground">Dispositivos vinculados → Vincular un dispositivo</strong>.</li>
                <li>Escanea este código. Se actualiza solo.</li>
              </ol>
              <p className="flex items-start gap-2 rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                <DeviceMobile className="mt-0.5 size-4 shrink-0" />
                Usa un número dedicado a la clínica. Es una conexión no oficial: envía mensajes con moderación para evitar bloqueos.
              </p>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2.5 text-sm font-semibold text-danger">{error}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-black text-primary">Últimos mensajes enviados</h2>
        {status.recent.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no se han enviado mensajes desde el panel.
          </p>
        ) : (
          <ul className="space-y-2">{status.recent.map((entry) => <WhatsappLogItem key={entry.id} entry={entry} showContact />)}</ul>
        )}
      </section>
    </div>
  );
}
