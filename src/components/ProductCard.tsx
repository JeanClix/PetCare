import { Plus } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { categoryLabels, petLabels, type Product } from "@/data/products";
import { cn, formatPrice } from "@/lib/utils";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  return (
    <article className={cn("group flex flex-col", className)}>
      <div className="relative aspect-square overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-border transition-shadow duration-300 group-hover:shadow-lift">
        <Link
          to={`/tienda/${product.id}`}
          aria-label={`Ver detalles de ${product.name}`}
          className="block size-full"
        >
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="size-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </Link>
        <Link
          to={`/tienda/${product.id}`}
          aria-label={`Ver y comprar ${product.name}`}
          className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_8px_20px_-8px_rgb(0_122_100/0.6)] transition-transform hover:scale-105 active:scale-95"
        >
          <Plus weight="bold" className="size-5" />
        </Link>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3.5">
        <p className="text-[0.8rem] font-semibold text-muted-foreground">
          {product.subcategory || categoryLabels[product.category]}
          <span className="text-muted-foreground/60">{" / "}{product.pets.map((p) => petLabels[p]).join(", ")}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 font-sans text-[0.95rem] leading-snug font-bold tracking-normal">
          <Link to={`/tienda/${product.id}`} className="hover:text-accent">{product.name}</Link>
        </h3>
        <p className="mt-auto pt-2 font-display text-lg font-black text-primary tabular-nums">
          {product.priceMax && <span className="mr-1 text-sm font-bold text-muted-foreground">desde</span>}
          {formatPrice(product.price)}
        </p>
      </div>
    </article>
  );
}
