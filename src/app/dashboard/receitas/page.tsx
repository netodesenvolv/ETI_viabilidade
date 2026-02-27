
"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2, AlertCircle, Calculator, Eye, ListFilter } from "lucide-react";
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

export default function ReceitasPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);

  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: schools, loading: schoolsLoading } = useCollection(schoolsRef);

  // FILTRO CENTRAL: Apenas escolas da rede municipal ('3')
  const municipalSchools = useMemo(() => {
    if (!schools) return [];
    return schools.filter(s => String(s.tp_dependencia) === '3');
  }, [schools]);

  if (profileLoading || schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Carregando lista de unidades municipais...</p>
      </div>
    );
  }

  if (municipalSchools.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola municipal encontrada</h3>
        <p className="text-muted-foreground max-w-xs">
          Importe o censo escolar primeiro para visualizar as unidades e seus microdados.
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
          <p className="text-muted-foreground">Etapa 1: Validação de Microdados de Matrícula (INEP)</p>
        </div>
        <Badge variant="outline" className="py-1 gap-2 border-primary/20 bg-primary/5 text-primary">
          <ListFilter className="h-3 w-3" /> {municipalSchools.length} Unidades
        </Badge>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Menu de Unidades Escolares</CardTitle>
          <CardDescription>Clique em "Ver Matrículas" para validar os números importados do Censo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Escola Municipal</TableHead>
                  <TableHead>Cód. INEP</TableHead>
                  <TableHead className="text-right">Total Geral</TableHead>
                  <TableHead className="text-right">Total ETI</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {municipalSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{school.nome}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{school.localizacao}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                    <TableCell className="text-right font-bold">{school.total_matriculas || 0}</TableCell>
                    <TableCell className="text-right text-primary font-bold">{school.total_eti || 0}</TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-2 text-primary hover:text-primary hover:bg-primary/5"
                            onClick={() => setSelectedSchool(school)}
                          >
                            <Eye className="h-4 w-4" />
                            Ver Matrículas
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Detalhamento: {school.nome}</DialogTitle>
                            <DialogDescription>
                              Valores de matrícula por segmento lidos do banco de dados (INEP {school.codigo_inep}).
                            </DialogDescription>
                          </DialogHeader>
                          
                          <ScrollArea className="max-h-[60vh] pr-4">
                            <div className="space-y-6 py-4">
                              <section>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">Educação Infantil (Creche)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <DataField label="Integral Pública" value={school.matriculas?.creche_integral} />
                                  <DataField label="Parcial Pública" value={school.matriculas?.creche_parcial} />
                                  <DataField label="Integral Conveniada" value={school.matriculas?.creche_conveniada_int} />
                                  <DataField label="Parcial Conveniada" value={school.matriculas?.creche_conveniada_par} />
                                </div>
                              </section>

                              <Separator />

                              <section>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">Educação Infantil (Pré-Escola)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <DataField label="Integral (ETI)" value={school.matriculas?.pre_integral} />
                                  <DataField label="Parcial" value={school.matriculas?.pre_parcial} />
                                </div>
                              </section>

                              <Separator />

                              <section>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">Ensino Fundamental (Anos Iniciais)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <DataField label="Integral (ETI)" value={school.matriculas?.ef_ai_integral} />
                                  <DataField label="Parcial" value={school.matriculas?.ef_ai_parcial} />
                                </div>
                              </section>

                              <Separator />

                              <section>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">Ensino Fundamental (Anos Finais)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <DataField label="Integral (ETI)" value={school.matriculas?.ef_af_integral} />
                                  <DataField label="Parcial" value={school.matriculas?.ef_af_parcial} />
                                </div>
                              </section>

                              <Separator />

                              <section>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">EJA e Outros</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <DataField label="EJA Fundamental" value={school.matriculas?.eja_fundamental} />
                                  <DataField label="EJA Médio" value={school.matriculas?.eja_medio} />
                                  <DataField label="Ed. Especial (AEE)" value={school.matriculas?.especial_aee} />
                                  <DataField label="Indígena/Quilombola" value={school.matriculas?.indigena_quilombola} />
                                  <DataField label="Campo/Rural" value={school.matriculas?.campo_rural} />
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
            </Table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-sm">
            <Info className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="space-y-1 text-blue-800">
              <p className="font-bold">Por que validar?</p>
              <p className="text-xs leading-relaxed">
                O FUNDEB VAAf 2026 utiliza fatores de ponderação específicos para cada linha acima. 
                Se os valores em "Ver Matrículas" estiverem zerados ou incorretos, o cálculo final da receita será impactado.
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
