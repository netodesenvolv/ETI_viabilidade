
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
import { 
  GraduationCap, 
  TrendingUp, 
  DollarSign, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Calculator, 
  Info, 
  Loader2, 
  RefreshCcw, 
  Scale, 
  ArrowDownRight, 
  ArrowUpRight,
  Play
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";

interface SimulacaoResult {
  receitaAtual: number;
  receitaSimulada: number;
  incrementoReceitaBruto: number;
  despesaExtra: number;
  saldoSimulacao: number;
  novasMatriculasETI: number;
  reducaoVagas: number;
  percentualETIAnterior: number;
  percentualETINovo: number;
  viabilidade: number;
  totalMatriculasEscolaNova: number;
}

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
  const [isCalculating, setIsCalculating] = useState(false);
  const [resultado, setResultado] = useState<SimulacaoResult | null>(null);

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

  const handleRunSimulation = () => {
    const selectedSchool = municipalSchools.find((s: any) => s.id === selectedSchoolId);
    if (!selectedSchool) return;

    setIsCalculating(true);

    // Simulando delay de processamento para feedback visual
    setTimeout(() => {
      const schoolMatriculas = selectedSchool.matriculas || {};
      
      // 1. Cálculo do Cenário Atual
      const vaafA = calcularVAAF(schoolMatriculas, parametros);
      const vaatA = calcularVAAT(selectedSchool, parametros, totalMatriculasRedeAtual);
      const pnaeA = calcularPNAE(schoolMatriculas, parametros);
      const mdeA = calcularMDE(selectedSchool, parametros, totalMatriculasRedeAtual);
      const outrosA = calcularOutros(selectedSchool, parametros, totalMatriculasRedeAtual);
      const receitaAtual = vaafA + vaatA + pnaeA + mdeA + outrosA;

      // 2. Lógica de Expansão e Impacto Físico
      const fatorReducao = logicaExpansao === 'capacidade' ? 2 : 1;
      
      // Criamos as novas matrículas ajustando parciais para dar lugar a integrais
      // Priorizamos a remoção de Anos Iniciais Parciais (C2) e Anos Finais Parciais (D2)
      const alunosParciaisRemover = novasMatriculasETI * fatorReducao;
      
      const novasMatriculas = { ...schoolMatriculas };
      
      // Adiciona integrais nos anos iniciais (exemplo simplificado)
      novasMatriculas.ef_ai_integral = (novasMatriculas.ef_ai_integral || 0) + novasMatriculasETI;
      
      // Remove parciais para compensar
      let remanescenteRemover = alunosParciaisRemover;
      
      // Tenta remover do Fundamental Anos Iniciais Parcial primeiro
      const removiveisAI = Math.min(remanescenteRemover, novasMatriculas.ef_ai_parcial || 0);
      novasMatriculas.ef_ai_parcial = (novasMatriculas.ef_ai_parcial || 0) - removiveisAI;
      remanescenteRemover -= removiveisAI;
      
      // Se ainda precisar remover, tira do Fundamental Anos Finais Parcial
      if (remanescenteRemover > 0) {
        const removiveisAF = Math.min(remanescenteRemover, novasMatriculas.ef_af_parcial || 0);
        novasMatriculas.ef_af_parcial = (novasMatriculas.ef_af_parcial || 0) - removiveisAF;
        remanescenteRemover -= removiveisAF;
      }

      // Calcula novo total da escola
      const totalMatriculasEscolaNova = Object.values(novasMatriculas).reduce((a: any, b: any) => a + (Number(b) || 0), 0);
      const diferencaAlunosEscola = selectedSchool.total_matriculas - totalMatriculasEscolaNova;
      const totalMatriculasRedeNova = totalMatriculasRedeAtual - diferencaAlunosEscola;

      const escolaSimulada = {
        ...selectedSchool,
        total_matriculas: totalMatriculasEscolaNova
      };

      // 3. Cálculo do Cenário Simulado
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

      setResultado({
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
        totalMatriculasEscolaNova
      });
      setIsCalculating(false);
    }, 800);
  };

  const chartData = resultado ? [
    { name: 'Cenário Atual', valor: Math.round(resultado.receitaAtual), fill: 'hsl(var(--muted-foreground))' },
    { name: 'Cenário Simulado', valor: Math.round(resultado.receitaSimulada), fill: 'hsl(var(--primary))' },
    { name: 'Custo Extra', valor: Math.round(resultado.despesaExtra), fill: 'hsl(var(--destructive))' },
  ] : [];

  if (schoolsLoading || profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Configurando simulador municipal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Simulador de Expansão: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Projeções de impacto fiscal e físico para o exercício 2026</p>
        </div>
        <Badge variant="outline" className="h-fit py-1 px-3 border-accent/30 text-accent bg-accent/5 gap-2">
          <RefreshCcw className="h-3 w-3" /> Motor de Cálculo 2026
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
                <div className={`flex items-start space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${logicaExpansao === 'simples' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                  <RadioGroupItem value="simples" id="simples" className="mt-1" />
                  <Label htmlFor="simples" className="cursor-pointer space-y-1">
                    <div className="font-bold flex items-center gap-2">Conversão Direta (1:1)</div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Cada 1 novo integral substitui 1 parcial. Indica espaço ocioso ou salas disponíveis.
                    </p>
                  </Label>
                </div>
                <div className={`flex items-start space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${logicaExpansao === 'capacidade' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                  <RadioGroupItem value="capacidade" id="capacidade" className="mt-1" />
                  <Label htmlFor="capacidade" className="cursor-pointer space-y-1">
                    <div className="font-bold flex items-center gap-2">Impacto Físico (1:2)</div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Cada 1 novo integral substitui 2 parciais (Manhã e Tarde). Reflete lotação máxima das salas.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Novas Matrículas ETI</Label>
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
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Custo Extra Anual / Aluno</Label>
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

            <Button 
              className="w-full gap-2 mt-4 shadow-lg shadow-primary/20" 
              onClick={handleRunSimulation} 
              disabled={isCalculating || !selectedSchoolId}
            >
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Calcular Cenário Projetado
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!resultado && !isCalculating ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-2xl bg-muted/5 space-y-4">
              <Calculator className="h-12 w-12 text-muted-foreground/30" />
              <div className="space-y-1">
                <h4 className="font-bold">Pronto para Simular</h4>
                <p className="text-muted-foreground text-xs max-w-[250px]">
                  Configure os parâmetros à esquerda e clique em <b>Calcular</b> para ver o impacto financeiro.
                </p>
              </div>
            </div>
          ) : isCalculating ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium animate-pulse">Cruzando microdados com fatores FUNDEB 2026...</p>
            </div>
          ) : resultado && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Diferença de Receita</div>
                    <div className={`text-2xl font-bold flex items-center gap-1 ${resultado.incrementoReceitaBruto >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {resultado.incrementoReceitaBruto >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      R$ {Math.abs(resultado.incrementoReceitaBruto).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Impacto anual projetado</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Custo Extra Previsto</div>
                    <div className="text-2xl font-bold text-destructive">
                      R$ {resultado.despesaExtra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Adicional operacional</p>
                  </CardContent>
                </Card>

                <Card className={`border-none shadow-sm ${resultado.saldoSimulacao >= 0 ? 'bg-green-50 border-green-200 border' : 'bg-red-50 border-red-200 border'}`}>
                  <CardContent className="pt-6">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Saldo Final da Expansão</div>
                    <div className={`text-2xl font-bold ${resultado.saldoSimulacao >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      R$ {resultado.saldoSimulacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{resultado.saldoSimulacao >= 0 ? 'Expansão Sustentável' : 'Requer Aporte Municipal'}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Projeção de Repasses (Cenário 2026)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000)}k`} />
                      <Tooltip 
                        formatter={(v: any) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Valor']}
                        contentStyle={{ borderRadius: '12px', border: 'none', shadow: 'lg' }}
                      />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
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
                      <Scale className="h-4 w-4" /> Análise de Viabilidade
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Modelo de Ocupação</span>
                        <span className="font-bold text-accent">{logicaExpansao === 'simples' ? 'Conversão 1:1' : 'Impacto Físico 1:2'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Novas Vagas Integrais</span>
                        <span className="font-bold text-accent">+{resultado.novasMatriculasETI} alunos</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Vagas Parciais Suprimidas</span>
                        <span className="font-bold text-orange-600">-{resultado.novasMatriculasETI * (logicaExpansao === 'capacidade' ? 2 : 1)} alunos</span>
                      </div>
                    </div>
                    <div className="p-2 bg-accent/10 rounded-lg border border-accent/20">
                      <p className="text-[10px] text-accent leading-tight font-medium">
                        {logicaExpansao === 'capacidade' 
                          ? "O impacto fiscal é maior devido à perda de receitas 'por cabeça' (PNAE/MDE) dos alunos parciais que deixam de ser atendidos."
                          : "O impacto fiscal é puramente incremental, pois considera que não há redução no total de alunos atendidos pela rede."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6 space-y-3">
                    <h4 className="font-headline font-bold text-primary flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Jornada Escolar Projetada
                    </h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <div className="text-center">
                             <p className="text-[10px] uppercase font-bold text-muted-foreground">ETI Atual</p>
                             <p className="text-xl font-bold">{resultado.percentualETIAnterior.toFixed(1)}%</p>
                          </div>
                          <div className="h-8 w-px bg-primary/20" />
                          <div className="text-center">
                             <p className="text-[10px] uppercase font-bold text-primary">ETI Projetado</p>
                             <p className="text-2xl font-bold text-primary">{resultado.percentualETINovo.toFixed(1)}%</p>
                          </div>
                       </div>
                       <div className="p-3 bg-white/50 rounded-lg border border-primary/10 space-y-1">
                          <p className="text-[10px] text-primary leading-tight font-bold">
                             Resultado Operacional por Aluno:
                          </p>
                          <p className="text-xs font-mono font-bold text-primary">
                            R$ {(resultado.saldoSimulacao / resultado.novasMatriculasETI).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / aluno ETI
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
    </div>
  );
}
