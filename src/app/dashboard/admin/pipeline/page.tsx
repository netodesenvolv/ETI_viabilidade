
"use client"

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileUp, 
  CheckCircle2, 
  FileText, 
  Loader2, 
  AlertTriangle, 
  Database,
  Building,
  Users,
  Play,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, writeBatch, collection } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";

interface INEPSchool {
  codigo_inep: string;
  nome: string;
  municipio_id: string;
  municipio_nome: string;
  uf: string;
  localizacao: string;
  tp_dependencia: string;
}

interface INEPEnrollment {
  codigo_inep: string;
  total_matriculas: number;
  total_eti: number;
  matriculas: any;
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
    const separator = firstLine.includes(';') ? ';' : ',';
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
    setStatus("Lendo arquivos...");
    setProgress(10);

    try {
      const schoolsText = await schoolsFile.text();
      const enrollmentsText = await enrollmentsFile.text();

      setStatus("Processando cadastros de escolas...");
      const schoolsRaw = parseCSV(schoolsText);
      const schoolMap = new Map<string, INEPSchool>();
      
      schoolsRaw.forEach(row => {
        if (!row.CO_ENTIDADE) return;
        schoolMap.set(row.CO_ENTIDADE, {
          codigo_inep: row.CO_ENTIDADE,
          nome: row.NO_ENTIDADE || "N/A",
          municipio_id: row.CO_MUNICIPIO,
          municipio_nome: row.NO_MUNICIPIO || "N/A",
          uf: row.SG_UF || "N/A",
          localizacao: row.TP_LOCALIZACAO === "2" ? "rural" : "urbana",
          tp_dependencia: row.TP_DEPENDENCIA || "3"
        });
      });

      setProgress(30);
      setStatus("Processando microdados de matrículas...");
      const enrollmentsRaw = parseCSV(enrollmentsText);
      const consolidatedData = new Map<string, any[]>();

      enrollmentsRaw.forEach(row => {
        const schoolInfo = schoolMap.get(row.CO_ENTIDADE);
        if (!schoolInfo) return;

        // Mapeamento de matrículas (adaptado para nova estrutura INEP se necessário)
        const qInt = (k: string) => parseInt(row[k] || "0", 10);
        const qt_inf_cre = qInt('QT_MAT_INF_CRE');
        const qt_inf_cre_int = qInt('QT_MAT_INF_CRE_INT');
        const qt_inf_pre = qInt('QT_MAT_INF_PRE');
        const qt_inf_pre_int = qInt('QT_MAT_INF_PRE_INT');
        const qt_fund_ai = qInt('QT_MAT_FUND_AI');
        const qt_fund_ai_int = qInt('QT_MAT_FUND_AI_INT');
        const qt_fund_af = qInt('QT_MAT_FUND_AF');
        const qt_fund_af_int = qInt('QT_MAT_FUND_AF_INT');

        const total_eti = qt_inf_cre_int + qt_inf_pre_int + qt_fund_ai_int + qt_fund_af_int;
        const total_bas = parseInt(row.QT_MAT_BAS || "0", 10);

        const schoolDoc = {
          ...schoolInfo,
          total_matriculas: total_bas,
          total_eti,
          percentual_eti: total_bas > 0 ? Number(((total_eti / total_bas) * 100).toFixed(1)) : 0,
          matriculas: {
            creche_integral: qt_inf_cre_int,
            creche_parcial: Math.max(0, qt_inf_cre - qt_inf_cre_int),
            pre_integral: qt_inf_pre_int,
            pre_parcial: Math.max(0, qt_inf_pre - qt_inf_pre_int),
            ef_ai_integral: qt_fund_ai_int,
            ef_ai_parcial: Math.max(0, qt_fund_ai - qt_fund_ai_int),
            ef_af_integral: qt_fund_af_int,
            ef_af_parcial: Math.max(0, qt_fund_af - qt_fund_af_int),
            eja_fundamental: qInt('QT_MAT_EJA_FUND'),
            especial_aee: qInt('QT_MAT_ESP')
          },
          updatedAt: new Date().toISOString()
        };

        const mId = schoolInfo.municipio_id;
        if (!consolidatedData.has(mId)) consolidatedData.set(mId, []);
        consolidatedData.get(mId)?.push(schoolDoc);
      });

      setProgress(60);
      setStatus(`Salvando ${consolidatedData.size} municípios no Firestore...`);

      // Lógica de escrita em lote (Batch)
      let count = 0;
      const totalCities = consolidatedData.size;
      
      for (const [mId, schools] of Array.from(consolidatedData.entries())) {
        const batch = writeBatch(db);
        schools.forEach(school => {
          const sRef = doc(db, 'municipios', mId, 'schools', school.codigo_inep);
          batch.set(sRef, school, { merge: true });
        });
        await batch.commit();
        count++;
        setProgress(60 + Math.floor((count / totalCities) * 40));
        setStatus(`Processando: ${count} de ${totalCities} municípios...`);
      }

      toast({ title: "Sucesso!", description: "Pipeline concluído. Base nacional atualizada." });
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
          Este pipeline é de uso exclusivo para atualização da base nacional consolidada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Importador Mestre (Pipeline)</h2>
          <p className="text-muted-foreground">Distribuição nacional de microdados INEP para municípios segmentados</p>
        </div>
        <Badge className="bg-accent h-fit py-1 px-3">Censo 2025 ready</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Fontes de Dados (CSV)
            </CardTitle>
            <CardDescription>Upload dos arquivos oficiais do INEP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">1. Cadastro de Escolas</label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                <Building className="h-4 w-4 text-primary opacity-50" />
                <Input 
                  type="file" 
                  accept=".csv" 
                  className="border-none shadow-none h-8 cursor-pointer text-xs"
                  onChange={(e) => setSchoolsFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">2. Microdados Matrículas</label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                <Users className="h-4 w-4 text-primary opacity-50" />
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
              Rodar Pipeline de Distribuição
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Monitor de Processamento</CardTitle>
            <CardDescription>Acompanhe o roteamento e a persistência no banco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 py-8">
            {loading ? (
              <div className="space-y-6 text-center">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-primary">
                    <span>{status}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
                <div className="p-4 bg-white rounded-xl border border-primary/10 flex items-start gap-3 text-left">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">Roteamento Dinâmico Ativo</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      O sistema está realizando o join entre as tabelas e enviando os pacotes de dados 
                      diretamente para os caminhos <code>/municipios/[CO_MUNICIPIO]/schools/</code>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 space-y-4 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 opacity-20" />
                <p className="text-sm">Aguardando início do pipeline nacional...</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-4 bg-white rounded-xl border space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <ArrowRight className="h-3 w-3" /> FLUXO DE ENTRADA
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    CSV Nacional (Escolas) + CSV Nacional (Matrículas). Chave primária: <b>CO_ENTIDADE</b>.
                  </p>
               </div>
               <div className="p-4 bg-white rounded-xl border space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-green-600">
                    <ArrowRight className="h-3 w-3" /> FLUXO DE SAÍDA
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Documentos segmentados por <b>municipioId</b> no Firestore. Tenancy garantida.
                  </p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
