
"use client"

import { useState, useMemo, useEffect } from "react";
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
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { GraduationCap, TrendingUp, DollarSign, Users, AlertTriangle, CheckCircle2, Calculator, Info, Loader2, RefreshCcw, Layers, Scale, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";

export default function SimuladorETIPage() {
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

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [novasMatriculasETI, setNovasMatriculasETI] = useState(20);
  const [custoExtraEstimado, setCustoExtraEstimado] = useState(4500); 
  const [logicaExpansao, setLogicaExpansao] = useState<"simples" | "capacidade">("simples");

  const municipalSchools = useMemo(() => {
    if (!schools) return [];
    return schools.filter(s => String(s.tp_dependencia) === '3');
  }, [schools]);

  const totalMatriculasRedeAtual = useMemo(() => 
    municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0)
  , [municipalSchools]);

  useEffect(() => {
    if (municipalSchools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(municipalSchools[0].id);
    }
  }, [municipalSchools, selectedSchoolId]);

  const selectedSchool = useMemo(() => 
    municipalSchools.find((s: any) => s.id === selectedSchoolId) || null
  , [municipalSchools, selectedSchoolId]);

  const simulacao = useMemo(() => {
    if (!selectedSchool) return null;

    const schoolMatriculas = selectedSchool.matriculas || {};
    
    // Cálculo do Cenário Atual
    const vaafA = calcularVAAF(schoolMatriculas, parametros);
    const vaatA = calcularVAAT(selectedSchool, parametros, totalMatriculasRedeAtual);
    const pnaeA = calcularPNAE(schoolMatriculas, parametros);
    const mdeA = calcularMDE(selectedSchool, parametros, totalMatriculasRedeAtual);
    const outrosA = calcularOutros(selectedSchool, parametros, totalMatriculasRedeAtual);
    const receitaAtual = vaafA + vaatA + pnaeA + mdeA + outrosA;

    // Lógica de Expansão
    const fatorReducao = logicaExpansao === 'capacidade' ? 2 : 1;
    const matriculasParciaisDisponiveis = (schoolMatriculas.ef_ai_parcial || 0) + (schoolMatriculas.ef_af_parcial || 0);
    
    // Ajuste de matrículas
    const novasMatriculas = {
      ...schoolMatriculas,
      ef_ai_integral: (schoolMatriculas.ef_ai_integral || 0) + novasMatriculasETI,
      ef_ai_parcial: Math.max(0, (schoolMatriculas.ef_ai_parcial || 0) - (novasMatriculasETI * fatorReducao))
    };

    const totalMatriculasEscolaNova = Object.values(novasMatriculas).reduce((a: any, b: any) => a + (b || 0), 0);
    const diferencaAlunosEscola = selectedSchool.total_matriculas - totalMatriculasEscolaNova;
    const totalMatriculasRedeNova = totalMatriculasRedeAtual - diferencaAlunosEscola;

    // Objeto de escola simulada para funções de cálculo
    const escolaSimulada = {
      ...selectedSchool,
      total_matriculas: totalMatriculasEscolaNova
    };

    // Cálculo do Cenário Simulado
    const vaafS = calcularVAAF(novasMatriculas, parametros);
    const vaatS = calcularVAAT(escolaSimulada, parametros, totalMatriculasRedeNova);
    const pnaeS = calcularPNAE(novasMatriculas, parametros);
    const mdeS = calcularMDE(escolaSimulada, parametros, totalMatriculasRedeNova);
    const outrosS = calcularOutros(escolaSimulada, parametros, totalMatriculasRedeNova);
    
    const receitaSimulada = vaafS + vaatS + pnaeS + mdeS + outrosS;
    const incrementoReceitaBruto = receitaSimulada - receitaAtual;

    const despesaExtra = novasMatriculasETI * custoExtraEstimado;
    const saldoSimulacao = incrementoReceitaBruto - despesaExtra;
    
    const matriculasDepoisETI = (novasMatriculas.creche_integral || 0) + (novasMatriculas.pre_integral || 0) + (novasMatriculas.ef_ai_integral || 0) + (novasMatriculas.ef_af_integral || 0);
    const percentualETINovo = totalMatriculasEscolaNova > 0 ? (matriculasDepoisETI / totalMatriculasEscolaNova) * 100 : 0;

    return {
      receitaAtual,
      receitaSimulada,
      incrementoReceitaBruto,
      despesaExtra,
      saldoSimulacao,
      novasMatriculasETI,
      reducaoVagas: diferencaAlunosEscola,
      percentualETIAnterior: selectedSchool.percentual_eti || 0,
      percentualETINovo,
      viabilidade: despesaExtra > 0 ? (incrementoReceitaBruto / despesaExtra) * 100 : 100,
      perdaFiscalPorVaga: logicaExpansao === 'capacidade' ? (receitaAtual / selectedSchool.total_matriculas) : 0
    };
  }, [selectedSchool, novasMatriculasETI, custoExtraEstimado, parametros, logicaExpansao, totalMatriculasRedeAtual]);

  if (schoolsLoading || profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Configurando simulador municipal...</p>
      </div>
    );
  }

  const chartData = simulacao ? [
    { name: 'Receita Atual', valor: Math.round(simulacao.receitaAtual) },
    { name: 'Receita Nova', valor: Math.round(simulacao.receitaSimulada) },
    { name: 'Custo Extra', valor: Math.round(simulacao.despesaExtra) },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Simulador de Expansão: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Projeções de impacto fiscal e físico para o exercício 2026</p>
        </div>
        <Badge variant="outline" className="h-fit py-1 px-3 border-accent/30 text-accent bg-accent/5 gap-2">
          <RefreshCcw className="h-3 w-3" /> Simulação de Impacto
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Parâmetros da Expansão
            </CardTitle>
            <CardDescription>Defina as variáveis para análise de viabilidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Unidade Municipal Alvo</Label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escola" />
                </SelectTrigger>
                <SelectContent>
                  {municipalSchools.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Modelo de Ocupação da Infraestrutura</Label>
              <RadioGroup 
                value={logicaExpansao} 
                onValueChange={(v: any) => setLogicaExpansao(v)}
                className="grid gap-4"
              >
                <div className="flex items-start space-x-3 p-3 border rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="simples" id="simples" className="mt-1" />
                  <Label htmlFor="simples" className="cursor-pointer space-y-1">
                    <div className="font-bold flex items-center gap-2">Conversão Direta (1:1)</div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Cada 1 novo aluno integral substitui 1 parcial. Indica que há espaço físico ocioso ou salas disponíveis.
                    </p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 border rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="capacidade" id="capacidade" className="mt-1" />
                  <Label htmlFor="capacidade" className="cursor-pointer space-y-1">
                    <div className="font-bold flex items-center gap-2">Impacto Físico (1:2)</div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Cada 1 novo integral substitui 2 parciais (Manhã e Tarde). Reflete a lotação máxima das salas de aula.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Aumento de Matrículas ETI</Label>
                <Input 
                  type="number"
                  className="w-20 h-8 text-right font-bold"
                  value={novasMatriculasETI}
                  onChange={(e) => setNovasMatriculasETI(Number(e.target.value))}
                />
              </div>
              <Slider 
                value={[novasMatriculasETI]} 
                onValueChange={(v) => setNovasMatriculasETI(v[0])} 
                max={100} 
                step={1} 
              />
              {logicaExpansao === 'capacidade' && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-orange-800 leading-tight">
                    <b>Atenção:</b> Neste modelo, você deixará de atender <b>{novasMatriculasETI * 2}</b> alunos parciais para atender <b>{novasMatriculasETI}</b> integrais.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Custo Adicional ETI / Aluno</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input 
                    type="number"
                    className="w-24 h-8 text-right font-bold text-primary"
                    value={custoExtraEstimado}
                    onChange={(e) => setCustoExtraEstimado(Number(e.target.value))}
                  />
                </div>
              </div>
              <Slider 
                value={[custoExtraEstimado]} 
                onValueChange={(v) => setCustoExtraEstimado(v[0])} 
                min={1000}
                max={10000} 
                step={100} 
              />
            </div>
          </CardContent>
        </Card>

        {simulacao && (
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="pt-6">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Impacto na Receita</div>
                  <div className={`text-2xl font-bold flex items-center gap-1 ${simulacao.incrementoReceitaBruto >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {simulacao.incrementoReceitaBruto >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    R$ {Math.abs(simulacao.incrementoReceitaBruto).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Saldo de repasses federais</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white">
                <CardContent className="pt-6">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Custo Extra Projetado</div>
                  <div className="text-2xl font-bold text-destructive">
                    R$ {simulacao.despesaExtra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Gasto anual adicional</p>
                </CardContent>
              </Card>

              <Card className={`border-none shadow-sm ${simulacao.saldoSimulacao >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <CardContent className="pt-6">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Superávit/Déficit Líquido</div>
                  <div className={`text-2xl font-bold ${simulacao.saldoSimulacao >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    R$ {simulacao.saldoSimulacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{simulacao.saldoSimulacao >= 0 ? 'Expansão viável' : 'Requer aporte municipal'}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Projeção Financeira da Unidade</CardTitle>
                <CardDescription>
                  Impacto no fluxo de caixa da escola: {selectedSchool?.nome}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000)}k`} />
                    <Tooltip 
                      formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Valor']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-accent/20 bg-accent/5">
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-headline font-bold text-accent flex items-center gap-2">
                    <Scale className="h-4 w-4" /> Diagnóstico de Viabilidade
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Índice de Cobertura</span>
                      <span className={`font-bold ${simulacao.viabilidade >= 100 ? 'text-green-600' : 'text-destructive'}`}>
                        {simulacao.viabilidade.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Perda de Alunos (Capacidade)</span>
                      <span className="font-bold text-orange-600">{simulacao.reducaoVagas} alunos</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-accent/70 leading-relaxed italic">
                    {logicaExpansao === 'capacidade' 
                      ? "O modelo 1:2 reduz a receita per capita total da escola, pois o aumento no peso do FUNDEB (1.0 para 1.3) não compensa a perda de uma matrícula inteira."
                      : "O modelo 1:1 é puramente incremental. Considera que não há perda de atendimento à comunidade."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-headline font-bold text-primary flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" /> Evolução da Jornada ETI
                  </h4>
                  <div className="space-y-4">
                     <div className="flex justify-between items-end">
                        <div className="text-center">
                           <p className="text-[10px] uppercase font-bold text-muted-foreground">Atual</p>
                           <p className="text-xl font-bold">{simulacao.percentualETIAnterior.toFixed(1)}%</p>
                        </div>
                        <div className="h-8 w-px bg-primary/20" />
                        <div className="text-center">
                           <p className="text-[10px] uppercase font-bold text-primary">Projetado</p>
                           <p className="text-2xl font-bold text-primary">{simulacao.percentualETINovo.toFixed(1)}%</p>
                        </div>
                     </div>
                     <div className="p-2 bg-white/50 rounded-lg border border-primary/10">
                        <p className="text-[10px] text-primary leading-tight">
                           A meta municipal deve ser equilibrar a expansão física com a sustentabilidade do FUNDEB VAAf.
                        </p>
                     </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
