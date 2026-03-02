
"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileUp, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle, 
  Database,
  Building,
  Users,
  Play,
  ArrowRight,
  RefreshCw,
  Info,
  ShieldAlert,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, writeBatch } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface INEPSchool {
  codigo_inep: string;
  nome: string;
  municipio_id: string;
  municipio_nome: string;
  uf: string;
  localizacao: string;
  tp_dependencia: string;
}

/**
 * Throttling otimizado para planos pagos (Blaze).
 * Mantemos uma pequena pausa apenas para evitar saturação do buffer do navegador.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function PipelineImportadorPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [cityCount, setCityCount] = useState(0);
  
  const [schoolsFile, setSchoolsFile] = useState<File | null>(null);
  const [enrollmentsFile, setEnrollmentsFile] = useState<File | null>(null);

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const { data: profile } = useDoc(useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]));

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    let separator = ',';
    if (firstLine.includes('\t')) separator = '\t';
    else if (firstLine.includes(';')) separator = ';';
    
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => { row[header] = values[index]; });
      return row;
    });
  };

  const handleRunPipeline = async () => {
    if (!schoolsFile || !enrollmentsFile || !db) {
      toast({ title: "Erro", description: "Selecione ambos os arquivos para processar.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStatus("Sincronizando bases nacionais...");
    setProgress(5);
    setCityCount(0);

    try {
      const schoolsText = await schoolsFile.text();
      const schoolsRaw = parseCSV(schoolsText);
      const schoolMap = new Map<string, INEPSchool>();
      
      schoolsRaw.forEach(row => {
        const inep = row.CO_ENTIDADE;
        const dep = row.TP_DEPENDENCIA;
        // Filtramos apenas escolas municipais (TP_DEPENDENCIA = 3)
        if (!inep || dep !== "3") return;

        schoolMap.set(inep, {
          codigo_inep: inep,
          nome: row.NO_ENTIDADE || "N/A",
          municipio_id: row.CO_MUNICIPIO || "N/A",
          municipio_nome: row.NO_MUNICIPIO || "N/A",
          uf: row.SG_UF || "N/A",
          localizacao: row.TP_LOCALIZACAO === "2" ? "rural" : "urbana",
          tp_dependencia: dep
        });
      });

      const enrollmentsText = await enrollmentsFile.text();
      const enrollmentsRaw = parseCSV(enrollmentsText);
      const consolidatedData = new Map<string, any[]>();

      enrollmentsRaw.forEach(row => {
        const inep = row.CO_ENTIDADE;
        const schoolInfo = schoolMap.get(inep);
        if (!schoolInfo) return;

        const qInt = (k: string) => parseInt(row[k] || "0", 10);
        const total_eti = qInt('QT_MAT_INF_CRE_INT') + qInt('QT_MAT_INF_PRE_INT') + qInt('QT_MAT_FUND_AI_INT') + qInt('QT_MAT_FUND_AF_INT');
        const total_bas = qInt('QT_MAT_BAS');

        const schoolDoc = {
          ...schoolInfo,
          total_matriculas: total_bas,
          total_eti,
          percentual_eti: total_bas > 0 ? Number(((total_eti / total_bas) * 100).toFixed(1)) : 0,
          matriculas: {
            creche_integral: qInt('QT_MAT_INF_CRE_INT'),
            creche_parcial: Math.max(0, qInt('QT_MAT_INF_CRE') - qInt('QT_MAT_INF_CRE_INT')),
            pre_integral: qInt('QT_MAT_INF_PRE_INT'),
            pre_parcial: Math.max(0, qInt('QT_MAT_INF_PRE') - qInt('QT_MAT_INF_PRE_INT')),
            ef_ai_integral: qInt('QT_MAT_FUND_AI_INT'),
            ef_ai_parcial: Math.max(0, qInt('QT_MAT_FUND_AI') - qInt('QT_MAT_FUND_AI_INT')),
            ef_af_integral: qInt('QT_MAT_FUND_AF_INT'),
            ef_af_parcial: Math.max(0, qInt('QT_MAT_FUND_AF') - qInt('QT_MAT_FUND_AF_INT')),
            eja_fundamental: qInt('QT_MAT_EJA_FUND'),
            especial_aee: qInt('QT_MAT_ESP')
          },
          updatedAt: new Date().toISOString()
        };

        const mId = schoolInfo.municipio_id;
        if (!consolidatedData.has(mId)) consolidatedData.set(mId, []);
        consolidatedData.get(mId)?.push(schoolDoc);
      });

      let processedCities = 0;
      const allEntries = Array.from(consolidatedData.entries());
      const totalCities = allEntries.length;

      for (const [mId, schools] of allEntries) {
        // Lotes maiores para plano Blaze (400 por lote)
        for (let i = 0; i < schools.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = schools.slice(i, i + 400);
          
          chunk.forEach(school => {
            const sRef = doc(db, 'municipios', mId, 'schools', school.codigo_inep);
            batch.set(sRef, school, { merge: true });
          });
          
          await batch.commit();
          // Pausa curta (200ms) apenas para respiro do navegador
          await delay(200); 
        }
        
        processedCities++;
        setCityCount(processedCities);
        setProgress(20 + Math.floor((processedCities / totalCities) * 80));
        setStatus(`Processando: ${processedCities} de ${totalCities} prefeituras...`);
      }

      toast({ title: "Sucesso", description: "Pipeline nacional concluído com sucesso." });
    } catch (err: any) {
      const isQuotaError = err.message?.includes('quota') || err.message?.includes('exhausted');
      toast({ 
        title: isQuotaError ? "Cota Excedida" : "Erro no Pipeline", 
        description: isQuotaError 
          ? "O limite de escritas do Firebase foi atingido. Verifique se a migração para o plano Blaze foi concluída." 
          : err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
      setProgress(0);
      setStatus("");
    }
  };

  if (profile?.role !== 'Admin') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive/50" />
        <h3 className="text-xl font-bold">Acesso Restrito</h3>
        <p className="text-muted-foreground">Apenas o Administrador Mestre pode executar este pipeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Importador Nacional</h2>
          <p className="text-muted-foreground">Processamento centralizado de microdados INEP 2025</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 hover:bg-green-700 py-1 px-3 gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Alta Performance (Blaze)
          </Badge>
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200 text-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="font-bold">Processamento de Larga Escala</AlertTitle>
        <AlertDescription className="text-xs">
          O sistema está configurado para o plano Blaze, permitindo a escrita de todos os municípios simultaneamente. 
          O join entre as tabelas de Escolas e Matrículas é feito automaticamente via CO_ENTIDADE.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" /> Fontes CSV (Nacional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Building className="h-3 w-3" /> 1. Escolas (Arquivo Nacional)
              </label>
              <Input type="file" accept=".csv" onChange={(e) => setSchoolsFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Users className="h-3 w-3" /> 2. Matrículas (Arquivo Nacional)
              </label>
              <Input type="file" accept=".csv" onChange={(e) => setEnrollmentsFile(e.target.files?.[0] || null)} />
            </div>
            <Button className="w-full gap-2 mt-4" onClick={handleRunPipeline} disabled={loading || !schoolsFile || !enrollmentsFile}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {loading ? "Processando..." : "Rodar Pipeline Nacional"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /> Monitor de Distribuição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 py-10">
            {loading ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-primary">
                  <span>{status}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="flex items-center gap-2 p-3 bg-green-50 border rounded-lg text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-[10px]">
                    Modo Blaze Ativo: Gravando {cityCount || 0} municípios identificados nos arquivos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl opacity-50">
                <Database className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium">Aguardando arquivos para distribuição nacional</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
