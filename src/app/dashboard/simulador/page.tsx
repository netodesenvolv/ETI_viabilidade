"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { MOCK_SCHOOLS, DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE } from "@/lib/calculations";
import { GraduationCap, TrendingUp, DollarSign, Users, AlertTriangle, CheckCircle2, Calculator, Info } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SimuladorETIPage() {
  const [selectedSchoolId, setSelectedSchoolId] = useState(MOCK_SCHOOLS[0].id);
  const [novasMatriculasETI, setNovasMatriculasETI] = useState(20);
  const [custoExtraEstimado, setCustoExtraEstimado] = useState(4500); // Custo extra anual por aluno ETI além do parcial

  const selectedSchool = useMemo(() => 
    MOCK_SCHOOLS.find(s => s.id === selectedSchoolId) || MOCK_SCHOOLS[0]
  , [selectedSchoolId]);

  const totalMatriculasRede = MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_matriculas, 0);

  const simulacao = useMemo(() => {
    // Cenário Atual
    const vaafAtual = calcularVAAF(selectedSchool.matriculas, DEFAULT_PARAMETERS);
    const pnaeAtual = calcularPNAE(selectedSchool, DEFAULT_PARAMETERS);
    const receitaAtual = vaafAtual + pnaeAtual;

    // Cenário Simulado
    // Vamos assumir que as novas matrículas ETI saem das parciais (Anos Iniciais como padrão para o simulador)
    const novasMatriculas = {
      ...selectedSchool.matriculas,
      ef_ai_integral: selectedSchool.matriculas.ef_ai_integral + novasMatriculasETI,
      ef_ai_parcial: Math.max(0, selectedSchool.matriculas.ef_ai_parcial - novasMatriculasETI)
    };

    const vaafSimulado = calcularVAAF(novasMatriculas, DEFAULT_PARAMETERS);
    // Para o PNAE simulado, precisamos de um objeto "escola" temporário
    const escolaSimulada = { ...selectedSchool, matriculas: novasMatriculas };
    const pnaeSimulado = calcularPNAE(escolaSimulada, DEFAULT_PARAMETERS);
    
    const receitaSimulada = vaafSimulado + pnaeSimulado;
    const incrementoReceita = receitaSimulada - receitaAtual;

    // Custos
    const despesaExtra = novasMatriculasETI * custoExtraEstimado;
    const saldoSimulacao = incrementoReceita - despesaExtra;
    const viabilidade = despesaExtra > 0 ? (incrementoReceita / despesaExtra) * 100 : 100;

    return {
      receitaAtual,
      receitaSimulada,
      incrementoReceita,
      despesaExtra,
      saldoSimulacao,
      viabilidade,
      percentualETIAnterior: selectedSchool.percentual_eti,
      percentualETINovo: ((selectedSchool.total_eti + novasMatriculasETI) / selectedSchool.total_matriculas) * 100
    };
  }, [selectedSchool, novasMatriculasETI, custoExtraEstimado]);

  const chartData = [
    { name: 'Atual', valor: Math.round(simulacao.receitaAtual) },
    { name: 'Simulado (Receita)', valor: Math.round(simulacao.receitaSimulada) },
    { name: 'Custo Extra', valor: Math.round(simulacao.despesaExtra) },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Simulador de Expansão ETI</h2>
          <p className="text-muted-foreground">Projete o impacto financeiro de converter matrículas parciais em tempo integral</p>
        </div>
        <Badge variant="outline" className="h-fit py-1 px-3 border-accent/30 text-accent bg-accent/5">
          <GraduationCap className="h-3 w-3 mr-2" /> Exercício 2026
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Configuração */}
        <Card className="lg:col-span-1 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Parâmetros da Simulação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Unidade Escolar</Label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escola" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_SCHOOLS.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Novas Matrículas ETI</Label>
                <span className="text-sm font-bold text-primary">{novasMatriculasETI} alunos</span>
              </div>
              <Slider 
                value={[novasMatriculasETI]} 
                onValueChange={(v) => setNovasMatriculasETI(v[0])} 
                max={100} 
                step={5} 
              />
              <p className="text-[10px] text-muted-foreground">Considerando conversão de turmas de Anos Iniciais Parciais (C2) para Integrais (C1).</p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between">
                <Label>Custo Extra Anual / Aluno (R$)</Label>
                <span className="text-sm font-bold text-orange-600">R$ {custoExtraEstimado}</span>
              </div>
              <Slider 
                value={[custoExtraEstimado]} 
                onValueChange={(v) => setCustoExtraEstimado(v[0])} 
                min={2000}
                max={8000} 
                step={100} 
              />
              <p className="text-[10px] text-muted-foreground italic">Diferença estimada entre o custo de manter um aluno 7h+ vs 4h (pessoal, alimentação, luz).</p>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" /> Contexto do FUNDEB
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                No simulador, o aluno Integral recebe fator 1.30 (VAAf) enquanto o Parcial recebe 1.00. 
                Isso gera um incremento de receita bruto de <b>R$ {(DEFAULT_PARAMETERS.vaaf_base * 0.3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</b> por aluno ao ano.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Painel de Resultados */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="pt-6">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Incremento Receita</div>
                <div className="text-2xl font-bold text-green-600">+ R$ {simulacao.incrementoReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                <div className="flex items-center gap-1 text-[10px] mt-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> FUNDEB + PNAE
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardContent className="pt-6">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Custo da Expansão</div>
                <div className="text-2xl font-bold text-destructive">- R$ {simulacao.despesaExtra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                <div className="flex items-center gap-1 text-[10px] mt-1 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> Gastos Operacionais
                </div>
              </CardContent>
            </Card>

            <Card className={`border-none shadow-sm ${simulacao.saldoSimulacao >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <CardContent className="pt-6">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Resultado Líquido</div>
                <div className={`text-2xl font-bold ${simulacao.saldoSimulacao >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  R$ {simulacao.saldoSimulacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </div>
                <div className="flex items-center gap-1 text-[10px] mt-1 font-bold">
                  {simulacao.saldoSimulacao >= 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {simulacao.saldoSimulacao >= 0 ? 'Viável' : 'Requer Recursos Próprios'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Projeção Financeira do Cenário</CardTitle>
              <CardDescription>Impacto na receita total da unidade escolar vs novos custos</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000)}k`} />
                  <Tooltip 
                    formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Valor']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 2 ? 'hsl(var(--destructive))' : index === 1 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="pt-6 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 space-y-2 text-center md:text-left">
                <h4 className="font-headline font-bold text-accent">Índice de Cobertura da Expansão</h4>
                <p className="text-sm text-accent/80">
                  Para cada R$ 1,00 investido na expansão, o governo federal repassará 
                  <span className="font-bold"> R$ {(simulacao.incrementoReceita / (simulacao.despesaExtra || 1)).toFixed(2)} </span> 
                  através do FUNDEB e PNAE.
                </p>
                <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-accent/60 uppercase font-bold">Novo % ETI da Escola</span>
                    <span className="text-lg font-bold text-accent">{simulacao.percentualETINovo.toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-accent/60 uppercase font-bold">Auto-sustentabilidade</span>
                    <span className="text-lg font-bold text-accent">{simulacao.viabilidade.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="w-32 h-32 shrink-0 flex items-center justify-center rounded-full border-8 border-accent/10 relative">
                <div className="text-center">
                  <span className="text-2xl font-bold text-accent">{simulacao.viabilidade.toFixed(0)}%</span>
                  <p className="text-[8px] text-accent/60 uppercase font-bold">Meta: 100%</p>
                </div>
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="64" cy="64" r="56"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-accent"
                    strokeDasharray={351.8}
                    strokeDashoffset={351.8 * (1 - Math.min(simulacao.viabilidade / 100, 1))}
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
