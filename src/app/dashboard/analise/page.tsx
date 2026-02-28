
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
import { Calculator, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";

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

    // FILTRO CENTRAL: Apenas rede municipal ('3')
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

      // Ajuste: Se não houver despesa lançada, o custo é 0. Sem fallbacks estimados.
      let custoPorAluno = 0;
      if (totalDespesaReal > 0 && totalMatriculas > 0) {
        custoPorAluno = totalDespesaReal / totalMatriculas;
      }
      
      const saldoPorAluno = receitaPorAluno - custoPorAluno;
      const sustentabilidade = custoPorAluno > 0 ? (receitaPorAluno / custoPorAluno) * 100 : 100;

      return {
        name: school.nome,
        inep: school.codigo_inep,
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
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Análise Custo-Aluno: {profile?.municipio}</h2>
        <p className="text-muted-foreground">Exclusivo: Comparativo Financeiro da Rede Municipal de Ensino</p>
      </div>

      {!networkStats?.hasExpenses && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3 text-orange-800 text-sm">
            <Info className="h-5 w-5 shrink-0" />
            <p>
              <b>Aviso:</b> Nenhuma despesa real foi lançada. Os dados de "Custo/Aluno" abaixo estão zerados. 
              Importe seus gastos para visualizar a sustentabilidade real de cada unidade.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Média Receita/Aluno (Rede)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {networkStats?.avgReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) || "0"}</div>
            <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
              <TrendingUp className="h-3 w-3" /> Repasses 2026
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Média Custo/Aluno (Rede)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${!networkStats?.hasExpenses ? 'text-muted-foreground/30' : ''}`}>
              R$ {networkStats?.avgCusto.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) || "0"}
            </div>
            <div className="flex items-center gap-1 text-orange-600 text-xs mt-1">
              <Calculator className="h-3 w-3" /> Custos Operacionais
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Índice Sustentabilidade</CardTitle>
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
            <div className="flex items-center gap-1 text-destructive text-xs mt-1">
              <AlertTriangle className="h-3 w-3" /> Unidades deficitárias
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Divergência Financeira por Unidade Municipal</CardTitle>
            <CardDescription>Escolas da rede municipal em {profile?.municipio}</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ChartContainer config={chartConfig}>
              <BarChart data={analysisData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend verticalAlign="top" height={36}/>
                <Bar name="Receita/Aluno" dataKey="receita" fill="var(--color-receita)" radius={[4, 4, 0, 0]} />
                <Bar name="Custo/Aluno" dataKey="custo" fill="var(--color-custo)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Critérios de Análise</CardTitle>
            <CardDescription>Rede Municipal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-3 bg-muted/50 rounded-xl space-y-2">
                <p className="text-xs font-bold text-primary uppercase">Segmentação</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                   Apenas unidades com Dependência Municipal (3) são incluídas nesta análise. Unidades estaduais e federais possuem orçamentos e repasses distintos.
                </p>
             </div>
             <div className="p-3 bg-muted/50 rounded-xl space-y-2">
                <p className="text-xs font-bold text-accent uppercase">Base de Repasse</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                   Considera VAAf-Base Municipal, VAAT Estimado da Prefeitura e PNAE ajustado para 2026.
                </p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
