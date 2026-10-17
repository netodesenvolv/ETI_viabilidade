"use client"

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Info, ScrollText, Utensils, Loader2, AlertTriangle, MapPin, Landmark, RotateCcw, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_PARAMETERS, normalizarParametros, FATORES_OFICIAIS } from "@/lib/constants";
import { resolverParametros } from "@/lib/calculations";
import { METAS_PNE, MARCOS, metasDosParametros, metasSaoAsDoPNE } from "@/lib/metas-pne";
import { useMunicipality, useExercicioRefs } from "@/providers/municipality-provider";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { FundingParameters } from "@/types";
import { Badge } from "@/components/ui/badge";
import { custoExtraPorAluno, custoExtraPorTurma, custosDosParametros, minimo4Pct } from "@/lib/expansao";

// Componente auxiliar para evitar o bug do cursor pulando ao formatar moeda
function MoneyInput({ value, onChange, id, className, placeholder, decimals = 2 }: any) {
  const [editingValue, setEditingValue] = useState<string | null>(null);

  const formatOptions = { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  };

  const displayValue = editingValue !== null 
    ? editingValue 
    : (value ?? 0).toLocaleString('pt-BR', formatOptions);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d,.-]/g, '');
    setEditingValue(raw);
    
    // Converte para número para o pai
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
    onChange(num);
  };

  return (
    <Input
      id={id}
      className={className}
      value={displayValue}
      onChange={handleChange}
      onFocus={() => {
        const val = (value ?? 0).toString().replace('.', ',');
        setEditingValue(val);
      }}
      onBlur={() => setEditingValue(null)}
      placeholder={placeholder}
    />
  );
}

const VAAF_LABELS: Record<string, string> = {
  A1: "Creche pública — Integral (7h+)",
  A2: "Creche pública — Parcial",
  A3: "Creche conveniada — Integral",
  A4: "Creche conveniada — Parcial",
  B1: "Pré-escola pública — Integral",
  B2: "Pré-escola pública — Parcial",
  C1: "Fundamental — Integral (anos iniciais)",
  C2: "Fundamental — Anos iniciais, parcial (urbano)",
  D1: "Fundamental — Integral (anos finais)",
  D2: "Fundamental — Anos finais, parcial (urbano)",
  E1: "EJA (fundamental)",
  E2: "EJA (médio)",
  F1: "AEE — dupla matrícula (soma ao fator da etapa)",
  F2: "Educação especial (substitui o fator da etapa)",
  G1: "Multiplicador indígena/quilombola (×)",
  G2: "Multiplicador campo/rural (×)",
};
const ORDEM_FATORES = ["A1","A2","A3","A4","B1","B2","C1","C2","D1","D2","E1","E2","F1","F2","G1","G2"];

