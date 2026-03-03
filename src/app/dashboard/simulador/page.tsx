
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
  Cell
} from "recharts";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { 
  GraduationCap, 
  TrendingUp, 
  Calculator, 
  Loader2, 
  RefreshCcw, 
  Scale, 
  ArrowDownRight, 
  ArrowUpRight,
  Play,
  FileSearch,
  ChevronRight,
  Info,
  Building2,
  DollarSign
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EnrollmentCounts } from "@/types";

interface SimulacaoResult {
  receitaAtual: number;
  receitaSimulada: number;
  incrementoReceitaBruto: number;
  despesaAtual: number;
  despesaSimulada: number;
  saldoAtual: number;
  saldoSimulacao: number;
  novasMatriculasETI: number;
  reducaoVagas: number;
  vagasParciaisRemovidas: number;
  percentualETIAnterior: number;
  percentualETINovo: number;
  viabilidade: number;
  totalMatriculasEscolaNova: number;
  detalhes: {
    atual: { vaaf: number; vaat: number; pnae: number; mde: number; outros: number; total: number };
    simulado: { vaaf: number; vaat: number; pnae: number; mde: number; outros: number; total: number };
  };
  despesasDetalhadas: {
    pessoalFixo: number;
    operacionalAtual: number;
    operacionalSimulado: number;
    adicionalETI: number;
  }
}

const PHYSICAL_BUCKETS: (keyof EnrollmentCounts)[] = [
  'creche_integral', 'creche_parcial', 'creche_conveniada_int', 'creche_conveniada_par',
  'pre_integral', 'pre_parcial', 'ef_ai_integral', 'ef_ai_parcial', 
  'ef_af_integral', 'ef_af_parcial', 'eja_fundamental', 'eja_medio'
];

const PERSONNEL_CATEGORIES = ["Pessoal — Docentes", "Pessoal — Monitores", "Pessoal — Gestão"];

