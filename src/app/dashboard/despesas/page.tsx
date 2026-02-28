"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, FileSpreadsheet, Plus, Trash2, Download, Upload, Loader2, Building2, Landmark, PieChart, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, setDoc, collection } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Firebase
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  // Escolas do Município
  const schoolsRef = useMemo(() => (db && municipioId ? collection(db, 'municipios', municipioId, 'schools') : null), [db, municipioId]);
  const { data: allSchools, loading: schoolsLoading } = useCollection(schoolsRef);

  // FILTRO CENTRAL: Apenas escolas municipais para gestão de despesas
  const schools = useMemo(() => {
    if (!allSchools) return [];
    return allSchools.filter((s: any) => String(s.tp_dependencia) === '3');
  }, [allSchools]);

  // Estado para armazenar despesas (lançamentos temporários da sessão)
  const [expenses, setExpenses] = useState<SchoolExpenseEntry[]>([]);

  // Seta a primeira escola municipal quando carregar
  useEffect(() => {
    if (schools && schools.length > 0 && !selectedSchool) {
      setSelectedSchool(schools[0].id);
    }
  }, [schools, selectedSchool]);

  const handleSave = async () => {
    if (!db || !municipioId) {
      toast({
        title: "Erro de Contexto",
        description: "Município de atuação não identificado no seu perfil.",
        variant: "destructive"
      });
      return;
    }

    const schoolEntries = expenses.filter(e => e.schoolId === selectedSchool);
    if (schoolEntries.length === 0) {
      toast({
        title: "Nenhum dado",
        description: "Lance pelo menos uma categoria de despesa.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const promises = schoolEntries.map(entry => {
        const expenseId = `${entry.schoolId}_${entry.category.replace(/\s+/g, '_')}_2026`;
        const expenseRef = doc(db, 'municipios', municipioId, 'expenses', expenseId);
        
        const data = {
          schoolId: entry.schoolId,
          category: entry.category,
          value: entry.value,
          year: 2026,
          updatedAt: new Date().toISOString()
        };

        return setDoc(expenseRef, data, { merge: true })
          .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
              path: expenseRef.path,
              operation: 'write',
              requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      });

      await Promise.all(promises);

      toast({
        title: "Despesas salvas",
        description: "O histórico financeiro municipal foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!schools || schools.length === 0) {
      toast({
        title: "Sem dados",
        description: "Nenhuma escola municipal disponível para gerar modelo.",
        variant: "destructive"
      });
      return;
    }

    // Header compatível com a lógica de importação
    const headers = ["CO_ENTIDADE", "NO_ENTIDADE", "Categoria", "Valor_Anual"];
    
    // Gera linhas para todas as escolas em todas as categorias
    const rows = schools.flatMap((school: any) => 
      EXPENSE_CATEGORIES.map(cat => [
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

    // Adiciona BOM para garantir compatibilidade com Excel e caracteres especiais
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `modelo_despesas_municipais_${profile?.municipio || 'eti'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado",
      description: "Preencha a planilha municipal e utilize o botão Importar CSV.",
    });
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schools) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newEntries: SchoolExpenseEntry[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const separator = line.includes(';') ? ';' : ',';
        const parts = line.split(separator).map(p => p.trim().replace(/"/g, ''));
        const [inep, name, category, valueStr] = parts;
        
        const school: any = schools.find((s: any) => s.codigo_inep === inep);
        if (school) {
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
          description: `${newEntries.length} lançamentos municipais processados.`,
        });
      } else {
        toast({
          title: "Atenção",
          description: "Nenhum dado válido de escola municipal encontrado.",
          variant: "destructive"
        });
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsText(file);
  };

  const handleUpdateValue = (category: string, val: string) => {
    const cleanValue = val.replace(/\./g, '').replace(',', '.');
    const numericValue = parseFloat(cleanValue) || 0;
    
    setExpenses(prev => {
      const filtered = prev.filter(e => !(e.schoolId === selectedSchool && e.category === category));
      return [...filtered, { schoolId: selectedSchool, category, value: numericValue }];
    });
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

  const selectedSchoolData: any = schools?.find((s: any) => s.id === selectedSchool);

  if (schoolsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Carregando unidades municipais...</p>
      </div>
    );
  }

  if (!schools || schools.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="text-xl font-bold">Nenhuma escola municipal disponível</h3>
        <p className="text-muted-foreground max-w-xs">
          A gestão de despesas é restrita à Rede Municipal (Dependência 3). Importe o censo primeiro.
        </p>
        <Button asChild variant="outline">
          <a href="/dashboard/censo">Ir para Censo Escolar</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Gestão de Despesas: {profile?.municipio}</h2>
          <p className="text-muted-foreground">Exclusivo: Lançamentos para a Rede Municipal de Ensino</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv" 
            onChange={handleImportCSV} 
          />
          <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4" />
            Baixar Modelo CSV
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar CSV Municipal
          </Button>
        </div>
      </div>

      <Tabs defaultValue="individual" className="space-y-6">
        <TabsList className="bg-white border p-1">
          <TabsTrigger value="individual" className="gap-2">
            <Building2 className="h-4 w-4" /> Lançamento por Unidade
          </TabsTrigger>
          <TabsTrigger value="consolidated" className="gap-2">
            <Landmark className="h-4 w-4" /> Consolidado Municipal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Unidade Municipal</CardTitle>
                <CardDescription>Escolas da rede própria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a escola municipal" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="pt-4 space-y-3 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Matrículas Municipais</span>
                    <span className="font-medium">{selectedSchoolData?.total_matriculas}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">% ETI Municipal</span>
                    <Badge variant="secondary" className="font-bold text-[10px]">
                      {selectedSchoolData?.percentual_eti}%
                    </Badge>
                  </div>
                  <div className="pt-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Lançado Anual</div>
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
                  <CardTitle className="text-lg">Detalhamento de Custos Municipais</CardTitle>
                  <CardDescription>Valores anuais referentes ao tesouro municipal/repasses</CardDescription>
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
                      const entry = expenses.find(e => e.schoolId === selectedSchool && e.category === cat);
                      return (
                        <TableRow key={idx} className="hover:bg-muted/20">
                          <TableCell className="font-medium text-sm">{cat}</TableCell>
                          <TableCell>
                            <Input 
                              className="text-right font-mono text-sm" 
                              placeholder="0,00" 
                              value={entry ? entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ""}
                              onChange={(e) => handleUpdateValue(cat, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive h-8 w-8"
                              onClick={() => setExpenses(prev => prev.filter(e => !(e.schoolId === selectedSchool && e.category === category)))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-primary/5 font-bold">
                      <TableCell>TOTAL DA UNIDADE MUNICIPAL</TableCell>
                      <TableCell className="text-right text-lg text-primary">
                        R$ {(schoolExpensesSum[selectedSchool] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExpenses(prev => prev.filter(e => e.schoolId !== selectedSchool))}>Limpar Lançamentos</Button>
                  <Button size="sm" onClick={handleSave} className="gap-2 shadow-lg shadow-primary/20" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSaving ? "Salvando..." : "Salvar no Banco"}
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
                  <CardTitle className="text-xs font-medium text-white/70 uppercase">Custo Total da Rede Municipal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">R$ {totalNetworkExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <p className="text-[10px] text-white/60 mt-2">Consolidado de {schools.length} unidades municipais</p>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2 uppercase">
                    <PieChart className="h-4 w-4 text-accent" />
                    Cobertura de Dados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.keys(schoolExpensesSum).length} / {schools.length}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Unidades municipais com dados na sessão</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Custo Médio / Aluno Municipal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    R$ {schools.reduce((acc: number, s: any) => acc + (s.total_matriculas || 0), 0) > 0 
                      ? (totalNetworkExpenses / schools.reduce((acc: number, s: any) => acc + (s.total_matriculas || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                      : "0,00"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Mapa de Gastos: Rede Municipal</CardTitle>
                  <CardDescription>Visão comparativa exclusiva para a rede própria do município</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive border-destructive hover:bg-destructive/10 gap-2"
                  onClick={() => setExpenses([])}
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar Todos os Dados
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-xl overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead>Escola Municipal</TableHead>
                          <TableHead>Cód. INEP</TableHead>
                          <TableHead className="text-right">Matrículas</TableHead>
                          <TableHead className="text-right">ETI %</TableHead>
                          <TableHead className="text-right">Custo Anual (R$)</TableHead>
                          <TableHead className="text-right">R$/Aluno</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schools.map((school: any) => {
                          const total = schoolExpensesSum[school.id] || 0;
                          const perStudent = school.total_matriculas > 0 ? total / school.total_matriculas : 0;
                          return (
                            <TableRow key={school.id} className="hover:bg-muted/30 group">
                              <TableCell className="font-medium text-sm">{school.nome}</TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground">{school.codigo_inep}</TableCell>
                              <TableCell className="text-right text-xs">{school.total_matriculas}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="font-bold text-[10px]">{school.percentual_eti}%</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary text-sm">
                                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[10px] text-muted-foreground">
                                R$ {perStudent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter className="bg-muted/50 font-bold sticky bottom-0">
                        <TableRow>
                          <TableCell colSpan={4}>TOTAL CONSOLIDADO REDE MUNICIPAL</TableCell>
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