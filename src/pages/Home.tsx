import {
  AirplaneTilt,
  ArrowRight,
  Cat,
  Check,
  Cpu,
  Dog,
  MapPin,
  Phone,
  Rabbit,
  Siren,
} from "@phosphor-icons/react";
import { ServiceIcon } from "@/components/icons";
import { ProductCard } from "@/components/ProductCard";
import { ButtonLink, TextLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { products } from "@/data/products";
import { brands, business, photos, services, testimonials, yearsOfExperience } from "@/data/site";
import { cn } from "@/lib/utils";

const byId = (id: string) => services.find((s) => s.id === id)!;

// Los 8 productos más recientes del catálogo original
const featuredProducts = products.slice(0, 8);

export function Home() {
  return (
    <>
      <Hero />
      <Highlights />
      <ServicesBento />
      <TravelFeature />
      <ProductsRow />
      <BrandsMarquee />
      <Testimonials />
      <VisitUs />
    </>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden">
      <Container className="grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:pt-16 lg:pb-20">
        <div className="animate-fade-up">
          <p className="mb-4 font-display text-base font-extrabold text-accent italic">
            Clínica veterinaria en Surco desde {business.foundedYear}
          </p>
          <h1 className="text-[2.6rem] leading-[1.02] font-black tracking-[-0.035em] text-primary sm:text-6xl lg:text-[3.5rem] xl:text-[3.75rem]">
            Tu engreído, en las <em className="pr-1 text-accent">mejores manos</em>
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Consultas, grooming, cirugías y farmacia para perros, gatos y exóticos, con médicos colegiados y atención a
            domicilio.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <ButtonLink to="/contacto" size="lg">
              Agendar cita
            </ButtonLink>
            <TextLink to="/tienda">
              Ver la tienda <ArrowRight weight="bold" className="transition-transform group-hover:translate-x-1" />
            </TextLink>
          </div>
        </div>

        {/* Collage: perro, gato y exóticos, los tres pacientes que atiende la clínica */}
        <div className="relative mx-auto w-full max-w-lg animate-fade-up [animation-delay:120ms] lg:max-w-none">
          <div className="ml-auto w-[82%] overflow-hidden rounded-media shadow-lift">
            <img src={photos.beagle} alt="Beagle sonriendo" className="aspect-[4/5] w-full object-cover" />
          </div>
          <div className="absolute top-[8%] left-0 w-[38%] overflow-hidden rounded-card border-4 border-background shadow-lift">
            <img src={photos.cat} alt="Gato blanco y negro" className="aspect-square w-full object-cover" />
          </div>
          <div className="absolute bottom-[14%] left-[4%] w-[34%] overflow-hidden rounded-card border-4 border-background shadow-lift">
            <img src={photos.guineaPigs} alt="Dos cuyes comiendo zanahoria" className="aspect-[4/3] w-full object-cover" />
          </div>
          <div className="absolute right-4 -bottom-5 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-lift sm:right-8">
            <div className="flex -space-x-1.5 text-accent">
              {[Dog, Cat, Rabbit].map((Icon, i) => (
                <span key={i} className="grid size-9 place-items-center rounded-full border-2 border-card bg-accent-soft">
                  <Icon weight="duotone" className="size-5" />
                </span>
              ))}
            </div>
            <p className="font-display text-sm leading-tight font-extrabold">
              Perros, gatos
              <br />y exóticos
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Highlights() {
  const items = [
    { value: `${yearsOfExperience} años`, label: `Cuidando mascotas desde el ${business.foundedDate}` },
    { value: "10 servicios", label: "De la vacuna anual a la cirugía, con el mismo equipo" },
    { value: "Con cámaras", label: "Mira a tu mascota durante el baño y el grooming" },
    { value: "A domicilio", label: "Consultas en casa para mascotas que se estresan al salir" },
  ];
  return (
    <section className="border-y border-border bg-card">
      <Container className="grid grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.value}
            className={cn(
              "py-7 pr-4 sm:py-9",
              i % 2 === 1 && "border-l border-border pl-5",
              i >= 2 && "border-t border-border lg:border-t-0",
              i === 2 && "lg:border-l lg:pl-5",
            )}
          >
            <p className="font-display text-2xl font-black text-primary sm:text-3xl">{item.value}</p>
            <p className="mt-1 max-w-[26ch] text-sm leading-snug text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </Container>
    </section>
  );
}

function ServicesBento() {
  const consultas = byId("consultas");
  const grooming = byId("grooming");
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="reveal flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <SectionHeading title="Todo lo que necesita, en un solo lugar" />
          <TextLink to="/servicios" className="shrink-0">
            Ver los 10 servicios <ArrowRight weight="bold" className="transition-transform group-hover:translate-x-1" />
          </TextLink>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_auto_auto]">
          {/* Consultas: celda principal con foto */}
          <article className="reveal relative isolate flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-media p-7 text-white sm:col-span-2 lg:row-span-2">
            <img src={photos.puppy} alt="Cachorro golden corriendo en el pasto" className="absolute inset-0 -z-10 size-full object-cover object-[50%_75%]" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-navy-deep via-brand-navy-deep/85 via-55% to-brand-navy-deep/10 sm:from-brand-navy-deep/95 sm:via-brand-navy-deep/45 sm:via-45% sm:to-transparent sm:to-75%" />
            <ServiceIcon name={consultas.icon} className="mb-3 size-9 text-[#6fe0c4]" />
            <h3 className="text-3xl font-black">{consultas.name}</h3>
            <p className="mt-2 max-w-md text-white/85">{consultas.description}</p>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
              {consultas.bullets!.slice(0, 4).map((b) => (
                <li key={b} className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{b}</li>
              ))}
            </ul>
          </article>

          {/* Grooming: foto a un lado */}
          <article className="reveal grid overflow-hidden rounded-media bg-card shadow-soft sm:col-span-2 sm:grid-cols-2">
            <img src={photos.bath} alt="Golden retriever durante el baño" className="h-52 w-full object-cover sm:h-full" />
            <div className="p-6">
              <ServiceIcon name={grooming.icon} className="size-8 text-accent" />
              <h3 className="mt-3 text-xl font-black">Baños y grooming</h3>
              <p className="mt-1.5 text-[0.95rem] text-muted-foreground">
                Cortes por raza, baños medicados y monitoreo por cámaras de seguridad.
              </p>
            </div>
          </article>

          <SmallService id="analisis" className="bg-accent-soft" />
          <SmallService id="ecografias" className="bg-sky" />
          <SmallService id="cirugias" className="bg-card shadow-soft sm:col-span-1 lg:col-span-2" />
          <SmallService
            id="hospedaje"
            className="bg-brand-navy text-white ring-1 ring-white/5 sm:col-span-1 lg:col-span-2 [&_p]:text-white/75 [&_svg]:text-[#6fe0c4]"
          />
        </div>
      </Container>
    </section>
  );
}

function SmallService({ id, className }: { id: string; className?: string }) {
  const s = byId(id);
  return (
    <article className={cn("reveal rounded-media p-6", className)}>
      <ServiceIcon name={s.icon} className="size-8 text-accent" />
      <h3 className="mt-3 text-xl font-black">{s.name}</h3>
      <p className="mt-1.5 text-[0.95rem] text-muted-foreground">{s.summary}</p>
    </article>
  );
}

function TravelFeature() {
  const travel = byId("viajes");
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <div className="reveal grid overflow-hidden rounded-media bg-brand-navy text-white lg:grid-cols-[1fr_0.85fr]">
          <div className="p-8 sm:p-12">
            <p className="font-display text-base font-extrabold text-[#6fe0c4] italic">Trámites de viaje y microchip</p>
            <h2 className="mt-3 text-3xl leading-[1.08] font-black sm:text-4xl">¿Viajas con tu mascota? Nosotros vemos los papeles.</h2>
            <p className="mt-4 max-w-[52ch] text-lg text-white/80">{travel.description}</p>
            <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {travel.bullets!.map((b) => (
                <li key={b} className="flex gap-2.5 text-[0.95rem]">
                  <Check weight="bold" className="mt-0.5 size-5 shrink-0 text-[#6fe0c4]" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/servicios#viajes" variant="light">
                <AirplaneTilt weight="duotone" /> Planificar viaje
              </ButtonLink>
              <ButtonLink to="/servicios#microchip" variant="outline" className="border-white/30 text-white hover:border-white hover:text-white">
                <Cpu weight="duotone" /> Sobre el microchip
              </ButtonLink>
            </div>
          </div>
          <img src={photos.frenchie} alt="Bulldog francés con polera amarilla" className="h-72 w-full object-cover lg:h-full" />
        </div>
      </Container>
    </section>
  );
}

function ProductsRow() {
  return (
    <section className="border-t border-border bg-card py-20 sm:py-24">
      <Container>
        <div className="reveal flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <SectionHeading
            title="Recomendados por nuestros médicos"
            description="Farmacia, alimentos y cuidado de marcas en las que confiamos. Pide en línea y recoge en tienda."
          />
          <TextLink to="/tienda" className="shrink-0">
            Ver la tienda <ArrowRight weight="bold" className="transition-transform group-hover:translate-x-1" />
          </TextLink>
        </div>
      </Container>
      {/* Carril horizontal con scroll-snap; se alinea con el contenedor en pantallas grandes */}
      <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-4 [scrollbar-width:thin] sm:scroll-px-6 sm:px-6 xl:scroll-px-[calc((100vw-72rem)/2+1.5rem)] xl:px-[calc((100vw-72rem)/2+1.5rem)]">
        {featuredProducts.map((p) => (
          <ProductCard key={p.id} product={p} className="w-56 shrink-0 snap-start sm:w-60" />
        ))}
      </div>
    </section>
  );
}

function BrandsMarquee() {
  const row = [...brands, ...brands];
  return (
    <section className="overflow-hidden border-y border-border bg-card py-10" aria-labelledby="brands-title">
      <Container>
        <h2 id="brands-title" className="text-center font-display text-base font-extrabold text-muted-foreground">
          Marcas que encuentras en PetCare
        </h2>
      </Container>
      <div className="mt-6 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <ul className="flex w-max animate-marquee gap-5 hover:[animation-play-state:paused] motion-reduce:animate-none">
          {row.map((b, i) => (
            <li key={i} aria-hidden={i >= brands.length} className="grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-card bg-white ring-1 ring-border">
              <img src={b.logo} alt={b.name} className="max-h-16 max-w-28 object-contain" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Testimonials() {
  const [main, ...rest] = testimonials;
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Familias PetCare" title="Lo que cuentan los dueños" className="reveal" />
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <figure className="reveal grid overflow-hidden rounded-media bg-sky sm:grid-cols-[0.8fr_1fr]">
            <img src={photos.aussie} alt="Pastor australiano sonriendo en la playa" className="h-64 w-full object-cover sm:h-full" />
            <div className="flex flex-col justify-between gap-6 p-7 sm:p-9">
              <blockquote className="font-display text-2xl leading-snug font-extrabold text-primary">“{main.quote}”</blockquote>
              <figcaption>
                <p className="font-bold">{main.name}</p>
                <p className="text-sm text-muted-foreground">{main.detail}</p>
              </figcaption>
            </div>
          </figure>
          <div className="grid gap-5">
            {rest.map((t) => (
              <figure key={t.name} className="reveal flex flex-col justify-between gap-5 rounded-media bg-card p-7 shadow-soft">
                <blockquote className="text-lg leading-relaxed">“{t.quote}”</blockquote>
                <figcaption>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.detail}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function VisitUs() {
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <div className="reveal grid gap-10 rounded-media bg-accent-soft p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="text-3xl leading-[1.08] font-black text-primary sm:text-4xl">Agenda la próxima visita de tu engreído</h2>
            <p className="mt-4 max-w-[48ch] text-lg text-muted-foreground">
              Cuéntanos qué servicio necesitas y te contactamos para coordinar el horario.
            </p>
            <ButtonLink to="/contacto" size="lg" className="mt-7">
              Agendar cita
            </ButtonLink>
          </div>
          <ul className="space-y-5">
            <li className="flex gap-4">
              <MapPin weight="duotone" className="size-7 shrink-0 text-accent" />
              <div>
                <p className="font-display font-extrabold">Sede Surco</p>
                <a href={business.mapsLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent">
                  {business.address}
                </a>
              </div>
            </li>
            <li className="flex gap-4">
              <Phone weight="duotone" className="size-7 shrink-0 text-accent" />
              <div>
                <p className="font-display font-extrabold">Teléfono</p>
                <a href={business.phoneHref} className="text-muted-foreground hover:text-accent">{business.phone}</a>
                <p className="text-sm text-muted-foreground">{business.hours}</p>
              </div>
            </li>
            <li className="flex gap-4">
              <Siren weight="duotone" className="size-7 shrink-0 text-danger" />
              <div>
                <p className="font-display font-extrabold">Emergencias</p>
                <a href={business.emergencyHref} className="font-bold text-foreground hover:text-accent">{business.emergency}</a>
              </div>
            </li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
