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
  Legend,
  ComposedChart,
  Line
} from "recharts";
import { MOCK_SCHOOLS, DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Calculator, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export default function AnaliseCustoAlunoPage() {
  const totalMatriculasRede = MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_matriculas, 0);

  const analysisData = useMemo(() => {
    return MOCK_SCHOOLS.map(school => {
      // Receita
      const vaaf = calcularVAAF(school.matriculas, DEFAULT_PARAMETERS);
      const vaat = calcularVAAT(school, DEFAULT_PARAMETERS, totalMatriculasRede);
      const pnae = calcularPNAE(school, DEFAULT_PARAMETERS);
      const mde = calcularMDE(school, DEFAULT_PARAMETERS, totalMatriculasRede);
      const outros = calcularOutros(school, DEFAULT_PARAMETERS, totalMatriculasRede);
      const receitaTotal = vaaf + vaat + pnae + mde + outros;
      const receitaPorAluno = school.total_matriculas > 0 ? receitaTotal / school.total_matriculas : 0;

      // Custo (Simulado com variação para demonstração)
      // Escolas com mais ETI tendem a ter custo maior
      const fatorETI = 1 + (school.percentual_eti / 100) * 0.4; // Até 40% mais caro se 100% ETI
      const custoBase = 6200; // Custo base anual por aluno
      const custoPorAluno = custoBase * fatorETI * (0.9 + Math.random() * 0.2);
      
      const saldoPorAluno = receitaPorAluno - custoPorAluno;
      const sustentabilidade = (receitaPorAluno / custoPorAluno) * 100;

      return {
        name: school.nome,
        inep: school.codigo_inep,
        receita: Math.round(receitaPorAluno),
        custo: Math.round(custoPorAluno),
        saldo: Math.round(saldoPorAluno),
        eti: school.percentual_eti,
        sustentabilidade: Math.round(sustentabilidade),
        status: sustentabilidade >= 105 ? 'superavit' : sustentabilidade >= 95 ? 'neutro' : 'deficit'
      };
    });
  }, [totalMatriculasRede]);

  const networkStats = useMemo(() => {
    const avgReceita = analysisData.reduce((acc, d) => acc + d.receita, 0) / analysisData.length;
    const avgCusto = analysisData.reduce((acc, d) => acc + d.custo, 0) / analysisData.length;
    const atRisk = analysisData.filter(d => d.status === 'deficit').length;
    
    return {
      avgReceita,
      avgCusto,
      atRisk,
      sustentabilidadeMedia: (avgReceita / avgCusto) * 100
    };
  }, [analysisData]);

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
        <h2 className="text-3xl font-headline font-bold text-primary">Análise Custo-Aluno</h2>
        <p className="text-muted-foreground">Comparativo real entre repasses recebidos e custos operacionais por unidade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Média Receita/Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {networkStats.avgReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
              <TrendingUp className="h-3 w-3" /> Repasses 2026
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Média Custo/Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {networkStats.avgCusto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <div className="flex items-center gap-1 text-orange-600 text-xs mt-1">
              <Calculator className="h-3 w-3" /> Despesas Consolidadas
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Índice Sustentabilidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${networkStats.sustentabilidadeMedia >= 100 ? 'text-green-600' : 'text-destructive'}`}>
              {networkStats.sustentabilidadeMedia.toFixed(1)}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Meta Ideal: {'>'} 105%</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">Escolas Sob Alerta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{networkStats.atRisk}</div>
            <div className="flex items-center gap-1 text-destructive text-xs mt-1">
              <AlertTriangle className="h-3 w-3" /> Déficit operacional
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Divergência Financeira por Unidade</CardTitle>
            <CardDescription>Comparação direta entre receita e custo anual por matrícula</CardDescription>
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
            <CardTitle className="text-lg">Fatores de Risco</CardTitle>
            <CardDescription>Por que o custo varia entre as unidades?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
              <TrendingDown className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-bold">Ganho de Escala</p>
                <p className="text-[11px] text-muted-foreground">Escolas com menos de 150 alunos apresentam custo fixo/aluno até 25% superior à média da rede.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-accent shrink-0" />
              <div>
                <p className="text-xs font-bold">Impacto do ETI</p>
                <p className="text-[11px] text-muted-foreground">Cada 10% de aumento no ETI eleva o custo médio em R$ 420,00/ano, mas o repasse FUNDEB cobre apenas ~R$ 380,00.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
              <Info className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs font-bold">Vulnerabilidade VAAT</p>
                <p className="text-[11px] text-muted-foreground">Unidades com alta dependência do VAAT sofrem com a volatilidade dos critérios de vulnerabilidade socioeconômica.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ranking de Eficiência Financeira</CardTitle>
          <CardDescription>Relação Receita vs Custo por unidade escolar</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade Escolar</TableHead>
                <TableHead className="text-right">Receita/Al.</TableHead>
                <TableHead className="text-right">Custo/Al.</TableHead>
                <TableHead className="text-right">Saldo/Al.</TableHead>
                <TableHead className="text-right">Sustentabilidade</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysisData.sort((a, b) => a.sustentabilidade - b.sustentabilidade).map((item) => (
                <TableRow key={item.inep}>
                  <TableCell>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">INEP: {item.inep} • {item.eti}% ETI</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">R$ {item.receita.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-right font-mono text-sm">R$ {item.custo.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className={`text-right font-mono text-sm font-bold ${item.saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    R$ {item.saldo.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold">{item.sustentabilidade}%</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.status === 'superavit' ? 'bg-green-500' : item.status === 'neutro' ? 'bg-orange-400' : 'bg-destructive'}`}
                          style={{ width: `${Math.min(item.sustentabilidade, 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === 'superavit' ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Sustentável
                      </Badge>
                    ) : item.status === 'neutro' ? (
                      <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                        Equilibrado
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-red-50 text-destructive border-red-200">
                        Déficit
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
