/**
 * LogoO2inc — placeholder wordmark até logo oficial chegar do CEO.
 *
 * Quando o asset oficial chegar (SVG > PNG), basta substituir o conteúdo
 * deste componente — a API (size, variant, className) deve ser preservada
 * para que todos os usos continuem funcionando.
 */

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark";

interface LogoO2incProps {
  size?: Size;
  variant?: Variant;
  className?: string;
  title?: string;
}

const SIZE_MAP: Record<Size, { width: number; height: number; fontSize: number; supFontSize: number }> = {
  sm: { width: 80, height: 22, fontSize: 18, supFontSize: 8 },
  md: { width: 110, height: 30, fontSize: 24, supFontSize: 10 },
  lg: { width: 160, height: 44, fontSize: 36, supFontSize: 14 },
};

export function LogoO2inc({ size = "md", variant = "light", className, title = "O2inc" }: LogoO2incProps) {
  const dims = SIZE_MAP[size];
  // light variant = navy ink sobre fundo claro; dark variant = off-white sobre fundo navy
  const fill = variant === "light" ? "hsl(217 70% 14%)" : "hsl(60 14% 97%)";
  const accent = "hsl(42 50% 54%)"; // dourado para o "2"

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
        y={dims.height - dims.height * 0.25}
        fontFamily="'Source Serif Pro', Georgia, serif"
        fontWeight={700}
        fontSize={dims.fontSize}
        fill={fill}
        letterSpacing="-0.01em"
      >
        O<tspan fill={accent}>2</tspan>inc
      </text>
      <text
        x={dims.width - dims.supFontSize * 0.9}
        y={dims.height * 0.32}
        fontFamily="'Source Serif Pro', Georgia, serif"
        fontWeight={500}
        fontSize={dims.supFontSize}
        fill={fill}
        opacity={0.65}
      >
        ®
      </text>
    </svg>
  );
}

export default LogoO2inc;
