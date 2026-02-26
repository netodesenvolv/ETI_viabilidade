import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight, ShieldCheck, TrendingUp, Search } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-white">
        <Link className="flex items-center justify-center gap-2" href="#">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-headline font-bold text-xl text-primary">EduFin Insights</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/dashboard">
            Acessar Sistema
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-primary text-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
                  Gestão Financeira para<br />Escolas em Tempo Integral
                </h1>
                <p className="mx-auto max-w-[700px] text-white/80 md:text-xl font-body">
                  Análise de viabilidade, diagnóstico de custos e projeção de receitas para redes municipais de educação.
                </p>
              </div>
              <div className="space-x-4 pt-4">
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                  <Link href="/dashboard">
                    Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 p-6 bg-white rounded-xl shadow-sm border">
                <div className="p-3 bg-primary/10 rounded-full">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Diagnóstico Preciso</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Cruze dados do Censo Escolar com custos reais para identificar gargalos financeiros por escola.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 p-6 bg-white rounded-xl shadow-sm border">
                <div className="p-3 bg-primary/10 rounded-full">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Simulador de Expansão</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Projete o impacto financeiro de novas turmas de tempo integral com base nos fatores do FUNDEB 2026.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 p-6 bg-white rounded-xl shadow-sm border">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold">Análise com IA</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Relatórios narrativos automatizados para apresentações executivas e secretarias de finanças.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-white">
        <p className="text-xs text-muted-foreground">© 2026 EduFin Insights. Sistema de Viabilidade ETI.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Termos de Uso
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacidade
          </Link>
        </nav>
      </footer>
    </div>
  );
}
