
"use client"

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Database, FileUp, CheckCircle2, FileText, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { School } from "@/types";

export default function CensoPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1);
  const [parsedSchools, setParsedSchools] = useState<School[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const CO_MUNICIPIO_ALVO = "3162500"; // Exemplo configurado

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

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const schoolsMap = new Map<string, any>();

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // Filtrar pelo município alvo
      if (row.CO_MUNICIPIO !== CO_MUNICIPIO_ALVO) continue;

      const schoolId = row.CO_ENTIDADE;
      if (!schoolId) continue;

      // Mapeamento simplificado das colunas solicitadas para o modelo interno
      const parseNum = (val: any) => parseInt(val || "0", 10);

      const schoolData: School = {
        id: schoolId,
        codigo_inep: row.CO_ENTIDADE,
        nome: row.NO_ENTIDADE || "Escola sem nome",
        localizacao: row.TP_LOCALIZACAO === "2" ? "rural" : "urbana",
        matriculas: {
          creche_integral: parseNum(row.QT_MAT_INF_CRE_INT),
          creche_parcial: parseNum(row.QT_MAT_INF_CRE) - parseNum(row.QT_MAT_INF_CRE_INT),
          creche_conveniada_int: 0, // Dados específicos de convênio podem exigir mais colunas
          creche_conveniada_par: 0,
          pre_integral: parseNum(row.QT_MAT_INF_PRE_INT),
          pre_parcial: parseNum(row.QT_MAT_INF_PRE) - parseNum(row.QT_MAT_INF_PRE_INT),
          ef_ai_integral: parseNum(row.QT_MAT_FUND_AI_INT),
          ef_ai_parcial: parseNum(row.QT_MAT_FUND_AI) - parseNum(row.QT_MAT_FUND_AI_INT),
          ef_af_integral: parseNum(row.QT_MAT_FUND_AF_INT),
          ef_af_parcial: parseNum(row.QT_MAT_FUND_AF) - parseNum(row.QT_MAT_FUND_AF_INT),
          eja_fundamental: parseNum(row.QT_MAT_EJA_FUND),
          eja_medio: parseNum(row.QT_MAT_EJA_MED),
          especial_aee: parseNum(row.QT_MAT_ESP),
          indigena_quilombola: parseNum(row.QT_MAT_BAS_INDIGENA),
          campo_rural: parseNum(row.QT_MAT_ZR_RUR)
        },
        total_matriculas: parseNum(row.QT_MAT_BAS),
        total_eti: parseNum(row.QT_MAT_INF_INT) + parseNum(row.QT_MAT_FUND_INT) + parseNum(row.QT_MAT_MED_INT),
        percentual_eti: 0
      };

      // Calcular percentual
      if (schoolData.total_matriculas > 0) {
        schoolData.percentual_eti = Number(((schoolData.total_eti / schoolData.total_matriculas) * 100).toFixed(1));
      }

      schoolsMap.set(schoolId, schoolData);
    }

    return Array.from(schoolsMap.values());
  };

  const handleStartImport = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({
        title: "Nenhum arquivo",
        description: "Selecione um arquivo MATRICULA_SUDESTE.CSV primeiro.",
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
          title: "Importação concluída",
          description: `${schools.length} escolas encontradas para o município ${CO_MUNICIPIO_ALVO}.`,
        });
      } catch (err) {
        setUploading(false);
        toast({
          title: "Erro no processamento",
          description: "O formato do arquivo parece inválido.",
          variant: "destructive"
        });
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Importação do Censo Escolar</h2>
        <p className="text-muted-foreground">Importe os microdados do INEP (Colunas: NU_ANO_CENSO, CO_MUNICIPIO, QT_MAT_BAS, etc.)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Upload de Arquivos</CardTitle>
            <CardDescription>Formatos aceitos: CSV oficial do INEP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? (
                <FileText className="h-10 w-10 text-primary" />
              ) : (
                <FileUp className="h-10 w-10 text-primary/40" />
              )}
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{fileName || "Selecione o arquivo CSV"}</p>
                <p className="text-xs text-muted-foreground">Ex: MATRICULA_SUDESTE.CSV</p>
              </div>
              <Input 
                ref={fileInputRef}
                id="file" 
                type="file" 
                accept=".csv"
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{progress < 100 ? "Lendo arquivo..." : "Processando colunas..."}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <Button 
              className="w-full gap-2" 
              disabled={uploading || !fileName} 
              onClick={handleStartImport}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {uploading ? "Processando..." : "Iniciar Importação"}
            </Button>

            <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-blue-800 text-xs">
              <Info className="h-4 w-4 shrink-0" />
              <p>O sistema filtra automaticamente pelo CO_MUNICIPIO configurado (<strong>{CO_MUNICIPIO_ALVO}</strong>).</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Dados Identificados</CardTitle>
            <CardDescription>Confirme os dados extraídos das colunas de matrículas</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2 border-2 border-dashed rounded-lg">
                <Database className="h-8 w-8 opacity-20" />
                <p>Aguardando upload e processamento</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="max-h-[400px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Escola</TableHead>
                        <TableHead className="text-right">Total Matrículas</TableHead>
                        <TableHead className="text-right">Alunos ETI</TableHead>
                        <TableHead className="text-right">% ETI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedSchools.length > 0 ? (
                        parsedSchools.map((school) => (
                          <TableRow key={school.id}>
                            <TableCell className="font-medium">{school.nome}</TableCell>
                            <TableCell className="text-right">{school.total_matriculas}</TableCell>
                            <TableCell className="text-right">{school.total_eti}</TableCell>
                            <TableCell className="text-right">{school.percentual_eti}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhuma escola encontrada para o município {CO_MUNICIPIO_ALVO} neste arquivo.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {parsedSchools.length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
                      <CheckCircle2 className="h-5 w-5" />
                      Dados processados com sucesso.
                    </div>
                    <Button variant="outline" className="text-green-800 border-green-300 hover:bg-green-100">
                      Confirmar Consolidação
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
