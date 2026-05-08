
"use client"

import { useState, useMemo, useEffect } from "react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Users, 
  GraduationCap, 
  DollarSign, 
  AlertCircle, 
  TrendingUp, 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  FileDown, 
  ShieldCheck, 
  Scale, 
  Info, 
  Building2,
  Filter,
  Layers,
  Eye,
  Loader2,
  Search,
  PieChart,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularVAAR, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [filterETI, setFilterETI] = useState<string>("todas");
  const [mounted, setMounted] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'nome', direction: 'asc' });

  useEffect(() => {
    setMounted(true);
  }, []);

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const { activeMunicipioId, activeMunicipioName, activeUF } = require('@/providers/municipality-provider').useMunicipality();

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = activeMunicipioId;

  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  const expensesRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'expenses') : null), [db, municipioId]);
  const { data: allExpenses } = useCollection(expensesRef);

  const paramsRef = useMemo(() => (db && municipioId ? doc(db, 'municipios', municipioId, 'config', 'parameters') : null), [db, municipioId]);
  const { data: customParams } = useDoc(paramsRef);
  const parametros = (customParams as any) || DEFAULT_PARAMETERS;

  const { analysis, stats, networkTotals, nativeInsights } = useMemo(() => {
    if (!schools || schools.length === 0) return { analysis: [], stats: null, networkTotals: null, nativeInsights: [] };

    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculasMunicipal = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    const filteredSchools = schools.filter(s => {
      const matchesLocalizacao = filterLocalizacao === "todas" ? true : String(s.localizacao).toLowerCase() === filterLocalizacao.toLowerCase();
      const matchesDependencia = filterDependencia === "todas" ? true : String(s.tp_dependencia).trim() === filterDependencia;
      const matchesETI = filterETI === "todas" ? true : (filterETI === "sim" ? (s.total_eti || 0) > 0 : (s.total_eti || 0) === 0);
      return matchesLocalizacao && matchesDependencia && matchesETI;
    });

    const schoolAnalyses = filteredSchools.map((school: any) => {
      const m = school.matriculas || {};
      const vaaf = calcularVAAF(m, parametros);
      const vaat = calcularVAAT(school, parametros, totalMatriculasMunicipal);
      const vaar = calcularVAAR(school, parametros, totalMatriculasMunicipal);
      const pnae = calcularPNAE(m, parametros);
      const mde = calcularMDE(school, parametros, totalMatriculasMunicipal);
      const outros = calcularOutros(school, parametros, totalMatriculasMunicipal);
      
      const receitaTotal = vaaf + vaat + vaar + pnae + mde + outros;
      const schoolExpensesList = (allExpenses || []).filter((e: any) => e.schoolId === school.id);
      const despesaReal = schoolExpensesList.reduce((acc, e: any) => acc + (e.value || 0), 0);
      
      const despesaTotal = despesaReal;
      const saldo = receitaTotal - despesaTotal;
      const cobertura = despesaTotal > 0 ? receitaTotal / despesaTotal : 1;
      const custoAluno = (school.total_matriculas || 0) > 0 ? despesaTotal / school.total_matriculas : 0;
      const receitaAluno = (school.total_matriculas || 0) > 0 ? receitaTotal / school.total_matriculas : 0;

      let status: 'superavit' | 'neutro' | 'deficit' = 'superavit';
      if (despesaTotal === 0) status = 'neutro';
      else if (cobertura <= 0.98) status = 'deficit';
      else if (cobertura < 1.02) status = 'neutro';

      return {
        ...school,
        vaaf, vaat, vaar, pnae, mde, outros,
        receitaTotal, despesaTotal, saldo, cobertura,
        custoAluno, receitaAluno, status,
        expensesDetail: schoolExpensesList
      };
    });

    const totalMatriculasRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);
    const totalETIRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_eti || 0), 0);
    
    const segmentTotals = municipalSchools.reduce((acc, s: any) => {
      const m = s.matriculas || {};
      const f = parametros.fatores;

      const infantilRaw = (m.creche_integral || 0) + (m.creche_parcial || 0) + (m.creche_conveniada_int || 0) + (m.creche_conveniada_par || 0) + (m.pre_integral || 0) + (m.pre_parcial || 0);
      const infantilWeighted = 
        (m.creche_integral || 0) * (f.A1 || 1.550) +
        (m.creche_parcial || 0) * (f.A2 || 1.250) +
        (m.creche_conveniada_int || 0) * (f.A3 || 1.450) +
        (m.creche_conveniada_par || 0) * (f.A4 || 1.150) +
        (m.pre_integral || 0) * (f.B1 || 1.500) +
        (m.pre_parcial || 0) * (f.B2 || 1.150);

      const aiRaw = (m.ef_ai_integral || 0) + (m.ef_ai_parcial || 0);
      const aiWeighted = (m.ef_ai_integral || 0) * (f.C1 || 1.300) + (m.ef_ai_parcial || 0) * (f.C2 || 1.000);

      const afRaw = (m.ef_af_integral || 0) + (m.ef_af_parcial || 0);
      const afWeighted = (m.ef_af_integral || 0) * (f.D1 || 1.300) + (m.ef_af_parcial || 0) * (f.D2 || 1.100);

      const ejaRaw = (m.eja_fundamental || 0) + (m.eja_medio || 0);
      const ejaWeighted = (m.eja_fundamental || 0) * (f.E1 || 0.800) + (m.eja_medio || 0) * (f.E2 || 0.850);

      const totalInfantil = (m.creche_integral || 0) + (m.creche_parcial || 0) + (m.pre_integral || 0) + (m.pre_parcial || 0);
      const totalAi = (m.ef_ai_integral || 0) + (m.ef_ai_parcial || 0);
      const totalAf = (m.ef_af_integral || 0) + (m.ef_af_parcial || 0);
      let fatorBaseAEE = f.C2 || 1.00; 
      if (totalAf > totalAi && totalAf > totalInfantil) fatorBaseAEE = f.D2 || 1.10;
      else if (totalInfantil > totalAi && totalInfantil > totalAf) fatorBaseAEE = f.B2 || 1.15;
      
      const especialRaw = (m.especial_aee || 0);
      const especialWeighted = especialRaw * (fatorBaseAEE + (f.F1 || 1.40));

      return {
        infantil: { raw: acc.infantil.raw + infantilRaw, weighted: acc.infantil.weighted + infantilWeighted },
        ai: { raw: acc.ai.raw + aiRaw, weighted: acc.ai.weighted + aiWeighted },
        af: { raw: acc.af.raw + afRaw, weighted: acc.af.weighted + afWeighted },
        eja: { raw: acc.eja.raw + ejaRaw, weighted: acc.eja.weighted + ejaWeighted },
        especial: { raw: acc.especial.raw + especialRaw, weighted: acc.especial.weighted + especialWeighted }
      };
    }, {
      infantil: { raw: 0, weighted: 0 }, ai: { raw: 0, weighted: 0 }, af: { raw: 0, weighted: 0 }, eja: { raw: 0, weighted: 0 }, especial: { raw: 0, weighted: 0 }
    });

    const totalMatriculasPonderadasRede = Object.values(segmentTotals).reduce((acc, s) => acc + s.weighted, 0);

    const municipalRevenue = municipalSchools.reduce((acc, s: any) => {
      const m = s.matriculas || {};
      const vaaf = calcularVAAF(m, parametros);
      const vaat = calcularVAAT(s, parametros, totalMatriculasRede);
      const vaar = calcularVAAR(s, parametros, totalMatriculasRede);
      const pnae = calcularPNAE(m, parametros);
      const mde = calcularMDE(s, parametros, totalMatriculasRede);
      const outros = calcularOutros(s, parametros, totalMatriculasRede);
      return {
        vaaf: acc.vaaf + vaaf, vaat: acc.vaat + vaat, vaar: acc.vaar + vaar, pnae: acc.pnae + pnae, mde: acc.mde + mde, outros: acc.outros + outros,
        total: acc.total + (vaaf + vaat + vaar + pnae + mde + outros)
      };
    }, { vaaf: 0, vaat: 0, vaar: 0, pnae: 0, mde: 0, outros: 0, total: 0 });

    const totalSecretariaExpenses = (allExpenses || []).filter((e: any) => e.schoolId === 'SECRETARIA').reduce((acc, e: any) => acc + (e.value || 0), 0);
    const currentTotalSaldo = schoolAnalyses.reduce((acc, s) => acc + s.saldo, 0) - totalSecretariaExpenses;
    const currentDeficitCount = schoolAnalyses.filter(s => s.status === 'deficit').length;
    const currentAvgCusto = schoolAnalyses.length > 0 ? schoolAnalyses.reduce((acc, s) => acc + s.custoAluno, 0) / schoolAnalyses.length : 0;
    const currentTotalReceita = schoolAnalyses.reduce((acc, s) => acc + s.receitaTotal, 0);
    const percETI = totalMatriculasRede > 0 ? (totalETIRede / totalMatriculasRede) * 100 : 0;
    const schoolsWithEtiCount = municipalSchools.filter(s => (s.total_eti || 0) > 0).length;
    const percSchoolsWithEti = municipalSchools.length > 0 ? (schoolsWithEtiCount / municipalSchools.length) * 100 : 0;

    const hasExpenses = (allExpenses || []).length > 0;

    const technicalInsights = [
      {
        title: "Meta PNE (Matrículas)",
        value: `${percETI.toFixed(1)}%`,
        status: percETI >= 40 ? "Conforme" : "Abaixo da Meta",
        description: percETI >= 40 ? "Rede atende a Meta 6 (mínimo 40% das matrículas em tempo integral)." : "Necessário expandir matrículas ETI para atingir a meta de 40%.",
        variant: percETI >= 40 ? "success" : "warning"
      },
      {
        title: "Meta PNE (Escolas)",
        value: `${percSchoolsWithEti.toFixed(1)}%`,
        status: percSchoolsWithEti >= 55 ? "Conforme" : "Abaixo da Meta",
        description: percSchoolsWithEti >= 55 ? "Rede atende a meta de 55% das escolas com tempo integral." : "Necessário ampliar a oferta para atingir 55% das unidades.",
        variant: percSchoolsWithEti >= 55 ? "success" : "warning"
      },
      {
        title: "Sustentabilidade Operacional",
        value: !hasExpenses ? "Aguardando Dados" : (currentTotalSaldo >= 0 ? "Superavitário" : "Déficit"),
        status: !hasExpenses ? "Sem Lançamentos" : (currentTotalSaldo >= 0 ? "Equilibrado" : "Alerta Fiscal"),
        description: !hasExpenses ? "Lance as despesas em 'Gestão de Despesas' para análise." : (currentTotalSaldo >= 0 ? "A receita municipal cobre os custos projetados." : "A rede opera acima da capacidade de repasse atual."),
        variant: !hasExpenses ? "info" : (currentTotalSaldo >= 0 ? "success" : "destructive")
      }
    ];

    return {
      analysis: schoolAnalyses,
      stats: {
        totalMatriculasRede,
        totalMatriculasPonderadasRede,
        segmentTotals,
        totalETIRede,
        percentualETI: percETI,
        totalSaldo: currentTotalSaldo,
        deficitCount: currentDeficitCount,
        avgCusto: currentAvgCusto,
        receitaAlunoMedio: currentTotalReceita / (schoolAnalyses.reduce((acc, s) => acc + (s.total_matriculas || 0), 0) || 1),
        hasExpenses,
        schoolsWithEtiCount,
        percSchoolsWithEti,
        totalSchools: municipalSchools.length,
        totalSecretariaExpenses
      },
      networkTotals: municipalRevenue,
      nativeInsights: technicalInsights
    };
  }, [schools, allExpenses, parametros, filterLocalizacao, filterDependencia, filterETI]);

  const sortedAnalysis = useMemo(() => {
    let items = [...analysis];
    if (sortConfig) {
      items.sort((a: any, b: any) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (typeof valA === 'string') {
          return sortConfig.direction === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      });
    }
    return items;
  }, [analysis, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleGenerateReport = async () => {
    if (!stats || !networkTotals) {
      toast({ title: "Dados incompletos", description: "Aguarde o carregamento dos dados.", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    setReport(null);
    
    try {
      const getSum = (key: string) => analysis.reduce((acc, d: any) => acc + (d[key] || 0), 0);
      const totalRevenue = networkTotals.total || 1;

      const input = {
        municipio: activeMunicipioName || "Município",
        uf: activeUF || "BA",
        exercicio: 2026,
        totalMatriculas: stats.totalMatriculasRede,
        totalETI: stats.totalETIRede,
        percentualETI: Math.round(stats.percentualETI),
        custoAlunoMedio: Math.round(stats.avgCusto),
        receitaAlunoMedio: Math.round(stats.receitaAlunoMedio),
        saldoTotalRede: Math.round(stats.totalSaldo),
        despesaSecretaria: Math.round(stats.totalSecretariaExpenses),
        saldoStatus: stats.totalSaldo >= 0 ? "superávit" : "déficit",
        escolasEmDeficit: stats.deficitCount,
        totalEscolas: stats.totalSchools,
        percentualEscolasETI: Math.round(stats.percSchoolsWithEti),
        metaMatriculasPNE: "40%",
        metaEscolasPNE: "55%",
        escolasETIlt20Percent: analysis.filter(s => (s.percentual_eti || 0) < 20).length,
        composicaoReceitas: {
          fundebVaaf: { amount: Math.round(networkTotals.vaaf), percentage: Math.round((networkTotals.vaaf / totalRevenue) * 100) },
          vaat: { amount: Math.round(networkTotals.vaat), percentage: Math.round((networkTotals.vaat / totalRevenue) * 100) },
          pnae: { amount: Math.round(networkTotals.pnae), percentage: Math.round((networkTotals.pnae / totalRevenue) * 100) },
          mdeLiquido: { amount: Math.round(networkTotals.mde), percentage: Math.round((networkTotals.mde / totalRevenue) * 100) },
          outros: { amount: Math.round(networkTotals.outros), percentage: Math.round((networkTotals.outros / totalRevenue) * 100) },
        },
        escolasEmAtencao: analysis
          .filter(s => s.status === 'deficit')
          .slice(0, 5)
          .map(s => `${s.nome}: Cobertura ${s.cobertura.toFixed(2)}x`),
      };
      
      const result = await generateExecutiveFinancialReport(input);
      setReport(result.report);
      toast({ title: "Diagnóstico Gerado", description: "A IA concluiu a análise técnica." });
    } catch (error: any) {
      toast({
        title: "Erro na IA",
        description: `Falha na narrativa técnica: ${error.message || 'Verifique sua conexão.'}`,
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
    toast({ title: "Copiado", description: "Copiado para a área de transferência." });
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `parecer_eti_${activeMunicipioName || 'municipio'}_2026.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download iniciado", description: "Arquivo de parecer técnico exportado." });
  };

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground animate-pulse">Carregando dados municipais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Diagnóstico: {activeMunicipioName}</h2>
          <p className="text-muted-foreground">Visão geral do exercício fiscal 2026 (Rede Municipal)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm text-xs">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterLocalizacao} onValueChange={setFilterLocalizacao}>
              <SelectTrigger className="h-8 w-[100px] border-none shadow-none focus:ring-0 font-bold">
                <SelectValue placeholder="Local" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="urbana">Urbana</SelectItem>
                <SelectItem value="rural">Rural</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm text-xs">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Select value={filterDependencia} onValueChange={setFilterDependencia}>
              <SelectTrigger className="h-8 w-[130px] border-none shadow-none focus:ring-0 font-bold">
                <SelectValue placeholder="Rede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Municipal</SelectItem>
                <SelectItem value="1">Federal</SelectItem>
                <SelectItem value="2">Estadual</SelectItem>
                <SelectItem value="4">Privada</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm text-xs">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <Select value={filterETI} onValueChange={setFilterETI}>
              <SelectTrigger className="h-8 w-[120px] border-none shadow-none focus:ring-0 font-bold">
                <SelectValue placeholder="Escolas ETI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="sim">Com ETI</SelectItem>
                <SelectItem value="nao">Sem ETI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerateReport} disabled={isGenerating || analysis.length === 0} size="sm" className="gap-2 bg-accent hover:bg-accent/90 shadow-md">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isGenerating ? "Processando..." : "Gerar Narrativa IA"}
          </Button>
        </div>
      </div>

      {!stats?.hasExpenses && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3 text-orange-800">
            <Info className="h-5 w-5 shrink-0" />
            <p className="text-xs">
              <b>Aviso:</b> Nenhuma despesa real encontrada para este município. Os índices de custo-aluno e saldo estão zerados. 
              Realize o upload das despesas em <a href="/dashboard/despesas" className="underline font-bold">Gestão de Despesas</a> para uma análise real.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard title="Matrículas Reais" value={mounted ? (stats?.totalMatriculasRede ?? 0).toLocaleString('pt-BR') : "0"} icon={Users} subtitle="Alunos Físicos" />
        <KPICard title="Matrículas Ponderadas" value={mounted ? Math.round(stats?.totalMatriculasPonderadasRede ?? 0).toLocaleString('pt-BR') : "0"} icon={Scale} subtitle="Peso p/ Repasse" />
        <KPICard title="Alunos em ETI" value={`${(stats?.percentualETI ?? 0).toFixed(1)}%`} icon={GraduationCap} subtitle={`${stats?.totalETIRede ?? 0} integrais`} />
        <KPICard title="Cobertura ETI" value={`${(stats?.percSchoolsWithEti ?? 0).toFixed(1)}%`} icon={Building2} subtitle={`${stats?.schoolsWithEtiCount ?? 0} escolas`} />
        <KPICard title="Saldo Estimado" value={`R$ ${mounted ? ((stats?.totalSaldo ?? 0) / 1000).toFixed(1) : "0"}k`} icon={DollarSign} subtitle={stats?.hasExpenses ? ((stats?.totalSaldo ?? 0) >= 0 ? "Superávit" : "Déficit") : "Sem Despesas"} className={stats?.hasExpenses ? ((stats?.totalSaldo ?? 0) >= 0 ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200") : "bg-muted/30 border-dashed"} />
        <KPICard title="Unidades Risco" value={stats?.deficitCount || 0} icon={AlertCircle} subtitle="Déficit projetado" className={(stats?.deficitCount ?? 0) > 0 ? "bg-orange-50/50 border-orange-200" : ""} />
      </div>

      <Card className="shadow-md border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="font-headline text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Detalhamento de Matrículas por Segmento
          </CardTitle>
          <CardDescription>Subtotais reais vs ponderados para cálculo do FUNDEB 2026</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <SegmentCard label="Infantil" raw={stats?.segmentTotals.infantil.raw} weighted={stats?.segmentTotals.infantil.weighted} color="bg-blue-500" />
            <SegmentCard label="Fund. Anos Iniciais" raw={stats?.segmentTotals.ai.raw} weighted={stats?.segmentTotals.ai.weighted} color="bg-emerald-500" />
            <SegmentCard label="Fund. Anos Finais" raw={stats?.segmentTotals.af.raw} weighted={stats?.segmentTotals.af.weighted} color="bg-indigo-500" />
            <SegmentCard label="EJA" raw={stats?.segmentTotals.eja.raw} weighted={stats?.segmentTotals.eja.weighted} color="bg-amber-500" />
            <SegmentCard label="Especial (AEE)" raw={stats?.segmentTotals.especial.raw} weighted={stats?.segmentTotals.especial.weighted} color="bg-rose-500" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Apreciação Técnica Nativa (Normas FNDE/PNE)
              </CardTitle>
              <CardDescription>Validação automatizada baseada em marcos legais vigentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {nativeInsights.map((insight, idx) => (
                  <div key={idx} className="p-4 rounded-xl border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{insight.title}</p>
                      <Badge variant="outline" className={`text-[9px] ${
                        insight.variant === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                        insight.variant === 'destructive' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {insight.status}
                      </Badge>
                    </div>
                    <p className="text-xl font-bold">{insight.value}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{insight.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="font-headline text-lg">Eficiência Financeira por Unidade</CardTitle>
              <CardDescription>Comparativo Receita vs Custo Projetado 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => toggleSort('nome')}>
                      <div className="flex items-center gap-2">
                        Escola
                        {sortConfig.key === 'nome' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => toggleSort('receitaAluno')}>
                      <div className="flex items-center justify-end gap-2">
                        Receita/Aluno
                        {sortConfig.key === 'receitaAluno' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => toggleSort('custoAluno')}>
                      <div className="flex items-center justify-end gap-2">
                        Custo/Aluno
                        {sortConfig.key === 'custoAluno' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => toggleSort('percentual_eti')}>
                      <div className="flex items-center justify-end gap-2">
                        % ETI
                        {sortConfig.key === 'percentual_eti' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => toggleSort('status')}>
                      <div className="flex items-center gap-2">
                        Situação
                        {sortConfig.key === 'status' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Auditoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAnalysis.length > 0 ? (
                    sortedAnalysis.map((school) => (
                      <TableRow key={school.id} className="hover:bg-muted/30 text-xs">
                        <TableCell>
                          <div className="font-medium text-sm">{school.nome}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {String(school.localizacao).toUpperCase()} • {DEPENDENCIA_LABELS[String(school.tp_dependencia)]}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">R$ {mounted ? Math.round(school.receitaAluno).toLocaleString('pt-BR') : "0"}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">R$ {mounted ? Math.round(school.custoAluno).toLocaleString('pt-BR') : "0"}</TableCell>
                        <TableCell className="text-right font-bold text-accent">{school.percentual_eti || 0}%</TableCell>
                        <TableCell>
                          <Badge variant={school.status === 'superavit' ? 'default' : school.status === 'deficit' ? 'destructive' : 'secondary'} className={school.status === 'superavit' ? 'bg-green-600' : ''}>
                            {school.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Auditoria de Viabilidade: {school.nome}</DialogTitle>
                                <DialogDescription>Composição de Receitas e Despesas consolidadas no banco.</DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="max-h-[70vh] pr-4">
                                <div className="space-y-6 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                                      <p className="text-[10px] font-bold text-green-800 uppercase mb-1">Receita Total Anual</p>
                                      <p className="text-xl font-bold text-green-900">R$ {school.receitaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                      <p className="text-[10px] font-bold text-red-800 uppercase mb-1">Custo Total Anual</p>
                                      <p className="text-xl font-bold text-red-900">R$ {school.despesaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                                    </div>
                                  </div>

                                  <section className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                      <Users className="h-3 w-3" /> Microdados de Matrículas (Censo 2025)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Infantil</p>
                                        <DataField label="Creche Integral" value={school.matriculas?.creche_integral} />
                                        <DataField label="Creche Parcial" value={school.matriculas?.creche_parcial} />
                                        <DataField label="Pré Integral" value={school.matriculas?.pre_integral} />
                                        <DataField label="Pré Parcial" value={school.matriculas?.pre_parcial} />
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Fundamental</p>
                                        <DataField label="AI Integral" value={school.matriculas?.ef_ai_integral} />
                                        <DataField label="AI Parcial" value={school.matriculas?.ef_ai_parcial} />
                                        <DataField label="AF Integral" value={school.matriculas?.ef_af_integral} />
                                        <DataField label="AF Parcial" value={school.matriculas?.ef_af_parcial} />
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Outros / Especial</p>
                                        <DataField label="EJA" value={school.matriculas?.eja_fundamental} />
                                        <DataField label="AEE Inclusão" value={school.matriculas?.especial_aee} />
                                      </div>
                                    </div>
                                  </section>

                                  <Separator />

                                  <section className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                      <TrendingUp className="h-3 w-3" /> Composição de Receitas (VAAf {parametros.fatores.C1.toFixed(2)} / {parametros.fatores.D2.toFixed(2)})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <RevenueDetailItem label="FUNDEB VAAf" value={school.vaaf} />
                                      <RevenueDetailItem label="Complementação VAAT" value={school.vaat} />
                                      <RevenueDetailItem label="Complementação VAAR" value={school.vaar} />
                                      <RevenueDetailItem label="PNAE Alimentação" value={school.pnae} />
                                      <RevenueDetailItem label="MDE / Recursos Próprios" value={school.mde} />
                                      <RevenueDetailItem label="Outros Repasses (QSE/PDDE)" value={school.outros} />
                                    </div>
                                  </section>

                                  <Separator />

                                  <section className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                      <PieChart className="h-3 w-3" /> Detalhamento de Despesas Reais
                                    </h4>
                                    {school.expensesDetail && school.expensesDetail.length > 0 ? (
                                      <div className="border rounded-xl overflow-hidden">
                                        <Table>
                                          <TableHeader className="bg-muted/30">
                                            <TableRow>
                                              <TableHead className="text-[10px]">Categoria</TableHead>
                                              <TableHead className="text-right text-[10px]">Valor (R$)</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {school.expensesDetail.map((exp: any, idx: number) => (
                                              <TableRow key={idx} className="text-[11px]">
                                                <TableCell className="py-2">{exp.category}</TableCell>
                                                <TableCell className="text-right py-2 font-mono">R$ {exp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    ) : (
                                      <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed text-muted-foreground text-xs italic">
                                        Nenhuma despesa real lançada para esta unidade.
                                      </div>
                                    )}
                                  </section>
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Nenhum dado encontrado com os filtros atuais.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col border-accent/20 shadow-lg h-full">
          <CardHeader className="bg-accent/5 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-headline text-lg text-accent">
                <Sparkles className="h-5 w-5" /> Parecer Técnico IA
              </CardTitle>
              {report && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-accent hover:bg-accent/10" onClick={handleDownloadReport} title="Download Parecer (.txt)">
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-accent hover:bg-accent/10" onClick={handleCopy} title="Copiar Texto">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            {report ? (
              <ScrollArea className="h-[600px]">
                <div className="text-xs space-y-4 whitespace-pre-wrap font-body leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border">
                  {report}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 space-y-6 border-2 border-dashed rounded-2xl bg-muted/5">
                <FileText className="h-12 w-12 text-accent/40" />
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800">Aguardando Diagnóstico</h4>
                  <p className="text-muted-foreground text-[11px] max-w-[200px] mx-auto">
                    {isGenerating ? "Analisando microdados fiscais municipais..." : "Clique no botão acima para gerar a narrativa técnica da rede baseada nos parâmetros 2026."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SegmentCard({ label, raw, weighted, color }: { label: string, raw?: number, weighted?: number, color: string }) {
  return (
    <div className="p-4 rounded-xl border bg-white shadow-sm space-y-3 relative overflow-hidden group hover:border-primary/30 transition-all">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-800">{(raw || 0).toLocaleString('pt-BR')}</span>
          <span className="text-[10px] text-muted-foreground font-medium">Alunos</span>
        </div>
      </div>
      <div className="pt-2 border-t flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground font-medium uppercase">Ponderado:</span>
        <span className="text-xs font-bold text-slate-700">{(weighted || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
      </div>
    </div>
  );
}

function RevenueDetailItem({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <span className="text-xs font-mono font-bold">R$ {value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
    </div>
  );
}

function DataField({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/10 border border-transparent hover:border-muted-foreground/10 transition-colors">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-[11px] font-bold ${value > 0 ? 'text-primary' : 'text-muted-foreground/30'}`}>
        {value || 0}
      </span>
    </div>
  )
}
