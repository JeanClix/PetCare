import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold", {
  variants: {
    tone: {
      green: "bg-accent-soft text-accent",
      sky: "bg-sky text-primary",
      muted: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { tone: "green" },
});

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
