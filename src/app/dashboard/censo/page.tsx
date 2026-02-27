
"use client"

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Database, FileUp, CheckCircle2, FileText, Info, Loader2, Search, FilterX, Globe, Building2, Eye, MapPin } from "lucide-react";
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
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, setDoc, collection } from "firebase/firestore";
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
  const [consolidating, setConsolidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1);
  const [parsedSchools, setParsedSchools] = useState<ParsedSchool[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);
  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

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
      headers.forEach((header, index) => { row[header] = values[index]; });

      const schoolId = row.CO_ENTIDADE;
      if (!schoolId) continue;

      const parseNum = (val: any) => parseInt(val || "0", 10);
      const total_matriculas = parseNum(row.QT_MAT_BAS);
      const total_eti = parseNum(row.QT_MAT_INF_INT) + parseNum(row.QT_MAT_FUND_INT) + parseNum(row.QT_MAT_MED_INT);
      
      schools.push({
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
      });
    }
    return schools;
  };

  const handleStartImport = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Nenhum arquivo", description: "Selecione um CSV primeiro.", variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const schools = processCSV(text);
        setParsedSchools(schools);
        setUploading(false);
        setStep(2);
      } catch (err) {
        setUploading(false);
        toast({ title: "Erro no processamento", description: "Arquivo inválido.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const filteredData = useMemo(() => {
    return parsedSchools.filter(school => {
      const matchesSearch = school.nome.toLowerCase().includes(searchQuery.toLowerCase()) || school.codigo_inep.includes(searchQuery);
      const matchesMunicipio = municipioFilter === "" || school.municipio.toLowerCase().includes(municipioFilter.toLowerCase());
      const matchesDependencia = dependenciaFilter === "all" || school.tp_dependencia === dependenciaFilter;
      return matchesSearch && matchesMunicipio && matchesDependencia;
    });
  }, [parsedSchools, searchQuery, municipioFilter, dependenciaFilter]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalMat = filteredData.reduce((acc, s) => acc + s.total_matriculas, 0);
    const totalETI = filteredData.reduce((acc, s) => acc + s.total_eti, 0);
    return {
      totalMat,
      totalETI,
      percentETI: totalMat > 0 ? ((totalETI / totalMat) * 100).toFixed(1) : "0.0",
      count: filteredData.length,
      municipios: new Set(filteredData.map(s => s.municipio)).size
    };
  }, [filteredData]);

  const handleConsolidate = async () => {
    if (!db || !municipioId) {
      toast({
        title: "Município não identificado",
        description: "Seu perfil não possui um Código IBGE vinculado. Configure em 'Usuários' antes de consolidar.",
        variant: "destructive"
      });
      return;
    }

    setConsolidating(true);
    try {
      const promises = filteredData.map(school => {
        const schoolRef = doc(db, 'municipios', municipioId, 'schools', school.id);
        const data = {
          codigo_inep: school.codigo_inep,
          nome: school.nome,
          total_matriculas: school.total_matriculas,
          total_eti: school.total_eti,
          percentual_eti: school.percentual_eti,
          localizacao: school.localizacao.toLowerCase() === "rural" ? "rural" : "urbana",
          updatedAt: new Date().toISOString()
        };
        return setDoc(schoolRef, data, { merge: true }).catch(async (e) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: schoolRef.path, operation: 'write', requestResourceData: data }));
        });
      });
      await Promise.all(promises);
      toast({ title: "Dados Consolidados", description: `${filteredData.length} escolas salvas para ${profile?.municipio}.` });
      setStep(1); setParsedSchools([]); setFileName(null);
    } catch (e) {
      console.error(e);
    } finally {
      setConsolidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Censo Escolar</h2>
          <p className="text-muted-foreground">Consolidação de microdados INEP para o município</p>
        </div>
        {!municipioId && (
          <Badge variant="destructive" className="animate-pulse">
            <MapPin className="h-3 w-3 mr-2" /> Vínculo Municipal Pendente
          </Badge>
        )}
      </div>

      {!municipioId && (
        <Alert variant="destructive" className="bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Contexto Indefinido</AlertTitle>
          <AlertDescription>
            Sua conta não está vinculada a um município. Vá em <b>Usuários</b> e atualize seu perfil com o <b>Código IBGE</b> da cidade que deseja gerenciar.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Fonte de Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div 
              className="p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? <FileText className="h-8 w-8 text-primary" /> : <FileUp className="h-8 w-8 text-primary/40" />}
              <p className="text-xs font-medium text-center">{fileName || "Escolher CSV do INEP"}</p>
              <Input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>

            <Button className="w-full gap-2" disabled={uploading || !fileName || consolidating} onClick={handleStartImport}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Carregar Dados
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Visualização Prévia</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground gap-4 border-2 border-dashed rounded-xl bg-muted/10 text-center p-8">
                <Globe className="h-10 w-10 opacity-20" />
                <p className="text-sm">Aguardando upload de arquivo para consolidar em <b>{profile?.municipio || "Município não identificado"}</b></p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-2 px-3 rounded-lg border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Escolas</span>
                    <p className="text-lg font-bold">{stats?.count}</p>
                  </div>
                  <div className="bg-primary/5 p-2 px-3 rounded-lg border border-primary/10">
                    <span className="text-[10px] uppercase font-bold text-primary/70">Média % ETI</span>
                    <p className="text-lg font-bold text-primary">{stats?.percentETI}%</p>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-muted/80 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead>INEP</TableHead>
                          <TableHead>Escola</TableHead>
                          <TableHead className="text-right">Matrículas</TableHead>
                          <TableHead className="text-right">% ETI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((school) => (
                          <TableRow key={school.id}>
                            <TableCell className="font-mono text-xs">{school.codigo_inep}</TableCell>
                            <TableCell className="font-medium text-sm">{school.nome}</TableCell>
                            <TableCell className="text-right">{school.total_matriculas}</TableCell>
                            <TableCell className="text-right font-bold">{school.percentual_eti}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-700" />
                    <p className="text-green-800 font-bold text-sm">Pronto para salvar em {profile?.municipio}</p>
                  </div>
                  <Button onClick={handleConsolidate} disabled={consolidating} className="bg-green-700 hover:bg-green-800">
                    {consolidating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Consolidar no Banco de Dados
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
