import { GraduationCap, Heart, Microscope, SealCheck } from "@phosphor-icons/react";
import { PageHeader } from "@/components/PageHeader";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { business, photos, yearsOfExperience } from "@/data/site";
import { VisitUs } from "@/pages/Home";

const values = [
  { icon: Heart, title: "Cariño genuino", text: "Ver a nuestros pacientes sanos y felices es lo más gratificante de nuestro trabajo." },
  { icon: GraduationCap, title: "Formación continua", text: "Médicos titulados y colegiados que se capacitan constantemente." },
  { icon: Microscope, title: "Diagnóstico preciso", text: "Laboratorio y ecografía con equipos de última generación." },
  { icon: SealCheck, title: "Transparencia", text: "Te explicamos cada tratamiento y su costo antes de empezar." },
];

export function About() {
  return (
    <>
      <PageHeader
        title={`${yearsOfExperience} años haciendo lo que nos gusta`}
        description="Una clínica veterinaria de Surco que nació de la experiencia en la distribución de productos veterinarios."
      />

      <Container className="grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1fr_1.05fr]">
        <div className="reveal space-y-5 text-lg leading-relaxed text-muted-foreground">
          <SectionHeading title={`Desde el ${business.foundedDate}`} />
          <p>
            Dimos nuestros primeros pasos en una empresa distribuidora de productos veterinarios, y allí nació la idea
            de ofrecer nuestros propios servicios. Así comenzó PetCare.
          </p>
          <p>
            No fue fácil al inicio, pero no hay nada mejor que trabajar en lo que te gusta, para lo que te has formado
            y te da satisfacción. Hoy contamos con colaboradores que son un gran apoyo, y con clientes y pacientes a
            los que les tenemos mucho cariño.
          </p>
        </div>
        <div className="reveal relative pb-8">
          <img
            src={photos.friends}
            alt="Un gato y un perro recostados juntos en el pasto"
            className="aspect-[4/3] w-full rounded-media object-cover shadow-lift"
          />
          <div className="absolute bottom-0 -left-2 rounded-card bg-accent px-6 py-4 text-accent-foreground shadow-lift sm:-left-6">
            <p className="font-display text-4xl font-black">{yearsOfExperience} años</p>
            <p className="text-sm font-semibold">cuidando mascotas en Surco</p>
          </div>
        </div>
      </Container>

      <section className="border-y border-border bg-card py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading title="Lo que nos mueve" className="reveal" />
          <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, text }) => (
              <div key={title} className="reveal">
                <dt className="flex items-center gap-3 font-display text-xl font-black">
                  <Icon weight="duotone" className="size-8 text-accent" /> {title}
                </dt>
                <dd className="mt-2 text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <div className="pt-20 sm:pt-28">
        <VisitUs />
      </div>
    </>
  );
}
