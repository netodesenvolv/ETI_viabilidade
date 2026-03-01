
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { useAuth, useFirestore, useUser } from "@/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Parâmetros para a Homologação do Administrador Geral
  const [targetCity, setTargetCity] = useState("Teixeira de Freitas")
  const [targetIbge, setTargetIbge] = useState("2932705")
  
  const router = useRouter()
  const { toast } = useToast()
  
  const auth = useAuth()
  const db = useFirestore()
  const { user, loading: authLoading } = useUser(auth)

  // Redirecionamento estável: monitora o usuário e o loading
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const ensureUserProfile = async (uid: string, userEmail: string, isInitialAdmin = false) => {
    if (!db) return;
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      // Se o usuário não existe, cria um perfil. 
      // Se for o seed do admin, já vincula ao município alvo da homologação.
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: userEmail.split('@')[0],
          email: userEmail,
          role: isInitialAdmin ? "Admin" : "Leitor",
          municipio: isInitialAdmin ? targetCity : "Aguardando Vínculo",
          municipioId: isInitialAdmin ? targetIbge : "",
          status: "Ativo",
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Erro ao garantir perfil:", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || loading) return;
    
    setError(null)
    setLoading(true)
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      // Garante que o perfil exista ao logar
      await ensureUserProfile(userCredential.user.uid, userCredential.user.email!)
      toast({ title: "Bem-vindo", description: "Acesso autorizado com sucesso." })
    } catch (error: any) {
      let message = "E-mail ou senha incorretos."
      if (error.code === 'auth/user-not-found') message = "Usuário não cadastrado."
      if (error.code === 'auth/wrong-password') message = "Senha incorreta."
      if (error.code === 'auth/invalid-credential') message = "Credenciais inválidas."
      
      setError(message)
      toast({ title: "Erro de Acesso", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSeedAdmin = async () => {
    if (!auth || !db || seeding) return;
    setSeeding(true)
    setError(null)
    
    // Credenciais do Administrador Geral para Homologação
    const adminEmail = "castroalvesneto@gmail.com"
    const adminPass = "paix2018+"

    try {
      // Tenta criar o usuário administrador geral
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass)
      await ensureUserProfile(userCredential.user.uid, userCredential.user.email!, true);
      
      setEmail(adminEmail); 
      setPassword(adminPass);
      
      toast({ 
        title: "Homologação Concluída", 
        description: "Administrador Geral criado e vinculado ao município alvo." 
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setEmail(adminEmail); 
        setPassword(adminPass);
        toast({ title: "Credenciais Preenchidas", description: "O Administrador Geral já possui cadastro." });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } finally {
      setSeeding(false)
    }
  }

  // Enquanto verifica a sessão, exibe apenas o loader
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    )
  }

  // Se já houver usuário, não renderiza o form para evitar loops visuais
  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
              <GraduationCap className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline font-bold text-primary">EduFin Insights</CardTitle>
          <CardDescription className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">
            Gestão de Viabilidade Financeira ETI
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive text-xs py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail Institucional</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nome@municipio.gov.br" 
                  className="pl-10 h-11" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha de Acesso</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10 h-11" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button type="submit" className="w-full h-11 font-bold text-lg" disabled={loading || seeding}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Acessar Sistema"}
            </Button>
            
            <div className="w-full relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-tighter">
                <span className="bg-white px-3 text-muted-foreground">Homologação de Administrador</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mb-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Cidado Alvo</Label>
                <Input className="h-8 text-xs font-medium" value={targetCity} onChange={e => setTargetCity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Cód. IBGE</Label>
                <Input className="h-8 text-xs font-mono" value={targetIbge} onChange={e => setTargetIbge(e.target.value)} />
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full gap-3 border-dashed h-14 bg-muted/50 hover:bg-muted" 
              onClick={handleSeedAdmin} 
              disabled={loading || seeding}
            >
              {seeding ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5 text-primary/60" />}
              <div className="text-left">
                <p className="text-xs font-bold leading-none text-slate-800">Seed de Administrador Geral</p>
                <p className="text-[10px] text-muted-foreground mt-1">Vincula o e-mail mestre à prefeitura alvo</p>
              </div>
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        © 2026 EduFin Insights • Homologação Exclusiva para Administradores
      </p>
    </div>
  )
}
