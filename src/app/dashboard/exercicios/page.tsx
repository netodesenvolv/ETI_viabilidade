"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarRange, Loader2, ArrowRightLeft, PlusCircle, DatabaseZap, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { useMunicipality } from "@/providers/municipality-provider";
import { censoDoExercicio } from "@/lib/exercicio";
import {
  contarLegado, migrarLegadoParaExercicio, migrarDespesasLegado, migrarParametrosLegado, criarExercicioProjetado, resumoExercicio, ResumoExercicio,
} from "@/lib/exercicio-acoes";

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v: number, d = 0) => (v || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
const pct = (s: string) => (parseFloat((s || "0").replace(",", ".")) || 0) / 100;

export default function ExerciciosPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const profileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const { activeMunicipioId, activeMunicipioName, exercicio, setExercicio, exerciciosDisponiveis, isViewOnly } = useMunicipality();
  const municipioId = activeMunicipioId || profile?.municipioId;

  // ---- Estrutura antiga (antes da separação por exercício)
  const [legado, setLegado] = useState<{ escolas: number; despesas: number; parametros: boolean } | null>(null);
  const [anoMigracao, setAnoMigracao] = useState("2026");
  const [migrando, setMigrando] = useState(false);

  // ---- Novo exercício
  const ultimo = exerciciosDisponiveis.length ? exerciciosDisponiveis[exerciciosDisponiveis.length - 1].ano : exercicio;
  const [anoBase, setAnoBase] = useState<string>("");
  const [reajPessoal, setReajPessoal] = useState("6");
  const [reajAlim, setReajAlim] = useState("5");
  const [reajTransp, setReajTransp] = useState("5");
  const [reajCusteio, setReajCusteio] = useState("5");
  const [crescValor, setCrescValor] = useState("5");
  const [criando, setCriando] = useState(false);

  // ---- Comparativo
  const [resumos, setResumos] = useState<ResumoExercicio[]>([]);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  useEffect(() => {
    if (!anoBase && exerciciosDisponiveis.length) setAnoBase(String(ultimo));
  }, [exerciciosDisponiveis, anoBase, ultimo]);

  useEffect(() => {
    if (!db || !municipioId) return;
    contarLegado(db, municipioId).then(setLegado).catch(() => setLegado(null));
  }, [db, municipioId]);

  const carregarResumos = async () => {
    if (!db || !municipioId) return;
    setCarregandoResumo(true);
    try {
      const lista = await Promise.all(exerciciosDisponiveis.map(e => resumoExercicio(db, municipioId, e.ano)));
      setResumos(lista);
    } catch (e: any) {
      toast({ title: "Erro no comparativo", description: e.message, variant: "destructive" });
    } finally { setCarregandoResumo(false); }
  };
  useEffect(() => { carregarResumos(); /* eslint-disable-next-line */ }, [db, municipioId, exerciciosDisponiveis.length]);

  const jaMigrado = exerciciosDisponiveis.some(e => e.ano === Number(anoMigracao));
  const temLegado = !!legado && (legado.escolas > 0 || legado.despesas > 0 || legado.parametros);

  const handleMigrar = async () => {
    if (!db || !municipioId) return;
    if (!confirm(`Copiar os dados atuais (estrutura antiga) para o Exercício ${anoMigracao}? Nada será apagado.`)) return;
    setMigrando(true);
    try {
      const r = await migrarLegadoParaExercicio(db, municipioId, Number(anoMigracao));
      setExercicio(Number(anoMigracao));
      toast({ title: "Migração concluída", description: `${r.escolas} escolas, ${r.despesas} despesas${r.parametros ? " e os parâmetros" : ""} copiados para ${anoMigracao}.` });
    } catch (e: any) {
      toast({ title: "Erro na migração", description: e.message, variant: "destructive" });
    } finally { setMigrando(false); }
  };

  const handleCopiarDespesas = async () => {
    if (!db || !municipioId) return;
    if (!confirm(`Copiar as ${legado?.despesas || 0} despesas da estrutura antiga para o Exercício ${anoMigracao}? As escolas do exercício não serão alteradas e nada da estrutura antiga será apagado.`)) return;
    setMigrando(true);
    try {
      const r = await migrarDespesasLegado(db, municipioId, Number(anoMigracao));
      toast({ title: "Despesas copiadas", description: `${r.despesas} despesas copiadas para ${anoMigracao}.` });
      await carregarResumos();
    } catch (e: any) {
      toast({ title: "Erro ao copiar despesas", description: e.message, variant: "destructive" });
    } finally { setMigrando(false); }
  };

  const handleCopiarParametros = async () => {
    if (!db || !municipioId) return;
    if (!confirm(`Substituir os parâmetros do Exercício ${anoMigracao} pelos da estrutura antiga? Os fatores serão os oficiais do exercício.`)) return;
    setMigrando(true);
    try {
      const r = await migrarParametrosLegado(db, municipioId, Number(anoMigracao));
      toast({ title: r.parametros ? "Parâmetros copiados" : "Sem parâmetros antigos", description: r.parametros ? `Confira a tela Parâmetros ${anoMigracao}.` : "Não há parâmetros na estrutura antiga." });
      await carregarResumos();
    } catch (e: any) {
      toast({ title: "Erro ao copiar parâmetros", description: e.message, variant: "destructive" });
    } finally { setMigrando(false); }
  };

  const anoNovo = (Number(anoBase) || ultimo) + 1;
  const handleCriar = async () => {
    if (!db || !municipioId || !anoBase) return;
    if (!confirm(`Abrir o Exercício ${anoNovo} (Censo ${censoDoExercicio(anoNovo)}) a partir de ${anoBase}?`)) return;
    setCriando(true);
    try {
      const r = await criarExercicioProjetado(db, municipioId, {
        anoBase: Number(anoBase), anoNovo,
        reajustes: { pessoal: pct(reajPessoal), alimentacao: pct(reajAlim), transporte: pct(reajTransp), custeio: pct(reajCusteio) },
        crescimentoValorPonderada: pct(crescValor),
        copiarEscolas: true,
      });
      setExercicio(anoNovo);
      toast({ title: `Exercício ${anoNovo} aberto`, description: `${r.despesas} despesas projetadas e ${r.escolas} escolas copiadas. Agora importe o Censo ${censoDoExercicio(anoNovo)} na tela Censo Escolar.` });
    } catch (e: any) {
      toast({ title: "Não foi possível abrir o exercício", description: e.message, variant: "destructive" });
    } finally { setCriando(false); }
  };

  if (!municipioId) {
    return <div className="h-[60vh] flex items-center justify-center text-muted-foreground">Município não identificado.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary flex items-center gap-2"><CalendarRange className="h-7 w-7" /> Exercícios</h2>
        <p className="text-muted-foreground">
          {activeMunicipioName} — cada exercício guarda suas próprias escolas, despesas e parâmetros. Regra: <b>Exercício N usa o Censo N−1</b>.
        </p>
      </div>

      {temLegado && !jaMigrado && (
        <Alert className="bg-amber-50 border-amber-200">
          <DatabaseZap className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-bold text-amber-900">Dados na estrutura antiga</AlertTitle>
          <AlertDescription className="space-y-3 text-amber-900">
            <p>
              Há {legado!.escolas} escolas, {legado!.despesas} despesas{legado!.parametros ? " e parâmetros" : ""} gravados antes da separação por exercício.
              Copie-os para o exercício a que pertencem (o Censo 2025 pertence ao Exercício 2026). Os fatores de ponderação serão atualizados para a tabela oficial; os antigos ficam guardados.
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Exercício</Label>
              <Input className="w-24 h-8" value={anoMigracao} onChange={e => setAnoMigracao(e.target.value)} />
              <Button size="sm" onClick={handleMigrar} disabled={migrando || isViewOnly} className="gap-2">
                {migrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Migrar para {anoMigracao}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {temLegado && jaMigrado && (
        <Alert className="bg-amber-50 border-amber-200">
          <DatabaseZap className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-bold text-amber-900">Dados da versão anterior (estrutura antiga)</AlertTitle>
          <AlertDescription className="space-y-3 text-amber-900">
            <p>
              A versão anterior do sistema guarda {legado!.despesas} despesas{legado!.parametros ? " e parâmetros" : ""} fora dos exercícios.
              O Exercício {anoMigracao} já existe, então copie só o que falta. As escolas do exercício não são alteradas.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Exercício</Label>
              <Input className="w-24 h-8" value={anoMigracao} onChange={e => setAnoMigracao(e.target.value)} />
              {legado!.despesas > 0 && (
                <Button size="sm" onClick={handleCopiarDespesas} disabled={migrando || isViewOnly} className="gap-2">
                  {migrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Copiar {legado!.despesas} despesas
                </Button>
              )}
              {legado!.parametros && (
                <Button size="sm" variant="outline" onClick={handleCopiarParametros} disabled={migrando || isViewOnly} className="gap-2">
                  Copiar parâmetros
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Comparativo entre exercícios</CardTitle>
            <CardDescription>Rede municipal. Receita inclui FUNDEB, PNAE, recursos próprios, royalties e demais receitas lançadas nos parâmetros.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={carregarResumos} disabled={carregandoResumo}>
            {carregandoResumo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
          </Button>
        </CardHeader>
        <CardContent>
          {exerciciosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum exercício aberto ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exercício</TableHead><TableHead>Situação</TableHead>
                    <TableHead className="text-right">Escolas</TableHead><TableHead className="text-right">Matrículas</TableHead>
                    <TableHead className="text-right">ETI</TableHead><TableHead className="text-right">Ponderadas</TableHead>
                    <TableHead className="text-right">FUNDEB</TableHead><TableHead className="text-right">Receita total</TableHead>
                    <TableHead className="text-right">Despesa</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exerciciosDisponiveis.map(e => {
                    const r = resumos.find(x => x.ano === e.ano);
                    return (
                      <TableRow key={e.ano} className={e.ano === exercicio ? "bg-primary/5" : ""}>
                        <TableCell className="font-bold">{e.ano}<div className="text-[10px] text-muted-foreground font-normal">Censo {e.censoAno}</div></TableCell>
                        <TableCell><Badge variant="outline" className={e.status === "projecao" ? "border-amber-300 text-amber-700" : "border-green-300 text-green-700"}>{e.status === "projecao" ? "Projeção" : "Realizado"}</Badge></TableCell>
                        <TableCell className="text-right">{r ? num(r.escolas) : "…"}</TableCell>
                        <TableCell className="text-right">{r ? num(r.matriculas) : "…"}</TableCell>
                        <TableCell className="text-right">{r ? num(r.eti) : "…"}</TableCell>
                        <TableCell className="text-right">{r ? num(r.ponderadas, 1) : "…"}</TableCell>
                        <TableCell className="text-right">{r ? <>{brl(r.fundeb)}<div className="text-[10px] text-muted-foreground">{r.origemFundeb === "oficial" ? "estimativa oficial" : "cálculo automático"}</div></> : "…"}</TableCell>
                        <TableCell className="text-right">{r ? brl(r.receita) : "…"}</TableCell>
                        <TableCell className="text-right">{r ? <>{brl(r.despesa)}{r.despesasProjetadas && <div className="text-[10px] text-amber-700">projetada</div>}</> : "…"}</TableCell>
                        <TableCell className={`text-right font-bold ${r && r.saldo < 0 ? "text-destructive" : "text-green-700"}`}>{r ? brl(r.saldo) : "…"}</TableCell>
                        <TableCell>{e.ano === exercicio ? <span className="text-xs text-primary flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> ativo</span> : <Button size="sm" variant="ghost" onClick={() => setExercicio(e.ano)}>Ativar</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /> Abrir novo exercício (projeção)</CardTitle>
          <CardDescription>
            Copia escolas e parâmetros do exercício base e projeta as despesas com os reajustes abaixo. Depois, importe o Censo do novo exercício na tela Censo Escolar: as escolas copiadas serão substituídas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exerciciosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Primeiro migre ou crie o exercício base (importando o Censo na tela Censo Escolar).</p>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Exercício base</Label>
                  <Select value={anoBase} onValueChange={setAnoBase}>
                    <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent>{exerciciosDisponiveis.map(e => <SelectItem key={e.ano} value={String(e.ano)}>{e.ano} (Censo {e.censoAno})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Novo exercício</Label>
                  <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 font-bold">{anoNovo} · Censo {censoDoExercicio(anoNovo)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Crescimento do valor por matrícula ponderada (%)</Label>
                  <Input value={crescValor} onChange={e => setCrescValor(e.target.value)} />
                </div>
              </div>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-1"><Label className="text-xs">Reajuste pessoal (%)</Label><Input value={reajPessoal} onChange={e => setReajPessoal(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Reajuste alimentação (%)</Label><Input value={reajAlim} onChange={e => setReajAlim(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Reajuste transporte (%)</Label><Input value={reajTransp} onChange={e => setReajTransp(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Reajuste demais custeios (%)</Label><Input value={reajCusteio} onChange={e => setReajCusteio(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Os percentuais são sugestões; ajuste com a equipe. O custo das novas turmas de tempo integral entra pelo Simulador ETI ou lançando em Gestão de Despesas no exercício {anoNovo}.
              </p>
              <Button onClick={handleCriar} disabled={criando || isViewOnly || !anoBase || exerciciosDisponiveis.some(e => e.ano === anoNovo)} className="gap-2">
                {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                {exerciciosDisponiveis.some(e => e.ano === anoNovo) ? `Exercício ${anoNovo} já existe` : `Abrir Exercício ${anoNovo}`}
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Próximos passos depois de abrir: <Link className="underline" href="/dashboard/censo">importar o Censo</Link>, conferir os <Link className="underline" href="/dashboard/parametros">parâmetros</Link> e revisar as <Link className="underline" href="/dashboard/despesas">despesas projetadas</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
