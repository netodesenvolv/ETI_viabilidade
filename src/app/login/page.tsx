
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2, Lock, Mail, ShieldCheck, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"
import { useAuth, useFirestore, useUser } from "@/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [targetCity, setTargetCity] = useState("Teixeira de Freitas")
  const [targetIbge, setTargetIbge] = useState("2932705")
  const router = useRouter()
  const { toast } = useToast()
  
  const auth = useAuth()
  const db = useFirestore()
  const { user, loading: authLoading } = useUser(auth)

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const ensureUserProfile = async (uid: string, userEmail: string) => {
    if (!db) return;
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name: userEmail.split('@')[0],
        email: userEmail,
        role: "Admin",
        municipio: targetCity,
        municipioId: targetIbge,
        status: "Ativo",
        createdAt: new Date().toISOString()
      }, { merge: true });
      return true;
    }
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || !db) {
      toast({ title: "Aguarde", description: "O serviço Firebase está inicializando.", variant: "destructive" });
      return;
    }

    setLoading(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      await ensureUserProfile(userCredential.user.uid, userCredential.user.email!)
      toast({
        title: "Sucesso",
        description: "Acesso liberado.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: "E-mail ou senha inválidos.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSeedAdmin = async () => {
    if (!auth || !db) return;
    setSeeding(true)
    const adminEmail = "castroalvesneto@gmail.com"
    const adminPass = "paix2018+"

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass)
      await ensureUserProfile(userCredential.user.uid, userCredential.user.email!);
      toast({ title: "Admin Criado", description: `Usuário ${adminEmail} configurado.` });
      setEmail(adminEmail); setPassword(adminPass);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setEmail(adminEmail); setPassword(adminPass);
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
    } finally {
      setSeeding(false)
    }
  }

  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-xl">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-headline font-bold">EduFin Insights</CardTitle>
          <CardDescription>Plataforma de Viabilidade Financeira ETI</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="nome@municipio.gov.br" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full font-bold" disabled={loading || seeding}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Acessar Sistema"}
            </Button>
            
            <div className="w-full relative py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Vínculo Municipal</span></div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full mb-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Cidade Alvo</Label>
                <Input className="h-7 text-xs" value={targetCity} onChange={e => setTargetCity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Cód. IBGE</Label>
                <Input className="h-7 text-xs" value={targetIbge} onChange={e => setTargetIbge(e.target.value)} />
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full gap-2 border-dashed h-12" onClick={handleSeedAdmin} disabled={loading || seeding}>
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : user ? <UserCheck className="h-4 w-4 text-green-600" /> : <ShieldCheck className="h-4 w-4" />}
              <div className="text-left">
                <p className="text-xs font-bold leading-none">{user ? "Sessão Ativa" : "Criar Admin de Teste"}</p>
                <p className="text-[10px] text-muted-foreground">Acesso rápido para homologação</p>
              </div>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
