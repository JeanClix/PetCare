import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  categoryLabels,
  petLabels,
  type Category,
  type Pet,
} from "@/data/products";
import { useSiteContent } from "@/context/SiteContentContext";

type Sort = "recientes" | "precio-asc" | "precio-desc" | "nombre";

const sortLabels: Record<Sort, string> = {
  recientes: "Más recientes",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  nombre: "Nombre (A-Z)",
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function Shop() {
  const { content, text } = useSiteContent();
  const products = content.products;
  const [params, setParams] = useSearchParams();
  const pet = (params.get("mascota") ?? "all") as Pet | "all";
  const category = (params.get("categoria") ?? "all") as Category | "all";
  const sort = (params.get("orden") ?? "recientes") as Sort;
  const query = params.get("q") ?? "";

  function update(key: string, value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const list = products.filter(
      (p) =>
        (pet === "all" || p.pets.includes(pet)) &&
        (category === "all" || p.category === category) &&
        (!q || normalize(`${p.name} ${p.subcategory}`).includes(q)),
    );
    if (sort === "precio-asc") list.sort((a, b) => a.price - b.price);
    if (sort === "precio-desc") list.sort((a, b) => b.price - a.price);
    if (sort === "nombre") list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list;
  }, [products, pet, category, sort, query]);

  const hasFilters = pet !== "all" || category !== "all" || query !== "";

  return (
    <>
      <PageHeader
        title={text("shop.page.title")}
        description={text("shop.page.description")}
      />

      <Container className="py-6 sm:py-8">
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15.5rem]">
            <label className="relative min-w-0">
              <span className="sr-only">Buscar productos</span>
              <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => update("q", e.target.value, "")}
                placeholder="Buscar: shampoo, Hill's, oftálmico..."
                className="h-12 w-full rounded-xl border border-border bg-sky/20 pr-4 pl-11 text-sm placeholder:text-muted-foreground/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Ordenar</span>
              <select
                value={sort}
                onChange={(e) => update("orden", e.target.value, "recientes")}
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-sky/20 px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 sm:gap-4">
            <label className="min-w-0">
              <span className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Mascota</span>
              <select
                value={pet}
                onChange={(e) => update("mascota", e.target.value, "all")}
                aria-label="Filtrar por mascota"
                className="h-11 w-full rounded-xl border border-border bg-sky/20 px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="all">Todas las mascotas</option>
                {Object.entries(petLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Categoría</span>
              <select
                value={category}
                onChange={(e) => update("categoria", e.target.value, "all")}
                aria-label="Filtrar por categoría"
                className="h-11 w-full rounded-xl border border-border bg-sky/20 px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="all">Todas las categorías</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span>{" "}
            {results.length === 1 ? "producto" : "productos"}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })} className="shrink-0">
              <X weight="bold" /> Limpiar filtros
            </Button>
          )}
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-media bg-sky/60 px-6 py-16 text-center">
            <p className="font-display text-xl font-black">No encontramos productos</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Prueba con otros filtros o consúltanos al {text("global.phone")}.</p>
            <Button variant="outline" size="sm" className="mt-6" onClick={() => setParams({}, { replace: true })}>
              Ver todos los productos
            </Button>
          </div>
        )}
      </Container>
    </>
  );
}
