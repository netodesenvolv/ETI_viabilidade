
"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Sparkles, 
  Loader2, 
  Download, 
  Save, 
  History, 
  FileText, 
  Target, 
  Calendar, 
  Calculator, 
  Scale,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  MapPin,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { generateEtiStrategy } from "@/ai/flows/generate-eti-strategy";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";

export default function EstrategistaPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

  // Estados do Formulário
  const [metaPct, setMetaPct] = useState("25");
  const [prazoAnos, setPrazoAnos] = useState("5");
  const [restricao, setRestricao] = useState("");
  const [prioridade, setPrioridade] = useState("Rede completa proporcional");
  const [observacoes, setObservacoes] = useState("");

  // Estados da IA
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Dados do Firestore
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

  // Histórico de Estratégias
  const strategiesRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'strategies') : null), [db, municipioId]);
  const strategiesQuery = useMemo(() => strategiesRef ? query(strategiesRef, orderBy('createdAt', 'desc')) : null, [strategiesRef]);
  const { data: history } = useCollection(strategiesQuery);

  // Consolidação de Contexto para a IA
  const networkContext = useMemo(() => {
    if (!schools || schools.length === 0) return null;

    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculas = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);
    const totalETI = municipalSchools.reduce((acc, s: any) => acc + (s.total_eti || 0), 0);
    const pctETI = totalMatriculas > 0 ? (totalETI / totalMatriculas) * 100 : 0;

    let totalVaaf = 0;
    let totalReceita = 0;
    municipalSchools.forEach((s: any) => {
      const vaaf = calcularVAAF(s.matriculas, parametros);
      const vaat = calcularVAAT(s, parametros, totalMatriculas);
      const pnae = calcularPNAE(s.matriculas, parametros);
      const mde = calcularMDE(s, parametros, totalMatriculas);
      const outros = calcularOutros(s, parametros, totalMatriculas);
      totalVaaf += vaaf;
      totalReceita += (vaaf + vaat + pnae + mde + outros);
    });

    const despesaTotal = (expenses || []).reduce((acc: number, e: any) => acc + (e.value || 0), 0);
    const saldo = totalReceita - despesaTotal;

    return {
      totalMatriculas,
      totalETI,
      pctETI,
      vaaf: totalVaaf,
      receitaTotal: totalReceita,
      despesaTotal,
      saldo,
      numEscolas: municipalSchools.length
    };
  }, [schools, expenses, parametros]);

  const handleGenerate = async () => {
    if (!networkContext || !profile) return;
    setIsGenerating(true);
    setReport(null);

    try {
      const input = {
        municipio: profile.municipio,
        uf: profile.uf || "BA",
        totalMatriculas: networkContext.totalMatriculas,
        totalETI: networkContext.totalETI,
        pctETI: Math.round(networkContext.pctETI),
        vaaf: Math.round(networkContext.vaaf),
        receitaTotal: Math.round(networkContext.receitaTotal),
        despesaTotal: Math.round(networkContext.despesaTotal),
        saldo: Math.round(networkContext.saldo),
        numEscolas: networkContext.numEscolas,
        metaPct: Number(metaPct),
        prazoAnos: Number(prazoAnos),
        prioridade,
        restricao: restricao || undefined,
        observacoes: observacoes || undefined,
      };

      const result = await generateEtiStrategy(input);
      setReport(result.report);
      toast({ title: "Estratégia Gerada", description: "O roteiro personalizado está pronto para análise." });
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!db || !municipioId || !report) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'municipios', municipioId, 'strategies'), {
        metaDesejada: Number(metaPct),
        prazoAnos: Number(prazoAnos),
        prioridade,
        observacoes,
        report,
        createdAt: new Date().toISOString()
      });
      toast({ title: "Estratégia Salva", description: "O roteiro foi arquivado no histórico do município." });
    } catch (e) {
      toast({ title: "Erro ao Salvar", description: "Não foi possível arquivar a estratégia.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Sincronizando dados municipais para a IA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-accent" /> Estrategista ETI
          </h2>
          <p className="text-muted-foreground">Roteiro de Expansão Inteligente para {profile?.municipio}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
             <Download className="h-4 w-4" /> Exportar PDF
           </Button>
           <Button 
             size="sm" 
             className="gap-2 bg-green-700 hover:bg-green-800" 
             disabled={!report || isSaving}
             onClick={handleSave}
           >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
             Salvar no Histórico
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="border-none shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Contexto da Rede
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ContextItem label="Alunos" value={networkContext?.totalMatriculas.toLocaleString('pt-BR')} />
                <ContextItem label="% ETI Atual" value={`${networkContext?.pctETI.toFixed(1)}%`} />
              </div>
              <Separator />
              <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                    <span>Meta PNE 6</span>
                    <span className="text-primary">25% (2024)</span>
                 </div>
                 <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (networkContext?.pctETI || 0) / 0.25)}%` }} />
                 </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Receita Estimada</span>
                  <span className="font-bold">R$ {Math.round((networkContext?.receitaTotal || 0) / 1000).toLocaleString('pt-BR')}k</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Saldo Líquido</span>
                  <span className={`font-bold ${(networkContext?.saldo || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    R$ {Math.round((networkContext?.saldo || 0) / 1000).toLocaleString('pt-BR')}k
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-accent/20">
            <CardHeader>
              <CardTitle className="text-lg">Parâmetros de Análise</CardTitle>
              <CardDescription>A IA usará estes dados como balizadores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Meta de ETI Desejada (%)</Label>
                <div className="relative">
                  <Target className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9" value={metaPct} onChange={e => setMetaPct(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Prazo de Expansão (Anos)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9" value={prazoAnos} onChange={e => setPrazoAnos(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Prioridade Geográfica/Etapa</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Creches e Pré-escola">Creches e Pré-escola</SelectItem>
                    <SelectItem value="Ensino Fundamental AI">Ensino Fundamental Anos Iniciais</SelectItem>
                    <SelectItem value="Ensino Fundamental AF">Ensino Fundamental Anos Finais</SelectItem>
                    <SelectItem value="Rede completa proporcional">Rede completa proporcional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Observações e Restrições</Label>
                <Textarea 
                  placeholder="Ex: Obras em andamento, carência de pessoal, etc." 
                  className="min-h-[100px] text-xs"
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                />
              </div>

              <Button 
                className="w-full gap-2 bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" 
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar Estratégia com IA
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="min-h-[600px] flex flex-col border-accent/20 shadow-xl overflow-hidden">
            <CardHeader className="bg-accent/5 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-accent flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Roteiro Estratégico IA
                </CardTitle>
              </div>
              {report && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-accent" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                    <Sparkles className="h-8 w-8 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">Processando Consultoria...</h3>
                    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                      A IA está cruzando o VAAf 2026 com os microdados do Censo para projetar sua expansão fiscal.
                    </p>
                  </div>
                </div>
              ) : report ? (
                <ScrollArea className="h-[600px] p-8">
                  <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed font-body">
                    {report}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground opacity-40">
                  <TrendingUp className="h-16 w-16 mb-4" />
                  <p className="text-sm font-headline">Aguardando definição de parâmetros para análise estratégica</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico de Planejamento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <ScrollArea className="h-[200px]">
                {history && history.length > 0 ? (
                  <div className="divide-y">
                    {history.map((h: any) => (
                      <div key={h.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/20">
                              Meta {h.metaDesejada}%
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(h.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs font-medium truncate max-w-[300px]">{h.prioridade}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setReport(h.report)}
                          className="gap-2 text-xs group-hover:text-accent"
                        >
                          Visualizar <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase tracking-widest p-8">
                    Nenhum roteiro salvo anteriormente
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContextItem({ label, value }: { label: string, value: any }) {
  return (
    <div className="p-3 bg-muted/30 rounded-xl space-y-1 border border-muted-foreground/5">
      <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">{label}</p>
      <p className="text-lg font-black text-slate-800 leading-none">{value || '---'}</p>
    </div>
  );
}
