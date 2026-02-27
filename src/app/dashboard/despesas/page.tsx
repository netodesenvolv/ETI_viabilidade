
"use client"

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, FileSpreadsheet, Plus, Trash2, Download, Upload, Loader2, Building2, Landmark, PieChart, FileText } from "lucide-react";
import { MOCK_SCHOOLS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface SchoolExpenseEntry {
  schoolId: string;
  category: string;
  value: number;
}

export default function DespesasPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSchool, setSelectedSchool] = useState(MOCK_SCHOOLS[0].id);
  const [isImporting, setIsImporting] = useState(false);
  
  // Estado para armazenar despesas (mock inicial + novos lançamentos)
  const [expenses, setExpenses] = useState<SchoolExpenseEntry[]>([]);

  const handleSave = () => {
    toast({
      title: "Despesas salvas",
      description: "O histórico financeiro da escola foi atualizado com sucesso.",
    });
  };

  const handleDownloadTemplate = () => {
    const headers = ["CO_ENTIDADE", "NO_ENTIDADE", "Categoria", "Valor_Anual"];
    
    // Criar algumas linhas de exemplo com as escolas do sistema
    const rows = MOCK_SCHOOLS.flatMap(school => 
      EXPENSE_CATEGORIES.slice(0, 3).map(cat => [
        school.codigo_inep,
        school.nome,
        cat,
        "0,00"
      ])
    );

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_despesas_eti.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado",
      description: "Preencha a planilha e utilize o botão Importar CSV.",
    });
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newEntries: SchoolExpenseEntry[] = [];
      
      // Pular cabeçalho
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Suporte a vírgula ou ponto e vírgula
        const separator = line.includes(';') ? ';' : ',';
        const [inep, name, category, valueStr] = line.split(separator);
        
        const school = MOCK_SCHOOLS.find(s => s.codigo_inep === inep);
        if (school) {
          // Tratar formato de moeda brasileiro (0.000,00)
          const cleanValue = (valueStr || "0")
            .replace(/\./g, '')
            .replace(',', '.');
            
          newEntries.push({
            schoolId: school.id,
            category: category || "Outros",
            value: parseFloat(cleanValue) || 0
          });
        }
      }

      setExpenses(prev => [...prev, ...newEntries]);
      setIsImporting(false);
      
      if (newEntries.length > 0) {
        toast({
          title: "Importação concluída",
          description: `${newEntries.length} lançamentos de despesas foram processados.`,
        });
      } else {
        toast({
          title: "Atenção",
          description: "Nenhum dado válido encontrado no arquivo. Verifique se os códigos INEP correspondem às escolas cadastradas.",
          variant: "destructive"
        });
      }

      // Resetar input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsText(file);
  };

  const schoolExpensesSum = useMemo(() => {
    return expenses.reduce((acc, exp) => {
      if (!acc[exp.schoolId]) acc[exp.schoolId] = 0;
      acc[exp.schoolId] += exp.value;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  const totalNetworkExpenses = useMemo(() => {
    return Object.values(schoolExpensesSum).reduce((acc, val) => acc + val, 0);
  }, [schoolExpensesSum]);

  const selectedSchoolData = MOCK_SCHOOLS.find(s => s.id === selectedSchool);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Gestão de Despesas</h2>
          <p className="text-muted-foreground">Lançamento e consolidação de custos por unidade escolar</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv" 
            onChange={handleImportCSV} 
          />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4" /> Modelo de Planilha
          </Button>
        </div>
      </div>

      <Tabs defaultValue="individual" className="space-y-6">
        <TabsList className="bg-white border p-1">
          <TabsTrigger value="individual" className="gap-2">
            <Building2 className="h-4 w-4" /> Lançamento Individual
          </TabsTrigger>
          <TabsTrigger value="consolidated" className="gap-2">
            <Landmark className="h-4 w-4" /> Visão Consolidada da Rede
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Unidade Escolar</CardTitle>
                <CardDescription>Selecione a escola para detalhamento</CardDescription>
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
                
                <div className="pt-4 space-y-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Matrículas</span>
                    <span className="font-medium">{selectedSchoolData?.total_matriculas}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">% ETI</span>
                    <Badge variant="secondary" className="font-bold">
                      {selectedSchoolData?.percentual_eti}%
                    </Badge>
                  </div>
                  <div className="pt-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Lançado (Escola)</div>
                    <div className="text-xl font-bold text-primary">
                      R$ {(schoolExpensesSum[selectedSchool] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Detalhamento de Custos</CardTitle>
                  <CardDescription>Valores anuais em Reais (R$)</CardDescription>
                </div>
                <Button size="sm" variant="ghost" className="gap-2 text-primary hover:bg-primary/5">
                  <Plus className="h-4 w-4" /> Adicionar Categoria
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Categoria de Despesa</TableHead>
                      <TableHead className="w-[200px] text-right">Valor Anual (R$)</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EXPENSE_CATEGORIES.map((cat, idx) => {
                      const existingValue = expenses.find(e => e.schoolId === selectedSchool && e.category === cat)?.value || 0;
                      return (
                        <TableRow key={idx} className="hover:bg-muted/20">
                          <TableCell className="font-medium">{cat}</TableCell>
                          <TableCell>
                            <Input 
                              className="text-right font-mono" 
                              placeholder="0,00" 
                              defaultValue={existingValue > 0 ? existingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ""}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-primary/5 font-bold">
                      <TableCell>TOTAL DA UNIDADE</TableCell>
                      <TableCell className="text-right text-lg text-primary">
                        R$ {(schoolExpensesSum[selectedSchool] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setExpenses(prev => prev.filter(e => e.schoolId !== selectedSchool))}>Limpar Lançamentos</Button>
                  <Button onClick={handleSave} className="gap-2 shadow-lg shadow-primary/20">
                    <Save className="h-4 w-4" /> Salvar Detalhamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consolidated">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-primary text-white border-none shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white/70">Custo Total da Rede</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">R$ {totalNetworkExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-white/60 mt-2">Consolidado de {MOCK_SCHOOLS.length} unidades</p>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-accent" />
                    Situação dos Dados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.keys(schoolExpensesSum).length} / {MOCK_SCHOOLS.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Unidades com despesas lançadas</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Custo Médio / Aluno (Rede)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    R$ {MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_matriculas, 0) > 0 
                      ? (totalNetworkExpenses / MOCK_SCHOOLS.reduce((acc, s) => acc + s.total_matriculas, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                      : "0,00"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Base: Lançamentos efetivados</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Mapa de Gastos por Escola</CardTitle>
                <CardDescription>Visão geral comparativa das despesas lançadas em toda a rede</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-xl overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead>Escola</TableHead>
                          <TableHead>Código INEP</TableHead>
                          <TableHead className="text-right">Matrículas</TableHead>
                          <TableHead className="text-right">ETI %</TableHead>
                          <TableHead className="text-right">Total Despesa (R$)</TableHead>
                          <TableHead className="text-right">R$/Aluno</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOCK_SCHOOLS.map((school) => {
                          const total = schoolExpensesSum[school.id] || 0;
                          const perStudent = school.total_matriculas > 0 ? total / school.total_matriculas : 0;
                          return (
                            <TableRow key={school.id} className="hover:bg-muted/30 group">
                              <TableCell className="font-medium">{school.nome}</TableCell>
                              <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                              <TableCell className="text-right">{school.total_matriculas}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="font-bold">{school.percentual_eti}%</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                R$ {perStudent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter className="bg-muted/50 font-bold sticky bottom-0">
                        <TableRow>
                          <TableCell colSpan={4}>TOTAL CONSOLIDADO DA REDE</TableCell>
                          <TableCell className="text-right text-lg">
                            R$ {totalNetworkExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
