"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { MOCK_SCHOOLS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const EXPENSE_CATEGORIES = [
  "Pessoal — Docentes",
  "Pessoal — Monitores",
  "Pessoal — Gestão",
  "Alimentação Escolar",
  "Transporte",
  "Utilidades (Energia/Água)",
  "Material Didático",
  "Serviços Terceirizados",
  "Outros",
];

export default function DespesasPage() {
  const { toast } = useToast();
  const [selectedSchool, setSelectedSchool] = useState(MOCK_SCHOOLS[0].id);

  const handleSave = () => {
    toast({
      title: "Despesas salvas",
      description: "O histórico financeiro da escola foi atualizado.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Gestão de Despesas</h2>
          <p className="text-muted-foreground">Lançamento de custos reais por unidade escolar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importar Planilha
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Unidade Escolar</CardTitle>
            <CardDescription>Selecione a escola para lançar despesas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a escola" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_SCHOOLS.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Matrículas</span>
                <span className="font-medium">{MOCK_SCHOOLS.find(s => s.id === selectedSchool)?.total_matriculas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">% ETI</span>
                <span className="font-medium">{MOCK_SCHOOLS.find(s => s.id === selectedSchool)?.percentual_eti}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Despesas do Exercício</CardTitle>
              <CardDescription>Valores em Reais (R$)</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="gap-2 text-primary">
              <Plus className="h-4 w-4" /> Adicionar Categoria
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria de Despesa</TableHead>
                  <TableHead className="w-[200px] text-right">Valor Anual (R$)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EXPENSE_CATEGORIES.map((cat, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell>
                      <Input className="text-right" placeholder="0,00" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell>TOTAL DESPESAS</TableCell>
                  <TableCell className="text-right">R$ 0,00</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> Salvar Lançamentos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
