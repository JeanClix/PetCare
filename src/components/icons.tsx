import {
  AirplaneTilt,
  Bed,
  Cpu,
  Flask,
  HouseLine,
  Pulse,
  Scissors,
  Shower,
  Stethoscope,
  Syringe,
  type IconProps,
} from "@phosphor-icons/react";
import type { ServiceIcon as ServiceIconName } from "@/data/site";

const serviceIcons = {
  stethoscope: Stethoscope,
  bath: Shower,
  scissors: Scissors,
  flask: Flask,
  scan: Pulse,
  syringe: Syringe,
  home: HouseLine,
  bed: Bed,
  chip: Cpu,
  plane: AirplaneTilt,
} satisfies Record<ServiceIconName, unknown>;

export function ServiceIcon({ name, ...props }: { name: ServiceIconName } & IconProps) {
  const Icon = serviceIcons[name];
  return <Icon weight="duotone" {...props} />;
}
