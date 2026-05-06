import { cn } from "@/lib/utils";
import icon from "@/assets/branding/o2-icon.png";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, number> = { sm: 24, md: 36, lg: 56, xl: 96 };

/** Símbolo isolado da O2 (anéis verdes). Use em sidebar colapsado, splash, hero. */
export function LogoO2Icon({ size = "md", className, breathe = false }: { size?: Size; className?: string; breathe?: boolean }) {
  return (
    <img
      src={icon}
      alt="O2 Inc."
      style={{ height: SIZE[size], width: SIZE[size] }}
      className={cn("inline-block select-none", breathe && "breathe", className)}
      draggable={false}
    />
  );
}

export default LogoO2Icon;
