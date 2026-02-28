
"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from "recharts";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Calculator, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Info, Loader2, ListFilter, ArrowRight } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AnaliseCustoAlunoPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

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

  const analysisData = useMemo(() => {
    if (!schools) return [];

    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculasRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    return municipalSchools.map((school: any) => {
      const schoolExpenses = (expenses || []).filter((e: any) => e.schoolId === school.id);
      const totalDespesaReal = schoolExpenses.reduce((acc, e: any) => acc + (e.value || 0), 0);

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
      const totalMatriculas = school.total_matriculas || 0;
      const receitaPorAluno = totalMatriculas > 0 ? receitaTotal / totalMatriculas : 0;
      const custoPorAluno = (totalDespesaReal > 0 && totalMatriculas > 0) ? totalDespesaReal / totalMatriculas : 0;
      
      const saldoPorAluno = receitaPorAluno - custoPorAluno;
      const sustentabilidade = custoPorAluno > 0 ? (receitaPorAluno / custoPorAluno) * 100 : 100;

      return {
        id: school.id,
        name: school.nome,
        inep: school.codigo_inep,
        totalMatriculas,
        receita: Math.round(receitaPorAluno),
        custo: Math.round(custoPorAluno),
        saldo: Math.round(saldoPorAluno),
        eti: school.percentual_eti || 0,
        sustentabilidade: Math.round(sustentabilidade),
        status: custoPorAluno === 0 ? 'neutro' : (sustentabilidade >= 105 ? 'superavit' : sustentabilidade >= 95 ? 'neutro' : 'deficit')
      };
    });
  }, [schools, expenses, parametros]);

  const networkStats = useMemo(() => {
    if (analysisData.length === 0) return null;
    const avgReceita = analysisData.reduce((acc, d) => acc + d.receita, 0) / analysisData.length;
    const avgCusto = analysisData.reduce((acc, d) => acc + d.custo, 0) / analysisData.length;
    const atRisk = analysisData.filter(d => d.status === 'deficit').length;
    const hasExpenses = (expenses || []).length > 0;
    
    return {
      avgReceita,
      avgCusto,
      atRisk,
      sustentabilidadeMedia: avgCusto > 0 ? (avgReceita / avgCusto) * 100 : 0,
      hasExpenses
    };
  }, [analysisData, expenses]);

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Processando análise custo-aluno municipal...</p>
      </div>
    );
  }

  const chartConfig = {
    receita: {
      label: "Receita/Aluno",
      color: "hsl(var(--primary))",
    },
    custo: {
      label: "Custo/Aluno",
      color: "hsl(var(--destructive))",
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Análise Custo-Aluno: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Diagnóstico de Sustentabilidade da Rede Municipal</p>
        </div>
        <Badge variant="outline" className="py-1 gap-2 border-primary/20 bg-primary/5 text-primary">
           Exercício 2026
        </Badge>
      </div>

      {!networkStats?.hasExpenses && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3 text-orange-800 text-sm">
            <Info className="h-5 w-5 shrink-0" />
            <p>
              <b>Aviso:</b> Nenhuma despesa real foi lançada no banco de dados. Os indicadores de "Custo/Aluno" estão zerados. 
              Importe seus gastos em <b>Gestão de Despesas</b> para visualizar a sustentabilidade real.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Média Receita/Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {networkStats?.avgReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) || "0"}</div>
            <div className="flex items-center gap-1 text-green-600 text-[10px] mt-1">
              <TrendingUp className="h-3 w-3" /> Repasses Projetados
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Média Custo/Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${!networkStats?.hasExpenses ? 'text-muted-foreground/30' : ''}`}>
              R$ {networkStats?.avgCusto.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) || "0"}
            </div>
            <div className="flex items-center gap-1 text-orange-600 text-[10px] mt-1">
              <Calculator className="h-3 w-3" /> Custos Operacionais
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Sustentabilidade Rede</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${networkStats && networkStats.sustentabilidadeMedia >= 100 ? 'text-green-600' : 'text-destructive'}`}>
              {networkStats?.sustentabilidadeMedia.toFixed(1)}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Ideal Municipal: {'>'} 105%</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Déficit Operacional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{networkStats?.atRisk || 0}</div>
            <div className="flex items-center gap-1 text-destructive text-[10px] mt-1">
              <AlertTriangle className="h-3 w-3" /> Unidades em Alerta
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Divergência Financeira por Unidade</CardTitle>
            <CardDescription>Comparativo Receita vs Custo (Base 2026)</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ChartContainer config={chartConfig}>
              <BarChart data={analysisData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} hide={analysisData.length > 15} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend verticalAlign="top" height={36}/>
                <Bar name="Receita/Aluno" dataKey="receita" fill="var(--color-receita)" radius={[4, 4, 0, 0]} />
                <Bar name="Custo/Aluno" dataKey="custo" fill="var(--color-custo)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Critérios de Sustentabilidade</CardTitle>
            <CardDescription>Métricas do Tesouro Municipal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-3 bg-muted/50 rounded-xl space-y-2 border">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <p className="text-xs font-bold text-primary uppercase">Superávit (>105%)</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                   A unidade gera receita excedente ao custo operacional, permitindo investimentos em infraestrutura e bônus pedagógicos.
                </p>
             </div>
             <div className="p-3 bg-muted/50 rounded-xl space-y-2 border">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <p className="text-xs font-bold text-accent uppercase">Equilíbrio (95% - 105%)</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                   A unidade opera no limite financeiro. Requer monitoramento rigoroso de gastos variáveis.
                </p>
             </div>
             <div className="p-3 bg-muted/50 rounded-xl space-y-2 border">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <p className="text-xs font-bold text-destructive uppercase">Déficit (<95%)</p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                   O custo por aluno excede os repasses. Requer revisão imediata da matriz de gastos ou expansão de matrículas integrais para elevar o VAAf.
                </p>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListFilter className="h-5 w-5 text-primary" /> Detalhamento Analítico por Unidade
              </CardTitle>
              <CardDescription>Indicadores granulares de viabilidade econômica</CardDescription>
            </div>
            <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Dados Municipais Consolidados
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[300px]">Unidade Municipal</TableHead>
                    <TableHead className="text-right">Alunos</TableHead>
                    <TableHead className="text-right">% ETI</TableHead>
                    <TableHead className="text-right">Receita/Aluno</TableHead>
                    <TableHead className="text-right">Custo/Aluno</TableHead>
                    <TableHead className="text-right">Saldo/Aluno</TableHead>
                    <TableHead className="text-right">Sustentabilidade</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisData.length > 0 ? (
                    analysisData.map((school) => (
                      <TableRow key={school.id} className="hover:bg-muted/30 text-xs">
                        <TableCell>
                          <div className="font-bold text-sm text-slate-800">{school.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">INEP: {school.inep}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{school.totalMatriculas}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px] border-primary/20">{school.eti}%</Badge>
                        </TableCell>
                        <TableCell className="text-right text-green-700 font-mono">R$ {school.receita.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className={`text-right font-mono ${school.custo > 0 ? 'text-destructive' : 'text-muted-foreground/30'}`}>
                          R$ {school.custo.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className={`text-right font-bold font-mono ${school.saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                          R$ {school.saldo.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${school.sustentabilidade >= 100 ? 'text-green-600' : 'text-destructive'}`}>
                          {school.sustentabilidade}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={school.status === 'superavit' ? 'default' : school.status === 'deficit' ? 'destructive' : 'secondary'}
                            className={`text-[9px] uppercase tracking-tighter ${school.status === 'superavit' ? 'bg-green-600' : ''}`}
                          >
                            {school.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">
                        Nenhuma escola municipal encontrada para análise.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
