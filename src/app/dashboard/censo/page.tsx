
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, FileUp, CheckCircle2, FileText, Globe, Loader2, MapPin, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, setDoc, writeBatch, collection, getDocs, deleteField, query, where, orderBy, limit, startAfter, documentId, getCountFromServer } from "firebase/firestore";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useMunicipality, useExercicioRefs } from "@/providers/municipality-provider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

interface IBGECity {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
        nome: string;
      }
    }
  }
}

interface ParsedSchool {
  id: string;
  codigo_inep: string;
  nome: string;
  municipio: string;
  municipio_id?: string;
  uf: string;
  localizacao: string;
  tp_dependencia: string;
  total_matriculas: number;
  total_eti: number;
  percentual_eti: number;
  total_eti_verificado?: number | null;
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
    aee?: number;
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
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  const { activeMunicipioId, activeMunicipioName, exercicio, censoAno, statusExercicio, exercicioExiste, isViewOnly } = useMunicipality();
  const municipioId = activeMunicipioId || profile?.municipioId;
  const exRefs = useExercicioRefs(municipioId);

  // Estados para inserção manual
  const [manualSchoolName, setManualSchoolName] = useState("");
  const [manualSchoolInep, setManualSchoolInep] = useState("");
  const [manualTotalBas, setManualTotalBas] = useState("0");
  const [manualTotalEti, setManualTotalEti] = useState("0");

  const handleAddManualSchool = () => {
    if (!manualSchoolName || !manualSchoolInep) {
      toast({ title: "Atenção", description: "Nome e INEP são obrigatórios.", variant: "destructive" });
      return;
    }
    
    const bas = parseInt(manualTotalBas) || 0;
    const eti = parseInt(manualTotalEti) || 0;

    // Escola que já está na lista: mantém as matrículas do Censo e grava só o tempo integral verificado
    const existente = parsedSchools.find(s => s.codigo_inep === manualSchoolInep);
    if (existente) {
      setParsedSchools(prev => prev.map(s => s.codigo_inep === manualSchoolInep
        ? { ...s, nome: manualSchoolName || s.nome, total_eti_verificado: eti }
        : s));
      setStep(2);
      setManualSchoolName(""); setManualSchoolInep(""); setManualTotalBas("0"); setManualTotalEti("0");
      toast({ title: "Tempo integral corrigido", description: `ETI verificado = ${eti}. As matrículas do Censo foram mantidas. Confirme a consolidação.` });
      return;
    }
    
    const newSchool: ParsedSchool = {
      id: manualSchoolInep,
      codigo_inep: manualSchoolInep,
      nome: manualSchoolName,
      municipio: profile?.municipio || "N/A",
      uf: profile?.uf || "N/A",
      localizacao: "urbana",
      tp_dependencia: "3", // Municipal
      total_matriculas: bas,
      total_eti: eti,
      percentual_eti: bas > 0 ? Number(((eti / bas) * 100).toFixed(1)) : 0,
      matriculas: {
        creche_integral: 0, creche_parcial: 0,
        pre_integral: 0, pre_parcial: 0,
        ef_ai_integral: 0, ef_ai_parcial: 0,
        ef_af_integral: 0, ef_af_parcial: 0,
        eja_fundamental: 0, especial_aee: 0,
      }
    };

    setParsedSchools(prev => {
      // Remover se já existir com o mesmo INEP e adicionar atualizada
      const filtered = prev.filter(s => s.codigo_inep !== manualSchoolInep);
      return [newSchool, ...filtered];
    });
    
    setStep(2);
    setManualSchoolName("");
    setManualSchoolInep("");
    setManualTotalBas("0");
    setManualTotalEti("0");
    toast({ title: "Escola Adicionada", description: "Revise os dados na tabela e confirme a consolidação." });
  };

