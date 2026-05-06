import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Target, CalendarCheck, FileDown, CheckCircle2 } from "lucide-react";
import { CoBranding } from "@/components/branding/CoBranding";
import { LogoG4Tools } from "@/components/branding/LogoG4Tools";

const PILLARS = [
  {
    icon: Compass,
    eyebrow: "Estratégico",
    title: "Para onde vamos",
    desc: "Visão 5/3/1, north star e diagnóstico de maturidade em 5 dimensões.",
  },
  {
    icon: Target,
    eyebrow: "Tático",
    title: "Como vamos chegar lá",
    desc: "OKRs trimestrais com KRs mensuráveis e estrutura de time com frameworks (SPIN, MEDDIC, RACI).",
  },
  {
    icon: CalendarCheck,
    eyebrow: "Operacional",
    title: "O que fazemos toda semana",
    desc: "Rituais (daily, weekly, 1:1, monthly, quarter) com agenda e check-ins.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-foreground/10 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container max-w-6xl flex items-center justify-between py-4">
          <CoBranding size="sm" variant="dark" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth/login">Entrar</Link></Button>
            <Button asChild size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground"><Link to="/auth/signup">Criar conta</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-foreground">
        {/* Grid blueprint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(0 0% 100% / 0.05) 1px, transparent 1px), linear-gradient(to bottom, hsl(0 0% 100% / 0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 35%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 80%)",
          }}
        />
        {/* Halo lima */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full z-0"
          style={{
            background:
              "radial-gradient(circle, hsl(119 84% 66% / 0.18), transparent 60%)",
          }}
        />
        <div className="container max-w-6xl py-20 md:py-28 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-medium mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Presente exclusivo <LogoG4Tools height={14} className="ml-1" />
            </div>
            <h1 className="font-serif text-4xl md:text-6xl font-bold leading-tight tracking-tight">
              Transforme visão em <span className="text-accent">plano executável</span> de 5 anos.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-foreground/80 leading-relaxed">
              A plataforma estratégica criada por <strong className="text-accent">Pedro Albite (O2 Inc.)</strong> — 
              maior CFO-as-a-Service do Brasil — para CEOs de PMEs construírem em 30 minutos 
              o plano completo: visão, OKRs, estrutura de time e rituais.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-gold">
                <Link to="/auth/signup">
                  Construir meu plano agora <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-foreground/30 text-foreground hover:bg-foreground/10">
                <Link to="/auth/login">Já tenho conta</Link>
              </Button>
            </div>
            
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-foreground/70">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Em português, mobile e desktop</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> PDF completo do plano</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Acesso pleno ao workspace</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="container max-w-6xl">
          <div className="max-w-2xl mb-14">
            <div className="text-xs uppercase tracking-widest text-accent font-semibold mb-3">O que você vai construir</div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary">
              Três níveis. Um plano só.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map(({ icon: Icon, eyebrow, title, desc }) => (
              <div key={eyebrow} className="bg-card border border-border rounded-xl p-8 shadow-soft hover:shadow-elegant transition-smooth">
                <div className="h-12 w-12 rounded-lg gradient-gold flex items-center justify-center shadow-gold mb-5">
                  <Icon className="h-6 w-6 text-accent-foreground" />
                </div>
                <div className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">{eyebrow}</div>
                <h3 className="font-serif text-xl font-semibold text-primary mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PDF callout */}
      <section className="py-20 bg-ink-900 border-y border-accent/20">
        <div className="container max-w-4xl text-center">
          <FileDown className="h-10 w-10 text-accent mx-auto mb-4" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-4">
            Saia com o seu plano em PDF.
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Capa branded O2inc + G4, sumário executivo, visão 5/3/1, OKRs,
            organograma recomendado, calendário de rituais e plano de ação 90 dias.
          </p>
          <Button asChild size="lg"><Link to="/auth/signup">Construir meu plano agora <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <CoBranding size="sm" variant="dark" />
            <span className="hidden md:inline text-muted-foreground/60">·</span>
            <span>© {new Date().getFullYear()} Strategic OS</span>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-right">
            <span className="inline-flex items-center gap-2">Bônus exclusivo · <LogoG4Tools height={14} /> · Pedro Albite, CEO O2inc</span>
            <span className="hidden md:inline text-muted-foreground/40">·</span>
            <div className="flex items-center gap-3">
              <Link to="/privacidade" className="hover:text-primary underline-offset-4 hover:underline">Privacidade</Link>
              <Link to="/termos" className="hover:text-primary underline-offset-4 hover:underline">Termos</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
