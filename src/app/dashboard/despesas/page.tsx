
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, FileSpreadsheet, Plus, Trash2, Download, Upload, Loader2, Building2, Landmark, PieChart, FileText, AlertCircle, AlertTriangle, Calculator, Share2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useFirestore, useUser, useDoc, useCollection } from "@/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EXPENSE_CATEGORIES = [
  "Pessoal — Docentes",
  "Pessoal — Monitores",
  "Pessoal — Gestão",
  "Alimentação Escolar",
  "Transporte",
  "Utilidades (Energia/Água)",
  "Material Didático",
  "Serviços Terceirizados",
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
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estados para Rateio Global
  const [globalAlimentacao, setGlobalAlimentacao] = useState("");
  const [globalTransporte, setGlobalTransporte] = useState("");

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

  const totalMatriculasRede = useMemo(() => {
    return schools.reduce((acc: number, s: any) => acc + (s.total_matriculas || 0), 0);
  }, [schools]);

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

    if (expenses.length === 0) {
      toast({
        title: "Nenhum dado",
        description: "Não há despesas na sessão para salvar. Importe um arquivo ou lance manualmente.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const promises = expenses.map(entry => {
        const sanitizedCategory = entry.category.replace(/[\s/()]+/g, '_');
        const expenseId = `${entry.schoolId}_${sanitizedCategory}_2026`;
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
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: expenseRef.path,
              operation: 'write',
              requestResourceData: data,
            }));
          });
      });

      await Promise.all(promises);

      toast({
        title: "Dados Salvos",
        description: `${expenses.length} lançamentos foram gravados no banco de dados.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao Salvar",
        description: "Ocorreu um problema ao persistir os dados no banco.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllFromFirestore = async () => {
    if (!db || !municipioId) return;
    setIsDeleting(true);
    
    try {
      const expensesCol = collection(db, 'municipios', municipioId, 'expenses');
      const snapshot = await getDocs(expensesCol);
      
      if (snapshot.empty) {
        toast({ title: "Informação", description: "Não existem registros de despesas no banco de dados para este município." });
        return;
      }

      const deletePromises = snapshot.docs.map(docSnap => {
        return deleteDoc(docSnap.ref).catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docSnap.ref.path,
            operation: 'delete'
          }));
        });
      });

      await Promise.all(deletePromises);
      setExpenses([]); // Limpa a sessão também

      toast({
        title: "Banco de Dados Limpo",
        description: "Todos os registros de despesas foram removidos permanentemente.",
      });
    } catch (error) {
      toast({
        title: "Erro na Exclusão",
        description: "Não foi possível remover os registros do banco.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApplyRateio = (category: string, totalStr: string) => {
    const totalValue = parseFloat(totalStr.replace(/\./g, '').replace(',', '.')) || 0;
    
    if (totalValue <= 0) {
      toast({ title: "Valor inválido", description: "Informe um valor total para realizar o rateio.", variant: "destructive" });
      return;
    }

    if (totalMatriculasRede === 0) {
      toast({ title: "Sem matrículas", description: "Não há matrículas na rede para basear o rateio.", variant: "destructive" });
      return;
    }

    const newEntries = schools.map((school: any) => ({
      schoolId: school.id,
      category: category,
      value: (totalValue * (school.total_matriculas || 0)) / totalMatriculasRede
    }));

    setExpenses(prev => {
      const filtered = prev.filter(e => e.category !== category);
      return [...filtered, ...newEntries];
    });

    toast({ 
      title: "Rateio Aplicado", 
      description: `O valor de R$ ${totalValue.toLocaleString('pt-BR')} foi distribuído entre ${schools.length} escolas.` 
    });
  };

  const handleDownloadTemplate = () => {
    if (!schools || schools.length === 0) {
      toast({ title: "Sem dados", description: "Nenhuma escola municipal disponível para gerar modelo.", variant: "destructive" });
      return;
    }

    const headers = ["CO_ENTIDADE", "NO_ENTIDADE", "Categoria", "Valor_Anual"];
    const rows = schools.flatMap((school: any) => 
      EXPENSE_CATEGORIES.map(cat => [
        school.codigo_inep,
        school.nome,
        cat,
        "0,00"
      ])
    );

    const csvContent = ["\uFEFF" + headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `modelo_despesas_${profile?.municipio || 'eti'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
          const cleanValue = (valueStr || "0").replace(/\./g, '').replace(',', '.');
          newEntries.push({
            schoolId: school.id,
            category: category || "Outros",
            value: parseFloat(cleanValue) || 0
          });
        }
      }

      setExpenses(prev => [...prev, ...newEntries]);
      setIsImporting(false);
      toast({ title: "Importação concluída", description: `${newEntries.length} lançamentos carregados na sessão.` });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Gestão de Despesas</h2>
          <p className="text-muted-foreground">Lançamentos anuais para a Rede Municipal de {profile?.municipio}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportCSV} />
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4" />
            Modelo CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar CSV
          </Button>
          <Button size="sm" className="gap-2 bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={isSaving || expenses.length === 0}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar no Banco
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
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a escola" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="pt-4 space-y-3 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Matrículas</span>
                    <span className="font-medium">{selectedSchoolData?.total_matriculas}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">% ETI</span>
                    <Badge variant="secondary" className="font-bold text-[10px]">
                      {selectedSchoolData?.percentual_eti}%
                    </Badge>
                  </div>
                  <div className="pt-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total na Sessão</div>
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
                  <CardDescription>Valores anuais referentes ao tesouro municipal</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Categoria</TableHead>
                      <TableHead className="w-[200px] text-right">Valor Anual (R$)</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EXPENSE_CATEGORIES.map((cat, idx) => {
                      const entry = expenses.find(e => e.schoolId === selectedSchool && e.category === cat);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{cat}</TableCell>
                          <TableCell>
                            <Input 
                              className="text-right font-mono" 
                              placeholder="0,00" 
                              value={entry ? entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ""}
                              onChange={(e) => handleUpdateValue(cat, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setExpenses(prev => prev.filter(e => !(e.schoolId === selectedSchool && e.category === cat)))}
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
                      <TableCell>TOTAL DA UNIDADE (SESSÃO)</TableCell>
                      <TableCell className="text-right text-lg text-primary">
                        R$ {(schoolExpensesSum[selectedSchool] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consolidated">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-primary text-white border-none shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-white/70 uppercase">Custo Total Sessão</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">R$ {totalNetworkExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <p className="text-[10px] text-white/60 mt-2">Cobertura: {Object.keys(schoolExpensesSum).length} escolas</p>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-accent" />
                    Eficiência de Dados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Object.keys(schoolExpensesSum).length} / {schools.length}</div>
                  <p className="text-[10px] text-muted-foreground mt-2">Unidades com dados nesta sessão</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Custo Médio Aluno</CardTitle>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 shadow-md border-accent/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-accent" />
                    Rateio Municipal (Global)
                  </CardTitle>
                  <CardDescription>Distribuir custos centralizados proporcionalmente às matrículas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Alimentação Escolar (Total)</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="R$ 0,00" 
                        value={globalAlimentacao} 
                        onChange={e => setGlobalAlimentacao(e.target.value)}
                        className="font-mono"
                      />
                      <Button size="icon" variant="outline" onClick={() => handleApplyRateio("Alimentação Escolar", globalAlimentacao)}>
                        <Calculator className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Transporte (Total)</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="R$ 0,00" 
                        value={globalTransporte} 
                        onChange={e => setGlobalTransporte(e.target.value)}
                        className="font-mono"
                      />
                      <Button size="icon" variant="outline" onClick={() => handleApplyRateio("Transporte", globalTransporte)}>
                        <Calculator className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-xl border space-y-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase">
                      <Info className="h-3 w-3" /> Regra de Rateio
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      O sistema calcula o valor por aluno (Total ÷ Matrículas da Rede) e multiplica pelo número de alunos de cada escola municipal.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border-none shadow-md">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Mapa de Gastos: Rede Municipal</CardTitle>
                    <CardDescription>Gerenciamento permanente do banco de dados</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-muted-foreground gap-2"
                      onClick={() => setExpenses([])}
                    >
                      Limpar Sessão
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive border-destructive hover:bg-destructive/10 gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Apagar Tudo do Banco
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação excluirá permanentemente **TODOS os registros de despesas** do município de {profile?.municipio} no banco de dados. 
                            Esta operação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteAllFromFirestore}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sim, Apagar Tudo
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button 
                      size="sm" 
                      className="gap-2 bg-green-700 hover:bg-green-800" 
                      onClick={handleSave} 
                      disabled={isSaving || expenses.length === 0}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar Sessão no Banco
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-xl overflow-hidden">
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                          <TableRow>
                            <TableHead>Escola</TableHead>
                            <TableHead>INEP</TableHead>
                            <TableHead className="text-right">Matrículas</TableHead>
                            <TableHead className="text-right">ETI %</TableHead>
                            <TableHead className="text-right">Custo Anual (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schools.map((school: any) => (
                            <TableRow key={school.id}>
                              <TableCell className="font-medium">{school.nome}</TableCell>
                              <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                              <TableCell className="text-right">{school.total_matriculas}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{school.percentual_eti}%</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                R$ {(schoolExpensesSum[school.id] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
