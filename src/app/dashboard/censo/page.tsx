
"use client"

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, FileUp, CheckCircle2, FileText, Globe, Loader2, MapPin, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ParsedSchool {
  id: string;
  codigo_inep: string;
  nome: string;
  municipio: string;
  uf: string;
  localizacao: string;
  tp_dependencia: string;
  total_matriculas: number;
  total_eti: number;
  percentual_eti: number;
  matriculas: {
    creche_integral: number;
    creche_parcial: number;
    pre_integral: number;
    pre_parcial: number;
    ef_ai_integral: number;
    ef_ai_parcial: number;
    ef_af_integral: number;
    ef_af_parcial: number;
    eja_fundamental: number;
    especial_aee: number;
  };
}

export default function CensoAdminPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [step, setStep] = useState(1);
  const [parsedSchools, setParsedSchools] = useState<ParsedSchool[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  const [manualCity, setManualCity] = useState("");
  const [manualIbge, setManualIbge] = useState("");
  const [linking, setLinking] = useState(false);

  const handleManualLink = async () => {
    if (!db || !user || !manualIbge) return;
    setLinking(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        municipio: manualCity,
        municipioId: manualIbge,
        role: "Admin",
        status: "Ativo"
      }, { merge: true });
      toast({ title: "Vínculo Criado", description: "Recarregando dados do perfil..." });
      window.location.reload();
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao vincular município.", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const processCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    const schools: ParsedSchool[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lineToValues(lines[i], separator);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => { row[header] = values[index]; });
      
      if (!row.CO_ENTIDADE) continue;
      
      const qInt = (k: string) => parseInt(row[k] || "0", 10);
      
      const total_bas = qInt('QT_MAT_BAS');
      const creche_int = qInt('QT_MAT_INF_CRE_INT');
      const creche_tot = qInt('QT_MAT_INF_CRE');
      const pre_int = qInt('QT_MAT_INF_PRE_INT');
      const pre_tot = qInt('QT_MAT_INF_PRE');
      const ef_ai_int = qInt('QT_MAT_FUND_AI_INT');
      const ef_ai_tot = qInt('QT_MAT_FUND_AI');
      const ef_af_int = qInt('QT_MAT_FUND_AF_INT');
      const ef_af_tot = qInt('QT_MAT_FUND_AF');

      const total_eti = creche_int + pre_int + ef_ai_int + ef_af_int;
      
      schools.push({
        id: row.CO_ENTIDADE,
        codigo_inep: row.CO_ENTIDADE,
        nome: row.NO_ENTIDADE || row.nome || "Escola sem nome",
        municipio: row.NO_MUNICIPIO || "N/A",
        uf: row.SG_UF || "N/A",
        localizacao: row.TP_LOCALIZACAO === "2" ? "Rural" : "Urbana",
        tp_dependencia: row.TP_DEPENDENCIA || "3",
        total_matriculas: total_bas,
        total_eti,
        percentual_eti: total_bas > 0 ? Number(((total_eti / total_bas) * 100).toFixed(1)) : 0,
        matriculas: {
          creche_integral: creche_int,
          creche_parcial: Math.max(0, creche_tot - creche_int),
          pre_integral: pre_int,
          pre_parcial: Math.max(0, pre_tot - pre_int),
          ef_ai_integral: ef_ai_int,
          ef_ai_parcial: Math.max(0, ef_ai_tot - ef_ai_int),
          ef_af_integral: ef_af_int,
          ef_af_parcial: Math.max(0, ef_af_tot - ef_af_int),
          eja_fundamental: qInt('QT_MAT_EJA_FUND'),
          especial_aee: qInt('QT_MAT_ESP')
        }
      });
    }
    return schools;
  };

  const lineToValues = (line: string, sep: string) => {
    return line.split(sep).map(v => v.trim().replace(/"/g, ''));
  };

  const handleStartImport = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Atenção", description: "Selecione um arquivo primeiro.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const schools = processCSV(e.target?.result as string);
        setParsedSchools(schools);
        setStep(2);
      } catch (err) {
        toast({ title: "Erro", description: "Falha ao ler o arquivo estatístico.", variant: "destructive" });
      } finally { setUploading(false); }
    };
    reader.readAsText(file);
  };

  const handleConsolidate = async () => {
    if (!db || !municipioId) return;
    setConsolidating(true);
    try {
      // Chunking para garantir performance no município individual
      for (let i = 0; i < parsedSchools.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = parsedSchools.slice(i, i + 500);
        
        chunk.forEach(school => {
          const schoolRef = doc(db, 'municipios', municipioId, 'schools', school.id);
          const data = {
            codigo_inep: school.codigo_inep,
            nome: school.nome,
            total_matriculas: school.total_matriculas,
            total_eti: school.total_eti,
            percentual_eti: school.percentual_eti,
            localizacao: school.localizacao.toLowerCase() === "rural" ? "rural" : "urbana",
            tp_dependencia: school.tp_dependencia,
            matriculas: school.matriculas,
            updatedAt: new Date().toISOString()
          };
          batch.set(schoolRef, data, { merge: true });
        });
        
        await batch.commit();
      }

      toast({ title: "Dados Consolidados", description: `${parsedSchools.length} escolas atualizadas no banco municipal.` });
      setStep(1); setParsedSchools([]); setFileName(null);
    } catch (e) {
      toast({ title: "Erro na Consolidação", description: "Não foi possível gravar os dados.", variant: "destructive" });
    } finally { setConsolidating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Censo Escolar</h2>
          <p className="text-muted-foreground">Consolidação de microdados INEP 2025 para {profile?.municipio}</p>
        </div>
        {!municipioId && <Badge variant="destructive" className="animate-pulse py-1 gap-2"><MapPin className="h-3 w-3" /> Vínculo Municipal Pendente</Badge>}
      </div>

      {!municipioId && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-bold">Perfil Incompleto</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>Sua conta não tem um município vinculado. Informe os dados abaixo para gerenciar sua rede:</p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <Input placeholder="Nome da Cidade" value={manualCity} onChange={e => setManualCity(e.target.value)} className="bg-white border-red-200" />
              <Input placeholder="Cód. IBGE" value={manualIbge} onChange={e => setManualIbge(e.target.value)} className="bg-white border-red-200" />
              <Button onClick={handleManualLink} disabled={linking} variant="destructive" className="gap-2">
                {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Vincular Minha Conta
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader><CardTitle className="text-lg">Upload Local</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {fileName ? <FileText className="h-8 w-8 text-primary" /> : <FileUp className="h-8 w-8 text-primary/40" />}
              <p className="text-xs font-medium text-center">{fileName || "Escolher CSV Matrículas"}</p>
              <Input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { setFileName(e.target.files?.[0]?.name || null); setStep(1); }} />
            </div>
            <Button className="w-full gap-2" disabled={uploading || !fileName || consolidating} onClick={handleStartImport}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Carregar Dados
            </Button>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-[10px] text-blue-700 font-bold uppercase mb-1">Mapeamento INEP 2025</p>
              <p className="text-[10px] text-blue-600 leading-tight">O sistema reconhece as colunas: CO_ENTIDADE, QT_MAT_BAS e colunas de microdados integrais.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-lg">Visualização de Microdados</CardTitle></CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground gap-4 border-2 border-dashed rounded-xl bg-muted/10 text-center p-8">
                <Globe className="h-10 w-10 opacity-20" />
                <p className="text-sm">Aguardando arquivo estatístico para <b>{profile?.municipio || "sua rede"}</b></p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border rounded-xl overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead>INEP</TableHead>
                          <TableHead>Escola</TableHead>
                          <TableHead className="text-right">Total Matrículas</TableHead>
                          <TableHead className="text-right">Matrículas ETI</TableHead>
                          <TableHead className="text-right">% ETI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedSchools.map((school) => (
                          <TableRow key={school.id}>
                            <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                            <TableCell className="font-medium text-sm">{school.nome}</TableCell>
                            <TableCell className="text-right">{school.total_matriculas}</TableCell>
                            <TableCell className="text-right text-primary font-medium">{school.total_eti}</TableCell>
                            <TableCell className="text-right font-bold">{school.percentual_eti}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-green-800 font-bold text-sm flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Prontos para {profile?.municipio}</p>
                  <Button onClick={handleConsolidate} disabled={consolidating || !municipioId} className="bg-green-700 hover:bg-green-800">
                    {consolidating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
