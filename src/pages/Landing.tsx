import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Target, TrendingUp, Users2, CalendarCheck, Gauge, FileDown, CheckCircle2 } from "lucide-react";
import { CoBranding } from "@/components/branding/CoBranding";

const FEATURES = [
  { icon: Compass, title: "Visão 5/3/1", desc: "North star, missão e metas em cascata até a semana." },
  { icon: Target, title: "OKRs", desc: "Objetivos com KRs mensuráveis e check-ins semanais." },
  
  { icon: Users2, title: "Time & frameworks", desc: "Organograma recomendado, SPIN, MEDDIC, RACI." },
  { icon: CalendarCheck, title: "Rituais", desc: "Daily, weekly, monthly, 1:1 e quarter review." },
  { icon: Gauge, title: "Diagnóstico de maturidade", desc: "Radar em 5 dimensões com recomendações." },
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
      <section className="gradient-hero text-foreground">
        <div className="container max-w-6xl py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-medium mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Presente exclusivo G4 Educação
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
              Sete módulos integrados. Um plano estratégico cascateado da visão até a semana.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-elegant transition-smooth">
                <div className="h-11 w-11 rounded-lg gradient-gold flex items-center justify-center shadow-gold mb-4">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-primary mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PDF callout */}
      <section className="py-20 bg-muted/40 border-y border-border">
        <div className="container max-w-4xl text-center">
          <FileDown className="h-10 w-10 text-accent mx-auto mb-4" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-4">
            Saia com o seu plano em PDF.
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Capa branded O2inc + G4, sumário executivo, visão 5/3/1, OKRs, DRE em 3 cenários, 
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
            <span>Bônus exclusivo · Palestra G4 Educação · Pedro Albite, CEO O2inc</span>
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
