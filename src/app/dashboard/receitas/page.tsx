
"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2, AlertCircle, Calculator, Eye, ListFilter, TrendingUp, DollarSign } from "lucide-react";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { KPICard } from "@/components/dashboard/kpi-card";

export default function ReceitasPage() {
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

  // FILTRO CENTRAL: Apenas escolas da rede municipal ('3')
  const municipalSchools = useMemo(() => {
    if (!schools) return [];
    return schools.filter(s => String(s.tp_dependencia) === '3');
  }, [schools]);

  const totalMatriculasRede = useMemo(() => 
    municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0)
  , [municipalSchools]);

  const schoolRevenueData = useMemo(() => {
    return municipalSchools.map((school: any) => {
      const vaaf = calcularVAAF(school.matriculas, parametros);
      const vaat = calcularVAAT(school, parametros, totalMatriculasRede);
      const pnae = calcularPNAE(school.matriculas, parametros);
      const mde = calcularMDE(school, parametros, totalMatriculasRede);
      const outros = calcularOutros(school, parametros, totalMatriculasRede);
      
      const total = vaaf + vaat + pnae + mde + outros;
      const perStudent = school.total_matriculas > 0 ? total / school.total_matriculas : 0;

      return {
        ...school,
        vaaf,
        vaat,
        pnae,
        mde_outros: mde + outros,
        total,
        perStudent
      };
    });
  }, [municipalSchools, parametros, totalMatriculasRede]);

  const networkTotals = useMemo(() => {
    return schoolRevenueData.reduce((acc, s) => ({
      vaaf: acc.vaaf + s.vaaf,
      vaat: acc.vaat + s.vaat,
      pnae: acc.pnae + s.pnae,
      total: acc.total + s.total
    }), { vaaf: 0, vaat: 0, pnae: 0, total: 0 });
  }, [schoolRevenueData]);

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Calculando receitas da rede municipal...</p>
      </div>
    );
  }

  if (municipalSchools.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola municipal encontrada</h3>
        <p className="text-muted-foreground max-w-xs">
          Importe o censo escolar primeiro para visualizar as unidades e seus microdados financeiros.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard/censo">Ir para Censo Escolar</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Mapa de Receitas: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Cruzamento: Microdados INEP × Parâmetros Financeiros 2026</p>
        </div>
        <Badge variant="outline" className="py-1 gap-2 border-primary/20 bg-primary/5 text-primary">
          <ListFilter className="h-3 w-3" /> {municipalSchools.length} Unidades Municipais
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="VAAf Total (Rede)" value={`R$ ${(networkTotals.vaaf / 1e6).toFixed(2)}M`} icon={TrendingUp} subtitle="Repasses FUNDEB" />
        <KPICard title="VAAT Projetado" value={`R$ ${(networkTotals.vaat / 1e6).toFixed(2)}M`} icon={DollarSign} subtitle="Complementação VAAT" />
        <KPICard title="PNAE Alimentação" value={`R$ ${(networkTotals.pnae / 1000).toFixed(1)}k`} icon={Calculator} subtitle="Recurso Merenda" />
        <KPICard title="Receita Total Estimada" value={`R$ ${(networkTotals.total / 1e6).toFixed(2)}M`} icon={TrendingUp} className="bg-primary text-white" />
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento Financeiro por Unidade</CardTitle>
          <CardDescription>Valores anuais projetados com base no perfil de matrículas de cada escola municipal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead>Escola Municipal</TableHead>
                    <TableHead className="text-right">VAAf (R$)</TableHead>
                    <TableHead className="text-right">VAAT (R$)</TableHead>
                    <TableHead className="text-right">PNAE (R$)</TableHead>
                    <TableHead className="text-right">MDE/QSE (R$)</TableHead>
                    <TableHead className="text-right">Total Escola</TableHead>
                    <TableHead className="text-center">Auditoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schoolRevenueData.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{school.nome}</div>
                        <div className="text-[10px] text-muted-foreground uppercase flex gap-1">
                          <span>{school.total_matriculas} alunos</span>
                          <span>•</span>
                          <span className="text-primary font-bold">{school.percentual_eti}% ETI</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">R$ {school.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right text-xs">R$ {school.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right text-xs">R$ {school.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right text-xs">R$ {school.mde_outros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right font-bold text-primary">R$ {school.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Auditoria de Dados: {school.nome}</DialogTitle>
                              <DialogDescription>
                                Validação granular para conferência com o Censo Escolar.
                              </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh] pr-4">
                              <div className="space-y-6 py-4">
                                <section>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Educação Infantil (VAAf 1.55 / 1.25)</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <DataField label="Creche Integral" value={school.matriculas?.creche_integral} />
                                    <DataField label="Creche Parcial" value={school.matriculas?.creche_parcial} />
                                    <DataField label="Pré Integral" value={school.matriculas?.pre_integral} />
                                    <DataField label="Pré Parcial" value={school.matriculas?.pre_parcial} />
                                  </div>
                                </section>
                                <Separator />
                                <section>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Ensino Fundamental (VAAf 1.30 / 1.00)</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <DataField label="Anos Iniciais Integral" value={school.matriculas?.ef_ai_integral} />
                                    <DataField label="Anos Iniciais Parcial" value={school.matriculas?.ef_ai_parcial} />
                                    <DataField label="Anos Finais Integral" value={school.matriculas?.ef_af_integral} />
                                    <DataField label="Anos Finais Parcial" value={school.matriculas?.ef_af_parcial} />
                                  </div>
                                </section>
                                <Separator />
                                <section>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">EJA e Inclusão (VAAf 0.80 / 2.40)</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <DataField label="EJA" value={school.matriculas?.eja_fundamental} />
                                    <DataField label="Educação Especial (AEE)" value={school.matriculas?.especial_aee} />
                                  </div>
                                </section>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-primary/5 font-bold sticky bottom-0 z-10">
                  <TableRow>
                    <TableCell>TOTAIS DA REDE MUNICIPAL</TableCell>
                    <TableCell className="text-right">R$ {networkTotals.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {networkTotals.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {networkTotals.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell colSpan={2} className="text-right text-lg text-primary">R$ {networkTotals.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollArea>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-xs">
            <Info className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="space-y-1 text-blue-800">
              <p className="font-bold">Lógica de Repasse FUNDEB 2026</p>
              <p className="leading-relaxed">
                As receitas acima são calculadas cruzando os parâmetros da aba <b>Configuração</b> com o número exato de alunos em cada modalidade. 
                Escolas com maior percentual de Tempo Integral (ETI) geram proporcionalmente mais recursos de VAAf e PNAE para o tesouro municipal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataField({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${value > 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>
        {value || 0}
      </span>
    </div>
  )
}
