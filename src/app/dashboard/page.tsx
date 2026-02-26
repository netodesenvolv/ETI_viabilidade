"use client"

import { useState } from "react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Users, GraduationCap, DollarSign, AlertCircle, TrendingUp, Sparkles, FileText, Download } from "lucide-react";
import { MOCK_SCHOOLS, DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateExecutiveFinancialReport } from "@/ai/flows/generate-executive-financial-report";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DashboardPage() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const totalMatriculasRede = MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_matriculas, 0);
  const totalETIRede = MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_eti, 0);
  const percentualETIRede = (totalETIRede / totalMatriculasRede) * 100;

  const schoolsAnalysis = MOCK_SCHOOLS.map(school => {
    const vaaf = calcularVAAF(school.matriculas, DEFAULT_PARAMETERS);
    const vaat = calcularVAAT(school, DEFAULT_PARAMETERS, totalMatriculasRede);
    const pnae = calcularPNAE(school, DEFAULT_PARAMETERS);
    const mde = calcularMDE(school, DEFAULT_PARAMETERS, totalMatriculasRede);
    const outros = calcularOutros(school, DEFAULT_PARAMETERS, totalMatriculasRede);
    
    const receitaTotal = vaaf + vaat + pnae + mde + outros;
    // Mock expenses as ~90% of revenue for demonstration
    const despesaTotal = receitaTotal * (0.8 + Math.random() * 0.25);
    const saldo = receitaTotal - despesaTotal;
    const cobertura = receitaTotal / despesaTotal;
    const custoAluno = despesaTotal / school.total_matriculas;
    const receitaAluno = receitaTotal / school.total_matriculas;

    let status: 'superavit' | 'neutro' | 'deficit' = 'superavit';
    if (cobertura <= 0.9) status = 'deficit';
    else if (cobertura < 1.1) status = 'neutro';

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

  const saldoTotalRede = schoolsAnalysis.reduce((acc, s) => acc + s.saldo, 0);
  const escolasEmDeficit = schoolsAnalysis.filter(s => s.status === 'deficit').length;
  const custoAlunoMedioRede = schoolsAnalysis.reduce((acc, s) => acc + s.custo_aluno, 0) / schoolsAnalysis.length;
  const receitaAlunoMedioRede = schoolsAnalysis.reduce((acc, s) => acc + s.receita_total, 0) / schoolsAnalysis.length; // Actually total revenue / total network enrollments would be better

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const input = {
        municipio: "São João dos Campos",
        uf: "MG",
        exercicio: 2026,
        totalMatriculas: totalMatriculasRede,
        totalETI: totalETIRede,
        percentualETI: Math.round(percentualETIRede),
        custoAlunoMedio: Math.round(custoAlunoMedioRede),
        receitaAlunoMedio: Math.round(receitaTotalRedePerStudent),
        saldoTotalRede: Math.round(saldoTotalRede),
        saldoStatus: saldoTotalRede >= 0 ? "superávit" : "déficit",
        escolasEmDeficit,
        totalEscolas: MOCK_SCHOOLS.length,
        escolasETIlt20Percent: MOCK_SCHOOLS.filter(s => s.percentual_eti < 20).length,
        composicaoReceitas: {
          fundebVaaf: { amount: 1500000, percentage: 65 },
          vaat: { amount: 350000, percentage: 15 },
          pnae: { amount: 120000, percentage: 5 },
          mdeLiquido: { amount: 230000, percentage: 10 },
          outros: { amount: 115000, percentage: 5 },
        },
        escolasEmAtencao: schoolsAnalysis
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

  const receitaTotalRedePerStudent = schoolsAnalysis.reduce((acc, s) => acc + s.receitaTotal, 0) / totalMatriculasRede;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Diagnóstico da Rede</h2>
          <p className="text-muted-foreground">Visão geral do exercício fiscal 2026</p>
        </div>
        <div className="flex gap-2">
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
          title="Matrículas Totais" 
          value={totalMatriculasRede.toLocaleString()} 
          icon={Users}
          subtitle="Rede Municipal"
        />
        <KPICard 
          title="Alunos em ETI" 
          value={`${percentualETIRede.toFixed(1)}%`} 
          icon={GraduationCap}
          subtitle={`${totalETIRede} alunos em tempo integral`}
          trend={{ value: 4.2, label: "vs 2025", isPositive: true }}
        />
        <KPICard 
          title="Saldo da Rede" 
          value={`R$ ${(saldoTotalRede / 1000).toFixed(1)}k`} 
          icon={DollarSign}
          subtitle={saldoTotalRede >= 0 ? "Superávit projetado" : "Déficit projetado"}
          className={saldoTotalRede >= 0 ? "bg-green-50/50" : "bg-red-50/50"}
        />
        <KPICard 
          title="Escolas em Déficit" 
          value={escolasEmDeficit} 
          icon={AlertCircle}
          subtitle={`De ${MOCK_SCHOOLS.length} escolas totais`}
          className={escolasEmDeficit > 0 ? "bg-orange-50/50" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">Diagnóstico por Escola</CardTitle>
            <CardDescription>Resumo financeiro e operacional de cada unidade</CardDescription>
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
                {schoolsAnalysis.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.nome}</TableCell>
                    <TableCell className="text-right">R$ {school.receitaAluno.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {school.custoAluno.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{school.percentual_eti}%</TableCell>
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