export default function SimuladorETIPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  const expensesRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'expenses') : null), [db, municipioId]);
  const { data: allExpenses } = useCollection(expensesRef);

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

  const totalETIRedeAtual = useMemo(() => 
    municipalSchools.reduce((acc, s: any) => acc + (s.total_eti || 0), 0)
  , [municipalSchools]);

  const metaPNERedeAtual = useMemo(() => 
    totalMatriculasRedeAtual > 0 ? (totalETIRedeAtual / totalMatriculasRedeAtual) * 100 : 0
  , [totalETIRedeAtual, totalMatriculasRedeAtual]);

  useEffect(() => {
    if (municipalSchools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(municipalSchools[0].id);
    }
  }, [municipalSchools, selectedSchoolId]);

  const handleRunSimulation = () => {
    const selectedSchool = municipalSchools.find((s: any) => s.id === selectedSchoolId);
    if (!selectedSchool) return;

    setIsCalculating(true);

    setTimeout(() => {
      const schoolMatriculas = selectedSchool.matriculas || {};
      const totalMatriculasAntes = PHYSICAL_BUCKETS.reduce((acc, cat) => acc + (Number(schoolMatriculas[cat]) || 0), 0);
      
      const vaafA = calcularVAAF(schoolMatriculas, parametros);
      const vaatA = calcularVAAT(selectedSchool, parametros, totalMatriculasRedeAtual);
      const pnaeA = calcularPNAE(schoolMatriculas, parametros);
      const mdeA = calcularMDE(selectedSchool, parametros, totalMatriculasRedeAtual);
      const outrosA = calcularOutros(selectedSchool, parametros, totalMatriculasRedeAtual);
      const receitaAtual = vaafA + vaatA + pnaeA + mdeA + outrosA;

      const schoolExpensesList = (allExpenses || []).filter((e: any) => e.schoolId === selectedSchoolId);
      const despesaAtual = schoolExpensesList.reduce((acc, e: any) => acc + (e.value || 0), 0);
      
      const despesaPessoal = schoolExpensesList
        .filter(e => PERSONNEL_CATEGORIES.includes(e.category))
        .reduce((acc, e) => acc + (e.value || 0), 0);
      
      const despesaOperacionalBase = despesaAtual - despesaPessoal;

      const fatorReducao = logicaExpansao === 'capacidade' ? 2 : 1;
      const vagasQueDevemSerLiberadas = novasMatriculasETI * fatorReducao;
      
      const novasMatriculas = { ...schoolMatriculas };
      const categoriasPrioridadeRemover: (keyof EnrollmentCounts)[] = [
        'eja_fundamental', 'eja_medio', 'ef_af_parcial', 'ef_ai_parcial', 
        'pre_parcial', 'creche_parcial', 'creche_conveniada_par',
        'creche_conveniada_int', 'pre_integral', 'creche_integral'
      ];

      const targetBucket = selectedSchool.nome.toLowerCase().includes('fundamental') ? 'ef_af_integral' : 'ef_ai_integral';
      novasMatriculas[targetBucket] = (novasMatriculas[targetBucket] || 0) + novasMatriculasETI;

      let remanescenteRemover = vagasQueDevemSerLiberadas;
      let totalRemovidoFisico = 0;

      for (const cat of categoriasPrioridadeRemover) {
        if (remanescenteRemover <= 0) break;
        const valorAtual = Number(novasMatriculas[cat] || 0);
        const removiveis = Math.min(remanescenteRemover, valorAtual);
        (novasMatriculas[cat] as any) = valorAtual - removiveis;
        remanescenteRemover -= removiveis;
        totalRemovidoFisico += removiveis;
      }

      const totalMatriculasEscolaNova = PHYSICAL_BUCKETS.reduce((acc, cat) => acc + (Number(novasMatriculas[cat]) || 0), 0);
      const ratioAlunos = totalMatriculasAntes > 0 ? totalMatriculasEscolaNova / totalMatriculasAntes : 1;

      const vaafS = calcularVAAF(novasMatriculas, parametros);
      const pnaeS = calcularPNAE(novasMatriculas, parametros);
      const receitaSimulada = vaafS + vaatA + pnaeS + mdeA + outrosA;

      const operacionalSimulado = despesaOperacionalBase * ratioAlunos;
      const adicionalETI = novasMatriculasETI * custoExtraEstimado;
      const despesaSimulada = despesaPessoal + operacionalSimulado + adicionalETI;
      
      const matriculasDepoisETI = (novasMatriculas.creche_integral || 0) + (novasMatriculas.pre_integral || 0) + (novasMatriculas.ef_ai_integral || 0) + (novasMatriculas.ef_af_integral || 0);

      setResultado({
        receitaAtual,
        receitaSimulada,
        incrementoReceitaBruto: receitaSimulada - receitaAtual,
        despesaAtual,
        despesaSimulada,
        saldoAtual: receitaAtual - despesaAtual,
        saldoSimulacao: receitaSimulada - despesaSimulada,
        novasMatriculasETI,
        reducaoVagas: totalMatriculasAntes - totalMatriculasEscolaNova,
        vagasParciaisRemovidas: totalRemovidoFisico,
        percentualETIAnterior: selectedSchool.percentual_eti || 0,
        percentualETINovo: totalMatriculasEscolaNova > 0 ? (matriculasDepoisETI / totalMatriculasEscolaNova) * 100 : 0,
        viabilidade: (receitaSimulada - despesaSimulada) >= (receitaAtual - despesaAtual) ? 100 : 0,
        totalMatriculasEscolaNova,
        detalhes: {
          atual: { vaaf: vaafA, vaat: vaatA, pnae: pnaeA, mde: mdeA, outros: outrosA, total: receitaAtual },
          simulado: { vaaf: vaafS, vaat: vaatA, pnae: pnaeS, mde: mdeA, outros: outrosA, total: receitaSimulada }
        },
        despesasDetalhadas: {
          pessoalFixo: despesaPessoal,
          operacionalAtual: despesaOperacionalBase,
          operacionalSimulado: operacionalSimulado,
          adicionalETI: adicionalETI
        }
      });
      setIsCalculating(false);
    }, 800);
  };

  const networkMetaSimulada = useMemo(() => {
    if (!resultado) return 0;
    const novaMatriculaRede = totalMatriculasRedeAtual - resultado.reducaoVagas;
    const novoETIRede = totalETIRedeAtual + resultado.novasMatriculasETI;
    return novaMatriculaRede > 0 ? (novoETIRede / novaMatriculaRede) * 100 : 0;
  }, [resultado, totalMatriculasRedeAtual, totalETIRedeAtual]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Simulador de Expansão: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Projeções de impacto fiscal e físico 2026</p>
        </div>
        <div className="flex gap-2">
           {resultado && (
             <Dialog>
               <DialogTrigger asChild>
                 <Button variant="outline" className="gap-2 border-accent text-accent hover:bg-accent/5">
                   <FileSearch className="h-4 w-4" /> Auditoria de Viabilidade
                 </Button>
               </DialogTrigger>
               <DialogContent className="max-w-4xl">
                 <DialogHeader>
                   <DialogTitle>Auditoria de Viabilidade Financeira</DialogTitle>
                   <DialogDescription>Comparativo técnico das rubricas de receita e despesas (Cenário 2026).</DialogDescription>
                 </DialogHeader>
                 <ScrollArea className="max-h-[75vh] pr-4">
                   <div className="space-y-8 py-4">
                     <section>
                       <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                         <TrendingUp className="h-4 w-4" /> Composição de Receitas (Turno e Merenda)
                       </h4>
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-muted/50">
                             <TableHead>Rubrica de Receita</TableHead>
                             <TableHead className="text-right">Cenário Atual</TableHead>
                             <TableHead className="text-right">Cenário Simulado</TableHead>
                             <TableHead className="text-right">Diferença</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           <AuditRow label="VAAf (Repasse Turno)" valA={resultado.detalhes.atual.vaaf} valS={resultado.detalhes.simulado.vaaf} help="Cálculo ponderado por peso do turno" />
                           <AuditRow label="PNAE (Merenda)" valA={resultado.detalhes.atual.pnae} valS={resultado.detalhes.simulado.pnae} help="Valor dia integral vs Parcial" />
                           <AuditRow label="VAAT (Complementação)" valA={resultado.detalhes.atual.vaat} valS={resultado.detalhes.simulado.vaat} />
                           <AuditRow label="MDE (Recursos Próprios)" valA={resultado.detalhes.atual.mde} valS={resultado.detalhes.simulado.mde} />
                           <AuditRow label="Outros (QSE/PDDE)" valA={resultado.detalhes.atual.outros} valS={resultado.detalhes.simulado.outros} />
                           <TableRow className="bg-primary/5 font-bold">
                             <TableCell>SUBTOTAL RECEITAS</TableCell>
                             <TableCell className="text-right">R$ {resultado.receitaAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                             <TableCell className="text-right">R$ {resultado.receitaSimulada.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                             <TableCell className="text-right text-green-600 font-mono">+ R$ {resultado.incrementoReceitaBruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                           </TableRow>
                         </TableBody>
                       </Table>
                     </section>

                     <Separator />

                     <section>
                       <h4 className="text-sm font-bold text-destructive mb-3 flex items-center gap-2">
                         <Calculator className="h-4 w-4" /> Composição de Despesas (Impacto Operacional)
                       </h4>
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-muted/50">
                             <TableHead>Categoria de Despesa</TableHead>
                             <TableHead className="text-right">Cenário Atual</TableHead>
                             <TableHead className="text-right">Cenário Simulado</TableHead>
                             <TableHead className="text-right">Diferença</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           <AuditRow 
                            label="Folha de Pagamento (Fixo)" 
                            valA={resultado.despesasDetalhadas.pessoalFixo} 
                            valS={resultado.despesasDetalhadas.pessoalFixo} 
                            help="Docentes, Gestão e Monitores existentes" 
                           />
                           <AuditRow 
                             label="Operacional (Redimensionado)" 
                             valA={resultado.despesasDetalhadas.operacionalAtual} 
                             valS={resultado.despesasDetalhadas.operacionalSimulado} 
                             help="Transporte, Alimentação e Utilidades (Headcount)" 
                           />
                           <AuditRow 
                             label="Custo Adicional ETI" 
                             valA={0} 
                             valS={resultado.despesasDetalhadas.adicionalETI} 
                             help={`${resultado.novasMatriculasETI} integrais × R$ ${custoExtraEstimado.toLocaleString('pt-BR')}`}
                           />
                           <TableRow className="bg-destructive/5 font-bold">
                             <TableCell>SUBTOTAL DESPESAS</TableCell>
                             <TableCell className="text-right">R$ {resultado.despesaAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                             <TableCell className="text-right">R$ {resultado.despesaSimulada.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                             <TableCell className="text-right text-destructive">
                                {resultado.despesaSimulada >= resultado.despesaAtual ? '+' : ''}
                                R$ {(resultado.despesaSimulada - resultado.despesaAtual).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                             </TableCell>
                           </TableRow>
                         </TableBody>
                       </Table>
                     </section>

                     <div className="p-6 bg-primary text-white rounded-2xl shadow-inner mt-4">
                       <div className="flex justify-between items-center text-left">
                         <div>
                           <h5 className="text-lg font-bold">Resultado Líquido da Operação (Saldo)</h5>
                           <p className="text-xs text-white/70">Diferença final entre ganho de repasse e custo incremental</p>
                         </div>
                         <div className="text-right">
                            <div className="text-3xl font-black">
                              R$ {resultado.saldoSimulacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </div>
                            <Badge className={resultado.saldoSimulacao >= resultado.saldoAtual ? "bg-green-400 text-green-900 border-none" : "bg-orange-400 text-orange-900 border-none"}>
                              {resultado.saldoSimulacao >= resultado.saldoAtual ? "Incremento Positivo" : "Margem Reduzida"}
                            </Badge>
                         </div>
                       </div>
                     </div>
                   </div>
                 </ScrollArea>
               </DialogContent>
             </Dialog>
           )}
           <Badge variant="outline" className="h-fit py-1 px-3 border-accent/30 text-accent bg-accent/5 gap-2">
             <RefreshCcw className="h-3 w-3" /> Motor de Cálculo 2026
           </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Parâmetros da Expansão
            </CardTitle>
            <CardDescription>Defina as variáveis para análise</CardDescription>
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
              <RadioGroup value={logicaExpansao} onValueChange={(v: any) => setLogicaExpansao(v)} className="grid gap-4">
                <div className={`flex items-start space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${logicaExpansao === 'simples' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                  <RadioGroupItem value="simples" id="simples" className="mt-1" />
                  <Label htmlFor="simples" className="cursor-pointer space-y-1">
                    <div className="font-bold">Conversão Direta (1:1)</div>
                    <p className="text-[10px] text-muted-foreground">Cada 1 novo integral substitui 1 parcial.</p>
                  </Label>
                </div>
                <div className={`flex items-start space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${logicaExpansao === 'capacidade' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'}`}>
                  <RadioGroupItem value="capacidade" id="capacidade" className="mt-1" />
                  <Label htmlFor="capacidade" className="cursor-pointer space-y-1">
                    <div className="font-bold">Impacto Físico (1:2)</div>
                    <p className="text-[10px] text-muted-foreground">Cada 1 novo integral substitui 2 parciais.</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Novas Matrículas ETI</Label>
                <Input type="number" className="w-20 h-8 text-right font-bold" value={novasMatriculasETI} onChange={(e) => setNovasMatriculasETI(Number(e.target.value))} />
              </div>
              <Slider value={[novasMatriculasETI]} onValueChange={(v) => setNovasMatriculasETI(v[0])} max={1000} step={1} />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Custo Extra Anual / Aluno</Label>
                <Input type="number" className="w-24 h-8 text-right font-bold" value={custoExtraEstimado} onChange={(e) => setCustoExtraEstimado(Number(e.target.value))} />
              </div>
              <Slider value={[custoExtraEstimado]} onValueChange={(v) => setCustoExtraEstimado(v[0])} min={1000} max={10000} step={100} />
            </div>

            <Button className="w-full gap-2 mt-4" onClick={handleRunSimulation} disabled={isCalculating || !selectedSchoolId}>
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Calcular Cenário Projetado
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {resultado && !isCalculating && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Impacto na Receita Anual
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-xs">
                      <span>Receita Atual</span>
                      <span className="font-medium">R$ {resultado.receitaAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Receita Simulada</span>
                      <span className="font-bold text-green-600">R$ {resultado.receitaSimulada.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-xs font-bold">Ganho Líquido Repasses</span>
                      <Badge className="bg-green-600">+ R$ {resultado.incrementoReceitaBruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Sustentabilidade Fiscal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-xs">
                      <span>Despesa Atual (Real)</span>
                      <span className="text-muted-foreground">R$ {resultado.despesaAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Despesa Simulada</span>
                      <span className="text-destructive">R$ {resultado.despesaSimulada.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-xs font-bold">Saldo Projetado</span>
                      <Badge className={resultado.saldoSimulacao >= 0 ? 'bg-green-700' : 'bg-destructive'}>
                        R$ {resultado.saldoSimulacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-accent/20 bg-accent/5 p-6">
                  <h4 className="font-bold text-accent flex items-center gap-2 mb-4"><Scale className="h-4 w-4" /> Viabilidade Infra</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>Vagas Parciais Liberadas</span><span className="font-bold text-destructive">-{resultado.vagasParciaisRemovidas}</span></div>
                    <div className="flex justify-between"><span>Novas Vagas Integrais</span><span className="font-bold text-accent">+{resultado.novasMatriculasETI}</span></div>
                    <div className="flex justify-between pt-1 border-t"><span>Total Alunos Físicos</span><span className="font-bold text-primary">{resultado.totalMatriculasEscolaNova}</span></div>
                  </div>
                </Card>

                <Card className="border-primary/20 bg-primary/5 p-6">
                  <h4 className="font-bold text-primary flex items-center gap-2 mb-4 border-b pb-2"><GraduationCap className="h-4 w-4" /> Meta PNE (Integral)</h4>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Nesta Escola</p>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">
                            <p className="text-[8px] text-muted-foreground">Atual</p>
                            <p className="font-bold">{resultado.percentualETIAnterior.toFixed(1)}%</p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <div className="text-sm">
                            <p className="text-[8px] text-primary">Simulado</p>
                            <p className="font-bold text-primary">{resultado.percentualETINovo.toFixed(1)}%</p>
                          </div>
                        </div>
                     </div>
                     <div className="space-y-3 border-l pl-4">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Na Rede Municipal</p>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">
                            <p className="text-[8px] text-muted-foreground">Atual</p>
                            <p className="font-bold">{metaPNERedeAtual.toFixed(1)}%</p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <div className="text-sm">
                            <p className="text-[8px] text-primary">Simulado</p>
                            <p className="font-bold text-primary">{networkMetaSimulada.toFixed(1)}%</p>
                          </div>
                        </div>
                     </div>
                  </div>
                </Card>
              </div>

              <div className="p-4 bg-muted/50 rounded-xl border flex gap-3 text-xs italic text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  <b>Nota Técnica:</b> No cenário de conversão 1:2, as despesas operacionais (alimentação, transporte e utilidades) foram reduzidas proporcionalmente à menor ocupação física da unidade, mantendo-se fixa apenas a despesa com folha de pagamento.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditRow({ label, valA, valS, help }: { label: string, valA: number, valS: number, help?: string }) {
  const diff = valS - valA;
  return (
    <TableRow className="text-xs">
      <TableCell className="font-medium">
        <div>{label}</div>
        {help && <div className="text-[9px] text-muted-foreground italic">{help}</div>}
      </TableCell>
      <TableCell className="text-right font-mono">R$ {valA.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
      <TableCell className="text-right font-mono">R$ {valS.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
      <TableCell className={`text-right font-bold font-mono ${Math.abs(diff) < 1 ? 'text-muted-foreground' : diff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
        {Math.abs(diff) < 1 ? 'R$ 0' : `${diff >= 0 ? '+' : ''}R$ ${diff.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
      </TableCell>
    </TableRow>
  );
}
