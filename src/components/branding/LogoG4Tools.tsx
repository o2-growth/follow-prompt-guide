/**
 * LogoG4Tools — logo oficial G4 Tools (PNG transparente).
 * Em fundos escuros aplicamos invert para garantir contraste com a marca lima/off-white.
 */
import logo from "@/assets/branding/g4-tools-logo.png";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "dark" | "light"; // dark = fundo escuro (inverte para branco), light = mantém navy
  height?: number;
}

export function LogoG4Tools({ className, variant = "dark", height = 18 }: Props) {
  return (
    <img
      src={logo}
      alt="G4 Tools"
      style={{ height }}
      className={cn(
        "inline-block w-auto align-middle select-none",
        variant === "dark" && "invert brightness-110 contrast-125",
        className
      )}
      draggable={false}
    />
  );
}
