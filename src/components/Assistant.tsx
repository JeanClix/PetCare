import { ChatCircleDots, CircleNotch, PaperPlaneRight, Phone, Plus, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import { products } from "@/data/products";
import { business, services } from "@/data/site";
import { askAssistant, assistantUrl, type AssistantReply, type ChatTurn } from "@/lib/assistant";
import { cn, formatPrice } from "@/lib/utils";

type Message = { role: "user"; content: string } | ({ role: "assistant"; content: string } & Partial<AssistantReply>);

const suggestions = ["Mi gata tiene salpullido", "Mi gato tiene los ojos llorosos", "Mi perro está estresado", "Quiero bañar a mi perro"];

const greeting: Message = {
  role: "assistant",
  content: "¡Hola! Cuéntame qué le pasa a tu mascota o qué buscas, y te recomiendo productos y servicios de PetCare.",
};

// Se abre abajo a la izquierda: la esquina derecha es del chat de HubSpot
export function Assistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    // En móvil el chat de HubSpot quedaría encima del panel (ver index.css)
    document.body.classList.add("assistant-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("assistant-open");
    };
  }, [isOpen]);

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

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 left-4 z-40 flex h-13 items-center gap-2 rounded-full bg-primary px-5 font-display font-bold text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-[0.98] sm:left-6"
        >
          <ChatCircleDots weight="fill" className="size-6" /> Asistente
        </button>
      )}

      {isOpen && (
        <section
          aria-label="Asistente de PetCare"
          className="fixed bottom-4 left-4 z-50 flex h-[min(40rem,calc(100dvh-2rem))] w-[min(25rem,calc(100vw-2rem))] animate-fade-up flex-col overflow-hidden rounded-card bg-card shadow-lift ring-1 ring-border sm:left-6"
        >
          <header className="flex items-center justify-between gap-3 bg-primary px-5 py-4 text-primary-foreground">
            <div>
              <p className="font-display text-lg font-black">Asistente PetCare</p>
              <p className="text-xs opacity-80">Orientación general, no reemplaza una consulta</p>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Cerrar asistente" className="grid size-9 place-items-center rounded-full hover:bg-white/15">
              <X weight="bold" className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
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

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
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
          </form>
        </section>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const { add } = useCart();

  if (message.role === "user") {
    return <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-foreground">{message.content}</p>;
  }

  const recommended = (message.productos ?? []).map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined);
  const service = services.find((s) => s.id === message.servicio);

  return (
    <div className="max-w-[92%] space-y-3">
      <p className={cn("rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 whitespace-pre-line", message.urgente && "ring-2 ring-danger/40")}>
        {message.content}
      </p>
      {message.urgente && (
        <ButtonAnchor href={business.emergencyHref} target="_self" size="sm" className="bg-danger hover:bg-danger/90">
          <Phone weight="bold" /> Emergencias {business.emergency}
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
      {service && (
        <ButtonLink to={`/contacto?servicio=${service.id}`} variant="outline" size="sm">
          Agendar cita: {service.name}
        </ButtonLink>
      )}
    </div>
  );
}
