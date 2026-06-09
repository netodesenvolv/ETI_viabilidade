"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Database, AlertTriangle, CheckCircle } from "lucide-react";
import { useFirestore, useAuth, useUser } from "@/firebase";
import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function MigracaoPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({ oldSchools: 0, oldExpenses: 0, oldMunicipioCount: 0 });
  const [checking, setChecking] = useState(true);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    async function checkData() {
      if (!db) return;
      try {
        // Verifica dados na raiz (antes de 8 de Abril)
        let oldSchools = 0;
        let oldExpenses = 0;
        try {
          const sSnap = await getDocs(collection(db, "schools"));
          oldSchools = sSnap.size;
        } catch (e) {}
        try {
          const eSnap = await getDocs(collection(db, "expenses"));
          oldExpenses = eSnap.size;
        } catch (e) {}

        // Verifica outros municipios
        let oldMunicipioCount = 0;
        try {
          const mSnap = await getDocs(collection(db, "municipios"));
          oldMunicipioCount = mSnap.size;
        } catch (e) {}

        setStats({ oldSchools, oldExpenses, oldMunicipioCount });
        if (oldSchools > 0 || oldExpenses > 0) {
          addLog(`Encontrados ${oldSchools} escolas e ${oldExpenses} despesas na estrutura antiga (raiz).`);
        } else {
          addLog(`Nenhum dado encontrado na estrutura antiga (raiz).`);
        }
        addLog(`Total de municípios registrados: ${oldMunicipioCount}`);
      } catch (e) {
        addLog(`Erro ao verificar banco: ${e}`);
      } finally {
        setChecking(false);
      }
    }
    checkData();
  }, [db]);

  const handleMigrateRoot = async () => {
    if (!db) return;
    setLoading(true);
    addLog("Iniciando migração dos dados da raiz para Teixeira de Freitas (2931350)...");
    
    try {
      const municipioId = "2931350";
      
      // Migrar escolas
      const schoolsSnap = await getDocs(collection(db, "schools"));
      if (schoolsSnap.size > 0) {
        addLog(`Migrando ${schoolsSnap.size} escolas...`);
        let batch = writeBatch(db);
        let count = 0;
        
        for (const schoolDoc of schoolsSnap.docs) {
          const newRef = doc(db, 'municipios', municipioId, 'schools', schoolDoc.id);
          batch.set(newRef, schoolDoc.data(), { merge: true });
          count++;
          if (count % 400 === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }
        }
        if (count % 400 !== 0) await batch.commit();
        addLog(`Escolas migradas com sucesso!`);
      }

      // Migrar despesas
      const expSnap = await getDocs(collection(db, "expenses"));
      if (expSnap.size > 0) {
        addLog(`Migrando ${expSnap.size} despesas...`);
        let batch = writeBatch(db);
        let count = 0;
        
        for (const expDoc of expSnap.docs) {
          const newRef = doc(db, 'municipios', municipioId, 'expenses', expDoc.id);
          batch.set(newRef, expDoc.data(), { merge: true });
          count++;
          if (count % 400 === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }
        }
        if (count % 400 !== 0) await batch.commit();
        addLog(`Despesas migradas com sucesso!`);
      }

      toast({ title: "Migração concluída", description: "Os dados antigos foram movidos para a nova estrutura." });
      addLog("✅ Migração finalizada. Você já pode voltar ao painel.");
    } catch (e: any) {
      addLog(`❌ Erro durante migração: ${e.message}`);
      toast({ title: "Erro", description: "Falha na migração.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeIbge = async () => {
    if (!db || !user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        municipioId: "Teixeira de Freitas"
      }, { merge: true });
      toast({ title: "Perfil atualizado", description: "Município alterado para texto. Recarregue a página." });
    } catch (e) {}
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h2 className="text-3xl font-bold text-primary">Diagnóstico de Banco de Dados</h2>
        <p className="text-muted-foreground">Ferramenta para recuperar dados de estruturas antigas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Status do Banco
          </CardTitle>
          <CardDescription>Análise das informações presentes no Firebase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {checking ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando coleções...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-xs text-muted-foreground uppercase">Escolas (Raiz)</p>
                  <p className="text-2xl font-bold">{stats.oldSchools}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-xs text-muted-foreground uppercase">Despesas (Raiz)</p>
                  <p className="text-2xl font-bold">{stats.oldExpenses}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg border">
                  <p className="text-xs text-muted-foreground uppercase">Cidades</p>
                  <p className="text-2xl font-bold">{stats.oldMunicipioCount}</p>
                </div>
              </div>

              {(stats.oldSchools > 0 || stats.oldExpenses > 0) && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div className="ml-2">
                    <p className="font-bold text-amber-800">Dados Antigos Encontrados!</p>
                    <p className="text-sm text-amber-700">Encontramos dados da versão anterior do sistema. Clique no botão abaixo para migrá-los para Teixeira de Freitas.</p>
                    <Button onClick={handleMigrateRoot} disabled={loading} className="mt-3 bg-amber-600 hover:bg-amber-700 text-white">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Restaurar Dados Antigos
                    </Button>
                  </div>
                </Alert>
              )}

              {stats.oldMunicipioCount > 1 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <div className="ml-2">
                    <p className="font-bold text-blue-800">Múltiplos Municípios Detectados</p>
                    <p className="text-sm text-blue-700">Existem outras pastas de municípios no banco. Se os seus dados sumiram, eles podem estar salvos com o ID de texto ("Teixeira de Freitas") ao invés do código IBGE.</p>
                    <Button onClick={handleChangeIbge} variant="outline" className="mt-3 border-blue-300 text-blue-700">
                      Tentar Acessar Pasta "Teixeira de Freitas" (Texto)
                    </Button>
                  </div>
                </Alert>
              )}

              <div className="mt-6 p-4 bg-slate-900 text-green-400 font-mono text-xs rounded-lg h-48 overflow-y-auto">
                <p>--- LOGS DO SISTEMA ---</p>
                {logs.map((log, i) => (
                  <p key={i}>{log}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
