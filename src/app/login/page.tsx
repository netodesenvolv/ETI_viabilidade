"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2, Lock, Mail, ShieldCheck, MapPin, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { useAuth, useFirestore } from "@/firebase"
import { doc, setDoc } from "firebase/firestore"
import { firebaseConfig } from "@/firebase/config"
import Link from "next/link"

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) {
      toast({
        title: "Erro de inicialização",
        description: "O serviço de autenticação não está pronto. Verifique o console.",
        variant: "destructive",
      })
      return
    }

    if (firebaseConfig.apiKey === "AIzaSy...") {
      toast({
        title: "Configuração Pendente",
        description: "As chaves do Firebase ainda não foram sincronizadas. Por favor, aguarde alguns instantes e atualize a página.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Erro no login:", error)
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSeedAdmin = async () => {
    if (!auth || !db) {
      toast({
        title: "Serviços indisponíveis",
        description: "Firebase não inicializado corretamente.",
        variant: "destructive",
      })
      return
    }

    if (firebaseConfig.apiKey === "AIzaSy...") {
      toast({
        title: "Chave Inválida",
        description: "A API Key ainda é um placeholder. O Studio precisa sincronizar o projeto.",
        variant: "destructive",
      })
      return
    }

    setSeeding(true)
    
    const adminEmail = "castroalvesneto@gmail.com"
    const adminPass = "paix2018+"

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass)
      const user = userCredential.user

      await setDoc(doc(db, "users", user.uid), {
        name: "Administrador Geral",
        email: adminEmail,
        role: "Admin",
        municipio: targetCity,
        municipioId: targetIbge,
        status: "Ativo",
        createdAt: new Date().toISOString()
      })

      toast({
        title: "Administrador Criado!",
        description: `Perfil configurado para ${targetCity}.`,
      })
      
      setEmail(adminEmail)
      setPassword(adminPass)
    } catch (error: any) {
      console.error("Erro no seeding:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          title: "Atenção",
          description: "Este administrador já está cadastrado. Tente fazer o login.",
        })
        setEmail(adminEmail)
        setPassword(adminPass)
      } else {
        toast({
          title: "Erro na configuração",
          description: error.message || "Verifique se o Auth está ativado no console.",
          variant: "destructive",
        })
      }
    } finally {
      setSeeding(false)
    }
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
          <CardDescription>Entre com suas credenciais para acessar a plataforma</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nome@municipio.gov.br" 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full font-bold" disabled={loading || seeding}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Acessar Sistema"}
            </Button>
            
            <div className="w-full relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Configuração de Teste</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full mb-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Cidade Teste</Label>
                <Input className="h-7 text-xs" value={targetCity} onChange={e => setTargetCity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Cód. IBGE</Label>
                <Input className="h-7 text-xs" value={targetIbge} onChange={e => setTargetIbge(e.target.value)} />
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full gap-2 border-dashed h-12"
              onClick={handleSeedAdmin}
              disabled={loading || seeding}
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <div className="text-left">
                <p className="text-xs font-bold leading-none">Criar Admin & Vincular Cidade</p>
                <p className="text-[10px] text-muted-foreground">Vínculo necessário para salvar dados</p>
              </div>
            </Button>

            <Link href="/" className="text-xs text-muted-foreground hover:underline mt-2">
              Voltar para a página inicial
            </Link>
          </CardFooter>
        </form>
      </Card>
      <p className="mt-8 text-xs text-muted-foreground max-w-xs text-center">
        Certifique-se de habilitar o provedor de E-mail/Senha no Console do Firebase antes de criar o admin.
      </p>
    </div>
  )
}
