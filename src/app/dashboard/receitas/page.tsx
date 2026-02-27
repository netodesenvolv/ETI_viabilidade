
"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Info, Loader2, AlertCircle, MapPin } from "lucide-react";
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

    // FILTRO CENTRAL: Apenas escolas da rede municipal ('3') geram receita para o município
    const municipalSchools = schools.filter(s => String(s.tp_dependencia) === '3');
    const totalMatriculasRede = municipalSchools.reduce((acc, s: any) => acc + (s.total_matriculas || 0), 0);

    const revenueList = municipalSchools.map((school: any) => {
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

  if (!schoolsRevenue || schoolsRevenue.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola municipal encontrada</h3>
        <p className="text-muted-foreground max-w-xs">
          O cálculo de receitas exige a presença de escolas vinculadas à Rede Municipal (Dependência 3).
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
          <p className="text-muted-foreground">Exclusivo: Rede Municipal de Ensino</p>
        </div>
        <Badge variant="outline" className="py-1 gap-2 border-primary/20 bg-primary/5 text-primary">
          <MapPin className="h-3 w-3" /> Exercício 2026
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-white border-none shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/70 uppercase">Receita Municipal Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals?.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-white/60 mt-1">Estimativa de repasses anuais</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">FUNDEB VAAF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals?.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">{(totals && totals.total > 0 ? ((totals.vaaf / totals.total) * 100) : 0).toFixed(1)}% do aporte total</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Repasse VAAT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals?.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">VAAT estimado para {schoolsRevenue.length} unidades</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Unidade Municipal</CardTitle>
          <CardDescription>Cálculos baseados em matrículas municipais do censo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
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
                    <TableCell className="font-medium text-sm">{school.nome}</TableCell>
                    <TableCell className="text-right text-xs">R$ {school.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right text-xs">R$ {school.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right text-xs">R$ {school.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right text-xs">R$ {school.mde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right font-bold text-primary text-sm">R$ {school.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-primary/5">
                <TableRow className="font-bold">
                  <TableCell>Total Rede Municipal</TableCell>
                  <TableCell className="text-right">R$ {totals?.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals?.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals?.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals?.mde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right text-primary">R$ {totals?.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-3 text-sm text-blue-800">
            <Info className="h-5 w-5 shrink-0 text-blue-600" />
            <p>
              Esta visualização considera exclusivamente a **Rede Municipal (Dependência 3)**. Escolas federais, estaduais ou privadas situadas no território não são computadas nas receitas geridas pela prefeitura.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
