/**
 * LogoG4 — logo oficial G4 Educação (SVG branco).
 *
 * Para fundos escuros (variant="dark", padrão do app), renderiza o asset original.
 * Para fundos claros (variant="light", ex.: capa do PDF), aplica filtro CSS para
 * inverter a cor para preto, mantendo a fidelidade do traço vetorial.
 */

import { cn } from "@/lib/utils";
import g4LogoWhite from "@/assets/branding/g4-logo-white.svg";

type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark";

interface LogoG4Props {
  size?: Size;
  variant?: Variant;
  className?: string;
  title?: string;
}

// Aspect ratio original do SVG: 101 x 40 ≈ 2.525
const SIZE_MAP: Record<Size, { height: number }> = {
  sm: { height: 22 },
  md: { height: 30 },
  lg: { height: 44 },
};

export function LogoG4({ size = "md", variant = "dark", className, title = "G4 Educação" }: LogoG4Props) {
  const { height } = SIZE_MAP[size];
  const width = Math.round(height * (101 / 40));

  return (
    <img
      src={g4LogoWhite}
      alt={title}
      width={width}
      height={height}
      style={
        variant === "light"
          ? { filter: "invert(1) brightness(0)", height, width }
          : { height, width }
      }
      className={cn("inline-block align-middle select-none", className)}
      draggable={false}
    />
  );
}

export default LogoG4;
