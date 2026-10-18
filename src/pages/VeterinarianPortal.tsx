import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useAuth } from "@/context/AuthContext";

export function VeterinarianPortal() {
  const { user, ready, logout } = useAuth();

  if (!ready) {
    return <Container className="py-20 text-center text-muted-foreground">Verificando tu sesión...</Container>;
  }
  if (!user) return <Navigate to="/cuenta" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role !== "veterinarian") return <Navigate to="/cuenta" replace />;

  return (
    <>
      <PageHeader
        title="Portal veterinario"
        description="Acceso de cuenta para el equipo veterinario de PetCare."
      />
      <Container className="py-14 sm:py-20">
        <section className="mx-auto max-w-xl space-y-5 rounded-media border border-border bg-card p-6 shadow-soft sm:p-9">
          <div>
            <h2 className="font-display text-xl font-black text-primary">
              {`${user.firstname} ${user.lastname}`.trim()}
            </h2>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Tu cuenta tiene acceso veterinario. Este portal todavía no incluye expedientes ni herramientas clínicas.
          </p>
          <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
        </section>
      </Container>
    </>
  );
}
