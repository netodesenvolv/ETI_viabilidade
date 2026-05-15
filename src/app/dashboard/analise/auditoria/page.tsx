"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search,
  Filter,
  Download,
  Loader2,
  TrendingUp,
  BarChart4,
  Scale,
  Sparkles,
  X,
  Copy,
  Check
} from "lucide-react";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateAuditInvestigationReport } from "@/ai/flows/generate-audit-investigation-report";

export default function AuditoriaCustosPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

  const [categoryFilter, setCategoryFilter] = useState("total");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  const expensesRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'expenses') : null), [db, municipioId]);
  const { data: expenses } = useCollection(expensesRef);

  const paramsRef = useMemo(() => (db && municipioId ? doc(db, 'municipios', municipioId, 'config', 'parameters') : null), [db, municipioId]);
  const { data: customParams } = useDoc(paramsRef);
  const parametros = (customParams as any) || DEFAULT_PARAMETERS;

  const auditData = useMemo(() => {
    if (!schools || !expenses) return { rankings: [], categories: [], avgByCat: {} };

    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculasRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    // Identificar categorias
    const categories = Array.from(new Set(expenses.map(e => e.category || "Não Categorizado"))).sort();

    const schoolsData = municipalSchools.map((school: any) => {
      const schoolExpenses = (expenses || []).filter((e: any) => e.schoolId === school.id);
      const totalDespesaReal = schoolExpenses.reduce((acc, e: any) => acc + (e.value || 0), 0);
      const totalMatriculas = school.total_matriculas || 1;

      const costsByCategory = schoolExpenses.reduce((acc: any, e: any) => {
        const cat = e.category || "Não Categorizado";
        acc[cat] = (acc[cat] || 0) + (e.value || 0);
        return acc;
      }, {});

      const perStudentByCategory = categories.reduce((acc: any, cat: string) => {
        acc[cat] = (costsByCategory[cat] || 0) / totalMatriculas;
        return acc;
      }, {});

      return {
        id: school.id,
        name: school.nome,
        totalMatriculas,
        totalCostPerStudent: totalDespesaReal / totalMatriculas,
        costsByCategory: perStudentByCategory
      };
    });

    // Médias da rede por categoria
    const avgByCat = categories.reduce((acc: any, cat: string) => {
      const totalCat = schoolsData.reduce((sum, s) => sum + s.costsByCategory[cat], 0);
      acc[cat] = totalCat / schoolsData.length;
      return acc;
    }, {});

    const avgTotal = schoolsData.reduce((sum, s) => sum + s.totalCostPerStudent, 0) / schoolsData.length;

    return { 
      rankings: schoolsData, 
      categories, 
      avgByCat,
      avgTotal
    };
  }, [schools, expenses, parametros]);

  const sortedRankings = useMemo(() => {
    if (!auditData.rankings) return [];
    const items = [...auditData.rankings];
    
    if (categoryFilter === "total") {
      return items.sort((a, b) => b.totalCostPerStudent - a.totalCostPerStudent);
    } else {
      return items.sort((a, b) => b.costsByCategory[categoryFilter] - a.costsByCategory[categoryFilter]);
    }
  }, [auditData.rankings, categoryFilter]);

  const handleGenerateAI = async () => {
    if (!auditData || auditData.rankings.length === 0) return;
    
    setIsGenerating(true);
    try {
      const topOutliers = sortedRankings
        .slice(0, 5)
        .map(s => {
          const value = categoryFilter === "total" ? s.totalCostPerStudent : s.costsByCategory[categoryFilter];
          const avg = categoryFilter === "total" ? auditData.avgTotal : (auditData.avgByCat[categoryFilter] || 0);
          return {
            schoolName: s.name,
            category: categoryFilter === "total" ? "Geral" : categoryFilter,
            value: Math.round(value),
            avgNetwork: Math.round(avg),
            diffPercentage: Math.round(((value / avg) - 1) * 100)
          };
        });

      const input = {
        municipio: profile?.municipio || "Município",
        uf: profile?.uf || "BA",
        exercicio: 2026,
        avgTotalCost: Math.round(auditData.avgTotal),
        topOutliers,
        networkAverages: Object.fromEntries(
          Object.entries(auditData.avgByCat).map(([k, v]) => [k, Math.round(v as number)])
        )
      };

      const result = await generateAuditInvestigationReport(input);
      setAiReport(result.report);
      toast({ title: "Auditoria IA Gerada", description: "O roteiro de investigação foi concluído pela IA." });
    } catch (err: any) {
      toast({ title: "Erro na IA", description: "Não foi possível gerar o roteiro de auditoria.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground italic">Processando pré-auditoria de custos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Auditoria de Custos: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Ranking de indicadores de despesa por unidade (Censo 2026)</p>
        </div>
        <Button 
          size="sm" 
          className="gap-2 bg-accent hover:bg-accent/90 shadow-md" 
          onClick={handleGenerateAI} 
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? "Analisando..." : "Gerar Auditoria IA"}
        </Button>
      </div>

      {aiReport && (
        <Card className="border-accent/30 bg-accent/5 shadow-lg animate-in slide-in-from-top-4 duration-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <CardTitle className="text-lg text-accent">Roteiro de Investigação IA</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={() => setAiReport(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full rounded-md border bg-white p-4">
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 font-body">
                {aiReport}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros de Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Setor de Despesa</label>
              <div className="grid grid-cols-1 gap-1">
                <Button 
                  variant={categoryFilter === "total" ? "default" : "outline"} 
                  size="sm" 
                  className="justify-start text-xs h-8"
                  onClick={() => setCategoryFilter("total")}
                >
                  <Scale className="h-3 w-3 mr-2" /> Custo Total/Aluno
                </Button>
                {auditData.categories.map(cat => (
                  <Button 
                    key={cat}
                    variant={categoryFilter === cat ? "default" : "outline"} 
                    size="sm" 
                    className="justify-start text-xs h-8 truncate"
                    onClick={() => setCategoryFilter(cat)}
                    title={cat}
                  >
                    <BarChart4 className="h-3 w-3 mr-2 shrink-0" /> {cat}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
               <div className="flex items-center gap-2 text-blue-800">
                 <Trophy className="h-4 w-4" />
                 <span className="text-xs font-bold uppercase">Líder de Gastos</span>
               </div>
               {sortedRankings.length > 0 && (
                 <div>
                   <p className="text-[10px] text-blue-600 font-medium">{sortedRankings[0].name}</p>
                   <p className="text-xl font-bold text-blue-900">
                     R$ {Math.round(categoryFilter === "total" ? sortedRankings[0].totalCostPerStudent : sortedRankings[0].costsByCategory[categoryFilter]).toLocaleString('pt-BR')}
                   </p>
                   <p className="text-[9px] text-blue-500 uppercase mt-1">Por Aluno / Ano</p>
                 </div>
               )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-md">
          <CardHeader className="bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> 
                  Ranking: {categoryFilter === "total" ? "Custo Total por Aluno" : `Custo de ${categoryFilter} por Aluno`}
                </CardTitle>
                <CardDescription>Unidades ordenadas pelo maior impacto financeiro per capita</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white">Rede: R$ {Math.round(categoryFilter === "total" ? auditData.avgTotal : (auditData.avgByCat[categoryFilter] || 0)).toLocaleString('pt-BR')} (Média)</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-12 text-center">Pos</TableHead>
                    <TableHead>Unidade Escolar</TableHead>
                    <TableHead className="text-right">Alunos</TableHead>
                    <TableHead className="text-right">Custo/Aluno</TableHead>
                    <TableHead className="text-right">Diferença vs Média</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRankings.map((s, idx) => {
                    const value = categoryFilter === "total" ? s.totalCostPerStudent : s.costsByCategory[categoryFilter];
                    const avg = categoryFilter === "total" ? auditData.avgTotal : (auditData.avgByCat[categoryFilter] || 0);
                    const diffPerc = avg > 0 ? ((value / avg) - 1) * 100 : 0;
                    
                    return (
                      <TableRow key={s.id} className={idx < 5 ? "bg-red-50/20" : ""}>
                        <TableCell className="text-center font-bold text-muted-foreground">{idx + 1}º</TableCell>
                        <TableCell>
                          <p className="font-bold text-sm">{s.name}</p>
                        </TableCell>
                        <TableCell className="text-right text-xs">{s.totalMatriculas}</TableCell>
                        <TableCell className="text-right font-mono font-bold">R$ {Math.round(value).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1 font-bold ${diffPerc > 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {diffPerc > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {Math.abs(diffPerc).toFixed(1)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {diffPerc > 50 && <Badge variant="destructive" className="text-[8px] animate-pulse">ALERTA</Badge>}
                          {diffPerc > 20 && diffPerc <= 50 && <Badge variant="outline" className="text-[8px] text-orange-600 border-orange-200">ACIMA</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-muted/10 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Unidades Críticas</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold text-destructive">
               {sortedRankings.filter(s => {
                 const val = categoryFilter === "total" ? s.totalCostPerStudent : s.costsByCategory[categoryFilter];
                 const avg = categoryFilter === "total" ? auditData.avgTotal : (auditData.avgByCat[categoryFilter] || 0);
                 return val > avg * 1.5;
               }).length}
             </div>
             <p className="text-[10px] text-muted-foreground mt-1">Mais de 50% acima da média da rede</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
