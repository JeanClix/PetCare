import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { business } from "@/data/site";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number) {
  return `S/ ${value.toFixed(2)}`;
}

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${business.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
