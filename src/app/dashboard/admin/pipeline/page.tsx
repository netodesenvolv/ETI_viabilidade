
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
  Info
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

export default function PipelineImportadorPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  
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
    const separator = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');
    
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
    setStatus("Lendo cadastro nacional de escolas...");
    setProgress(5);

    try {
      const schoolsText = await schoolsFile.text();
      const schoolsRaw = parseCSV(schoolsText);
      const schoolMap = new Map<string, INEPSchool>();
      
      schoolsRaw.forEach(row => {
        const inep = row.CO_ENTIDADE;
        const dep = row.TP_DEPENDENCIA;
        
        // Filtro: Apenas Escolas Municipais (3)
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

      setProgress(25);
      setStatus(`Cruzando microdados de matrículas para ${schoolMap.size} escolas municipais...`);

      const enrollmentsText = await enrollmentsFile.text();
      const enrollmentsRaw = parseCSV(enrollmentsText);
      const consolidatedData = new Map<string, any[]>();

      enrollmentsRaw.forEach(row => {
        const inep = row.CO_ENTIDADE;
        const schoolInfo = schoolMap.get(inep);
        if (!schoolInfo) return;

        const qInt = (k: string) => parseInt(row[k] || "0", 10);
        
        // Mapeamento INEP 2025 - Campos Integrais
        const creche_int = qInt('QT_MAT_INF_CRE_INT');
        const pre_int = qInt('QT_MAT_INF_PRE_INT');
        const fund_ai_int = qInt('QT_MAT_FUND_AI_INT');
        const fund_af_int = qInt('QT_MAT_FUND_AF_INT');

        // Totais para cálculo de parciais
        const qt_creche = qInt('QT_MAT_INF_CRE');
        const qt_pre = qInt('QT_MAT_INF_PRE');
        const qt_fund_ai = qInt('QT_MAT_FUND_AI');
        const qt_fund_af = qInt('QT_MAT_FUND_AF');
        
        const total_bas = qInt('QT_MAT_BAS');
        const total_eti = creche_int + pre_int + fund_ai_int + fund_af_int;

        const schoolDoc = {
          ...schoolInfo,
          total_matriculas: total_bas,
          total_eti,
          percentual_eti: total_bas > 0 ? Number(((total_eti / total_bas) * 100).toFixed(1)) : 0,
          matriculas: {
            creche_integral: creche_int,
            creche_parcial: Math.max(0, qt_creche - creche_int),
            pre_integral: pre_int,
            pre_parcial: Math.max(0, qt_pre - pre_int),
            ef_ai_integral: fund_ai_int,
            ef_ai_parcial: Math.max(0, qt_fund_ai - fund_ai_int),
            ef_af_integral: fund_af_int,
            ef_af_parcial: Math.max(0, qt_fund_af - fund_af_int),
            eja_fundamental: qInt('QT_MAT_EJA_FUND'),
            especial_aee: qInt('QT_MAT_ESP')
          },
          updatedAt: new Date().toISOString()
        };

        const mId = schoolInfo.municipio_id;
        if (!consolidatedData.has(mId)) consolidatedData.set(mId, []);
        consolidatedData.get(mId)?.push(schoolDoc);
      });

      setProgress(50);
      setStatus(`Salvando dados segmentados por município (${consolidatedData.size} cidades)...`);

      let cityCount = 0;
      const totalCities = consolidatedData.size;
      
      for (const [mId, schools] of Array.from(consolidatedData.entries())) {
        // Chunking de 500 para respeitar limites do Firestore
        for (let i = 0; i < schools.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = schools.slice(i, i + 500);
          
          chunk.forEach(school => {
            const sRef = doc(db, 'municipios', mId, 'schools', school.codigo_inep);
            batch.set(sRef, school, { merge: true });
          });
          
          await batch.commit();
        }
        
        cityCount++;
        setProgress(50 + Math.floor((cityCount / totalCities) * 50));
        setStatus(`Processado: ${cityCount} de ${totalCities} municípios...`);
      }

      toast({ 
        title: "Pipeline Concluído", 
        description: `Microdados INEP 2025 distribuídos para ${totalCities} municípios municipais.`,
      });
    } catch (err: any) {
      toast({ title: "Falha no Pipeline", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setStatus("");
      setProgress(0);
    }
  };

  if (profile?.role !== 'Admin') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive/50" />
        <h3 className="text-xl font-bold">Acesso Restrito ao Master Admin</h3>
        <p className="text-muted-foreground max-w-sm">
          Este pipeline nacional é de uso exclusivo para o administrador geral da plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Importador Mestre (Pipeline Nacional)</h2>
          <p className="text-muted-foreground">Distribuição automatizada de microdados INEP 2025</p>
        </div>
        <Badge className="bg-accent h-fit py-1 px-3">Censo 2025 v1.2</Badge>
      </div>

      <Alert className="bg-blue-50 border-blue-200 text-blue-800 shadow-sm">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="font-bold text-sm">Escalabilidade e Multi-tenancy</AlertTitle>
        <AlertDescription className="text-xs">
          O pipeline une automaticamente o cadastro nacional às matrículas e separa os dados por município. 
          Escolas existentes são atualizadas (Upsert), garantindo a integridade da rede municipal.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <FileUp className="h-5 w-5" />
              Fontes Nacionais
            </CardTitle>
            <CardDescription>Carregue os arquivos brutos do INEP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Building className="h-3 w-3" /> 1. Cadastro de Escolas (CSV)
              </label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
                <Input 
                  type="file" 
                  accept=".csv" 
                  className="border-none shadow-none h-8 cursor-pointer text-xs"
                  onChange={(e) => setSchoolsFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Users className="h-3 w-3" /> 2. Matrículas Consolidado (CSV)
              </label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
                <Input 
                  type="file" 
                  accept=".csv" 
                  className="border-none shadow-none h-8 cursor-pointer text-xs"
                  onChange={(e) => setEnrollmentsFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <Button 
              className="w-full gap-2 bg-primary hover:bg-primary/90" 
              onClick={handleRunPipeline} 
              disabled={loading || !schoolsFile || !enrollmentsFile}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {loading ? "Processando Lote..." : "Iniciar Pipeline Nacional"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Monitor de Distribuição
            </CardTitle>
            <CardDescription>Acompanhe o roteamento dos microdados fiscais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 py-8">
            {loading ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-primary">
                    <span>{status}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
                <div className="p-4 bg-white rounded-xl border border-primary/10 flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary uppercase">Escrita Segura Firestore</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Lote atual: Processando documentos e fragmentando em chunks de 500 para evitar timeout.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 space-y-4 text-muted-foreground border-2 border-dashed rounded-2xl bg-white/50">
                <CheckCircle2 className="h-12 w-12 opacity-10" />
                <div className="text-center">
                  <p className="text-sm font-medium">Pipeline Pronto para Receber Dados</p>
                  <p className="text-[10px]">Utilize os CSVs nacionais brutos do portal INEP.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-4 bg-white rounded-xl border space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
                    <ArrowRight className="h-3 w-3" /> Sharding IBGE
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Os dados são injetados diretamente na coleção do município correspondente ao código IBGE.
                  </p>
               </div>
               <div className="p-4 bg-white rounded-xl border space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase">
                    <ArrowRight className="h-3 w-3" /> Conservação de Dados
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Parâmetros customizados e despesas lançadas pelas secretarias não são afetados.
                  </p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
