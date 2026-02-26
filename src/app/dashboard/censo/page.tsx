"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Database, FileUp, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MOCK_SCHOOLS } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CensoPage() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1);

  const handleUpload = () => {
    setUploading(true);
    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setUploading(false);
        setStep(2);
        toast({
          title: "Processamento concluído",
          description: "4 escolas e 1.880 matrículas identificadas no arquivo.",
        });
      }
    }, 200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Importação do Censo Escolar</h2>
        <p className="text-muted-foreground">Importe os microdados do INEP (MATRICULA_SUDESTE.CSV)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Upload de Arquivos</CardTitle>
            <CardDescription>Formatos aceitos: CSV (INEP) ou Excel (.xlsx)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 bg-muted/30">
              <FileUp className="h-10 w-10 text-primary/40" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Arraste o arquivo aqui</p>
                <p className="text-xs text-muted-foreground">Limite de 500MB</p>
              </div>
              <Input id="file" type="file" className="hidden" />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('file')?.click()}>
                Selecionar Arquivo
              </Button>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Lendo microdados...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <Button className="w-full gap-2" disabled={uploading} onClick={handleUpload}>
              <Database className="h-4 w-4" /> Iniciar Importação
            </Button>

            <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-blue-800 text-xs">
              <Info className="h-4 w-4 shrink-0" />
              <p>O sistema filtra automaticamente pelo CO_MUNICIPIO configurado (3162500).</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Prévia das Matrículas</CardTitle>
            <CardDescription>Confirme os dados antes de consolidar no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Database className="h-8 w-8 opacity-20" />
                <p>Nenhum dado importado para este exercício</p>
              </div>
            ) : (
              <div className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escola</TableHead>
                      <TableHead className="text-right">Total Matrículas</TableHead>
                      <TableHead className="text-right">Alunos ETI</TableHead>
                      <TableHead className="text-right">% ETI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_SCHOOLS.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell className="font-medium">{school.nome}</TableCell>
                        <TableCell className="text-right">{school.total_matriculas}</TableCell>
                        <TableCell className="text-right">{school.total_eti}</TableCell>
                        <TableCell className="text-right">{school.percentual_eti}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-800 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    Validação Concluída: Dados consistentes
                  </div>
                  <Button variant="outline" className="text-green-800 border-green-300 hover:bg-green-100">
                    Confirmar Consolidação
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
