import { AirplaneTilt, Check, ClipboardText, Cpu, Syringe } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
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
        title="Medicina, estética y trámites con el mismo equipo"
        description="Médicos veterinarios titulados y colegiados, equipos de última generación y el trato cercano de siempre."
        image={{ src: photos.bath, alt: "Golden retriever durante el baño" }}
      >
        <nav className="mt-7 flex flex-wrap gap-2" aria-label="Servicios">
          {services.map((s) => (
            <Link
              key={s.id}
              to={`/servicios#${s.id}`}
              className="rounded-full bg-card px-3.5 py-1.5 text-sm font-semibold shadow-soft transition-colors hover:text-accent"
            >
              {s.name}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <Container className="space-y-5 py-14 sm:py-20">
        <FeaturedService service={featured[0]} image={photos.puppy} imageAlt="Cachorro golden corriendo en el pasto" />

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
              <p className="mt-2 max-w-[56ch] text-muted-foreground">{s.description}</p>
              <ButtonLink to={`/contacto?servicio=${s.id}`} variant="outline" size="sm" className="mt-6">
                Agendar cita
              </ButtonLink>
            </article>
          ))}
        </div>

        <FeaturedService service={featured[1]} image={photos.corgi} imageAlt="Corgi mirando a la cámara" reverse />
      </Container>

      <section className="border-y border-border bg-card py-20 sm:py-24">
        <Container>
          <SectionHeading
            eyebrow="Tranquilo, podemos ayudarte"
            title="Así preparamos el viaje de tu mascota"
            description="Es seguro y fácil transportar a tu engreído dentro y fuera del país. Déjalo en manos de expertos."
            className="reveal"
          />
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="pt-20 sm:pt-28">
        <VisitUs />
      </div>
    </>
  );
}

function FeaturedService({
  service: s,
  image,
  imageAlt,
  reverse = false,
}: {
  service: Service;
  image: string;
  imageAlt: string;
  reverse?: boolean;
}) {
  return (
    <article id={s.id} className="reveal grid scroll-mt-32 overflow-hidden rounded-media bg-card shadow-soft lg:grid-cols-2">
      <img src={image} alt={imageAlt} className={cn("h-64 w-full object-cover lg:h-full", reverse && "lg:order-2")} />
      <div className="p-7 sm:p-10">
        <ServiceIcon name={s.icon} className="size-10 text-accent" />
        <h2 className="mt-4 text-3xl font-black">{s.name}</h2>
        <p className="mt-2 max-w-[56ch] text-muted-foreground">{s.description}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {s.bullets!.map((b) => (
            <li key={b} className="flex gap-2.5 text-[0.95rem] font-semibold">
              <Check weight="bold" className="mt-0.5 size-5 shrink-0 text-accent" />
              {b}
            </li>
          ))}
        </ul>
        <ButtonLink to={`/contacto?servicio=${s.id}`} className="mt-8">
          Agendar cita
        </ButtonLink>
      </div>
    </article>
  );
}
