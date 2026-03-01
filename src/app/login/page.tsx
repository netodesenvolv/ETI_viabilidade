
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2, Lock, Mail, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useAuth, useUser } from "@/firebase"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const { toast } = useToast()
  
  const auth = useAuth()
  const { user, loading: authLoading } = useUser(auth)

  // Redirecionamento automático se já estiver logado
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth || loading) return;
    
    setError(null)
    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
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

  // Enquanto verifica a sessão inicial
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    )
  }

  // Se já houver usuário, não renderiza o form para evitar flashes visuais
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
            <Button type="submit" className="w-full h-11 font-bold text-lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Acessar Sistema"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        © 2026 EduFin Insights • Sistema de Gestão Estratégica
      </p>
    </div>
  )
}
