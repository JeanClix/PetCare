import { CircleNotch, Info, PaperPlaneRight, Phone, Plus, ShieldCheck, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import { business, services } from "@/data/site";
import { useSiteContent } from "@/context/SiteContentContext";
import { editableService, sitePhoneHref } from "@/lib/siteContent";
import { askAssistant, assistantUrl, type AssistantReply, type ChatTurn } from "@/lib/assistant";
import { asset } from "@/lib/asset";
import { cn, formatPrice } from "@/lib/utils";

type Message = { role: "user"; content: string } | ({ role: "assistant"; content: string } & Partial<AssistantReply>);

const AI_CONSENT_KEY = "petcare_assistant_ai_consent";

const suggestions = ["Mi gata tiene salpullido", "Mi gato tiene los ojos llorosos", "Mi perro está estresado", "Quiero bañar a mi perro"];

const greeting: Message = {
  role: "assistant",
  content: "¡Hola! Soy el asistente virtual con IA de PetCare. Cuéntame qué le pasa a tu mascota o qué buscas, y te recomiendo productos y servicios de nuestra clínica.",
};

export function Assistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AI_CONSENT_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!isOpen) return;
    if (hasConsented) {
      inputRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPolicyModal) {
          setShowPolicyModal(false);
        } else {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, hasConsented, showPolicyModal]);

  if (!assistantUrl) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setPending(true);
    setError(null);
    try {
      // El saludo inicial no es parte de la conversación
      const history: ChatTurn[] = next.slice(1).map(({ role, content }) => ({ role, content }));
      const reply = await askAssistant(history);
      setMessages([...next, { role: "assistant", content: reply.respuesta, ...reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "El asistente no está disponible ahora.");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = inputRef.current!;
    send(input.value);
    input.value = "";
  }

  function handleAcceptConsent() {
    try {
      localStorage.setItem(AI_CONSENT_KEY, "true");
    } catch {
      // Sin acceso a localStorage
    }
    setHasConsented(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 left-4 z-40 flex h-13 items-center gap-2.5 rounded-full bg-primary pl-2 pr-5 font-display font-bold text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-[0.98] sm:left-6"
          aria-label="Abrir asistente virtual con IA"
        >
          <img
            src={asset("img/assistant-avatar.png")}
            alt=""
            className="size-9 rounded-full bg-white object-cover ring-2 ring-white/30"
          />
          <span>Asistente</span>
          <span className="rounded-full bg-accent/25 px-1.5 py-0.5 text-[0.65rem] font-black tracking-wider text-accent uppercase">
            IA
          </span>
        </button>
      )}

      {isOpen && (
        <section
          aria-label="Asistente de PetCare"
          className="fixed bottom-4 left-4 z-50 flex h-[min(40rem,calc(100dvh-2rem))] w-[min(25rem,calc(100vw-2rem))] animate-fade-up flex-col overflow-hidden rounded-card bg-card shadow-lift ring-1 ring-border sm:left-6"
        >
          <header className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative shrink-0">
                <img
                  src={asset("img/assistant-avatar.png")}
                  alt="Asistente PetCare"
                  className="size-10 rounded-full bg-white object-cover shadow-sm ring-2 ring-white/30"
                />
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-accent px-1 py-0.2 text-[0.55rem] font-black text-accent-foreground">
                  IA
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-display text-base font-black leading-tight">Asistente PetCare</p>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[0.62rem] font-bold text-accent uppercase">
                    IA
                  </span>
                </div>
                <p className="truncate text-xs opacity-80">Orientación general · No reemplaza una consulta</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPolicyModal((v) => !v)}
                aria-label="Políticas y aviso de IA"
                title="Políticas y aviso de IA"
                className="grid size-9 place-items-center rounded-full hover:bg-white/15"
              >
                <Info weight="bold" className="size-5" />
              </button>
              <button onClick={() => setIsOpen(false)} aria-label="Cerrar asistente" className="grid size-9 place-items-center rounded-full hover:bg-white/15">
                <X weight="bold" className="size-5" />
              </button>
            </div>
          </header>

          <div className="relative flex flex-1 flex-col overflow-hidden">
            {showPolicyModal && (
              <div className="absolute inset-0 z-20 flex flex-col bg-card/95 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck weight="fill" className="size-5 text-accent" />
                    <h4 className="font-display text-sm font-black text-foreground">Políticas y Uso de IA</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPolicyModal(false)}
                    className="grid size-8 place-items-center rounded-full hover:bg-muted"
                    aria-label="Cerrar políticas"
                  >
                    <X weight="bold" className="size-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto py-3 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    <strong>Naturaleza del servicio:</strong> Este asistente virtual funciona mediante modelos de lenguaje e Inteligencia Artificial (IA) para ayudarte a navegar por nuestros servicios y catálogo de productos.
                  </p>
                  <p>
                    <strong>Alcance y límites:</strong> Las respuestas generadas tienen carácter exclusivamente informativo y de orientación. En ningún caso sustituyen el diagnóstico, prescripción médica o tratamiento de un médico veterinario colegiado.
                  </p>
                  <p>
                    <strong>Casos de urgencia:</strong> Si tu mascota presenta síntomas graves, sangrado, dificultad respiratoria, intoxicación o convulsiones, acude o llama inmediatamente a emergencias de PetCare.
                  </p>
                  <p>
                    <strong>Tratamiento de datos personales:</strong> La información transmitida se procesa con fines de atención conforme a la Ley N.° 29733 y nuestra{" "}
                    <a href={business.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline underline-offset-2">
                      política de privacidad
                    </a>.
                  </p>
                </div>
                <div className="border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPolicyModal(false)}
                    className="w-full rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}

            {!hasConsented ? (
              <div className="flex flex-1 flex-col justify-between overflow-y-auto p-5 text-center">
                <div className="space-y-4">
                  <div className="relative mx-auto mt-2 w-fit">
                    <img
                      src={asset("img/assistant-avatar.png")}
                      alt="Asistente virtual PetCare"
                      className="size-20 rounded-full bg-white object-cover shadow-md ring-4 ring-primary/10"
                    />
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-black uppercase text-accent-foreground shadow-xs">
                      IA
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-black text-foreground">
                      Aviso de Inteligencia Artificial
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estás a punto de interactuar con nuestro asistente virtual automatizado con Inteligencia Artificial (IA).
                    </p>
                  </div>

                  <div className="space-y-2.5 rounded-2xl border border-border bg-muted/40 p-3.5 text-left text-xs leading-relaxed text-muted-foreground">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accent/20 text-[0.65rem] font-bold text-accent">✓</span>
                      <p><strong>Conversación automatizada:</strong> Este chat genera respuestas automáticas y recomendaciones basadas en el catálogo de PetCare.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accent/20 text-[0.65rem] font-bold text-accent">✓</span>
                      <p><strong>No es consulta médica:</strong> La información es meramente orientativa y no sustituye la consulta o diagnóstico de un médico veterinario.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accent/20 text-[0.65rem] font-bold text-accent">✓</span>
                      <p><strong>Consentimiento y privacidad:</strong> Tus consultas se tratan conforme a nuestra{" "}
                        <a href={business.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-2">
                          política de privacidad
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleAcceptConsent}
                    className="w-full rounded-full bg-accent px-4 py-3 font-display text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent-hover active:scale-[0.98]"
                  >
                    Acepto y deseo comenzar
                  </button>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Al continuar, confirmas que has sido informado y aceptas conversar con un sistema de IA.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/50 px-3 py-1.5 text-[0.7rem] text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="inline-block size-1.5 rounded-full bg-accent animate-pulse" />
                      Conversando con Asistente IA PetCare
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPolicyModal(true)}
                      className="font-bold text-accent hover:underline"
                    >
                      Políticas de IA
                    </button>
                  </div>

                  {messages.map((m, i) => (
                    <MessageBubble key={i} message={m} />
                  ))}
                  {messages.length === 1 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full border-2 border-foreground/10 px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {pending && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CircleNotch weight="bold" className="size-4 animate-spin" /> Buscando en nuestro catálogo…
                    </p>
                  )}
                  {error && (
                    <p role="alert" className="rounded-xl border-2 border-danger/30 px-3.5 py-2.5 text-sm font-semibold text-danger">
                      {error}
                    </p>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col border-t border-border p-3 gap-1.5">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      name="pregunta"
                      maxLength={600}
                      autoComplete="off"
                      placeholder="Ej. mi perro se rasca mucho"
                      aria-label="Escribe tu consulta"
                      className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      aria-label="Enviar"
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
                    >
                      <PaperPlaneRight weight="fill" className="size-5" />
                    </button>
                  </div>
                  <p className="text-center text-[0.68rem] text-muted-foreground">
                    Respuestas generadas por IA · Orientación informativa no vinculante
                  </p>
                </form>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const { add } = useCart();
  const { content, text } = useSiteContent();

  if (message.role === "user") {
    return <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-foreground">{message.content}</p>;
  }

  const recommended = (message.productos ?? []).map((id) => content.products.find((p) => p.id === id)).filter((p) => p !== undefined);
  const service = services.find((s) => s.id === message.servicio);
  const editableRecommendedService = service ? editableService(service, text) : undefined;

  return (
    <div className="flex items-start gap-2.5">
      <img
        src={asset("img/assistant-avatar.png")}
        alt="IA"
        className="mt-0.5 size-7 shrink-0 rounded-full bg-white object-cover shadow-xs ring-1 ring-border"
      />
      <div className="min-w-0 max-w-[88%] space-y-3">
        <p className={cn("rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 whitespace-pre-line text-sm leading-relaxed", message.urgente && "ring-2 ring-danger/40")}>
          {message.content}
        </p>
        {message.urgente && (
          <ButtonAnchor href={sitePhoneHref(text("global.emergency"))} target="_self" size="sm" className="bg-danger hover:bg-danger/90">
            <Phone weight="bold" /> Emergencias {text("global.emergency")}
          </ButtonAnchor>
        )}
        {recommended.length > 0 && (
          <ul className="space-y-2">
            {recommended.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl bg-background p-2 ring-1 ring-border">
                <img src={p.image} alt="" className="size-14 shrink-0 rounded-lg bg-white object-contain p-1" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug font-bold">{p.name}</p>
                  <p className="text-sm font-black text-primary tabular-nums">
                    {p.priceMax && <span className="mr-1 text-xs font-bold text-muted-foreground">desde</span>}
                    {formatPrice(p.price)}
                  </p>
                </div>
                <button
                  onClick={() => add(p)}
                  aria-label={`Añadir ${p.name} al carrito`}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground hover:bg-accent-hover"
                >
                  <Plus weight="bold" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {editableRecommendedService && (
          <ButtonLink to={`/citas?servicio=${editableRecommendedService.id}`} variant="outline" size="sm">
            Agendar cita: {editableRecommendedService.name}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
