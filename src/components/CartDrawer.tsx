import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  Handbag,
  Minus,
  Plus,
  Storefront,
  Trash,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { ConsentFields, OwnerFields, validateContact, type ContactErrors } from "@/components/ui/Form";
import { useCart } from "@/context/CartContext";
import { hubspot, submitHubSpotForm } from "@/lib/hubspot";
import { formatPrice, whatsappLink } from "@/lib/utils";

// Con el formulario de pedidos configurado, se piden los datos del cliente antes de ir a WhatsApp
const crmEnabled = Boolean(hubspot.portalId && hubspot.orderFormId);

type Step = "cart" | "checkout" | "sending" | "done";

export function CartDrawer() {
  const { lines, total, count, isOpen, close, setQty, remove, clear } = useCart();
  const [step, setStep] = useState<Step>("cart");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  // Al cerrar el panel se vuelve a la vista del carrito
  useEffect(() => {
    if (!isOpen && step !== "sending") {
      setStep("cart");
      setSubmitError(null);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const orderLines = lines.map((l) => `${l.qty} x ${l.product.name} (${formatPrice(l.product.price * l.qty)})`);
  const orderMessage = ["Hola PetCare, quiero hacer este pedido:", ...orderLines.map((l) => `- ${l}`), `Total referencial: ${formatPrice(total)}`].join("\n");

  async function handleCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const found = validateContact(data);
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const get = (k: string) => String(data.get(k) ?? "").trim();
    setStep("sending");
    setSubmitError(null);
    const result = await submitHubSpotForm(
      hubspot.orderFormId,
      {
        firstname: get("firstname"),
        lastname: get("lastname"),
        email: get("email"),
        phone: get("phone").replace(/\D/g, ""),
        detalle_pedido: orderLines.join("\n"),
        monto_pedido: total.toFixed(2),
      },
      { marketing: data.get("marketing") === "on" },
    );

    if (result.status === "error") {
      setSubmitError(result.message);
      setStep("checkout");
      return;
    }
    window.open(whatsappLink(`${orderMessage}\nA nombre de: ${get("firstname")} ${get("lastname")}`), "_blank", "noopener");
    clear();
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carrito de compras">
      <button className="absolute inset-0 bg-brand-navy-deep/60 backdrop-blur-sm" onClick={close} aria-label="Cerrar carrito" />
      <aside className="absolute top-0 right-0 flex h-full w-full max-w-md animate-slide-in-right flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          {step === "checkout" || step === "sending" ? (
            <button onClick={() => setStep("cart")} className="flex items-center gap-2 font-display text-lg font-black hover:text-accent">
              <ArrowLeft weight="bold" /> Tus datos
            </button>
          ) : (
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Handbag weight="duotone" className="size-6 text-accent" /> Tu carrito
              <span className="text-sm font-medium text-muted-foreground">({count})</span>
            </h2>
          )}
          <Button variant="ghost" size="icon" onClick={close} aria-label="Cerrar">
            <X weight="bold" />
          </Button>
        </div>

        {step === "done" ? (
          <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <CheckCircle weight="fill" className="size-14 text-accent" />
            <div>
              <p className="font-display text-xl font-black">Registramos tu pedido</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Abrimos WhatsApp para coordinar el pago y el recojo o la entrega.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={close}>
              Seguir navegando
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-accent-soft text-accent">
              <Handbag weight="duotone" className="size-8" />
            </div>
            <div>
              <p className="font-display text-lg font-extrabold">Tu carrito está vacío</p>
              <p className="mt-1 text-sm text-muted-foreground">Alimentos, farmacia y accesorios recomendados por nuestros médicos.</p>
            </div>
            <ButtonLink to="/tienda" onClick={close}>
              Ver productos
            </ButtonLink>
          </div>
        ) : step === "cart" ? (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex gap-3 py-4">
                  <img src={product.image} alt="" className="size-18 shrink-0 rounded-xl border border-border bg-white object-contain p-1" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-border">
                        <button className="grid size-8 place-items-center rounded-full hover:bg-muted" onClick={() => setQty(product.id, qty - 1)} aria-label="Quitar uno">
                          <Minus weight="bold" className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                        <button className="grid size-8 place-items-center rounded-full hover:bg-muted" onClick={() => setQty(product.id, qty + 1)} aria-label="Añadir uno">
                          <Plus weight="bold" className="size-3.5" />
                        </button>
                      </div>
                      <span className="font-semibold tabular-nums">{formatPrice(product.price * qty)}</span>
                    </div>
                  </div>
                  <button className="self-start p-1 text-muted-foreground hover:text-danger" onClick={() => remove(product.id)} aria-label={`Eliminar ${product.name}`}>
                    <Trash className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-border bg-muted/50 p-5">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Storefront weight="duotone" className="size-4 text-accent" /> Recojo en tienda o coordinamos la entrega por WhatsApp.
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-black tabular-nums">{formatPrice(total)}</span>
              </div>
              {crmEnabled ? (
                <Button size="lg" className="w-full" onClick={() => setStep("checkout")}>
                  Continuar
                </Button>
              ) : (
                <ButtonAnchor href={whatsappLink(orderMessage)} variant="whatsapp" size="lg" className="w-full">
                  <WhatsappLogo weight="fill" /> Finalizar pedido
                </ButtonAnchor>
              )}
            </div>
          </>
        ) : (
          <form noValidate onSubmit={handleCheckout} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <p className="text-sm text-muted-foreground">
                Registramos tu pedido y te llevamos a WhatsApp para coordinar el pago y el recojo o la entrega.
              </p>
              <OwnerFields errors={errors} compact />
              <ConsentFields error={errors.consent} />
              {submitError && (
                <div role="alert" className="rounded-xl border-2 border-danger/30 px-4 py-3 text-sm">
                  <p className="font-bold text-danger">{submitError}</p>
                  <p className="mt-1 text-muted-foreground">
                    Inténtalo de nuevo o{" "}
                    <a href={whatsappLink(orderMessage)} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline underline-offset-2">
                      envía el pedido por WhatsApp
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-3 border-t border-border bg-muted/50 p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-black tabular-nums">{formatPrice(total)}</span>
              </div>
              <Button type="submit" variant="whatsapp" size="lg" className="w-full" disabled={step === "sending"}>
                {step === "sending" ? (
                  <>
                    <CircleNotch weight="bold" className="animate-spin" /> Registrando
                  </>
                ) : (
                  <>
                    <WhatsappLogo weight="fill" /> Finalizar pedido
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
