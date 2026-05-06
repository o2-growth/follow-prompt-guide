import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-12 prose prose-slate dark:prose-invert">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <h1 className="font-serif text-3xl font-bold text-primary">Política de privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {today}</p>

        <div className="space-y-4 text-sm leading-relaxed mt-6">
          <p>
            <strong>Em revisão pelo jurídico O2inc.</strong> Esta versão é um placeholder
            informativo enquanto o documento final é aprovado. Em caso de dúvidas, contate
            <a className="underline ml-1" href="mailto:dpo@o2inc.com.br">dpo@o2inc.com.br</a>.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">1. Coleta de dados</h2>
          <p>
            Coletamos somente os dados necessários para criar e operar seu workspace estratégico:
            nome, e-mail, dados da empresa (nome, CNPJ, setor, faturamento aproximado) e o conteúdo
            que você cria (visão, OKRs, projeções, rituais, time).
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">2. Uso dos dados</h2>
          <p>
            Os dados são usados exclusivamente para entregar a funcionalidade do produto e gerar
            relatórios solicitados por você (PDF do plano). Não compartilhamos dados com terceiros
            para fins de marketing.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">3. Direitos LGPD</h2>
          <p>
            Você pode, a qualquer momento, solicitar acesso, retificação, exclusão ou exportação
            dos seus dados. Use os botões em <Link to="/settings" className="underline">Configurações</Link> ou
            envie e-mail ao DPO.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">4. Segurança</h2>
          <p>
            Dados são armazenados em provedor (Supabase) com criptografia em repouso e em trânsito,
            isolados por tenant via Row Level Security. Erros são monitorados (Sentry) sem coletar
            conteúdo do usuário.
          </p>

          <h2 className="font-serif text-xl font-semibold text-primary mt-6">5. Contato</h2>
          <p>
            DPO O2inc — <a className="underline" href="mailto:dpo@o2inc.com.br">dpo@o2inc.com.br</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
