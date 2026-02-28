
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
import { calcularVAAF, calcularVAAT, calcularPNAE } from "@/lib/calculations";
import { GraduationCap, TrendingUp, DollarSign, Users, AlertTriangle, CheckCircle2, Calculator, Info, Loader2, RefreshCcw, Layers, Scale } from "lucide-react";
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

  // FILTRO CENTRAL: Apenas escolas municipais para simulação
  const municipalSchools = useMemo(() => {
    if (!schools) return [];
    return schools.filter(s => String(s.tp_dependencia) === '3');
  }, [schools]);

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

    const schoolMatriculas = selectedSchool.matriculas || {
      creche_integral: 0, creche_parcial: 0, creche_conveniada_int: 0, creche_conveniada_par: 0,
      pre_integral: 0, pre_parcial: 0, ef_ai_integral: 0, ef_ai_parcial: 0, ef_af_integral: 0, ef_af_parcial: 0,
      eja_fundamental: 0, eja_medio: 0, especial_aee: 0, indigena_quilombola: 0, campo_rural: 0
    };

    const vaafAtual = calcularVAAF(schoolMatriculas, parametros);
    const pnaeAtual = calcularPNAE(schoolMatriculas, parametros);
    const receitaAtual = vaafAtual + pnaeAtual;

    // LÓGICA DE CONVERSÃO:
    // Se logica === 'capacidade', cada 1 integral remove 2 parciais (ocupa os 2 turnos)
    const fatorReducao = logicaExpansao === 'capacidade' ? 2 : 1;
    
    const novasMatriculas = {
      ...schoolMatriculas,
      ef_ai_integral: (schoolMatriculas.ef_ai_integral || 0) + novasMatriculasETI,
      ef_ai_parcial: Math.max(0, (schoolMatriculas.ef_ai_parcial || 0) - (novasMatriculasETI * fatorReducao))
    };

    const vaafSimulado = calcularVAAF(novasMatriculas, parametros);
    const pnaeSimulado = calcularPNAE(novasMatriculas, parametros);
    
    const receitaSimulada = vaafSimulado + pnaeSimulado;
    const incrementoReceita = receitaSimulada - receitaAtual;

    const despesaExtra = novasMatriculasETI * custoExtraEstimado;
    const saldoSimulacao = incrementoReceita - despesaExtra;
    const viabilidade = despesaExtra > 0 ? (incrementoReceita / despesaExtra) * 100 : 100;

    const matriculasAntes = totalMatriculas(schoolMatriculas);
    const matriculasDepois = totalMatriculas(novasMatriculas);
    const reducaoVagas = matriculasAntes - matriculasDepois;

    return {
      receitaAtual,
      receitaSimulada,
      incrementoReceita,
      despesaExtra,
      saldoSimulacao,
      viabilidade,
      novasMatriculasETI,
      reducaoVagas,
      percentualETIAnterior: selectedSchool.percentual_eti || 0,
      percentualETINovo: matriculasDepois > 0 ? (totalETI(novasMatriculas) / matriculasDepois) * 100 : 0
    };
  }, [selectedSchool, novasMatriculasETI, custoExtraEstimado, parametros, logicaExpansao]);

  function totalMatriculas(m: any) {
    return Object.values(m).reduce((a: any, b: any) => a + (b || 0), 0);
  }

  function totalETI(m: any) {
    return (m.creche_integral || 0) + (m.pre_integral || 0) + (m.ef_ai_integral || 0) + (m.ef_af_integral || 0);
  }

  if (schoolsLoading || profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Configurando simulador municipal...</p>
      </div>
    );
  }

  if (municipalSchools.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola municipal disponível</h3>
        <p className="text-muted-foreground max-w-xs">
          A simulação de expansão é restrita à Rede Municipal (Dependência 3).
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard/censo">Ir para Censo Escolar</a>
        </Button>
      </div>
    );
  }

  const chartData = simulacao ? [
    { name: 'Atual', valor: Math.round(simulacao.receitaAtual) },
    { name: 'Simulado (Receita)', valor: Math.round(simulacao.receitaSimulada) },
    { name: 'Custo Extra', valor: Math.round(simulacao.despesaExtra) },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Simulador de Expansão: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Projeções de impacto fiscal e físico para 2026</p>
        </div>
        <Badge variant="outline" className="h-fit py-1 px-3 border-accent/30 text-accent bg-accent/5 gap-2">
          <RefreshCcw className="h-3 w-3" /> Simulação de Rede
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Parâmetros de Simulação
            </CardTitle>
            <CardDescription>Configure as variáveis e o modelo de ocupação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Unidade Escolar Municipal</Label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escola municipal" />
                </SelectTrigger>
                <SelectContent>
                  {municipalSchools.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Modelo de Ocupação Física</Label>
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
                      Cada 1 novo aluno integral substitui 1 aluno parcial. Assume que a escola possui salas extras ou capacidade ociosa nos turnos.
                    </p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 border rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value="capacidade" id="capacidade" className="mt-1" />
                  <Label htmlFor="capacidade" className="cursor-pointer space-y-1">
                    <div className="font-bold flex items-center gap-2">Conversão por Turno (1:2)</div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Cada 1 novo aluno integral substitui 2 alunos parciais (Manhã e Tarde). Reflete a realidade de ocupação total do espaço físico.
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
                max={Math.max(100, novasMatriculasETI + 50)} 
                step={1} 
              />
              {logicaExpansao === 'capacidade' && (
                <p className="text-[10px] text-orange-600 font-medium flex items-center gap-1">
                  <Scale className="h-3 w-3" /> Impacto: Redução de {novasMatriculasETI * 2} vagas parciais.
                </p>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Custo Extra Anual / Aluno</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input 
                    type="number"
                    className="w-24 h-8 text-right font-bold text-orange-600"
                    value={custoExtraEstimado}
                    onChange={(e) => setCustoExtraEstimado(Number(e.target.value))}
                  />
                </div>
              </div>
              <Slider 
                value={[custoExtraEstimado]} 
                onValueChange={(v) => setCustoExtraEstimado(v[0])} 
                min={500}
                max={15000} 
                step={50} 
              />
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-2">
              <p className="text-[10px] text-primary font-bold uppercase">Impacto FUNDEB 2026</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                O cálculo utiliza o VAAf Base de R$ {parametros.vaaf_base.toLocaleString('pt-BR')} e o fator integral de 1.30.
              </p>
            </div>
          </CardContent>
        </Card>

        {simulacao && (
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="pt-6">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Incremento Receita</div>
                  <div className="text-2xl font-bold text-green-600">+ R$ {simulacao.incrementoReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Ganhos em repasses</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white">
                <CardContent className="pt-6">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Custo Extra Operacional</div>
                  <div className="text-2xl font-bold text-destructive">- R$ {simulacao.despesaExtra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Gasto adicional projetado</p>
                </CardContent>
              </Card>

              <Card className={`border-none shadow-sm ${simulacao.saldoSimulacao >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <CardContent className="pt-6">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Saldo Líquido</div>
                  <div className={`text-2xl font-bold ${simulacao.saldoSimulacao >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    R$ {simulacao.saldoSimulacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{simulacao.saldoSimulacao >= 0 ? 'Expansão sustentável' : 'Necessita aporte próprio'}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Projeção de Fluxo de Caixa</CardTitle>
                <CardDescription>
                  Modelo: {logicaExpansao === 'simples' ? 'Conversão 1:1' : 'Conversão 1:2 (Físico)'} | 
                  Unidade: {selectedSchool?.nome}
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
                <CardContent className="pt-6">
                  <h4 className="font-headline font-bold text-accent mb-2 flex items-center gap-2">
                    <Scale className="h-4 w-4" /> Análise de Capacidade
                  </h4>
                  <p className="text-sm text-accent/80 leading-relaxed">
                    {logicaExpansao === 'capacidade' ? (
                      <>Para manter o padrão integral, a escola atenderá <b>{simulacao.reducaoVagas} alunos a menos</b> em relação ao cenário anterior. Isso exige reorganização do fluxo de matrículas da rede.</>
                    ) : (
                      <>Assume-se que a escola comporta novos alunos integrais sem reduzir a oferta total, ocupando vagas que estavam vazias ou turnos inativos.</>
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="bg-white">{simulacao.viabilidade.toFixed(1)}% de Cobertura</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <h4 className="font-headline font-bold text-primary mb-2 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" /> Evolução do ETI na Escola
                  </h4>
                  <div className="space-y-2 mt-3">
                    <div className="flex justify-between text-xs">
                      <span>Percentual Atual</span>
                      <span className="font-bold">{simulacao.percentualETIAnterior.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-primary font-bold">
                      <span>Percentual Projetado</span>
                      <span>{simulacao.percentualETINovo.toFixed(1)}%</span>
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
