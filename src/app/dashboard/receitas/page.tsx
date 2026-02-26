"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { MOCK_SCHOOLS, DEFAULT_PARAMETERS } from "@/lib/constants";
import { calcularVAAF, calcularVAAT, calcularPNAE, calcularMDE, calcularOutros } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Info } from "lucide-react";

export default function ReceitasPage() {
  const totalMatriculasRede = MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_matriculas, 0);

  const schoolsRevenue = MOCK_SCHOOLS.map(school => {
    const vaaf = calcularVAAF(school.matriculas, DEFAULT_PARAMETERS);
    const vaat = calcularVAAT(school, DEFAULT_PARAMETERS, totalMatriculasRede);
    const pnae = calcularPNAE(school, DEFAULT_PARAMETERS);
    const mde = calcularMDE(school, DEFAULT_PARAMETERS, totalMatriculasRede);
    const outros = calcularOutros(school, DEFAULT_PARAMETERS, totalMatriculasRede);
    const total = vaaf + vaat + pnae + mde + outros;

    return {
      ...school,
      vaaf, vaat, pnae, mde, outros, total
    };
  });

  const totals = {
    vaaf: schoolsRevenue.reduce((acc, s) => acc + s.vaaf, 0),
    vaat: schoolsRevenue.reduce((acc, s) => acc + s.vaat, 0),
    pnae: schoolsRevenue.reduce((acc, s) => acc + s.pnae, 0),
    mde: schoolsRevenue.reduce((acc, s) => acc + s.mde, 0),
    outros: schoolsRevenue.reduce((acc, s) => acc + s.outros, 0),
    total: schoolsRevenue.reduce((acc, s) => acc + s.total, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Mapa de Receitas</h2>
        <p className="text-muted-foreground">Cálculo detalhado de repasses por fonte e unidade escolar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/70">Receita Total Estimada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-white/60 mt-1">Exercício 2026</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">FUNDEB VAAF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">{((totals.vaaf / totals.total) * 100).toFixed(1)}% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repasse VAAT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totals.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Complementação Federal</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Escola</CardTitle>
          <CardDescription>Valores calculados com base nos parâmetros atuais</CardDescription>
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
                  <TableCell className="text-right">R$ {totals.vaaf.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals.vaat.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals.pnae.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right">R$ {totals.mde.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-right text-primary">R$ {totals.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
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
