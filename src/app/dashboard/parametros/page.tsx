
"use client"

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Info, ScrollText, Utensils, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { FundingParameters } from "@/types";

const VAAF_LABELS: Record<string, string> = {
  A1: "Creche pública — Integral (7h+)",
  A2: "Creche pública — Parcial (até 4h)",
  A3: "Creche conveniada — Integral",
  A4: "Creche conveniada — Parcial",
  B1: "Pré-escola pública — Integral (ETI)",
  B2: "Pré-escola pública — Parcial",
  C1: "EF Anos Iniciais — Integral (ETI 7h+)",
  C2: "EF Anos Iniciais — Parcial",
  D1: "EF Anos Finais — Integral (ETI 7h+)",
  D2: "EF Anos Finais — Parcial",
  E1: "EJA Fundamental",
  E2: "EJA Médio",
  F1: "Ed. Especial / AEE (adicional)",
  G1: "Multiplicador: Indígena/Quilombola",
  G2: "Multiplicador: Campo/Rural",
};

export default function ParametrosPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Firebase
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser(auth);

  // Perfil e Município
  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const municipioId = profile?.municipioId;

  // Carregar Parâmetros do Firestore
  const paramsRef = useMemo(() => (db && municipioId ? doc(db, 'municipios', municipioId, 'config', 'parameters') : null), [db, municipioId]);
  const { data: dbParams, loading: paramsLoading } = useDoc(paramsRef);

  // Estado local para edição
  const [localParams, setLocalParams] = useState<FundingParameters>(DEFAULT_PARAMETERS);

  // Sincronizar estado local com o banco de dados quando carregar
  useEffect(() => {
    if (dbParams) {
      setLocalParams(dbParams as FundingParameters);
    }
  }, [dbParams]);

  const handleSave = () => {
    if (!db || !municipioId) {
      toast({
        title: "Erro de Contexto",
        description: "Município não identificado.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    const docRef = doc(db, 'municipios', municipioId, 'config', 'parameters');
    
    setDoc(docRef, {
      ...localParams,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email
    }, { merge: true })
      .then(() => {
        toast({
          title: "Parâmetros salvos",
          description: "As configurações foram atualizadas no banco de dados do município.",
        });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: localParams,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setIsSaving(false));
  };

  const updateFator = (key: keyof FundingParameters['fatores'], val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0;
    setLocalParams(prev => ({
      ...prev,
      fatores: { ...prev.fatores, [key]: num }
    }));
  };

  const updatePnae = (key: keyof FundingParameters['pnae'], val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0;
    setLocalParams(prev => ({
      ...prev,
      pnae: { ...prev.pnae, [key]: num }
    }));
  };

  if (paramsLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground">Carregando parâmetros...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Parâmetros de Financiamento</h2>
          <p className="text-muted-foreground">Configuração dos valores de repasse para o exercício 2026 em {profile?.municipio}</p>
        </div>
        <Button onClick={handleSave} className="gap-2 shadow-lg shadow-primary/20" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Tabs defaultValue="fundeb" className="space-y-4">
        <TabsList className="bg-white p-1 border shadow-sm w-full md:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="fundeb">FUNDEB VAAF/VAAT</TabsTrigger>
          <TabsTrigger value="pnae">PNAE / PNATE</TabsTrigger>
          <TabsTrigger value="mde">MDE / Outros</TabsTrigger>
        </TabsList>

        <TabsContent value="fundeb">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Tabela VAAF e VAAT 2026</CardTitle>
                </div>
                <CardDescription>Valores base e fatores de ponderação (Resolução vigente)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                    <Label htmlFor="vaaf" className="text-xs uppercase tracking-wider text-muted-foreground">VAAf Base 2026 (R$)</Label>
                    <Input 
                      id="vaaf" 
                      className="text-lg font-bold font-mono" 
                      value={localParams.vaaf_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                        setLocalParams(prev => ({ ...prev, vaaf_base: val }));
                      }} 
                    />
                  </div>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                    <Label htmlFor="vaat" className="text-xs uppercase tracking-wider text-muted-foreground">Complementação VAAT Estimada (R$)</Label>
                    <Input 
                      id="vaat" 
                      className="text-lg font-bold font-mono" 
                      value={localParams.vaat_total_rede.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                        setLocalParams(prev => ({ ...prev, vaat_total_rede: val }));
                      }}
                    />
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[80px]">Código</TableHead>
                          <TableHead>Segmento / Etapa de Ensino</TableHead>
                          <TableHead className="text-right w-[180px]">Fator de Ponderação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(localParams.fatores).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-mono text-xs font-bold text-primary">{key}</TableCell>
                            <TableCell className="text-sm">{VAAF_LABELS[key] || key}</TableCell>
                            <TableCell className="text-right">
                              <Input 
                                className="w-24 ml-auto h-8 text-right font-mono" 
                                value={value.toString().replace('.', ',')} 
                                onChange={(e) => updateFator(key as any, e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pnae">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Alimentação Escolar (PNAE 2026)</CardTitle>
              </div>
              <CardDescription>Valores per capita ajustados para o município</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      PNAE (R$/dia por aluno)
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <Label>Creche e Ensino Integral (7h+)</Label>
                        <Input 
                          className="w-24 h-8 text-right" 
                          value={localParams.pnae.integral_dia.toString().replace('.', ',')} 
                          onChange={(e) => updatePnae('integral_dia', e.target.value)}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>Pré-escola Parcial</Label>
                        <Input 
                          className="w-24 h-8 text-right" 
                          value={localParams.pnae.pre_parcial_dia.toString().replace('.', ',')}
                          onChange={(e) => updatePnae('pre_parcial_dia', e.target.value)}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>EF/EM Parcial</Label>
                        <Input 
                          className="w-24 h-8 text-right" 
                          value={localParams.pnae.ef_parcial_dia.toString().replace('.', ',')}
                          onChange={(e) => updatePnae('ef_parcial_dia', e.target.value)}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>EJA</Label>
                        <Input 
                          className="w-24 h-8 text-right" 
                          value={localParams.pnae.eja_dia.toString().replace('.', ',')}
                          onChange={(e) => updatePnae('eja_dia', e.target.value)}
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <Label>Indígenas e Quilombolas</Label>
                        <Input 
                          className="w-24 h-8 text-right" 
                          value={localParams.pnae.indigena_dia.toString().replace('.', ',')}
                          onChange={(e) => updatePnae('indigena_dia', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Calendário e Outros</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <Label>Dias Letivos (Padrão)</Label>
                        <Input 
                          className="w-24 h-8 text-right" 
                          value={localParams.pnae.dias_letivos.toString()}
                          onChange={(e) => updatePnae('dias_letivos', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mde">
           <Card>
            <CardHeader>
              <CardTitle className="text-lg">MDE e Recursos Próprios</CardTitle>
              <CardDescription>Aportes anuais do município</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>MDE Líquido para ETI (Anual R$)</Label>
                  <Input 
                    placeholder="1.200.000,00" 
                    value={localParams.mde_liquido_eti.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setLocalParams(prev => ({ ...prev, mde_liquido_eti: val }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quota Salário Educação (QSE R$)</Label>
                  <Input 
                    placeholder="180.000,00" 
                    value={localParams.qse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setLocalParams(prev => ({ ...prev, qse: val }));
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
