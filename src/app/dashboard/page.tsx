
"use client"

import { useState, useMemo, useEffect } from "react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Users, GraduationCap, DollarSign, AlertCircle, TrendingUp, Sparkles, FileText, Download, Loader2, Filter, Layers, Copy, Check } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

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
  const [copied, setCopied] = useState(false);
  const [filterLocalizacao, setFilterLocalizacao] = useState<string>("todas");
  const [filterDependencia, setFilterDependencia] = useState<string>("3");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  const expensesRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'expenses') : null), [db, municipioId]);
  const { data: allExpenses } = useCollection(expensesRef);

  const paramsRef = useMemo(() => (db && municipioId ? doc(db, 'municipios', municipioId, 'config', 'parameters') : null), [db, municipioId]);
  const { data: customParams } = useDoc(paramsRef);
  const parametros = (customParams as any) || DEFAULT_PARAMETERS;

  const { analysis, stats, networkTotals } = useMemo(() => {
    if (!schools || schools.length === 0) return { analysis: [], stats: null, networkTotals: null };

    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculasMunicipal = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    const filteredSchools = schools.filter(s => {
      const matchesLocalizacao = filterLocalizacao === "todas" ? true : String(s.localizacao).toLowerCase() === filterLocalizacao.toLowerCase();
      const matchesDependencia = filterDependencia === "todas" ? true : String(s.tp_dependencia).trim() === filterDependencia;
      return matchesLocalizacao && matchesDependencia;
    });

    const schoolAnalyses = filteredSchools.map((school: any) => {
      const m = school.matriculas || {};
      const vaaf = calcularVAAF(m, parametros);
      const vaat = calcularVAAT(school, parametros, totalMatriculasMunicipal);
      const pnae = calcularPNAE(m, parametros);
      const mde = calcularMDE(school, parametros, totalMatriculasMunicipal);
      const outros = calcularOutros(school, parametros, totalMatriculasMunicipal);
      
      const receitaTotal = vaaf + vaat + pnae + mde + outros;
      
      // Busca despesas reais do banco de dados para esta escola
      const schoolExpenses = (allExpenses || []).filter((e: any) => e.schoolId === school.id);
      const despesaReal = schoolExpenses.reduce((acc, e: any) => acc + (e.value || 0), 0);
      
      // Se não houver despesa lançada, usa uma estimativa técnica (95% da receita)
      const despesaTotal = despesaReal > 0 ? despesaReal : (receitaTotal * 0.95);
      
      const saldo = receitaTotal - despesaTotal;
      const cobertura = despesaTotal > 0 ? receitaTotal / despesaTotal : 1;
      const custoAluno = (school.total_matriculas || 0) > 0 ? despesaTotal / school.total_matriculas : 0;
      const receitaAluno = (school.total_matriculas || 0) > 0 ? receitaTotal / school.total_matriculas : 0;

      let status: 'superavit' | 'neutro' | 'deficit' = 'superavit';
      if (cobertura <= 0.98) status = 'deficit';
      else if (cobertura < 1.02) status = 'neutro';

      return {
        ...school,
        vaaf,
        vaat,
        pnae,
        mde,
        outros,
        receitaTotal,
        despesaTotal,
        saldo,
        cobertura,
        custoAluno,
        receitaAluno,
        status
      };
    });

    // Totais consolidados da REDE MUNICIPAL (independente de filtros de exibição)
    const totalMatriculasRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);
    const totalETIRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_eti || 0), 0);
    
    // Cálculo de totais financeiros da rede municipal para a IA
    const municipalRevenue = municipalSchools.reduce((acc, s: any) => {
      const m = s.matriculas || {};
      const vaaf = calcularVAAF(m, parametros);
      const vaat = calcularVAAT(s, parametros, totalMatriculasRede);
      const pnae = calcularPNAE(m, parametros);
      const mde = calcularMDE(s, parametros, totalMatriculasRede);
      const outros = calcularOutros(s, parametros, totalMatriculasRede);
      return {
        vaaf: acc.vaaf + vaaf,
        vaat: acc.vaat + vaat,
        pnae: acc.pnae + pnae,
        mde: acc.mde + mde,
        outros: acc.outros + outros,
        total: acc.total + (vaaf + vaat + pnae + mde + outros)
      };
    }, { vaaf: 0, vaat: 0, pnae: 0, mde: 0, outros: 0, total: 0 });

    const currentTotalSaldo = schoolAnalyses.reduce((acc, s) => acc + s.saldo, 0);
    const currentDeficitCount = schoolAnalyses.filter(s => s.status === 'deficit').length;
    const currentAvgCusto = schoolAnalyses.length > 0 ? schoolAnalyses.reduce((acc, s) => acc + s.custoAluno, 0) / schoolAnalyses.length : 0;
    const currentTotalReceita = schoolAnalyses.reduce((acc, s) => acc + s.receitaTotal, 0);

    return {
      analysis: schoolAnalyses,
      stats: {
        totalMatriculasRede,
        totalETIRede,
        percentualETI: totalMatriculasRede > 0 ? (totalETIRede / totalMatriculasRede) * 100 : 0,
        totalSaldo: currentTotalSaldo,
        deficitCount: currentDeficitCount,
        avgCusto: currentAvgCusto,
        receitaAlunoMedio: currentTotalReceita / (schoolAnalyses.reduce((acc, s) => acc + (s.total_matriculas || 0), 0) || 1)
      },
      networkTotals: municipalRevenue
    };
  }, [schools, allExpenses, parametros, filterLocalizacao, filterDependencia]);

  const handleGenerateReport = async () => {
    if (!stats || !networkTotals) {
      toast({ title: "Dados incompletos", description: "Aguarde o carregamento dos dados da rede.", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    setReport(null);
    
    try {
      const getPerc = (val: number) => networkTotals.total > 0 ? Math.round((val / networkTotals.total) * 100) : 0;

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
          fundebVaaf: { amount: Math.round(networkTotals.vaaf), percentage: getPerc(networkTotals.vaaf) },
          vaat: { amount: Math.round(networkTotals.vaat), percentage: getPerc(networkTotals.vaat) },
          pnae: { amount: Math.round(networkTotals.pnae), percentage: getPerc(networkTotals.pnae) },
          mdeLiquido: { amount: Math.round(networkTotals.mde), percentage: getPerc(networkTotals.mde) },
          outros: { amount: Math.round(networkTotals.outros), percentage: getPerc(networkTotals.outros) },
        },
        escolasEmAtencao: analysis
          .filter(s => s.status === 'deficit')
          .slice(0, 5)
          .map(s => `${s.nome}: Cobertura de ${s.cobertura.toFixed(2)}x, Custo/Aluno R$ ${Math.round(s.custoAluno)}`),
      };
      
      const result = await generateExecutiveFinancialReport(input as any);
      setReport(result);
      toast({ title: "Diagnóstico Gerado", description: "A IA concluiu a análise técnica da rede municipal." });
    } catch (error) {
      toast({
        title: "Erro na IA",
        description: "Não foi possível conectar ao serviço de narrativa técnica.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado", description: "Relatório copiado para a área de transferência." });
  };

  const formatVal = (v: number) => mounted ? v.toLocaleString('pt-BR') : "0";
  const formatCur = (v: number) => mounted ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : "0";

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground animate-pulse">Carregando dados da rede municipal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Diagnóstico: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Visão geral do exercício fiscal 2026 (Filtro Central: Municipal)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Local:</span>
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
                <SelectItem value="3">Municipal (Alvo)</SelectItem>
                <SelectItem value="1">Federal</SelectItem>
                <SelectItem value="2">Estadual</SelectItem>
                <SelectItem value="4">Privada</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerateReport} disabled={isGenerating || analysis.length === 0} size="sm" className="gap-2 bg-accent hover:bg-accent/90 shadow-md">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isGenerating ? "Analisando..." : "Gerar Narrativa IA"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Matrículas Municipais" 
          value={formatVal(stats?.totalMatriculasRede || 0)} 
          icon={Users}
          subtitle="Rede direta da prefeitura"
        />
        <KPICard 
          title="Alunos em ETI" 
          value={`${stats?.percentualETI.toFixed(1)}%`} 
          icon={GraduationCap}
          subtitle={`${stats?.totalETIRede} alunos municipais integrais`}
        />
        <KPICard 
          title="Saldo Estimado" 
          value={`R$ ${((stats?.totalSaldo || 0) / 1000).toFixed(1)}k`} 
          icon={DollarSign}
          subtitle={stats?.totalSaldo! >= 0 ? "Superávit Projetado" : "Déficit Projetado"}
          className={stats?.totalSaldo! >= 0 ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}
        />
        <KPICard 
          title="Alerta de Déficit" 
          value={stats?.deficitCount || 0} 
          icon={AlertCircle}
          subtitle={`Unidades no cenário crítico`}
          className={stats?.deficitCount! > 0 ? "bg-orange-50/50 border-orange-200" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Ranking de Eficiência Escolar</CardTitle>
            <CardDescription>
              Comparativo Receita vs Custo (Base FUNDEB 2026 + Despesas Lançadas)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Escola</TableHead>
                  <TableHead className="text-right">Receita/Aluno</TableHead>
                  <TableHead className="text-right">Custo/Aluno</TableHead>
                  <TableHead className="text-right">% ETI</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.length > 0 ? (
                  analysis.map((school) => (
                    <TableRow key={school.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium text-sm">{school.nome}</div>
                        <div className="text-[10px] text-muted-foreground uppercase flex gap-2">
                          <span className="font-bold text-primary">{String(school.localizacao).toUpperCase()}</span>
                          <span>•</span>
                          <span>{DEPENDENCIA_LABELS[String(school.tp_dependencia)] || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">R$ {formatCur(school.receitaAluno)}</TableCell>
                      <TableCell className="text-right text-xs">R$ {formatCur(school.custoAluno)}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-accent">{school.percentual_eti || 0}%</TableCell>
                      <TableCell>
                        <Badge variant={school.status === 'superavit' ? 'default' : school.status === 'deficit' ? 'destructive' : 'secondary'} className={school.status === 'superavit' ? 'bg-green-600' : ''}>
                          {school.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic bg-muted/10">
                      Nenhuma escola encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-accent/20 shadow-lg">
          <CardHeader className="bg-accent/5 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-headline text-lg text-accent">
                <Sparkles className="h-5 w-5" />
                Narrativa IA
              </CardTitle>
              {report && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            {report ? (
              <ScrollArea className="h-[450px] pr-4">
                <div className="text-xs space-y-4 whitespace-pre-wrap font-body leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
                  {report}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 border-2 border-dashed rounded-2xl bg-muted/5">
                <div className="p-4 bg-accent/10 rounded-full animate-pulse">
                  <FileText className="h-12 w-12 text-accent/40" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800">Pronto para Diagnóstico</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed max-w-[200px] mx-auto">
                    {isGenerating 
                      ? "A IA está processando os microdados fiscais de 2026..." 
                      : "Gere uma análise textual completa sobre a sustentabilidade da rede municipal."}
                  </p>
                </div>
                {!isGenerating && (
                  <Button 
                    onClick={handleGenerateReport} 
                    size="sm" 
                    disabled={analysis.length === 0} 
                    variant="outline" 
                    className="border-accent text-accent hover:bg-accent/5 gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Gerar agora
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
