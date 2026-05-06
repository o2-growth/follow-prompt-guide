import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <h1 className="font-serif text-3xl font-bold text-primary">Termos de uso</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {today}</p>

        <div className="space-y-4 text-sm leading-relaxed mt-6">
          <p>
            <strong>Em revisão pelo jurídico O2inc.</strong> Versão placeholder. Para
            esclarecimentos, contate <a className="underline" href="mailto:legal@o2inc.com.br">legal@o2inc.com.br</a>.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">1. Objeto</h2>
          <p>
            Strategic OS é um produto da O2inc, oferecido como bônus exclusivo aos participantes
            do G4 Tools. O acesso é gratuito durante o ciclo da Mesa Redonda.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">2. Conta</h2>
          <p>
            Você é responsável por manter a confidencialidade da sua senha e por toda atividade
            realizada na conta.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">3. Conteúdo do usuário</h2>
          <p>
            Todo conteúdo criado dentro do workspace (visão, OKRs, dados financeiros) é de propriedade
            do usuário/empresa. A O2inc apenas armazena e processa para entregar o produto.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">4. Limitação de responsabilidade</h2>
          <p>
            O produto é fornecido "como está", sem garantia de disponibilidade ininterrupta. As
            projeções financeiras são baseadas em premissas inseridas pelo usuário e não constituem
            recomendação de investimento.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">5. Alterações</h2>
          <p>
            Esses termos podem ser atualizados. Mudanças relevantes serão comunicadas por e-mail
            cadastrado.
          </p>
        </div>
      </div>
    </div>
  );
}
