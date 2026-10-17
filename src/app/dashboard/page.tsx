
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
  ChevronDown,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";
import { normalizarParametros } from "@/lib/constants";
import { metasDosParametros, metasSaoAsDoPNE, situacaoMetas } from "@/lib/metas-pne";
import { useMunicipality, useExercicioRefs } from "@/providers/municipality-provider";
import { calcularVAAF, calcularVAAT, calcularVAAR, calcularPNAE, calcularMDE, calcularOutros, resolverParametros, ponderadasPorSegmento, ponderadorExercicio, etiConsiderado } from "@/lib/calculations";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { activeMunicipioId, activeMunicipioName, activeUF, exercicio, censoAno, statusExercicio } = useMunicipality();

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = activeMunicipioId || profile?.municipioId;
  const exRefs = useExercicioRefs(municipioId);

  const schoolsRef = exRefs.schoolsRef;
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  const expensesRef = exRefs.expensesRef;
  const { data: allExpenses } = useCollection(expensesRef);

  const paramsRef = exRefs.paramsRef;
  const { data: customParams } = useDoc(paramsRef);
  const parametros = useMemo(() => resolverParametros(normalizarParametros(customParams), schools as any[]), [customParams, schools]);

  const { analysis, stats, networkTotals, nativeInsights } = useMemo(() => {
    if (!schools || schools.length === 0) return { analysis: [], stats: null, networkTotals: null, nativeInsights: [] };

    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculasMunicipal = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    const filteredSchools = schools.filter(s => {
      const matchesLocalizacao = filterLocalizacao === "todas" ? true : String(s.localizacao).toLowerCase() === filterLocalizacao.toLowerCase();
      const matchesDependencia = filterDependencia === "todas" ? true : String(s.tp_dependencia).trim() === filterDependencia;
      const matchesETI = filterETI === "todas" ? true : (filterETI === "sim" ? etiConsiderado(s) > 0 : etiConsiderado(s) === 0);
      return matchesLocalizacao && matchesDependencia && matchesETI;
    });

    const schoolAnalyses = filteredSchools.map((school: any) => {
      const m = school.matriculas || {};
      const vaaf = calcularVAAF(m, parametros, school.localizacao);
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
    const totalETIRede = municipalSchools.reduce((acc, s: any) => acc + etiConsiderado(s), 0);
    
    const segmentTotals = municipalSchools.reduce((acc, s: any) => {
      const seg = ponderadasPorSegmento(s.matriculas, parametros, s.localizacao);
      const k = ponderadorExercicio(parametros);
      const add = (x: any, y: any) => ({ raw: x.raw + y.raw, weighted: x.weighted + y.weighted * k });
      return {
        infantil: add(acc.infantil, seg.infantil),
        ai: add(acc.ai, seg.ai),
        af: add(acc.af, seg.af),
        eja: add(acc.eja, seg.eja),
        especial: add(acc.especial, seg.especial)
      };
    }, {
      infantil: { raw: 0, weighted: 0 }, ai: { raw: 0, weighted: 0 }, af: { raw: 0, weighted: 0 }, eja: { raw: 0, weighted: 0 }, especial: { raw: 0, weighted: 0 }
    });

    const totalMatriculasPonderadasRede = Object.values(segmentTotals).reduce((acc, s) => acc + s.weighted, 0);

    const municipalRevenue = municipalSchools.reduce((acc, s: any) => {
      const m = s.matriculas || {};
      const vaaf = calcularVAAF(m, parametros, s.localizacao);
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
    const schoolsWithEtiCount = municipalSchools.filter(s => etiConsiderado(s) > 0).length;
    const percSchoolsWithEti = municipalSchools.length > 0 ? (schoolsWithEtiCount / municipalSchools.length) * 100 : 0;

    const hasExpenses = (allExpenses || []).length > 0;

    const metasSituacao = situacaoMetas(
      { matriculas: totalMatriculasRede, eti: totalETIRede, escolas: municipalSchools.length, escolasComEti: schoolsWithEtiCount },
      metasDosParametros(parametros),
      exercicio
    );
    const [m31, m36] = metasSituacao;
    const fonteMeta = metasSaoAsDoPNE(metasDosParametros(parametros)) ? "novo PNE" : "meta municipal";

    const technicalInsights = [
      {
        title: "Meta Tempo Integral (Matrículas)",
        value: `${percETI.toFixed(1)}%`,
        status: m31.atingiuMatriculas ? (m36.atingiuMatriculas ? "Conforme 2036" : "Conforme 2031") : "Abaixo da Meta 2031",
        description: m31.atingiuMatriculas
          ? (m36.atingiuMatriculas ? `Rede já atende ${m36.metaMatriculas}% (${fonteMeta}, 2036).` : `Atende ${m31.metaMatriculas}% (2031). Para 2036 (${m36.metaMatriculas}%) faltam ${m36.faltamMatriculas} matrículas.`)
          : `Faltam ${m31.faltamMatriculas} matrículas para ${m31.metaMatriculas}% em 2031 (≈ ${m31.matriculasPorAno}/ano) e ${m36.faltamMatriculas} para ${m36.metaMatriculas}% em 2036 (${fonteMeta}).`,
        variant: m31.atingiuMatriculas ? "success" : "warning"
      },
      {
        title: "Meta Tempo Integral (Escolas)",
        value: `${percSchoolsWithEti.toFixed(1)}%`,
        status: m31.atingiuEscolas ? (m36.atingiuEscolas ? "Conforme 2036" : "Conforme 2031") : "Abaixo da Meta 2031",
        description: m31.atingiuEscolas
          ? (m36.atingiuEscolas ? `Rede já atende ${m36.metaEscolas}% das escolas (${fonteMeta}, 2036).` : `Atende ${m31.metaEscolas}% (2031). Para 2036 (${m36.metaEscolas}%) faltam ${m36.faltamEscolas} escola(s).`)
          : `Faltam ${m31.faltamEscolas} escola(s) para ${m31.metaEscolas}% em 2031 e ${m36.faltamEscolas} para ${m36.metaEscolas}% em 2036 (${fonteMeta}).`,
        variant: m31.atingiuEscolas ? "success" : "warning"
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
        totalSecretariaExpenses,
        metasSituacao
      },
      networkTotals: municipalRevenue,
      nativeInsights: technicalInsights
    };
  }, [schools, allExpenses, parametros, filterLocalizacao, filterDependencia, filterETI, exercicio]);

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
        exercicio,
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
        metaMatriculasPNE: stats.metasSituacao.map(s => `${s.metaMatriculas}% (${s.ano}) — faltam ${s.faltamMatriculas}`).join("; "),
        metaEscolasPNE: stats.metasSituacao.map(s => `${s.metaEscolas}% (${s.ano}) — faltam ${s.faltamEscolas}`).join("; "),
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
    link.setAttribute("download", `parecer_eti_${activeMunicipioName || 'municipio'}_${exercicio}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download iniciado", description: "Arquivo de parecer técnico exportado." });
  };

  const handleExportSchoolXLSX = (school: any) => {
    const wb = XLSX.utils.book_new();
    
    const resumoData = [
      ["Auditoria de Viabilidade", school.nome],
      ["Município", activeMunicipioName],
      ["UF", activeUF],
      ["Exercício", String(exercicio)],
      [],
      ["RESUMO FINANCEIRO"],
      ["Receita Total Anual", school.receitaTotal],
      ["Custo Total Anual", school.despesaTotal],
      ["Saldo Estimado", school.saldo],
      ["Índice de Cobertura", school.cobertura.toFixed(2) + "x"],
      ["Custo/Aluno", school.custoAluno],
      ["Receita/Aluno", school.receitaAluno],
      ["Situação", school.status.toUpperCase()],
      [],
      [`MICRODADOS DE MATRÍCULAS (CENSO ${censoAno})`],
      ["Categoria", "Subcategoria", "Valor"],
      ["Infantil", "Creche Integral", school.matriculas?.creche_integral || 0],
      ["Infantil", "Creche Parcial", school.matriculas?.creche_parcial || 0],
      ["Infantil", "Pré Integral", school.matriculas?.pre_integral || 0],
      ["Infantil", "Pré Parcial", school.matriculas?.pre_parcial || 0],
      ["Fundamental", "AI Integral", school.matriculas?.ef_ai_integral || 0],
      ["Fundamental", "AI Parcial", school.matriculas?.ef_ai_parcial || 0],
      ["Fundamental", "AF Integral", school.matriculas?.ef_af_integral || 0],
      ["Fundamental", "AF Parcial", school.matriculas?.ef_af_parcial || 0],
      ["EJA", "Fundamental", school.matriculas?.eja_fundamental || 0],
      ["Especial", "AEE Inclusão", school.matriculas?.especial_aee || 0],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo e Matrículas");

    const receitasData = [
      ["COMPOSIÇÃO DE RECEITAS"],
      ["Fonte", "Valor (R$)"],
      ["FUNDEB VAAf", school.vaaf],
      ["Complementação VAAT", school.vaat],
      ["Complementação VAAR", school.vaar],
      ["PNAE Alimentação", school.pnae],
      ["MDE / Recursos Próprios", school.mde],
      ["Outros Repasses (QSE/PDDE)", school.outros],
      ["TOTAL", school.receitaTotal]
    ];
    const wsReceitas = XLSX.utils.aoa_to_sheet(receitasData);
    XLSX.utils.book_append_sheet(wb, wsReceitas, "Receitas");

    const despesasData = [
      ["DETALHAMENTO DE DESPESAS REAIS"],
      ["Categoria", "Valor (R$)"],
      ...(school.expensesDetail || []).map((exp: any) => [exp.category, exp.value]),
      ["TOTAL", school.despesaTotal]
    ];
    const wsDespesas = XLSX.utils.aoa_to_sheet(despesasData);
    XLSX.utils.book_append_sheet(wb, wsDespesas, "Despesas");

    XLSX.writeFile(wb, `auditoria_${school.nome.replace(/\s+/g, '_')}_${exercicio}.xlsx`);
    toast({ title: "Exportação Concluída", description: `Dados de ${school.nome} exportados para Excel.` });
  };

  const handleExportFullNetworkXLSX = () => {
    if (!analysis || analysis.length === 0) return;

    const wb = XLSX.utils.book_new();
    
    // 1. Diagnóstico por Unidade (Resumo)
    const schoolRows = analysis.map((s: any) => ({
      "Escola": s.nome,
      "Localização": String(s.localizacao).toUpperCase(),
      "Dependência": DEPENDENCIA_LABELS[String(s.tp_dependencia)] || s.tp_dependencia,
      "Total Matrículas": s.total_matriculas || 0,
      "Matrículas ETI (INEP)": s.total_eti || 0,
      "Matrículas ETI (consideradas)": etiConsiderado(s),
      "% ETI": (s.percentual_eti || 0).toFixed(1) + "%",
      "Receita Total": s.receitaTotal,
      "Custo Total": s.despesaTotal,
      "Saldo": s.saldo,
      "Cobertura": s.cobertura.toFixed(2) + "x",
      "Custo/Aluno": s.custoAluno,
      "Receita/Aluno": s.receitaAluno,
      "Situação": s.status.toUpperCase()
    }));
    
    const wsSchools = XLSX.utils.json_to_sheet(schoolRows);
    XLSX.utils.book_append_sheet(wb, wsSchools, "Diagnóstico Escolas");

    // 2. Matrículas Detalhadas
    const matriculasRows = analysis.map((s: any) => ({
      "Escola": s.nome,
      "Creche Integral": s.matriculas?.creche_integral || 0,
      "Creche Parcial": s.matriculas?.creche_parcial || 0,
      "Creche Conv. Integral": s.matriculas?.creche_conveniada_int || 0,
      "Creche Conv. Parcial": s.matriculas?.creche_conveniada_par || 0,
      "Pré Integral": s.matriculas?.pre_integral || 0,
      "Pré Parcial": s.matriculas?.pre_parcial || 0,
      "Fund. AI Integral": s.matriculas?.ef_ai_integral || 0,
      "Fund. AI Parcial": s.matriculas?.ef_ai_parcial || 0,
      "Fund. AF Integral": s.matriculas?.ef_af_integral || 0,
      "Fund. AF Parcial": s.matriculas?.ef_af_parcial || 0,
      "EJA Fundamental": s.matriculas?.eja_fundamental || 0,
      "EJA Médio": s.matriculas?.eja_medio || 0,
      "Especial AEE": s.matriculas?.especial_aee || 0,
      "TOTAL REAL": s.total_matriculas || 0,
      "TOTAL ETI (INEP)": s.total_eti || 0,
      "TOTAL ETI (considerado)": etiConsiderado(s)
    }));

    const wsMatriculas = XLSX.utils.json_to_sheet(matriculasRows);
    XLSX.utils.book_append_sheet(wb, wsMatriculas, "Matrículas Detalhadas");

    // 3. Receitas Detalhadas
    const receitasRows = analysis.map((s: any) => ({
      "Escola": s.nome,
      "FUNDEB VAAf": s.vaaf,
      "Compl. VAAT": s.vaat,
      "Compl. VAAR": s.vaar,
      "PNAE Alimentação": s.pnae,
      "MDE/Próprios": s.mde,
      "Outros (QSE/PDDE)": s.outros,
      "TOTAL RECEITA": s.receitaTotal
    }));

    const wsReceitas = XLSX.utils.json_to_sheet(receitasRows);
    XLSX.utils.book_append_sheet(wb, wsReceitas, "Receitas Detalhadas");

    // 4. Despesas Detalhadas (Lista plana de todos os lançamentos)
    const allDetailedExpenses: any[] = [];
    analysis.forEach((s: any) => {
      if (s.expensesDetail && s.expensesDetail.length > 0) {
        s.expensesDetail.forEach((exp: any) => {
          allDetailedExpenses.push({
            "Escola": s.nome,
            "Categoria": exp.category,
            "Valor (R$)": exp.value,
            "Data": exp.date || "",
            "Descrição": exp.description || ""
          });
        });
      }
    });

    if (allDetailedExpenses.length > 0) {
      const wsDespesas = XLSX.utils.json_to_sheet(allDetailedExpenses);
      XLSX.utils.book_append_sheet(wb, wsDespesas, "Despesas Detalhadas");
    }

    // 5. Resumo da Rede
    const networkRows = [
      ["Indicador", "Valor"],
      ["Município", activeMunicipioName],
      ["UF", activeUF],
      ["Total Matrículas Rede", stats?.totalMatriculasRede || 0],
      ["Total Matrículas Ponderadas", stats?.totalMatriculasPonderadasRede || 0],
      ["Percentual ETI Rede", (stats?.percentualETI || 0).toFixed(1) + "%"],
      ["Saldo Consolidado", stats?.totalSaldo || 0],
      ["Escolas em Déficit", stats?.deficitCount || 0],
      ["Custo Aluno Médio", stats?.avgCusto || 0],
      ["Receita Aluno Média", stats?.receitaAlunoMedio || 0],
    ];
    const wsNetwork = XLSX.utils.aoa_to_sheet(networkRows);
    XLSX.utils.book_append_sheet(wb, wsNetwork, "Resumo da Rede");

    XLSX.writeFile(wb, `diagnostico_completo_${(activeMunicipioName || "municipio").replace(/\s+/g, '_')}_${exercicio}.xlsx`);
    toast({ title: "Exportação Concluída", description: "Diagnóstico detalhado da rede exportado." });
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
          <p className="text-muted-foreground">Exercício {exercicio} · Censo {censoAno}{statusExercicio === "projecao" ? " · Projeção" : ""} (Rede Municipal)</p>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-white hover:bg-slate-50 border shadow-sm">
                <Download className="h-4 w-4 text-muted-foreground" /> Exportar Rede
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportFullNetworkXLSX} className="cursor-pointer">
                <FileDown className="h-4 w-4 mr-2" /> Exportar Diagnóstico (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

      {stats?.metasSituacao && (
        <Card className="shadow-md border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-headline text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Metas de Tempo Integral — 2031 e 2036
            </CardTitle>
            <CardDescription>
              {metasSaoAsDoPNE(metasDosParametros(parametros)) ? "Novo PNE (Lei 15.388/2026, Meta 6.a)" : "Metas próprias do município"} · posição pelo Censo {censoAno}, sobre a rede atual ({stats.totalMatriculasRede} alunos, {stats.totalSchools} escolas). Ajuste em Parâmetros → Metas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marco</TableHead>
                  <TableHead className="text-right">Estudantes: atual / meta</TableHead>
                  <TableHead className="text-right">Matrículas a criar</TableHead>
                  <TableHead className="text-right">Por ano</TableHead>
                  <TableHead className="text-right">Escolas: atual / meta</TableHead>
                  <TableHead className="text-right">Escolas a incluir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.metasSituacao.map((s) => (
                  <TableRow key={s.ano}>
                    <TableCell className="font-bold">Até {s.ano} <span className="text-[10px] font-normal text-muted-foreground">({s.anosRestantes} censos)</span></TableCell>
                    <TableCell className="text-right">{s.percMatriculas.toFixed(1)}% / <b>{s.metaMatriculas}%</b></TableCell>
                    <TableCell className={`text-right font-bold ${s.atingiuMatriculas ? "text-green-600" : "text-orange-600"}`}>{s.atingiuMatriculas ? "Atingida" : `+${s.faltamMatriculas}`}</TableCell>
                    <TableCell className="text-right">{s.atingiuMatriculas ? "—" : `≈ ${s.matriculasPorAno}`}</TableCell>
                    <TableCell className="text-right">{s.percEscolas.toFixed(1)}% / <b>{s.metaEscolas}%</b></TableCell>
                    <TableCell className={`text-right font-bold ${s.atingiuEscolas ? "text-green-600" : "text-orange-600"}`}>{s.atingiuEscolas ? "Atingida" : `+${s.faltamEscolas}`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-[10px] text-muted-foreground mt-2">"Por ano" divide o que falta pelo número de Censos até o marco. Não considera variação do total de alunos da rede.</p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="font-headline text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Detalhamento de Matrículas por Segmento
          </CardTitle>
          <CardDescription>Subtotais reais vs ponderados (com NSE × DRec) para o FUNDEB {exercicio}</CardDescription>
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
              <CardDescription>Comparativo Receita vs Custo — Exercício {exercicio}</CardDescription>
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
                            <DialogContent className="max-w-3xl">
                              <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
                                <div className="space-y-1">
                                  <DialogTitle>Auditoria de Viabilidade: {school.nome}</DialogTitle>
                                  <DialogDescription>Composição de Receitas e Despesas consolidadas no banco.</DialogDescription>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2 mr-6">
                                      <Download className="h-4 w-4" /> Exportar
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleExportSchoolXLSX(school)} className="cursor-pointer">
                                      <FileDown className="h-4 w-4 mr-2" /> Exportar para Excel (.xlsx)
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </DialogHeader>
                              <ScrollArea className="max-h-[70vh] pr-4">
                                <div className="space-y-6 py-6">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                                      <p className="text-[10px] font-bold text-green-800 uppercase mb-1">Receita Total Anual</p>
                                      <p className="text-lg font-bold text-green-900">R$ {school.receitaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                      <p className="text-[10px] font-bold text-red-800 uppercase mb-1">Custo Total Anual</p>
                                      <p className="text-lg font-bold text-red-900">R$ {school.despesaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className={`p-4 border rounded-xl ${school.saldo >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                                      <p className={`text-[10px] font-bold uppercase mb-1 ${school.saldo >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Saldo Estimado</p>
                                      <p className={`text-lg font-bold ${school.saldo >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>R$ {school.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                      <p className="text-[10px] font-bold text-slate-800 uppercase mb-1">Índice Cobertura</p>
                                      <p className="text-lg font-bold text-slate-900">{school.cobertura.toFixed(2)}x</p>
                                    </div>
                                  </div>

                                  <section className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                      <Users className="h-3 w-3" /> Microdados de Matrículas (Censo {censoAno})
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
