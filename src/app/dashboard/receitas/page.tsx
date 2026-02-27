"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Info, Loader2, AlertCircle } from "lucide-react";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";

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

  const { schoolsRevenue, totals } = useMemo(() => {
    if (!schools || schools.length === 0) return { schoolsRevenue: [], totals: null };

    const totalMatriculasRede = schools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    const revenueList = schools.map((school: any) => {
      const schoolMatriculas = school.matriculas || {
        creche_integral: 0, creche_parcial: 0, creche_conveniada_int: 0, creche_conveniada_par: 0,
        pre_integral: 0, pre_parcial: 0, ef_ai_integral: 0, ef_ai_parcial: 0, ef_af_integral: 0, ef_af_parcial: 0,
        eja_fundamental: 0, eja_medio: 0, especial_aee: 0, indigena_quilombola: 0, campo_rural: 0
      };

      const vaaf = calcularVAAF(schoolMatriculas, parametros);
      const vaat = calcularVAAT(school, parametros, totalMatriculasRede);
      const pnae = calcularPNAE(schoolMatriculas, parametros);
      const mde = calcularMDE(school, parametros, totalMatriculasRede);
      const outros = calcularOutros(school, parametros, totalMatriculasRede);
      const total = vaaf + vaat + pnae + mde + outros;

      return {
        ...school,
        vaaf, vaat, pnae, mde, outros, total
      };
    });

    const networkTotals = {
      vaaf: revenueList.reduce((acc, s) => acc + s.vaaf, 0),
      vaat: revenueList.reduce((acc, s) => acc + s.vaat, 0),
      pnae: revenueList.reduce((acc, s) => acc + s.pnae, 0),
      mde: revenueList.reduce((acc, s) => acc + s.mde, 0),
      outros: revenueList.reduce((acc, s) => acc + s.outros, 0),
      total: revenueList.reduce((acc, s) => acc + s.total, 0),
    };

    return { schoolsRevenue: revenueList, totals: networkTotals };
  }, [schools, parametros]);

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Carregando mapa de receitas...</p>
      </div>
    );
  }

  if (!schools || schools.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola cadastrada</h3>
        <p className="text-muted-foreground max-w-xs">
          Importe os dados do Censo Escolar para visualizar as receitas estimadas do município.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard/censo">Ir para Censo Escolar</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Mapa de Receitas: {profile?.municipio}</h2>
        <p className="text-muted-foreground">Cálculo detalhado de repasses por fonte e unidade escolar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Receita Total Estimada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals?.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-white/60 mt-1">Exercício 2026</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">FUNDEB VAAF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals?.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">{(totals && totals.total > 0 ? ((totals.vaaf / totals.total) * 100) : 0).toFixed(1)}% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repasse VAAT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals?.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Complementação Federal</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Escola</CardTitle>
          <CardDescription>Valores calculados com base nos parâmetros atuais do município</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Escola</TableHead>
                  <TableHead className="text-right">VAAF</TableHead>
                  <TableHead className="text-right">VAAT</TableHead>
                  <TableHead className="text-right">PNAE</TableHead>
                  <TableHead className="text-right">MDE Líq.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolsRevenue.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.nome}</TableCell>
                    <TableCell className="text-right">R$ {school.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {school.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {school.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">R$ {school.mde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right font-bold text-primary">R$ {school.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell>Totais da Rede</TableCell>
                  <TableCell className="text-right">R$ {totals?.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals?.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals?.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals?.mde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right text-primary">R$ {totals?.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="mt-6 p-4 bg-muted/30 rounded-lg flex gap-3 text-sm text-muted-foreground">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <p>
              Os cálculos consideram as matrículas consolidadas no Módulo de Censo Escolar e os parâmetros definidos para 2026. 
              O MDE Líquido é distribuído proporcionalmente ao total de matrículas de cada unidade.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
