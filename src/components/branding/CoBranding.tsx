/**
 * CoBranding — composição O2 Inc. × G4 Educação para uso em headers,
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
}

export function CoBranding({ size = "md", variant = "light", className }: CoBrandingProps) {
  const sepColor = variant === "light" ? "text-foreground/40" : "text-foreground/50";
  const sepSize = size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <LogoO2inc size={size} variant={variant} />
      <span aria-hidden="true" className={cn("font-mono uppercase tracking-widest select-none", sepSize, sepColor)}>
        ×
      </span>
      <LogoG4 size={size} variant={variant} />
    </div>
  );
}

export default CoBranding;
