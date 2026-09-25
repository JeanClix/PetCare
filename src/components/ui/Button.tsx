import { cva, type VariantProps } from "class-variance-authority";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-bold transition-[background-color,color,border-color,transform,box-shadow] duration-200 active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        accent: "bg-accent text-accent-foreground shadow-[0_8px_20px_-8px_rgb(0_122_100/0.55)] hover:bg-accent-hover",
        primary: "bg-primary text-primary-foreground hover:bg-brand-navy-deep dark:hover:bg-white",
        outline: "border-2 border-foreground/15 text-foreground hover:border-accent hover:text-accent",
        ghost: "text-foreground hover:bg-muted",
        light: "bg-white text-brand-navy hover:bg-accent-soft dark:hover:bg-white/90",
        whatsapp: "bg-[#128C4B] text-white hover:bg-[#0f7a41]",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "accent", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Variants) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ className, variant, size, ...props }: LinkProps & Variants) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonAnchor({
  className,
  variant,
  size,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & Variants) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** Enlace de texto terciario con flecha, para acciones secundarias */
export function TextLink({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-1.5 font-display font-bold text-accent underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
