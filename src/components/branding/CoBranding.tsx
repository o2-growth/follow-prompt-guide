/**
 * CoBranding — composição O2inc × G4 Educação para uso em headers,
 * footers, capa de PDF e auth split-screen.
 */

import { cn } from "@/lib/utils";
import { LogoO2inc } from "./LogoO2inc";
import { LogoG4 } from "./LogoG4";

type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark";

interface CoBrandingProps {
  size?: Size;
  variant?: Variant;
  className?: string;
  /** Quando true, mostra somente o "×" sem labels — útil em espaços muito apertados. */
  compact?: boolean;
}

export function CoBranding({ size = "md", variant = "light", className }: CoBrandingProps) {
  const separator = variant === "light" ? "text-primary/40" : "text-primary-foreground/50";
  const sepSize = size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-xl";

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <LogoO2inc size={size} variant={variant} />
      <span aria-hidden="true" className={cn("font-serif select-none", sepSize, separator)}>
        ×
      </span>
      <LogoG4 size={size} variant={variant} />
    </div>
  );
}

export default CoBranding;