  const handleLoadExistingSchools = async () => {
    if (!db || !municipioId) return;
    try {
      if (!exRefs.schoolsRef) return;
      const schoolsSnapshot = await getDocs(exRefs.schoolsRef);
      const schools: ParsedSchool[] = schoolsSnapshot.docs.map(d => ({ ...(d.data() as ParsedSchool), id: d.id }));
      if (schools.length > 0) {
        setParsedSchools(schools);
        setStep(2);
        toast({ title: "Escolas Carregadas", description: `Exercício ${exercicio}: para corrigir o tempo integral, use a aba Manual com o mesmo INEP.` });
      } else {
        toast({ title: "Aviso", description: "Nenhuma escola encontrada para este município." });
      }
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível carregar as escolas.", variant: "destructive" });
    }
  };

  // Estados para busca de cidades via API IBGE
  const [manualCity, setManualCity] = useState("");
  const [manualIbge, setManualIbge] = useState("");
  const [manualUf, setManualUf] = useState("");
  const [cityResults, setCityResults] = useState<IBGECity[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    const searchCities = async () => {
      if (manualCity.length < 3 || manualIbge !== "") {
        setCityResults([]);
        return;
      }
      setIsSearchingCity(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${manualCity}`);
        const data = await response.json();
        const filtered = data
          .filter((c: any) => c.nome.toLowerCase().includes(manualCity.toLowerCase()))
          .slice(0, 5);
        setCityResults(filtered);
      } catch (e) {
        console.error("Erro ao buscar cidades", e);
      } finally {
        setIsSearchingCity(false);
      }
    };

    const timer = setTimeout(searchCities, 400);
    return () => clearTimeout(timer);
  }, [manualCity, manualIbge]);

  const handleSelectCity = (city: IBGECity) => {
    setManualCity(city.nome);
    setManualIbge(city.id.toString());
    setManualUf(city.microrregiao.mesorregiao.UF.sigla);
    setCityResults([]);
  }

  const handleManualLink = async () => {
    if (!db || !user || !manualIbge) return;
    setLinking(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        municipio: manualCity,
        municipioId: manualIbge,
        uf: manualUf,
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
    const separator = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
    const schools: ParsedSchool[] = [];
    let descartadas = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => { row[header] = values[index]; });
      
      if (!row.CO_ENTIDADE) continue;
      // Proteção: só aceita escolas do município ativo (evita gravar a base nacional inteira)
      if (row.CO_MUNICIPIO && municipioId && String(row.CO_MUNICIPIO) !== String(municipioId)) { descartadas++; continue; }
      
      const qInt = (k: string) => parseInt(row[k] || "0", 10);
      
      // Modelo de cálculo unificado com o Pipeline Nacional
      const total_bas = qInt('QT_MAT_BAS');
      const total_eti = qInt('QT_MAT_INF_CRE_INT') + qInt('QT_MAT_INF_PRE_INT') + qInt('QT_MAT_FUND_AI_INT') + qInt('QT_MAT_FUND_AF_INT');
      
      schools.push({
        id: row.CO_ENTIDADE,
        codigo_inep: row.CO_ENTIDADE,
        nome: row.NO_ENTIDADE || row.nome || "Escola sem nome",
        municipio: row.NO_MUNICIPIO || "N/A",
        municipio_id: row.CO_MUNICIPIO || String(municipioId || ""),
        uf: row.SG_UF || "N/A",
        localizacao: row.TP_LOCALIZACAO === "2" ? "rural" : "urbana",
        tp_dependencia: row.TP_DEPENDENCIA || "3",
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
          especial_aee: qInt('QT_MAT_ESP'),
          // AEE no contraturno (dupla matrícula), quando a coluna existir no arquivo
          aee: qInt('QT_MAT_AEE')
        }
      });
    }
    if (descartadas > 0) {
      toast({ title: "Arquivo com outros municípios", description: `${descartadas.toLocaleString('pt-BR')} escolas de outros municípios foram ignoradas. Ficaram ${schools.length} escolas de ${activeMunicipioName || 'seu município'}.` });
    }
    return schools;
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
    if (!db || !municipioId || !exRefs.schoolsRef) return;
    setConsolidating(true);
    try {
      for (let i = 0; i < parsedSchools.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = parsedSchools.slice(i, i + 500);
        
        chunk.forEach(school => {
          const schoolRef = doc(exRefs.schoolsRef!, school.id);
          const data = {
            codigo_inep: school.codigo_inep,
            nome: school.nome,
            total_matriculas: school.total_matriculas,
            total_eti: school.total_eti,
            percentual_eti: school.percentual_eti,
            localizacao: school.localizacao.toLowerCase() === "rural" ? "rural" : "urbana",
            tp_dependencia: school.tp_dependencia,
            municipio_id: school.municipio_id || String(municipioId),
            matriculas: school.matriculas,
            ...(school.total_eti_verificado !== undefined && school.total_eti_verificado !== null ? { total_eti_verificado: school.total_eti_verificado } : {}),
            censoAno,
            copiadoDe: deleteField(),
            updatedAt: new Date().toISOString()
          };
          batch.set(schoolRef, data, { merge: true });
        });
        
        await batch.commit();
      }
      // Importação de arquivo completo: remove as escolas que só existiam como cópia do exercício anterior
      let removidas = 0;
      if (fileName && parsedSchools.length > 1) {
        const atuais = await getDocs(exRefs.schoolsRef);
        const ids = new Set(parsedSchools.map(s => s.id));
        const sobras = atuais.docs.filter(d => (d.data() as any).copiadoDe && !ids.has(d.id));
        for (let i = 0; i < sobras.length; i += 400) {
          const b = writeBatch(db);
          sobras.slice(i, i + 400).forEach(d => b.delete(d.ref));
          await b.commit();
        }
        removidas = sobras.length;
      }
      if (exRefs.metaRef && !exercicioExiste) {
        await setDoc(exRefs.metaRef, { ano: exercicio, censoAno, status: exercicio >= new Date().getFullYear() + 1 ? 'projecao' : 'realizado', origem: 'censo', criadoEm: new Date().toISOString() }, { merge: true });
      }

      toast({ title: "Dados Consolidados", description: `${parsedSchools.length} escolas gravadas no Exercício ${exercicio} (Censo ${censoAno}).${removidas ? ` ${removidas} escolas copiadas do exercício anterior foram removidas.` : ""}` });
      setStep(1); setParsedSchools([]); setFileName(null);
    } catch (e) {
      toast({ title: "Erro na Consolidação", description: "Não foi possível gravar os dados.", variant: "destructive" });
    } finally { setConsolidating(false); }
  };

  // ---------- Limpeza: remove do exercício as escolas que não são deste município ----------
  const [verificando, setVerificando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [progressoLimpeza, setProgressoLimpeza] = useState(0);
  const [diagnosticoBase, setDiagnosticoBase] = useState<{ total: number; manter: number; remover: number; matriculasMantidas: number; municipaisMantidas: number } | null>(null);

  const handleVerificarBase = async () => {
    if (!exRefs.schoolsRef || !municipioId) return;
    setVerificando(true);
    try {
      const total = (await getCountFromServer(exRefs.schoolsRef)).data().count;
      const daRede = await getDocs(query(exRefs.schoolsRef, where('municipio_id', '==', String(municipioId))));
      const manter = daRede.size;
      let matriculasMantidas = 0, municipaisMantidas = 0;
      daRede.docs.forEach(d => {
        const x: any = d.data();
        if (String(x.tp_dependencia ?? '3') === '3') { municipaisMantidas++; matriculasMantidas += Number(x.total_matriculas) || 0; }
      });
      setDiagnosticoBase({ total, manter, remover: total - manter, matriculasMantidas, municipaisMantidas });
    } catch (e: any) {
      toast({ title: "Erro ao verificar", description: e.message, variant: "destructive" });
    } finally { setVerificando(false); }
  };

  const handleLimparBase = async () => {
    if (!db || !exRefs.schoolsRef || !municipioId || !diagnosticoBase || diagnosticoBase.manter === 0) return;
    setLimpando(true); setProgressoLimpeza(0);
    let apagadas = 0;
    try {
      let ultimo: any = null;
      // Percorre a coleção em páginas e apaga tudo que não é do município ativo
      while (true) {
        const q = ultimo
          ? query(exRefs.schoolsRef, orderBy(documentId()), startAfter(ultimo), limit(400))
          : query(exRefs.schoolsRef, orderBy(documentId()), limit(400));
        const snap = await getDocs(q);
        if (snap.empty) break;
        const lixo = snap.docs.filter(d => String((d.data() as any).municipio_id || '') !== String(municipioId));
        if (lixo.length > 0) {
          const b = writeBatch(db);
          lixo.forEach(d => b.delete(d.ref));
          await b.commit();
          apagadas += lixo.length;
          setProgressoLimpeza(apagadas);
        }
        ultimo = snap.docs[snap.docs.length - 1];
        if (snap.size < 400) break;
      }
      toast({ title: "Base limpa", description: `${apagadas.toLocaleString('pt-BR')} escolas de outros municípios removidas do Exercício ${exercicio}.` });
      await handleVerificarBase();
    } catch (e: any) {
      toast({ title: "Erro na limpeza", description: `${apagadas} removidas antes do erro. Clique de novo para continuar. ${e.message}`, variant: "destructive" });
    } finally { setLimpando(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-3xl font-headline font-bold text-primary">Censo Escolar</h2>
        <p className="text-muted-foreground">Consolidação de microdados INEP para {activeMunicipioName || profile?.municipio} — o Censo {censoAno} alimenta o Exercício {exercicio}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className={`flex flex-col gap-0.5 p-2 rounded-lg border ${statusExercicio === 'projecao' ? 'bg-amber-50 border-amber-200' : 'bg-muted/30'}`}>
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Destino da importação</span>
          <span className="text-sm font-bold">Exercício {exercicio} · Censo {censoAno}</span>
          <span className="text-[10px] text-muted-foreground">Para trocar, use o seletor de exercício no topo da tela.</span>
        </div>
        {!municipioId && <Badge variant="destructive" className="animate-pulse py-1 gap-2"><MapPin className="h-3 w-3" /> Vínculo Municipal Pendente</Badge>}
      </div>
      </div>

      {!municipioId && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-bold">Perfil Incompleto</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>Sua conta não tem um município vinculado. Informe o nome da cidade abaixo:</p>
            <div className="flex flex-col space-y-2 max-w-xl relative">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input 
                    placeholder="Nome da Cidade (ex: Teixeira de Freitas)" 
                    value={manualCity} 
                    onChange={e => { setManualCity(e.target.value); setManualIbge(""); }} 
                    className="bg-white border-red-200"
                  />
                  {isSearchingCity && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-red-400" />}
                </div>
                <Input placeholder="Cód. IBGE" value={manualIbge} readOnly className="bg-muted border-red-200 w-full sm:w-32 font-mono text-xs" />
                <Button onClick={handleManualLink} disabled={linking || !manualIbge} variant="destructive" className="gap-2">
                  {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Vincular Conta
                </Button>
              </div>

              {cityResults.length > 0 && (
                <Card className="absolute z-50 w-full top-12 shadow-xl border-red-200 overflow-hidden">
                  <div className="p-1">
                    {cityResults.map((city) => (
                      <button
                        key={city.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 transition-colors flex justify-between items-center"
                        onClick={() => handleSelectCity(city)}
                      >
                        <span className="font-medium">{city.nome} - {city.microrregiao.mesorregiao.UF.sigla}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{city.id}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Tabs defaultValue="upload" className="lg:col-span-1 h-fit">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="upload">CSV</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <Card>
              <CardHeader><CardTitle className="text-lg">Upload Local</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {fileName ? <FileText className="h-8 w-8 text-primary" /> : <FileUp className="h-8 w-8 text-primary/40" />}
                  <p className="text-xs font-medium text-center">{fileName || "Escolher CSV"}</p>
                  <Input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { setFileName(e.target.files?.[0]?.name || null); setStep(1); }} />
                </div>
                <Button className="w-full gap-2" disabled={uploading || !fileName || consolidating} onClick={handleStartImport}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Carregar Dados
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader><CardTitle className="text-lg">Inserção Manual</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">INEP da Escola</Label>
                  <Input value={manualSchoolInep} onChange={e => setManualSchoolInep(e.target.value)} placeholder="Ex: 33001234" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nome da Escola</Label>
                  <Input value={manualSchoolName} onChange={e => setManualSchoolName(e.target.value)} placeholder="Ex: Escola Municipal" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Total Matrículas</Label>
                    <Input type="number" value={manualTotalBas} onChange={e => setManualTotalBas(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Matrículas ETI (verificado pela rede)</Label>
                    <Input type="number" value={manualTotalEti} onChange={e => setManualTotalEti(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full gap-2 mt-2" onClick={handleAddManualSchool}>
                  Adicionar Escola
                </Button>
                
                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full text-xs" onClick={handleLoadExistingSchools}>
                    Puxar Escolas do Exercício {exercicio}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2">Para corrigir o tempo integral informado pelo INEP: puxe as escolas, digite o mesmo INEP e o número verificado. As matrículas do Censo são mantidas.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                          <TableHead className="text-right">ETI (INEP)</TableHead>
                          <TableHead className="text-right">ETI verificado</TableHead>
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
                            <TableCell className="text-right font-medium">{school.total_eti_verificado ?? "—"}</TableCell>
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

      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader>
          <CardTitle className="text-lg text-orange-800">Limpeza da base do Exercício {exercicio}</CardTitle>
          <CardDescription>
            Use quando escolas de outros municípios foram gravadas por engano em {activeMunicipioName || profile?.municipio}.
            Ficam apenas as escolas com o código IBGE do município ({municipioId}). Antes de limpar, rode o Importador Nacional (Pipeline) neste mesmo exercício.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="gap-2" onClick={handleVerificarBase} disabled={verificando || limpando || !municipioId}>
            {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} 1. Verificar a base
          </Button>
          {diagnosticoBase && (
            <div className="rounded-lg border bg-white p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Escolas gravadas no exercício</span><b>{diagnosticoBase.total.toLocaleString('pt-BR')}</b></div>
              <div className="flex justify-between"><span>Escolas de {activeMunicipioName || 'seu município'} (ficam)</span><b className="text-green-700">{diagnosticoBase.manter.toLocaleString('pt-BR')}</b></div>
              <div className="flex justify-between pl-4 text-xs text-muted-foreground"><span>das quais municipais / matrículas</span><span>{diagnosticoBase.municipaisMantidas} escolas · {diagnosticoBase.matriculasMantidas.toLocaleString('pt-BR')} matrículas</span></div>
              <div className="flex justify-between"><span>Escolas de outros municípios (serão apagadas)</span><b className="text-destructive">{diagnosticoBase.remover.toLocaleString('pt-BR')}</b></div>
              {diagnosticoBase.manter === 0 && (
                <p className="text-destructive text-xs pt-2">Nenhuma escola deste município foi encontrada com o código IBGE. Rode primeiro o Importador Nacional neste exercício; só depois faça a limpeza.</p>
              )}
            </div>
          )}
          {diagnosticoBase && diagnosticoBase.manter > 0 && diagnosticoBase.remover > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="gap-2 bg-orange-600 hover:bg-orange-700" disabled={limpando}>
                  {limpando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {limpando ? `Apagando... ${progressoLimpeza.toLocaleString('pt-BR')}` : `2. Apagar ${diagnosticoBase.remover.toLocaleString('pt-BR')} escolas de outros municípios`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar a limpeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Serão apagadas {diagnosticoBase.remover.toLocaleString('pt-BR')} escolas do Exercício {exercicio} que não pertencem a {activeMunicipioName}.
                    Ficam {diagnosticoBase.manter} escolas do município. Não dá para desfazer, mas elas não são deste município.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLimparBase} className="bg-orange-600">Sim, apagar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

