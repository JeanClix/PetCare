import { Link } from "react-router-dom";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="PetCare, inicio">
      <span className="grid size-11 place-items-center rounded-2xl bg-white p-1 shadow-soft">
        <img src={asset("logo.png")} alt="" className="size-full object-contain" />
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "block font-display text-[1.35rem] font-black tracking-tight",
            inverted ? "text-white" : "text-brand-navy dark:text-white",
          )}
        >
          Pet<span className={inverted ? "text-[#6fe0c4]" : "text-accent"}>Care</span>
        </span>
        <span
          className={cn(
            "text-[0.78rem] font-semibold",
            inverted ? "text-white/70" : "text-muted-foreground",
          )}
        >
          Clínica veterinaria
        </span>
      </span>
    </Link>
  );
}
