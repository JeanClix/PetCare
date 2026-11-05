import { AirplaneTilt, Check, ClipboardText, Cpu, Syringe } from "@phosphor-icons/react";
import { ServiceIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { photos, services, type Service } from "@/data/site";
import { cn } from "@/lib/utils";
import { VisitUs } from "@/pages/Home";

const travelSteps = [
  { icon: ClipboardText, title: "Revisamos tu destino", text: "Vemos los requisitos sanitarios del país o ciudad a donde viajas." },
  { icon: Cpu, title: "Microchip y vacunas", text: "Implantamos el microchip y ponemos al día el calendario de vacunas." },
  { icon: Syringe, title: "Exámenes y certificados", text: "Test serológico de rabia, certificado de salud y documentos de exportación." },
  { icon: AirplaneTilt, title: "Listos para viajar", text: "Te entregamos todo en regla, con jaula y accesorios de viaje." },
];

// Los servicios con lista de detalle ocupan el ancho completo; el resto va en dos columnas
const featured = services.filter((s) => s.bullets);
const regular = services.filter((s) => !s.bullets);

export function Services() {
  return (
    <>
      <PageHeader
        title="Servicios veterinarios en Surco"
        description="Atención médica, grooming y más para perros, gatos y mascotas exóticas."
      />

      <Container className="space-y-5 py-10 sm:py-14">
        <FeaturedService
          service={featured[0]}
          image={photos.consultation}
          imageAlt="Veterinaria examinando a un gato durante una consulta"
        />

        <div className="grid gap-5 md:grid-cols-2">
          {regular.map((s, i) => (
            <article
              key={s.id}
              id={s.id}
              className={cn(
                "reveal scroll-mt-32 rounded-media p-7 sm:p-8",
                ["bg-card shadow-soft", "bg-accent-soft", "bg-sky", "bg-card shadow-soft"][i % 4],
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <ServiceIcon name={s.icon} className="size-10 text-accent" />
                {s.highlight && <Badge>{s.highlight}</Badge>}
              </div>
              <h2 className="mt-4 text-2xl font-black">{s.name}</h2>
              <p className="mt-2 max-w-[56ch] text-muted-foreground">{s.summary}</p>
              <ButtonLink to={`/citas?servicio=${s.id}`} variant="outline" size="sm" className="mt-6">
                Agendar cita
              </ButtonLink>
            </article>
          ))}
        </div>

        <FeaturedService
          service={featured[1]}
          image={photos.travel}
          imageAlt="Perro viajando dentro de una maleta con su dueño"
          compact
          reverse
        />
      </Container>

      <section className="border-y border-border bg-card py-14 sm:py-16">
        <Container>
          <SectionHeading
            eyebrow="Tranquilo, podemos ayudarte"
            title="Así preparamos el viaje de tu mascota"
            description="Te guiamos con los requisitos y documentos para viajar con tu mascota."
            className="reveal"
          />
          <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {travelSteps.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal border-t-2 border-accent pt-5">
                <Icon weight="duotone" className="size-8 text-accent" />
                <h3 className="mt-3 text-lg font-black">{title}</h3>
                <p className="mt-1.5 text-[0.95rem] text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <div className="pt-14 sm:pt-16">
        <VisitUs />
      </div>
    </>
  );
}

function FeaturedService({
  service: s,
  image,
  imageAlt,
  compact = false,
  reverse = false,
}: {
  service: Service;
  image: string;
  imageAlt: string;
  compact?: boolean;
  reverse?: boolean;
}) {
  return (
    <article id={s.id} className="reveal grid scroll-mt-32 overflow-hidden rounded-media bg-card shadow-soft lg:grid-cols-2">
      <figure className={cn("relative h-64", compact ? "lg:h-96" : "lg:h-full", reverse && "lg:order-2")}>
        <img src={image} alt={imageAlt} className="size-full object-cover object-[58%_center]" />
      </figure>
      <div className={cn(compact ? "p-6 sm:p-7" : "p-7 sm:p-10")}>
        <ServiceIcon name={s.icon} className="size-10 text-accent" />
        <h2 className={cn("font-black", compact ? "mt-2 text-2xl sm:text-3xl" : "mt-4 text-3xl")}>{s.name}</h2>
        <p className={cn("max-w-[56ch] text-muted-foreground", compact ? "mt-1.5" : "mt-2")}>{s.summary}</p>
        <ul className={cn("grid sm:grid-cols-2", compact ? "mt-3 gap-x-4 gap-y-2" : "mt-5 gap-2.5")}>
          {s.bullets!.map((b) => (
            <li key={b} className={cn("flex font-semibold", compact ? "gap-2 text-sm" : "gap-2.5 text-[0.95rem]")}>
              <Check weight="bold" className="mt-0.5 size-5 shrink-0 text-accent" />
              {b}
            </li>
          ))}
        </ul>
        <ButtonLink to={`/citas?servicio=${s.id}`} className={cn(compact ? "mt-4" : "mt-6")}>
          Agendar cita
        </ButtonLink>
      </div>
    </article>
  );
}
