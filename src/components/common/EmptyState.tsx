/**
 * EmptyState — placeholder reutilizável para listas vazias.
 *
 * Princípio: "Empty States Are Onboarding" — todo vazio é uma oportunidade
 * de orientar o usuário para a próxima ação relevante.
 */

import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  /** Caminho para `<Link to=…>` interno (react-router). Mutuamente exclusivo com `ctaOnClick`. */
  ctaTo?: string;
  /** Handler de clique. Mutuamente exclusivo com `ctaTo`. */
  ctaOnClick?: () => void;
  className?: string;
  /** Densidade do padding vertical. */
  density?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaTo,
  ctaOnClick,
  className,
  density = "md",
}: EmptyStateProps) {
  const padY = density === "sm" ? "py-10" : density === "lg" ? "py-20" : "py-14";

  const cta = ctaLabel
    ? ctaTo
      ? <Button asChild><Link to={ctaTo}>{ctaLabel}</Link></Button>
      : ctaOnClick
        ? <Button onClick={ctaOnClick}>{ctaLabel}</Button>
        : null
    : null;

  return (
    <div
      className={cn(
        "border-2 border-dashed border-border rounded-xl bg-muted/20",
        "flex flex-col items-center text-center px-6",
        padY,
        className
      )}
    >
      <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-accent" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-xl font-semibold text-primary mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">{description}</p>
      {cta}
    </div>
  );
}

export default EmptyState;
