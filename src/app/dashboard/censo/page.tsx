
"use client"

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Database, FileUp, CheckCircle2, FileText, Info, Loader2, Search, FilterX, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParsedSchool {
  id: string;
  codigo_inep: string;
  nome: string;
  municipio: string;
  uf: string;
  localizacao: string;
  total_matriculas: number;
  total_eti: number;
  percentual_eti: number;
}

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

    // Tentar identificar o separador (vírgula ou ponto e vírgula)
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    const schools: ParsedSchool[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
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
        total_matriculas,
        total_eti,
        percentual_eti: total_matriculas > 0 ? Number(((total_eti / total_matriculas) * 100).toFixed(1)) : 0
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
      return matchesSearch && matchesMunicipio;
    });
  }, [parsedSchools, searchQuery, municipioFilter]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalMat = filteredData.reduce((acc, s) => acc + s.total_matriculas, 0);
    const totalETI = filteredData.reduce((acc, s) => acc + s.total_eti, 0);
    const uniqueMun = new Set(filteredData.map(s => s.municipio)).size;
    return {
      totalMat,
      totalETI,
      percentETI: ((totalETI / totalMat) * 100).toFixed(1),
      count: filteredData.length,
      municipios: uniqueMun
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Painel de Administração: Censo Escolar</h2>
          <p className="text-muted-foreground">Importação global de microdados INEP sem restrição de município</p>
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
                <p className="text-[10px] text-muted-foreground">Suporta arquivos de matrículas de qualquer estado</p>
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
              <p>Este painel aceita o arquivo completo do INEP. A memória do navegador processa até ~100 mil linhas sem lentidão.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Explorador de Dados Consolidados</CardTitle>
                <CardDescription>Visualize e filtre escolas de qualquer município importado</CardDescription>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <FilterX className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Filtrar por Município..." 
                      className="pl-9 h-9"
                      value={municipioFilter}
                      onChange={(e) => setMunicipioFilter(e.target.value)}
                    />
                  </div>
                  <div className="bg-muted/50 p-2 px-3 rounded-lg border flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Total de Escolas</span>
                    <span className="text-lg font-bold">{stats?.count}</span>
                  </div>
                  <div className="bg-primary/5 p-2 px-3 rounded-lg border border-primary/10 flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-primary/70">Média % ETI</span>
                    <span className="text-lg font-bold text-primary">{stats?.percentETI}%</span>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <ScrollArea className="h-[450px]">
                    <Table>
                      <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-[120px]">INEP</TableHead>
                          <TableHead>Escola</TableHead>
                          <TableHead>Município / UF</TableHead>
                          <TableHead className="text-right">Matrículas</TableHead>
                          <TableHead className="text-right">ETI</TableHead>
                          <TableHead className="text-right">% ETI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.length > 0 ? (
                          filteredData.map((school) => (
                            <TableRow key={school.id} className="group hover:bg-muted/30">
                              <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{school.nome}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">{school.localizacao}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{school.municipio}</div>
                                <div className="text-xs text-muted-foreground">{school.uf}</div>
                              </TableCell>
                              <TableCell className="text-right font-medium">{school.total_matriculas}</TableCell>
                              <TableCell className="text-right text-primary/80">{school.total_eti}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={school.percentual_eti >= 50 ? "default" : school.percentual_eti >= 20 ? "secondary" : "outline"} className="font-bold">
                                  {school.percentual_eti}%
                                </Badge>
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
                        <p className="text-green-700 text-xs">Análise de {stats?.municipios} municípios selecionada.</p>
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
