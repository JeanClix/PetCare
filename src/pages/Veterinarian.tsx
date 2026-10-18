import { Stethoscope } from "@phosphor-icons/react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useAuth } from "@/context/AuthContext";

export function Veterinarian() {
  const { user, ready, logout } = useAuth();

  if (!ready) {
    return <Container className="py-20 text-center text-muted-foreground">Verificando tu sesión...</Container>;
  }
  if (!user) return <Navigate to="/cuenta?next=%2Fveterinario" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role !== "veterinarian") return <Navigate to="/cuenta" replace />;

  return (
    <>
      <PageHeader title="Portal veterinario" description="Acceso profesional de PetCare." />
      <Container className="py-14 sm:py-20">
        <section className="mx-auto max-w-2xl space-y-6 rounded-media border border-border bg-card p-6 shadow-soft sm:p-9">
          <div className="flex items-center gap-4">
            <Stethoscope weight="duotone" className="size-12 text-accent" />
            <div>
              <h2 className="font-display text-xl font-black text-primary">{`${user.firstname} ${user.lastname}`.trim()}</h2>
              <p className="text-muted-foreground">{user.email} · Veterinario/a</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="font-bold text-primary">Tu cuenta profesional está activa</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este proyecto aún no cuenta con agenda clínica, expedientes de pacientes ni turnos asignados.
              No se muestran datos médicos o de clientes en este portal.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/tienda" variant="outline">Ir a la tienda</ButtonLink>
            <Button variant="ghost" onClick={logout}>Cerrar sesión</Button>
          </div>
        </section>
      </Container>
    </>
  );
}
