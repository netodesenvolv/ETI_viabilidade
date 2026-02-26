"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ParametrosPage() {
  const { toast } = useToast();
  const [vaafBase, setVaafBase] = useState("5962.79");

  const handleSave = () => {
    toast({
      title: "Parâmetros salvos",
      description: "As configurações de financiamento foram atualizadas com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Parâmetros de Financiamento</h2>
        <p className="text-muted-foreground">Configuração dos valores de repasse para o exercício 2026</p>
      </div>

      <Tabs defaultValue="fundeb" className="space-y-4">
        <TabsList className="bg-white p-1 border shadow-sm">
          <TabsTrigger value="fundeb">FUNDEB VAAF/VAAT</TabsTrigger>
          <TabsTrigger value="pnae">PNAE / PNATE</TabsTrigger>
          <TabsTrigger value="mde">MDE / Outros</TabsTrigger>
        </TabsList>

        <TabsContent value="fundeb">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuração FUNDEB</CardTitle>
                <CardDescription>Valores base e fatores de ponderação (Resolução 05/2024)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vaaf">VAAf Base 2026 (R$)</Label>
                    <Input id="vaaf" value={vaafBase} onChange={(e) => setVaafBase(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vaat">Complementação VAAT Total (R$)</Label>
                    <Input id="vaat" placeholder="850.000,00" />
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead className="text-right">Fator de Ponderação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-xs">A1</TableCell>
                        <TableCell>Creche pública — Integral (7h+)</TableCell>
                        <TableCell className="text-right"><Input className="w-20 ml-auto h-8" defaultValue="1.550" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-xs">B1</TableCell>
                        <TableCell>Pré-escola pública — Integral (ETI)</TableCell>
                        <TableCell className="text-right"><Input className="w-20 ml-auto h-8" defaultValue="1.500" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-xs">C1</TableCell>
                        <TableCell>EF Anos Iniciais — Integral (ETI 7h+)</TableCell>
                        <TableCell className="text-right"><Input className="w-20 ml-auto h-8" defaultValue="1.300" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-xs">D1</TableCell>
                        <TableCell>EF Anos Finais — Integral (ETI 7h+)</TableCell>
                        <TableCell className="text-right"><Input className="w-20 ml-auto h-8" defaultValue="1.300" /></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pnae">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alimentação e Transporte</CardTitle>
              <CardDescription>Repasses PNAE (ajustados 2026) e PNATE</CardDescription>
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
                        <Label>Ensino Integral (7h+)</Label>
                        <Input className="w-24 h-8" defaultValue="1,57" />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>Pré-escola Parcial</Label>
                        <Input className="w-24 h-8" defaultValue="0,82" />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>EF/EM Parcial</Label>
                        <Input className="w-24 h-8" defaultValue="0,57" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">PNATE</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <Label>Valor Aluno/Semestre</Label>
                        <Input className="w-24 h-8" defaultValue="58,00" />
                      </div>
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" /> Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
