/**
 * LogoG4 — placeholder wordmark até logo oficial G4 Educação chegar.
 *
 * Quando o asset oficial chegar (SVG > PNG), basta substituir o conteúdo
 * deste componente — a API (size, variant, className) deve ser preservada
 * para que todos os usos continuem funcionando.
 */

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark";

interface LogoG4Props {
  size?: Size;
  variant?: Variant;
  className?: string;
  title?: string;
}

const SIZE_MAP: Record<Size, { width: number; height: number; g4Size: number; subSize: number }> = {
  sm: { width: 90, height: 22, g4Size: 18, subSize: 7 },
  md: { width: 120, height: 30, g4Size: 24, subSize: 9 },
  lg: { width: 170, height: 44, g4Size: 34, subSize: 12 },
};

export function LogoG4({ size = "md", variant = "light", className, title = "G4 Educação" }: LogoG4Props) {
  const dims = SIZE_MAP[size];
  // light = navy ink; dark = off-white. Em ambos casos o "4" recebe accent gold.
  const fill = variant === "light" ? "hsl(217 70% 14%)" : "hsl(60 14% 97%)";
  const accent = "hsl(42 50% 54%)"; // dourado original G4 — não alterar

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      width={dims.width}
      height={dims.height}
      className={cn("inline-block align-middle", className)}
    >
      <title>{title}</title>
      <text
        x="0"
        y={dims.height - dims.height * 0.28}
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight={900}
        fontSize={dims.g4Size}
        fill={fill}
        letterSpacing="-0.04em"
      >
        G<tspan fill={accent}>4</tspan>
      </text>
      <text
        x={dims.g4Size * 1.55}
        y={dims.height - dims.height * 0.28}
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight={500}
        fontSize={dims.subSize}
        fill={fill}
        opacity={0.75}
        letterSpacing="0.04em"
      >
        EDUCAÇÃO
      </text>
    </svg>
  );
}

export default LogoG4;
