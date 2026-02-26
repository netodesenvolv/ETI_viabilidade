"use client"

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Database, FileUp, CheckCircle2, FileText, Info, Loader2, Search, FilterX, Globe, Building2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ParsedSchool {
  id: string;
  codigo_inep: string;
  nome: string;
  municipio: string;
  uf: string;
  localizacao: string;
  tp_dependencia: string; // 1: Federal, 2: Estadual, 3: Municipal, 4: Privada
  total_matriculas: number;
  total_eti: number;
  percentual_eti: number;
  raw_data: Record<string, string>;
}

const DEPENDENCIA_LABELS: Record<string, string> = {
  "1": "Federal",
  "2": "Estadual",
  "3": "Municipal",
  "4": "Privada",
};

export default function CensoAdminPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1);
  const [parsedSchools, setParsedSchools] = useState<ParsedSchool[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  
  // Filtros de UI
  const [searchQuery, setSearchQuery] = useState("");
  const [municipioFilter, setMunicipioFilter] = useState("");
  const [dependenciaFilter, setDependenciaFilter] = useState("all");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setStep(1);
    }
  };

  const processCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    const schools: ParsedSchool[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      const schoolId = row.CO_ENTIDADE;
      if (!schoolId) continue;

      const parseNum = (val: any) => parseInt(val || "0", 10);

      const total_matriculas = parseNum(row.QT_MAT_BAS);
      const total_eti = parseNum(row.QT_MAT_INF_INT) + parseNum(row.QT_MAT_FUND_INT) + parseNum(row.QT_MAT_MED_INT);
      
      const schoolData: ParsedSchool = {
        id: schoolId,
        codigo_inep: row.CO_ENTIDADE,
        nome: row.NO_ENTIDADE || "Escola sem nome",
        municipio: row.NO_MUNICIPIO || "N/A",
        uf: row.SG_UF || "N/A",
        localizacao: row.TP_LOCALIZACAO === "2" ? "Rural" : "Urbana",
        tp_dependencia: row.TP_DEPENDENCIA || "0",
        total_matriculas,
        total_eti,
        percentual_eti: total_matriculas > 0 ? Number(((total_eti / total_matriculas) * 100).toFixed(1)) : 0,
        raw_data: row
      };

      schools.push(schoolData);
    }

    return schools;
  };

  const handleStartImport = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({
        title: "Nenhum arquivo",
        description: "Selecione um arquivo de microdados do Censo (CSV) primeiro.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    const reader = new FileReader();
    
    reader.onprogress = (data) => {
      if (data.lengthComputable) {
        const progress = Math.round((data.loaded / data.total) * 100);
        setProgress(progress);
      }
    };

    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const schools = processCSV(text);
        setParsedSchools(schools);
        setUploading(false);
        setStep(2);
        
        toast({
          title: "Processamento concluído",
          description: `${schools.length} registros identificados no arquivo.`,
        });
      } catch (err) {
        console.error(err);
        setUploading(false);
        toast({
          title: "Erro no processamento",
          description: "O formato do arquivo parece inválido ou as colunas não correspondem ao padrão INEP.",
          variant: "destructive"
        });
      }
    };

    reader.readAsText(file);
  };

  const filteredData = useMemo(() => {
    return parsedSchools.filter(school => {
      const matchesSearch = school.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           school.codigo_inep.includes(searchQuery);
      const matchesMunicipio = municipioFilter === "" || 
                              school.municipio.toLowerCase().includes(municipioFilter.toLowerCase());
      const matchesDependencia = dependenciaFilter === "all" || 
                               school.tp_dependencia === dependenciaFilter;
      
      return matchesSearch && matchesMunicipio && matchesDependencia;
    });
  }, [parsedSchools, searchQuery, municipioFilter, dependenciaFilter]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalMat = filteredData.reduce((acc, s) => acc + s.total_matriculas, 0);
    const totalETI = filteredData.reduce((acc, s) => acc + s.total_eti, 0);
    const uniqueMun = new Set(filteredData.map(s => s.municipio)).size;
    return {
      totalMat,
      totalETI,
      percentETI: totalMat > 0 ? ((totalETI / totalMat) * 100).toFixed(1) : "0.0",
      count: filteredData.length,
      municipios: uniqueMun
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Painel de Administração: Censo Escolar</h2>
          <p className="text-muted-foreground">Importação global de microdados INEP e filtragem administrativa</p>
        </div>
        <Badge variant="outline" className="h-fit py-1 px-3 border-primary/30 text-primary bg-primary/5">
          <Globe className="h-3 w-3 mr-2" /> Modo Administrador
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Fonte de Dados</CardTitle>
            <CardDescription>Upload de arquivos brutos do INEP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? (
                <FileText className="h-8 w-8 text-primary" />
              ) : (
                <FileUp className="h-8 w-8 text-primary/40 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{fileName || "Escolher Arquivo CSV"}</p>
                <p className="text-[10px] text-muted-foreground">Suporta arquivos de matrículas do INEP</p>
              </div>
              <Input 
                ref={fileInputRef}
                type="file" 
                accept=".csv"
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{progress < 100 ? "Carregando..." : "Analisando colunas..."}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button 
              className="w-full gap-2 font-semibold shadow-lg shadow-primary/20" 
              disabled={uploading || !fileName} 
              onClick={handleStartImport}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {uploading ? "Processando..." : "Carregar Dados"}
            </Button>

            <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-blue-800 text-[11px] border border-blue-100">
              <Info className="h-4 w-4 shrink-0" />
              <p>Este painel aceita o arquivo completo do INEP com centenas de colunas de matrículas.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Explorador de Dados Consolidados</CardTitle>
                <CardDescription>Visualize e filtre escolas por município e dependência administrativa</CardDescription>
              </div>
              {step === 2 && (
                <Button variant="outline" size="sm" onClick={() => { setStep(1); setParsedSchools([]); setFileName(null); }} className="gap-2">
                  <FilterX className="h-4 w-4" /> Limpar Tudo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground gap-4 border-2 border-dashed rounded-xl bg-muted/10">
                <div className="p-4 bg-muted rounded-full">
                  <Globe className="h-10 w-10 opacity-20" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium">Nenhum dado carregado no painel</p>
                  <p className="text-sm">Faça o upload do CSV do INEP para começar a análise global</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por escola ou INEP..." 
                      className="pl-9 h-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Filtrar por Município..." 
                      className="pl-9 h-9"
                      value={municipioFilter}
                      onChange={(e) => setMunicipioFilter(e.target.value)}
                    />
                  </div>
                  <div>
                    <Select value={dependenciaFilter} onValueChange={setDependenciaFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Dependência Administrativa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Dependências</SelectItem>
                        <SelectItem value="1">Federal</SelectItem>
                        <SelectItem value="2">Estadual</SelectItem>
                        <SelectItem value="3">Municipal</SelectItem>
                        <SelectItem value="4">Privada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-2 px-3 rounded-lg border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Total de Escolas</span>
                    <span className="text-lg font-bold">{stats?.count}</span>
                  </div>
                  <div className="bg-primary/5 p-2 px-3 rounded-lg border border-primary/10 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-primary/70">Média % ETI</span>
                    <span className="text-lg font-bold text-primary">{stats?.percentETI}%</span>
                  </div>
                  <div className="bg-muted/50 p-2 px-3 rounded-lg border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Matrículas</span>
                    <span className="text-lg font-bold">{stats?.totalMat.toLocaleString()}</span>
                  </div>
                  <div className="bg-muted/50 p-2 px-3 rounded-lg border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Alunos ETI</span>
                    <span className="text-lg font-bold">{stats?.totalETI.toLocaleString()}</span>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <ScrollArea className="h-[450px]">
                    <Table>
                      <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-[100px]">INEP</TableHead>
                          <TableHead>Escola</TableHead>
                          <TableHead>Rede / Local</TableHead>
                          <TableHead className="text-right">Matrículas</TableHead>
                          <TableHead className="text-right">% ETI</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.length > 0 ? (
                          filteredData.map((school) => (
                            <TableRow key={school.id} className="group hover:bg-muted/30">
                              <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{school.nome}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">{school.municipio} - {school.uf}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] py-0 font-medium">
                                  {DEPENDENCIA_LABELS[school.tp_dependencia] || "N/A"}
                                </Badge>
                                <div className="text-[10px] text-muted-foreground uppercase mt-1">{school.localizacao}</div>
                              </TableCell>
                              <TableCell className="text-right font-medium">{school.total_matriculas}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={school.percentual_eti >= 50 ? "default" : school.percentual_eti >= 20 ? "secondary" : "outline"} className="font-bold">
                                  {school.percentual_eti}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary">
                                      <Eye className="h-3.5 w-3.5" /> Detalhes
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                      <DialogTitle>{school.nome}</DialogTitle>
                                      <DialogDescription>
                                        Código INEP: {school.codigo_inep} • {school.municipio} ({school.uf})
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-auto mt-4 pr-2">
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(school.raw_data)
                                          .filter(([key]) => key.startsWith('QT_MAT_'))
                                          .map(([key, value]) => (
                                            <div key={key} className="flex justify-between p-2 border rounded-md bg-muted/20 text-xs">
                                              <span className="font-medium text-muted-foreground">{key}</span>
                                              <span className="font-bold">{value}</span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                              <div className="flex flex-col items-center gap-2">
                                <Search className="h-8 w-8 opacity-10" />
                                <p>Nenhum resultado encontrado para os filtros aplicados.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                
                {filteredData.length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <CheckCircle2 className="h-5 w-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-green-800 font-bold text-sm">Pronto para Consolidação</p>
                        <p className="text-green-700 text-xs">Análise de {stats?.municipios} municípios e {filteredData.length} escolas selecionada.</p>
                      </div>
                    </div>
                    <Button className="bg-green-700 hover:bg-green-800 text-white border-none shadow-lg shadow-green-900/20">
                      Consolidar no Banco de Dados
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
