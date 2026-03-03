"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileUp, 
  CheckCircle2, 
  Loader2, 
  Database,
  Building,
  Users,
  Play,
  RefreshCw,
  Info,
  ShieldAlert,
  Zap,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, writeBatch, collection, getDocs, deleteDoc } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface INEPSchool {
  codigo_inep: string;
  nome: string;
  municipio_id: string;
  municipio_nome: string;
  uf: string;
  localizacao: string;
  tp_dependencia: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function PipelineImportadorPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [cityCount, setCityCount] = useState(0);
  const [targetMunicipioId, setTargetMunicipioId] = useState("");
  
  const [schoolsFile, setSchoolsFile] = useState<File | null>(null);
  const [enrollmentsFile, setEnrollmentsFile] = useState<File | null>(null);

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const { data: profile } = useDoc(useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]));

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    const separator = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
    const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => { row[header] = values[index]; });
      return row;
    });
  };

  const handleCleanupOrphans = async () => {
    if (!db || !targetMunicipioId) {
      toast({ title: "Atenção", description: "Informe o Cód. IBGE do município para limpeza.", variant: "destructive" });
      return;
    }
    setCleaning(true);
    try {
      const schoolsCol = collection(db, 'municipios', targetMunicipioId, 'schools');
      const snapshot = await getDocs(schoolsCol);
      let count = 0;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        // Remove escolas sem matrículas ou sem atualização do novo ciclo (lixo de importação)
        if (!data.total_matriculas || data.total_matriculas === 0) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      
      await batch.commit();
      toast({ title: "Limpeza Concluída", description: `${count} entidades sem matrícula foram removidas.` });
    } catch (e: any) {
      toast({ title: "Erro na Limpeza", description: e.message, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!schoolsFile || !enrollmentsFile || !db) {
      toast({ title: "Erro", description: "Selecione ambos os arquivos para processar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setStatus("Sincronizando bases nacionais...");
    try {
      const schoolsRaw = parseCSV(await schoolsFile.text());
      const schoolMap = new Map<string, INEPSchool>();
      schoolsRaw.forEach(row => {
        if (row.TP_DEPENDENCIA === "3") { // Apenas Municipal
          schoolMap.set(row.CO_ENTIDADE, {
            codigo_inep: row.CO_ENTIDADE,
            nome: row.NO_ENTIDADE || "N/A",
            municipio_id: row.CO_MUNICIPIO || "N/A",
            municipio_nome: row.NO_MUNICIPIO || "N/A",
            uf: row.SG_UF || "N/A",
            localizacao: row.TP_LOCALIZACAO === "2" ? "rural" : "urbana",
            tp_dependencia: "3"
          });
        }
      });

      const enrollmentsRaw = parseCSV(await enrollmentsFile.text());
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
        if (!consolidatedData.has(schoolInfo.municipio_id)) consolidatedData.set(schoolInfo.municipio_id, []);
        consolidatedData.get(schoolInfo.municipio_id)?.push(schoolDoc);
      });

      let processedCities = 0;
      const allEntries = Array.from(consolidatedData.entries());
      for (const [mId, schools] of allEntries) {
        for (let i = 0; i < schools.length; i += 400) {
          const batch = writeBatch(db);
          schools.slice(i, i + 400).forEach(s => {
            const sRef = doc(db, 'municipios', mId, 'schools', s.codigo_inep);
            batch.set(sRef, s); // SEM MERGE para limpar lixo de campos antigos
          });
          await batch.commit();
          await delay(150);
        }
        processedCities++;
        setCityCount(processedCities);
        setProgress(Math.floor((processedCities / allEntries.length) * 100));
        setStatus(`Gravando municípios... ${processedCities} de ${allEntries.length}`);
      }
      toast({ title: "Pipeline Concluído", description: "Base nacional 2025 atualizada com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro no Pipeline", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false); setProgress(0); setStatus("");
    }
  };

  if (profile?.role !== 'Admin') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive/50" />
        <h3 className="text-xl font-bold text-primary">Acesso Restrito ao Administrador</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Importador Nacional</h2>
          <p className="text-muted-foreground">Distribuição centralizada de microdados 2025</p>
        </div>
        <Badge className="bg-green-600 py-1 px-3 gap-1.5"><Zap className="h-3.5 w-3.5" /> Modo Blaze Ativo</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> Fontes Nacionais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><Building className="h-3 w-3" /> 1. Escolas (CSV)</label>
                <Input type="file" accept=".csv" onChange={(e) => setSchoolsFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1"><Users className="h-3 w-3" /> 2. Matrículas (CSV)</label>
                <Input type="file" accept=".csv" onChange={(e) => setEnrollmentsFile(e.target.files?.[0] || null)} />
              </div>
              <Button className="w-full gap-2 mt-4" onClick={handleRunPipeline} disabled={loading || !schoolsFile || !enrollmentsFile}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Rodar Pipeline Nacional
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-orange-200 bg-orange-50/30">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-orange-700"><Trash2 className="h-5 w-5" /> Limpeza de Dados Órfãos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[10px] text-orange-600 leading-tight">Remove entidades que não possuem matrículas em 2025 (lixo do Censo 2024).</p>
              <Input placeholder="Cód. IBGE Município" value={targetMunicipioId} onChange={e => setTargetMunicipioId(e.target.value)} className="bg-white border-orange-200" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-100" disabled={cleaning}>
                    {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Limpar Entidades Sem Matrícula
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Limpeza Estrutural?</AlertDialogTitle>
                    <AlertDialogDescription>Isso removerá todas as escolas que não possuem matrículas cadastradas no Cód. IBGE informado.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCleanupOrphans} className="bg-orange-600">Sim, Limpar Lixo</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /> Monitor de Importação</CardTitle></CardHeader>
          <CardContent className="space-y-8 py-10">
            {loading ? (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-primary"><span>{status}</span><span>{progress}%</span></div>
                <Progress value={progress} className="h-3" />
                <Alert className="bg-green-50 border-green-200 text-green-700"><CheckCircle2 className="h-4 w-4" /><AlertDescription className="text-xs">Gravando {cityCount} municípios. O sistema está sobrescrevendo documentos antigos para evitar lixo.</AlertDescription></Alert>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl opacity-50"><Database className="h-10 w-10 mb-2" /><p className="text-sm">Aguardando arquivos para distribuição nacional</p></div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
