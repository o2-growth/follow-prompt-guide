import { Compass } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

export default function Diagnostic360() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Compass className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Diagnóstico 360</h1>
          <p className="text-muted-foreground">
            Visão completa da maturidade da sua empresa em todas as áreas.
          </p>
        </div>
      </div>

      <EmptyState
        icon={Compass}
        title="Descubra como está sua empresa em todas as áreas"
        description="O Diagnóstico 360 é feito em nossa plataforma dedicada e avalia, de ponta a ponta, a maturidade do seu negócio: estratégia, gestão, pessoas, processos, comercial, marketing, operações e financeiro. Ao final, você recebe um score consolidado e recomendações priorizadas que aparecerão aqui no Strategic OS para guiar seu plano de ação."
        ctaLabel="Fazer Diagnóstico 360"
        ctaHref="https://mindful-interface-lab.lovable.app/auth"
        density="lg"
      />
    </div>
  );
}
