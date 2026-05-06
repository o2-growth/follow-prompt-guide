import { cn } from "@/lib/utils";
import logoBlack from "@/assets/branding/o2-logo-black.png";
import logoWhite from "@/assets/branding/o2-logo-white.png";

type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark";

interface LogoO2incProps {
  size?: Size;
  variant?: Variant;
  className?: string;
  title?: string;
}

const HEIGHT: Record<Size, number> = { sm: 22, md: 32, lg: 48 };

/** O2 Inc. wordmark oficial. variant="dark" = sobre fundo escuro (logo branco). */
export function LogoO2inc({ size = "md", variant = "light", className, title = "O2 Inc." }: LogoO2incProps) {
  const src = variant === "dark" ? logoWhite : logoBlack;
  return (
    <img
      src={src}
      alt={title}
      style={{ height: HEIGHT[size], width: "auto" }}
      className={cn("inline-block align-middle select-none", className)}
      draggable={false}
    />
  );
}

export default LogoO2inc;
