
"use client"

import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Users, GraduationCap, DollarSign, AlertCircle, TrendingUp, Sparkles, FileText, Download, Loader2, Filter, Layers } from "lucide-react";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateExecutiveFinancialReport } from "@/ai/flows/generate-executive-financial-report";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEPENDENCIA_LABELS: Record<string, string> = {
  "1": "Federal",
  "2": "Estadual",
  "3": "Municipal",
  "4": "Privada"
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [filterLocalizacao, setFilterLocalizacao] = useState<string>("todas");
  const [filterDependencia, setFilterDependencia] = useState<string>("todas");

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  const paramsRef = useMemo(() => (db && municipioId ? doc(db, 'municipios', municipioId, 'config', 'parameters') : null), [db, municipioId]);
  const { data: customParams } = useDoc(paramsRef);
  const parametros = (customParams as any) || DEFAULT_PARAMETERS;

  const { analysis, stats } = useMemo(() => {
    if (!schools || schools.length === 0) return { analysis: [], stats: null };

    const filteredSchools = schools.filter(s => {
      const matchesLocalizacao = filterLocalizacao === "todas" ? true : s.localizacao === filterLocalizacao;
      const matchesDependencia = filterDependencia === "todas" ? true : String(s.tp_dependencia) === filterDependencia;
      return matchesLocalizacao && matchesDependencia;
    });

    if (filteredSchools.length === 0) return { analysis: [], stats: null };

    const totalMatriculasRede = filteredSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);
    const totalETIRede = filteredSchools.reduce((acc, s: any) => acc + (s.total_eti || 0), 0);

    const schoolAnalyses = filteredSchools.map((school: any) => {
      const schoolMatriculas = school.matriculas || {
        creche_integral: 0, creche_parcial: 0, creche_conveniada_int: 0, creche_conveniada_par: 0,
        pre_integral: 0, pre_parcial: 0, ef_ai_integral: 0, ef_ai_parcial: 0, ef_af_integral: 0, ef_af_parcial: 0,
        eja_fundamental: 0, eja_medio: 0, especial_aee: 0, indigena_quilombola: 0, campo_rural: 0
      };

      const vaaf = calcularVAAF(schoolMatriculas, parametros);
      const vaat = calcularVAAT(school, parametros, totalMatriculasRede);
      const pnae = calcularPNAE(schoolMatriculas, parametros);
      const mde = calcularMDE(school, parametros, totalMatriculasRede);
      const outros = calcularOutros(school, parametros, totalMatriculasRede);
      
      const receitaTotal = vaaf + vaat + pnae + mde + outros;
      const despesaTotal = school.total_despesa || (receitaTotal * 0.92);
      const saldo = receitaTotal - despesaTotal;
      const cobertura = despesaTotal > 0 ? receitaTotal / despesaTotal : 1;
      const custoAluno = (school.total_matriculas || 0) > 0 ? despesaTotal / school.total_matriculas : 0;
      const receitaAluno = (school.total_matriculas || 0) > 0 ? receitaTotal / school.total_matriculas : 0;

      let status: 'superavit' | 'neutro' | 'deficit' = 'superavit';
      if (cobertura <= 0.95) status = 'deficit';
      else if (cobertura < 1.05) status = 'neutro';

      return {
        ...school,
        receitaTotal,
        despesaTotal,
        saldo,
        cobertura,
        custoAluno,
        receitaAluno,
        status
      };
    });

    const totalSaldo = schoolAnalyses.reduce((acc, s) => acc + s.saldo, 0);
    const deficitCount = schoolAnalyses.filter(s => s.status === 'deficit').length;
    const avgCusto = schoolAnalyses.reduce((acc, s) => acc + s.custoAluno, 0) / (schoolAnalyses.length || 1);
    const totalReceitaRede = schoolAnalyses.reduce((acc, s) => acc + s.receitaTotal, 0);

    return {
      analysis: schoolAnalyses,
      stats: {
        totalMatriculasRede,
        totalETIRede,
        percentualETI: totalMatriculasRede > 0 ? (totalETIRede / totalMatriculasRede) * 100 : 0,
        totalSaldo,
        deficitCount,
        avgCusto,
        receitaAlunoMedio: totalMatriculasRede > 0 ? totalReceitaRede / totalMatriculasRede : 0
      }
    };
  }, [schools, parametros, filterLocalizacao, filterDependencia]);

  const handleGenerateReport = async () => {
    if (!stats) return;
    setIsGenerating(true);
    try {
      const input = {
        municipio: profile?.municipio || "Município",
        uf: profile?.uf || "BA",
        exercicio: 2026,
        totalMatriculas: stats.totalMatriculasRede,
        totalETI: stats.totalETIRede,
        percentualETI: Math.round(stats.percentualETI),
        custoAlunoMedio: Math.round(stats.avgCusto),
        receitaAlunoMedio: Math.round(stats.receitaAlunoMedio),
        saldoTotalRede: Math.round(stats.totalSaldo),
        saldoStatus: stats.totalSaldo >= 0 ? "superávit" : "déficit",
        escolasEmDeficit: stats.deficitCount,
        totalEscolas: analysis.length,
        escolasETIlt20Percent: analysis.filter(s => (s.percentual_eti || 0) < 20).length,
        composicaoReceitas: {
          fundebVaaf: { amount: Math.round(stats.totalMatriculasRede * parametros.vaaf_base * 0.7), percentage: 70 },
          vaat: { amount: Math.round(parametros.vaat_total_rede), percentage: 15 },
          pnae: { amount: 150000, percentage: 5 },
          mdeLiquido: { amount: Math.round(parametros.mde_liquido_eti), percentage: 10 },
          outros: { amount: 50000, percentage: 0 },
        },
        escolasEmAtencao: analysis
          .filter(s => s.status === 'deficit')
          .slice(0, 5)
          .map(s => `${s.nome}: Cobertura de ${s.cobertura.toFixed(2)}x`),
      };
      
      const result = await generateExecutiveFinancialReport(input as any);
      setReport(result);
    } catch (error) {
      toast({
        title: "Erro ao gerar relatório",
        description: "Não foi possível conectar ao serviço de IA.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground animate-pulse">Carregando dados da rede...</p>
      </div>
    );
  }

  if (!schools || schools.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola encontrada</h3>
        <p className="text-muted-foreground max-w-xs">
          Parece que ainda não foram consolidados dados do Censo Escolar para o município de {profile?.municipio}.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard/censo">Ir para Censo Escolar</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Diagnóstico: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Visão geral do exercício fiscal 2026</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entidade:</span>
            <Select value={filterLocalizacao} onValueChange={setFilterLocalizacao}>
              <SelectTrigger className="h-8 w-[120px] border-none shadow-none focus:ring-0 text-xs font-bold">
                <SelectValue placeholder="Localização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="urbana">Urbana</SelectItem>
                <SelectItem value="rural">Rural</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rede:</span>
            <Select value={filterDependencia} onValueChange={setFilterDependencia}>
              <SelectTrigger className="h-8 w-[140px] border-none shadow-none focus:ring-0 text-xs font-bold">
                <SelectValue placeholder="Dependência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="1">Federal</SelectItem>
                <SelectItem value="2">Estadual</SelectItem>
                <SelectItem value="3">Municipal</SelectItem>
                <SelectItem value="4">Privada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-8 w-px bg-border hidden lg:block" />

          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button onClick={handleGenerateReport} disabled={isGenerating} size="sm" className="gap-2 bg-accent hover:bg-accent/90">
            <Sparkles className="h-4 w-4" /> 
            {isGenerating ? "Gerando Relatório..." : "Análise IA"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Matrículas Filtradas" 
          value={stats?.totalMatriculasRede.toLocaleString() || "0"} 
          icon={Users}
          subtitle="Critérios de filtro ativos"
        />
        <KPICard 
          title="Alunos em ETI" 
          value={`${stats?.percentualETI.toFixed(1)}%`} 
          icon={GraduationCap}
          subtitle={`${stats?.totalETIRede} alunos em tempo integral`}
        />
        <KPICard 
          title="Saldo do Grupo" 
          value={`R$ ${((stats?.totalSaldo || 0) / 1000).toFixed(1)}k`} 
          icon={DollarSign}
          subtitle={stats?.totalSaldo! >= 0 ? "Superávit projetado" : "Déficit projetado"}
          className={stats?.totalSaldo! >= 0 ? "bg-green-50/50" : "bg-red-50/50"}
        />
        <KPICard 
          title="Escolas em Déficit" 
          value={stats?.deficitCount || 0} 
          icon={AlertCircle}
          subtitle={`De ${analysis.length} unidades filtradas`}
          className={stats?.deficitCount! > 0 ? "bg-orange-50/50" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">Diagnóstico por Escola</CardTitle>
            <CardDescription>
              Resultados financeiros detalhados por unidade dentro dos filtros selecionados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escola</TableHead>
                  <TableHead className="text-right">Receita/Aluno</TableHead>
                  <TableHead className="text-right">Custo/Aluno</TableHead>
                  <TableHead className="text-right">% ETI</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{school.nome}</div>
                      <div className="text-[10px] text-muted-foreground uppercase flex gap-2">
                        <span>{school.localizacao}</span>
                        <span>•</span>
                        <span>{DEPENDENCIA_LABELS[school.tp_dependencia] || "Dependência " + school.tp_dependencia}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">R$ {school.receitaAluno.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {school.custoAluno.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{school.percentual_eti || 0}%</TableCell>
                    <TableCell>
                      <Badge variant={school.status === 'superavit' ? 'default' : school.status === 'deficit' ? 'destructive' : 'secondary'} className={school.status === 'superavit' ? 'bg-green-600' : ''}>
                        {school.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Sparkles className="h-5 w-5 text-accent" />
              Relatório Executivo
            </CardTitle>
            <CardDescription>Análise narrativa gerada por IA</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {report ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="text-sm space-y-4 whitespace-pre-wrap font-body leading-relaxed">
                  {report}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  {isGenerating ? "Nossa IA está analisando os microdados financeiros..." : "Clique em 'Análise IA' para gerar o diagnóstico narrativo da rede."}
                </p>
                {!isGenerating && <Button onClick={handleGenerateReport} size="sm">Gerar Agora</Button>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
