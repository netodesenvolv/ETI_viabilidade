"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Info, ScrollText, Utensils } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_PARAMETERS } from "@/lib/constants";

const VAAF_ITEMS = [
  { code: "A1", segment: "Creche pública — Integral (7h+)", factor: "1.550" },
  { code: "A2", segment: "Creche pública — Parcial (até 4h)", factor: "1.250" },
  { code: "A3", segment: "Creche conveniada — Integral", factor: "1.450" },
  { code: "A4", segment: "Creche conveniada — Parcial", factor: "1.150" },
  { code: "B1", segment: "Pré-escola pública — Integral (ETI)", factor: "1.500" },
  { code: "B2", segment: "Pré-escola pública — Parcial", factor: "1.150" },
  { code: "C1", segment: "EF Anos Iniciais — Integral (ETI 7h+)", factor: "1.300" },
  { code: "C2", segment: "EF Anos Iniciais — Parcial", factor: "1.000" },
  { code: "D1", segment: "EF Anos Finais — Integral (ETI 7h+)", factor: "1.300" },
  { code: "D2", segment: "EF Anos Finais — Parcial", factor: "1.100" },
  { code: "E1", segment: "EJA Fundamental", factor: "0.800" },
  { code: "E2", segment: "EJA Médio", factor: "0.850" },
  { code: "F1", segment: "Ed. Especial / AEE (adicional)", factor: "1.400" },
  { code: "G1", segment: "Multiplicador: Indígena/Quilombola", factor: "1.400" },
  { code: "G2", segment: "Multiplicador: Campo/Rural", factor: "1.150" },
];

export default function ParametrosPage() {
  const { toast } = useToast();
  const [vaafBase, setVaafBase] = useState(DEFAULT_PARAMETERS.vaaf_base.toString());

  const handleSave = () => {
    toast({
      title: "Parâmetros salvos",
      description: "As configurações de financiamento foram atualizadas com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Parâmetros de Financiamento</h2>
          <p className="text-muted-foreground">Configuração dos valores de repasse para o exercício 2026</p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" /> Salvar Alterações
        </Button>
      </div>

      <Tabs defaultValue="fundeb" className="space-y-4">
        <TabsList className="bg-white p-1 border shadow-sm w-full md:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="fundeb">FUNDEB VAAF/VAAT</TabsTrigger>
          <TabsTrigger value="pnae">PNAE / PNATE</TabsTrigger>
          <TabsTrigger value="mde">MDE / Outros</TabsTrigger>
        </TabsList>

        <TabsContent value="fundeb">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Tabela VAAF e VAAT 2026</CardTitle>
                </div>
                <CardDescription>Valores base e fatores de ponderação (Resolução vigente)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                    <Label htmlFor="vaaf" className="text-xs uppercase tracking-wider text-muted-foreground">VAAf Base 2026 (R$)</Label>
                    <Input id="vaaf" className="text-lg font-bold font-mono" value={vaafBase} onChange={(e) => setVaafBase(e.target.value)} />
                  </div>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                    <Label htmlFor="vaat" className="text-xs uppercase tracking-wider text-muted-foreground">Complementação VAAT Estimada (R$)</Label>
                    <Input id="vaat" className="text-lg font-bold font-mono" placeholder="850.000,00" defaultValue={DEFAULT_PARAMETERS.vaat_total_rede.toLocaleString('pt-BR')} />
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[80px]">Código</TableHead>
                          <TableHead>Segmento / Etapa de Ensino</TableHead>
                          <TableHead className="text-right w-[180px]">Fator de Ponderação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {VAAF_ITEMS.map((item) => (
                          <TableRow key={item.code}>
                            <TableCell className="font-mono text-xs font-bold text-primary">{item.code}</TableCell>
                            <TableCell className="text-sm">{item.segment}</TableCell>
                            <TableCell className="text-right">
                              <Input 
                                className="w-24 ml-auto h-8 text-right font-mono" 
                                defaultValue={item.factor} 
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pnae">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Alimentação Escolar (PNAE 2026)</CardTitle>
              </div>
              <CardDescription>Valores per capita ajustados com reajuste de 14,35%</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      PNAE (R$/dia por aluno)
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <Label>Creche e Ensino Integral (7h+)</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="1,57" />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>Pré-escola Parcial</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="0,82" />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>EF/EM Parcial</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="0,57" />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>EJA</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="0,57" />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>Indígenas e Quilombolas</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="0,98" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Calendário e Outros</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <Label>Dias Letivos (Padrão)</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="200" />
                      </div>
                      <div className="flex justify-between items-center text-sm pt-4 border-t">
                        <Label className="font-bold">PNATE (Transporte)</Label>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>Valor Aluno/Semestre (Médio)</Label>
                        <Input className="w-24 h-8 text-right" defaultValue="58,00" />
                      </div>
                    </div>
                  </div>
               </div>
               <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-xs">
                 <p className="font-bold mb-1">Nota Técnica PNAE 2026:</p>
                 <p>Os valores acima refletem o reajuste oficial aplicado para o exercício de 2026, garantindo a manutenção da qualidade nutricional frente à inflação de alimentos.</p>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mde">
           <Card>
            <CardHeader>
              <CardTitle className="text-lg">MDE e Recursos Próprios</CardTitle>
              <CardDescription>25% constitucional e outros repasses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>MDE Líquido para ETI (Anual)</Label>
                  <Input placeholder="1.200.000,00" defaultValue={DEFAULT_PARAMETERS.mde_liquido_eti.toLocaleString('pt-BR')} />
                </div>
                <div className="space-y-2">
                  <Label>Quota Salário Educação (QSE)</Label>
                  <Input placeholder="180.000,00" defaultValue={DEFAULT_PARAMETERS.qse.toLocaleString('pt-BR')} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
