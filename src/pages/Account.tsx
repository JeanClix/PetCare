import { useEffect, useState, type FormEvent } from "react";
import { LockKey, SignIn, UserCirclePlus } from "@phosphor-icons/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { isDevelopmentAdminAuth } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export function Account() {
  const { user, ready, login, register, logout } = useAuth();
  const { open: openCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const next = searchParams.get("next");

  useEffect(() => {
    if (!ready || !user) return;
    if (user.role === "admin") {
      navigate("/admin", { replace: true });
    } else if (user.role === "veterinarian") {
      navigate("/veterinario", { replace: true });
    } else if (next === "/checkout") {
      navigate("/tienda", { replace: true, state: { checkoutAfterLogin: true } });
      openCart();
    }
  }, [ready, user, next, navigate, openCart]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "register") {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <Container className="py-20 text-center text-muted-foreground">Verificando tu sesión...</Container>;
  }

  if (user?.role === "admin") {
    return <Container className="py-20 text-center text-muted-foreground">Abriendo el panel administrativo...</Container>;
  }
  if (user?.role === "veterinarian") {
    return <Container className="py-20 text-center text-muted-foreground">Abriendo el portal veterinario...</Container>;
  }

  if (user?.role === "customer") {
    return (
      <>
        <PageHeader title="Mi cuenta" description="Tu sesión de cliente está activa." />
        <Container className="py-14 sm:py-20">
          <section className="mx-auto max-w-xl space-y-6 rounded-media border border-border bg-card p-6 shadow-soft sm:p-9">
            <div className="flex items-center gap-4">
              <UserCirclePlus weight="duotone" className="size-12 text-accent" />
              <div>
                <h2 className="font-display text-xl font-black text-primary">{`${user.firstname} ${user.lastname}`.trim()}</h2>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Inicia sesión para finalizar pedidos. El equipo de PetCare coordina el pago y la entrega por WhatsApp.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/tienda" onClick={openCart}>Ir a la tienda</ButtonLink>
              <Button variant="outline" onClick={() => { logout(); navigate("/", { replace: true }); }}>Cerrar sesión</Button>
            </div>
          </section>
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
        description={mode === "login"
          ? "Accede a tu cuenta de PetCare. El administrador entra aquí con su correo y contraseña habituales."
          : "Regístrate para hacer pedidos y consultar tu cuenta de cliente."}
      />
      <Container className="py-14 sm:py-20">
        <section className="mx-auto max-w-md space-y-6 rounded-media border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Acceso a PetCare">
            {(["login", "register"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                disabled={option === "register" && isDevelopmentAdminAuth}
                onClick={() => { setMode(option); setError(""); }}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  mode === option ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "login" ? "Iniciar sesión" : "Registrarme"}
              </button>
            ))}
          </div>

          {isDevelopmentAdminAuth && (
            <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
              En modo local solo está habilitado el acceso de demostración del administrador. El registro de clientes requiere Neon.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div className="space-y-2">
                <label htmlFor="account-name" className="block text-sm font-bold">Nombre completo</label>
                <input
                  id="account-name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 focus:border-accent focus:outline-none"
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="account-email" className="block text-sm font-bold">
                {isDevelopmentAdminAuth ? "Usuario" : "Correo electrónico"}
              </label>
              <input
                id="account-email"
                name="email"
                type={isDevelopmentAdminAuth ? "text" : "email"}
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={isDevelopmentAdminAuth ? "admin" : "tu@correo.com"}
                className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="account-password" className="block text-sm font-bold">Contraseña</label>
              <input
                id="account-password"
                name="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={mode === "register" ? 12 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 focus:border-accent focus:outline-none"
              />
              {mode === "register" && <p className="text-xs text-muted-foreground">Usa al menos 12 caracteres.</p>}
            </div>
            {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={submitting || (isDevelopmentAdminAuth && mode === "register")}>
              {submitting ? "Un momento..." : mode === "login" ? <><SignIn weight="bold" /> Iniciar sesión</> : <><LockKey weight="bold" /> Crear cuenta</>}
            </Button>
            {next === "/checkout" && <p className="text-center text-sm text-muted-foreground">Al iniciar sesión volverás al carrito para finalizar tu pedido.</p>}
          </form>

        </section>
      </Container>
    </>
  );
}
