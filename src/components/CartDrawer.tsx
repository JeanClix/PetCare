import {
  ArrowLeft,
  Bank,
  CheckCircle,
  CircleNotch,
  CreditCard,
  Handbag,
  Minus,
  Plus,
  QrCode,
  Storefront,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConsentFields, Field, inputClass, validateContact, type ContactErrors } from "@/components/ui/Form";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { createCustomerOrder, type PaymentMethod } from "@/lib/adminAuth";
import { payments } from "@/data/site";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

type Step = "cart" | "checkout" | "sending" | "done";

const paymentMethods: { value: PaymentMethod; label: string; icon: ReactNode; detail: ReactNode }[] = [
  {
    value: "yape",
    label: "Yape",
    icon: <QrCode weight="duotone" />,
    detail: (
      <>
        Yapea a <strong>{payments.yapePlinNumber}</strong> a nombre de {payments.yapePlinHolder}. Envía la captura por
        WhatsApp si quieres confirmación inmediata.
      </>
    ),
  },
  {
    value: "plin",
    label: "Plin",
    icon: <QrCode weight="duotone" />,
    detail: (
      <>
        Plinea a <strong>{payments.yapePlinNumber}</strong> a nombre de {payments.yapePlinHolder}.
      </>
    ),
  },
  {
    value: "transferencia",
    label: "Transferencia bancaria",
    icon: <Bank weight="duotone" />,
    detail: (
      <>
        {payments.bank.bankName} · {payments.bank.accountType}
        <br />
        Cuenta: <strong>{payments.bank.accountNumber}</strong> · CCI: {payments.bank.cci}
        <br />
        Titular: {payments.bank.holder}
      </>
    ),
  },
  {
    value: "tarjeta",
    label: "Tarjeta",
    icon: <CreditCard weight="duotone" />,
    detail: <>Nuestro equipo de ventas te enviará un enlace de cobro seguro para pagar con tarjeta.</>,
  },
];

export function CartDrawer() {
  const { lines, total, count, isOpen, close, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("cart");
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("yape");
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentMethod>("yape");

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

  useEffect(() => {
    const state = location.state;
    if (
      isOpen &&
      user?.role === "customer" &&
      state &&
      typeof state === "object" &&
      "checkoutAfterLogin" in state
    ) {
      setStep("checkout");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [isOpen, user, location.pathname, location.state, navigate]);

  // Al cerrar el panel se vuelve a la vista del carrito
  useEffect(() => {
    if (!isOpen && step !== "sending") {
      setStep("cart");
      setSubmitError(null);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const orderLines = lines.map((l) => `${l.qty} x ${l.product.name} (${formatPrice(l.product.price * l.qty)})`);

  async function handleCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || user.role !== "customer") {
      close();
      navigate("/cuenta?next=%2Fcheckout");
      return;
    }
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
    try {
      await createCustomerOrder(user.token, {
        phone: get("phone"),
        total,
        items: orderLines,
        paymentMethod,
        consent: true,
        marketingConsent: data.get("marketing") === "on",
      });
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No pudimos guardar tu pedido.");
      setStep("checkout");
      return;
    }

    setConfirmedPayment(paymentMethod);
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
          <div role="status" className="flex flex-1 flex-col items-center gap-5 overflow-y-auto p-8 text-center">
            <CheckCircle weight="fill" className="size-14 shrink-0 text-accent" />
            <div>
              <p className="font-display text-xl font-black">Registramos tu pedido</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Nuestro equipo de ventas revisará tu pago y coordinará el recojo o la entrega.
              </p>
            </div>
            {(() => {
              const method = paymentMethods.find((m) => m.value === confirmedPayment);
              return method ? (
                <div className="w-full space-y-2 rounded-xl border border-border bg-muted/50 p-4 text-left text-sm">
                  <p className="flex items-center gap-2 font-bold text-primary">
                    <span className="[&_svg]:size-5 [&_svg]:text-accent">{method.icon}</span>
                    Paga con {method.label}
                  </p>
                  <p className="text-muted-foreground">{method.detail}</p>
                </div>
              ) : null;
            })()}
            <ButtonLink to="/cuenta" onClick={close}>
              Ver mis pedidos
            </ButtonLink>
            <Button variant="ghost" size="sm" onClick={close}>
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
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  if (user?.role !== "customer") {
                    close();
                    navigate("/cuenta?next=%2Fcheckout");
                    return;
                  }
                  setStep("checkout");
                }}
              >
                Continuar
              </Button>
            </div>
          </>
        ) : (
          <form noValidate onSubmit={handleCheckout} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="rounded-xl border border-border bg-background p-4 text-sm">
                <p className="font-bold">{`${user?.firstname ?? ""} ${user?.lastname ?? ""}`.trim()}</p>
                <p className="text-muted-foreground">{user?.email}</p>
                <input type="hidden" name="firstname" value={user?.firstname ?? ""} />
                <input type="hidden" name="lastname" value={user?.lastname || user?.firstname || ""} />
                <input type="hidden" name="email" value={user?.email ?? ""} />
              </div>
              <Field label="Celular para coordinar el pedido" name="phone" error={errors.phone}>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  defaultValue={user?.phone ?? ""}
                  placeholder="987 654 321"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className={inputClass}
                />
              </Field>

              <div className="space-y-2.5">
                <p className="block text-sm font-bold">Método de pago</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {paymentMethods.map((method) => {
                    const active = method.value === paymentMethod;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPaymentMethod(method.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border-2 bg-background px-3 py-2.5 text-left text-sm font-bold transition-colors",
                          active ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/60",
                        )}
                      >
                        <span className="[&_svg]:size-5 [&_svg]:text-accent">{method.icon}</span>
                        {method.label}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                  {paymentMethods.find((m) => m.value === paymentMethod)?.detail}
                </div>
                <p className="text-xs text-muted-foreground">
                  Al confirmar tu pedido, nuestro equipo verificará el pago y coordinará el recojo o la entrega.
                </p>
              </div>

              <ConsentFields error={errors.consent} />
              {submitError && (
                <div role="alert" className="rounded-xl border-2 border-danger/30 px-4 py-3 text-sm">
                  <p className="font-bold text-danger">{submitError}</p>
                </div>
              )}
            </div>
            <div className="space-y-3 border-t border-border bg-muted/50 p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-black tabular-nums">{formatPrice(total)}</span>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={step === "sending"}>
                {step === "sending" ? (
                  <>
                    <CircleNotch weight="bold" className="animate-spin" /> Registrando
                  </>
                ) : (
                  "Confirmar pedido"
                )}
              </Button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