// Fora do componente para não recriar (evita perder o foco ao digitar)
function Linha({ label, ajuda, children }: any) {
  return (
    <div className="flex justify-between items-center gap-4 text-sm py-1">
      <div><Label>{label}</Label>{ajuda && <p className="text-[10px] text-muted-foreground">{ajuda}</p>}</div>
      {children}
    </div>
  );
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ParametrosPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const { activeMunicipioId, activeMunicipioName, exercicio, censoAno, statusExercicio } = useMunicipality();

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = activeMunicipioId || profile?.municipioId;
  const exRefs = useExercicioRefs(municipioId);

  const { data: dbParams, loading: paramsLoading } = useDoc(exRefs.paramsRef);
  const { data: schools } = useCollection(exRefs.schoolsRef);

  const [localParams, setLocalParams] = useState<FundingParameters>(DEFAULT_PARAMETERS);

  // Carrega os parâmetros do exercício ativo (ou os padrões, se o exercício ainda não tiver)
  useEffect(() => {
    setLocalParams(normalizarParametros(dbParams));
  }, [dbParams, exercicio]);

  // Mostra lado a lado o cálculo automático e a estimativa oficial
  const resolvido = useMemo(() => resolverParametros(localParams, schools as any[]), [localParams, schools]);
  const oficial = Number(localParams.fundeb_estimativa_oficial) || 0;

  const handleSave = () => {
    if (!db || !municipioId || !exRefs.paramsRef) {
      toast({ title: "Erro de Contexto", description: "Município não identificado.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const docRef = exRefs.paramsRef;
    const dataToSave = {
      ...localParams,
      exercicio,
      censoAno,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email,
      municipio: activeMunicipioName || profile?.municipio,
      municipioId
    };
    setDoc(docRef, dataToSave, { merge: true })
      .then(() => {
        toast({ title: "Parâmetros salvos", description: `Exercício ${exercicio} de ${activeMunicipioName || profile?.municipio} atualizado.` });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: dataToSave }));
      })
      .finally(() => setIsSaving(false));
  };

  const updateFator = (key: string, num: number) =>
    setLocalParams(prev => ({ ...prev, fatores: { ...prev.fatores, [key]: num } as any }));
  const updatePnae = (key: string, num: number) =>
    setLocalParams(prev => ({ ...prev, pnae: { ...prev.pnae, [key]: num } as any }));
  const metas = metasDosParametros(localParams);
  const custos = custosDosParametros(localParams);
  const updateCusto = (key: string, num: number) =>
    setLocalParams(prev => ({ ...prev, custos_eti: { ...custosDosParametros(prev), [key]: num } }));
  const restaurarCustos = () => {
    setLocalParams(prev => ({ ...prev, custos_eti: { ...DEFAULT_PARAMETERS.custos_eti! } }));
    toast({ title: "Custos padrão aplicados", description: "Clique em Salvar para gravar." });
  };
  const updateMeta = (marco: "m2031" | "m2036", campo: "matriculas" | "escolas", num: number) =>
    setLocalParams(prev => {
      const m = metasDosParametros(prev);
      return { ...prev, metas: { ...m, [marco]: { ...m[marco], [campo]: Math.max(0, Math.min(100, num)) } } };
    });
  const restaurarMetas = () => {
    setLocalParams(prev => ({ ...prev, metas: { m2031: { ...METAS_PNE.m2031 }, m2036: { ...METAS_PNE.m2036 } } }));
    toast({ title: "Metas do PNE aplicadas", description: "Clique em Salvar para gravar." });
  };
  const restaurarFatores = () => {
    const of = FATORES_OFICIAIS[exercicio];
    if (!of) { toast({ title: "Sem tabela oficial", description: `Não há fatores oficiais cadastrados para ${exercicio}.`, variant: "destructive" }); return; }
    setLocalParams(prev => ({ ...prev, fatores: { ...of } }));
    toast({ title: "Fatores oficiais aplicados", description: `Tabela ${exercicio}. Clique em Salvar para gravar.` });
  };

  if (paramsLoading || profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Carregando parâmetros do exercício...</p>
      </div>
    );
  }

  if (!municipioId) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive/50" />
        <h3 className="text-xl font-bold">Município não identificado</h3>
        <p className="text-muted-foreground max-w-xs">Vincule seu perfil a um município para gerenciar parâmetros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-headline font-bold text-primary">Parâmetros de Financiamento</h2>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1.5 py-1">
              <MapPin className="h-3 w-3" /> {activeMunicipioName}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Exercício {exercicio} · Censo {censoAno}{statusExercicio === 'projecao' ? ' · Projeção' : ''}{!dbParams ? ' — ainda sem parâmetros salvos (mostrando os padrões)' : ''}
          </p>
        </div>
        <Button onClick={handleSave} className="gap-2 shadow-lg shadow-primary/20" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Tabs defaultValue="fundeb" className="space-y-4">
        <TabsList className="bg-white p-1 border shadow-sm w-full md:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="fundeb">FUNDEB</TabsTrigger>
          <TabsTrigger value="fatores">Fatores de ponderação</TabsTrigger>
          <TabsTrigger value="pnae">PNAE</TabsTrigger>
          <TabsTrigger value="proprios">Recursos próprios e outros</TabsTrigger>
          <TabsTrigger value="metas">Metas 2031 / 2036</TabsTrigger>
          <TabsTrigger value="custos">Custos ETI</TabsTrigger>
        </TabsList>

        <TabsContent value="fundeb">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Cálculo automático</CardTitle></div>
                <CardDescription>Matrículas ponderadas × NSE × DRec × valor por matrícula ponderada</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Linha label="Valor por matrícula ponderada (R$)" ajuda="No exercício realizado: estimativa oficial ÷ matrículas ponderadas do FNDE. Em Cordeiro 2026: R$ 6.233,78.">
                  <MoneyInput className="w-36 h-8 text-right font-mono" value={localParams.vaaf_base} onChange={(v: number) => setLocalParams(p => ({ ...p, vaaf_base: v }))} />
                </Linha>
                <Linha label="Ponderador NSE" ajuda="Nível socioeconômico — planilha FNDE do exercício">
                  <MoneyInput className="w-36 h-8 text-right font-mono" decimals={6} value={localParams.nse ?? 1} onChange={(v: number) => setLocalParams(p => ({ ...p, nse: v }))} />
                </Linha>
                <Linha label="Ponderador DRec" ajuda="Disponibilidade de recursos — planilha FNDE do exercício">
                  <MoneyInput className="w-36 h-8 text-right font-mono" decimals={6} value={localParams.drec ?? 1} onChange={(v: number) => setLocalParams(p => ({ ...p, drec: v }))} />
                </Linha>
                <div className="rounded-lg bg-muted/40 border p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Matrículas ponderadas da rede (com NSE e DRec)</span><b>{resolvido._totalPonderadas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</b></div>
                  <div className="flex justify-between"><span>FUNDEB pelo cálculo automático</span><b>{brl(resolvido._fundebCalculado)}</b></div>
                </div>
              </CardContent>
            </Card>

            <Card className={oficial > 0 ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Estimativa oficial (Portaria)</CardTitle></div>
                <CardDescription>Preencha quando sair a estimativa oficial ou para corrigir. Deixe 0 para usar o cálculo automático.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Linha label="FUNDEB estimado para o município (R$)">
                  <MoneyInput className="w-40 h-8 text-right font-mono font-bold" value={localParams.fundeb_estimativa_oficial || 0} onChange={(v: number) => setLocalParams(p => ({ ...p, fundeb_estimativa_oficial: v || null }))} />
                </Linha>
                <div className="rounded-lg bg-muted/40 border p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Valor em uso no sistema</span><b>{oficial > 0 ? "Estimativa oficial" : "Cálculo automático"}</b></div>
                  {oficial > 0 && (<>
                    <div className="flex justify-between"><span>Valor por matrícula ponderada resultante</span><b>{brl(resolvido.vaaf_base)}</b></div>
                    <div className="flex justify-between"><span>Diferença oficial − automático</span><b>{brl(oficial - resolvido._fundebCalculado)}</b></div>
                  </>)}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1"><Label className="text-xs">Complementação VAAT (R$)</Label>
                    <MoneyInput className="h-8 text-right font-mono" value={localParams.vaat_total_rede} onChange={(v: number) => setLocalParams(p => ({ ...p, vaat_total_rede: v }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Complementação VAAR (R$)</Label>
                    <MoneyInput className="h-8 text-right font-mono" value={localParams.vaar_total_rede} onChange={(v: number) => setLocalParams(p => ({ ...p, vaar_total_rede: v }))} /></div>
                </div>
                <p className="text-[10px] text-muted-foreground">Município que não recebe VAAT/VAAR: deixe 0.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fatores">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Fatores VAAF — {exercicio}</CardTitle>
                <CardDescription>Resolução CIF do exercício (2026: nº 16/2025; 2027: nº 26/2026). A tabela do site do MEC tem erros de digitação na coluna 2026 (ex.: “0,10”); vale 1,10 como em 2025 e 2027.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={restaurarFatores}><RotateCcw className="h-4 w-4" /> Aplicar tabela oficial</Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow><TableHead className="w-[80px]">Código</TableHead><TableHead>Segmento</TableHead><TableHead className="text-right w-[180px]">Fator</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {ORDEM_FATORES.map((key) => (
                        <TableRow key={key}>
                          <TableCell className="font-mono text-xs font-bold text-primary">{key}</TableCell>
                          <TableCell className="text-sm">{VAAF_LABELS[key]}</TableCell>
                          <TableCell className="text-right">
                            <MoneyInput className="w-24 ml-auto h-8 text-right font-mono" value={(localParams.fatores as any)[key] ?? 0} decimals={3} onChange={(v: number) => updateFator(key, v)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnae">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Utensils className="h-5 w-5 text-primary" /><CardTitle className="text-lg">PNAE — valor por aluno/dia</CardTitle></div>
              <CardDescription>Resolução CD/FNDE nº 1, de 18/02/2026</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-x-10 gap-y-1">
              <Linha label="Creche (parcial ou integral)"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.creche_dia ?? 1.57} onChange={(v: number) => updatePnae('creche_dia', v)} /></Linha>
              <Linha label="Tempo integral (7h+)"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.integral_dia} onChange={(v: number) => updatePnae('integral_dia', v)} /></Linha>
              <Linha label="Pré-escola (parcial)"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.pre_parcial_dia} onChange={(v: number) => updatePnae('pre_parcial_dia', v)} /></Linha>
              <Linha label="Fundamental e médio (parcial)"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.ef_parcial_dia} onChange={(v: number) => updatePnae('ef_parcial_dia', v)} /></Linha>
              <Linha label="EJA"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.eja_dia} onChange={(v: number) => updatePnae('eja_dia', v)} /></Linha>
              <Linha label="Indígena/quilombola"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.indigena_dia} onChange={(v: number) => updatePnae('indigena_dia', v)} /></Linha>
              <Linha label="AEE no contraturno"><MoneyInput className="w-24 h-8 text-right" value={localParams.pnae.aee_dia ?? 0.78} onChange={(v: number) => updatePnae('aee_dia', v)} /></Linha>
              <Linha label="Dias letivos"><Input className="w-24 h-8 text-right" value={String(localParams.pnae.dias_letivos)} onChange={(e) => updatePnae('dias_letivos', parseInt(e.target.value) || 0)} /></Linha>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proprios">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recursos próprios e demais receitas (lançamento manual)</CardTitle>
              <CardDescription>Valores anuais do exercício {exercicio}. São distribuídos entre as escolas pelo número de matrículas.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1"><Label>Impostos — parcela da Educação (fonte 1500.1001) R$</Label>
                <MoneyInput value={localParams.mde_liquido_eti} onChange={(v: number) => setLocalParams(p => ({ ...p, mde_liquido_eti: v }))} />
                <p className="text-[10px] text-muted-foreground">Só a parte que vai para a Educação fora do FUNDEB. Não use o MDE bruto: a retenção do FUNDEB já está no cálculo acima.</p></div>
              <div className="space-y-1"><Label>Royalties vinculados à Educação (fonte 1573) R$</Label>
                <MoneyInput value={localParams.royalties || 0} onChange={(v: number) => setLocalParams(p => ({ ...p, royalties: v }))} /></div>
              <div className="space-y-1"><Label>Salário-Educação (QSE) R$</Label>
                <MoneyInput value={localParams.qse} onChange={(v: number) => setLocalParams(p => ({ ...p, qse: v }))} /></div>
              <div className="space-y-1"><Label>PDDE R$</Label>
                <MoneyInput value={localParams.pdde} onChange={(v: number) => setLocalParams(p => ({ ...p, pdde: v }))} /></div>
              <div className="space-y-1"><Label>Outros repasses R$</Label>
                <MoneyInput value={localParams.outros_repasses} onChange={(v: number) => setLocalParams(p => ({ ...p, outros_repasses: v }))} /></div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border rounded-lg p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Referência Cordeiro 2026: 1500.1001 ≈ R$ 8,9 mi (gasto efetivo na fonte); royalties ≈ R$ 10,4 mi (estimativa conservadora); Salário-Educação ≈ R$ 1,6 mi. Ajustar após a conferência com a contabilidade (25% MDE e saldo da fonte 1573).</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metas">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Metas de educação em tempo integral</CardTitle></div>
                <CardDescription>
                  Padrão: novo PNE (Lei nº 15.388/2026, Meta 6.a) — 2031: 35% dos estudantes e 50% das escolas; 2036: 50% dos estudantes e 65% das escolas.
                  O município pode adotar metas próprias (PME / Plano de Expansão), desde que não sejam menores que as do PNE.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={restaurarMetas}><RotateCcw className="h-4 w-4" /> Aplicar metas do PNE</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow><TableHead>Marco</TableHead><TableHead className="text-right">% dos estudantes em tempo integral</TableHead><TableHead className="text-right">% das escolas com tempo integral</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {MARCOS.map(({ chave, ano }) => (
                      <TableRow key={chave}>
                        <TableCell className="font-bold">Até {ano} <span className="text-[10px] font-normal text-muted-foreground">(Censo {ano})</span></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <MoneyInput className="w-20 h-8 text-right font-mono" decimals={0} value={metas[chave].matriculas} onChange={(v: number) => updateMeta(chave, "matriculas", v)} /><span>%</span>
                          </div>
                          {metas[chave].matriculas < METAS_PNE[chave].matriculas && <p className="text-[10px] text-destructive mt-1">Abaixo do PNE ({METAS_PNE[chave].matriculas}%)</p>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <MoneyInput className="w-20 h-8 text-right font-mono" decimals={0} value={metas[chave].escolas} onChange={(v: number) => updateMeta(chave, "escolas", v)} /><span>%</span>
                          </div>
                          {metas[chave].escolas < METAS_PNE[chave].escolas && <p className="text-[10px] text-destructive mt-1">Abaixo do PNE ({METAS_PNE[chave].escolas}%)</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border rounded-lg p-3">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {metasSaoAsDoPNE(metas) ? "Usando as metas do PNE. " : "Usando metas próprias do município. "}
                  A meta é conferida pelo Censo Escolar do ano do marco. O Dashboard e o Simulador mostram quantas matrículas e escolas faltam para cada marco.
                  As metas valem para o exercício {exercicio}; ao abrir um novo exercício, elas são copiadas.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="custos">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Custo a mais do tempo integral (modelo por turma)</CardTitle>
                <CardDescription>
                  Quanto custa, por ano, transformar uma turma parcial em integral: professor de 20h a mais, profissional de apoio e merenda extra.
                  Estes valores alimentam o Simulador e o Estrategista. Use a folha e a merenda reais do município.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={restaurarCustos}><RotateCcw className="h-4 w-4" /> Restaurar padrão</Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-x-10 gap-y-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-primary">Pessoal (valores mensais, sem encargos)</p>
                <Linha label="Professor 20h (R$/mês)"><MoneyInput className="w-32 h-8 text-right font-mono" value={custos.prof20h_mensal} onChange={(v: number) => updateCusto('prof20h_mensal', v)} /></Linha>
                <Linha label="Apoio 40h (R$/mês)" ajuda="Monitor/auxiliar"><MoneyInput className="w-32 h-8 text-right font-mono" value={custos.apoio40h_mensal} onChange={(v: number) => updateCusto('apoio40h_mensal', v)} /></Linha>
                <Linha label="Meses pagos no ano" ajuda="12 + 13º + 1/3 de férias = 13,33"><MoneyInput className="w-32 h-8 text-right font-mono" value={custos.meses_ano} onChange={(v: number) => updateCusto('meses_ano', v)} /></Linha>
                <Linha label="Encargos patronais (%)" ajuda="Ex.: 24"><MoneyInput className="w-32 h-8 text-right font-mono" decimals={1} value={Math.round(custos.encargos * 1000) / 10} onChange={(v: number) => updateCusto('encargos', v / 100)} /></Linha>
                <p className="text-sm font-bold text-primary pt-3">Merenda e investimento</p>
                <Linha label="Merenda a mais por aluno (R$/mês)"><MoneyInput className="w-32 h-8 text-right font-mono" value={custos.merenda_extra_mes} onChange={(v: number) => updateCusto('merenda_extra_mes', v)} /></Linha>
                <Linha label="Meses com merenda"><MoneyInput className="w-32 h-8 text-right font-mono" decimals={0} value={custos.meses_merenda} onChange={(v: number) => updateCusto('meses_merenda', v)} /></Linha>
                <Linha label="Investimento por turma nova (R$)" ajuda="Gasto único (mobiliário, adequação). Não entra no custo anual."><MoneyInput className="w-32 h-8 text-right font-mono" value={custos.capital_por_turma} onChange={(v: number) => updateCusto('capital_por_turma', v)} /></Linha>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-primary">Ensino fundamental — por turma</p>
                <Linha label="Alunos por turma"><MoneyInput className="w-24 h-8 text-right font-mono" decimals={0} value={custos.ef_alunos_turma} onChange={(v: number) => updateCusto('ef_alunos_turma', v)} /></Linha>
                <Linha label="Professores 20h a mais"><MoneyInput className="w-24 h-8 text-right font-mono" decimals={1} value={custos.ef_prof_turma} onChange={(v: number) => updateCusto('ef_prof_turma', v)} /></Linha>
                <Linha label="Apoios 40h" ajuda="0,5 = um apoio para cada duas turmas"><MoneyInput className="w-24 h-8 text-right font-mono" decimals={1} value={custos.ef_apoio_turma} onChange={(v: number) => updateCusto('ef_apoio_turma', v)} /></Linha>
                <p className="text-sm font-bold text-primary pt-3">Educação infantil — por turma</p>
                <Linha label="Alunos por turma"><MoneyInput className="w-24 h-8 text-right font-mono" decimals={0} value={custos.ei_alunos_turma} onChange={(v: number) => updateCusto('ei_alunos_turma', v)} /></Linha>
                <Linha label="Professores 20h a mais"><MoneyInput className="w-24 h-8 text-right font-mono" decimals={1} value={custos.ei_prof_turma} onChange={(v: number) => updateCusto('ei_prof_turma', v)} /></Linha>
                <Linha label="Apoios 40h"><MoneyInput className="w-24 h-8 text-right font-mono" decimals={1} value={custos.ei_apoio_turma} onChange={(v: number) => updateCusto('ei_apoio_turma', v)} /></Linha>
              </div>
              <div className="md:col-span-2 rounded-lg bg-muted/40 border p-3 text-sm grid md:grid-cols-3 gap-3">
                <div><p className="text-xs text-muted-foreground">Fundamental: custo a mais por aluno/ano</p><b className="text-lg">{brl(custoExtraPorAluno('ef_ai', localParams))}</b><p className="text-[10px] text-muted-foreground">Por turma: {brl(custoExtraPorTurma('ef_ai', localParams).total)}</p></div>
                <div><p className="text-xs text-muted-foreground">Infantil: custo a mais por aluno/ano</p><b className="text-lg">{brl(custoExtraPorAluno('creche', localParams))}</b><p className="text-[10px] text-muted-foreground">Por turma: {brl(custoExtraPorTurma('creche', localParams).total)}</p></div>
                <div><p className="text-xs text-muted-foreground">Mínimo de 4% do FUNDEB para tempo integral/ano</p><b className="text-lg">{brl(minimo4Pct(resolvido).minimo)}</b><p className="text-[10px] text-muted-foreground">FUNDEB + VAAT + VAAR × 4% (Res. CIF 23/2026)</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
