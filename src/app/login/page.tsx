
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2, Lock, Mail, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const { toast } = useToast()
  
  const auth = useAuth()
  const db = useFirestore()
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

  const handleGoogleLogin = async () => {
    if (!auth || loading) return;
    
    setError(null)
    setLoading(true)
    
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      
      // Criar perfil automaticamente no Firestore caso não exista
      if (db && userCredential.user) {
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const isOwner = userCredential.user.email === 'castroalvesneto@gmail.com' || userCredential.user.email === 'cordeiroseditor@gmail.com';
          await setDoc(userRef, {
            name: userCredential.user.displayName || "Usuário Google",
            email: userCredential.user.email,
            role: isOwner ? "Admin" : "Leitor",
            municipio: isOwner ? "Teixeira de Freitas" : "Não definido",
            municipioId: isOwner ? "2931350" : "",
            uf: isOwner ? "BA" : "",
            status: "Ativo",
            createdAt: new Date().toISOString()
          });
        } else {
          // Garante que a conta do admin (dono) tenha as permissões caso tenham se perdido
          const isOwner = userCredential.user.email === 'castroalvesneto@gmail.com' || userCredential.user.email === 'cordeiroseditor@gmail.com';
          const data = userSnap.data();
          if (isOwner && (!data.municipioId || data.role !== "Admin")) {
            await setDoc(userRef, {
              ...data,
              role: "Admin",
              municipio: "Teixeira de Freitas",
              municipioId: "2931350",
              uf: "BA"
            }, { merge: true });
          }
        }
      }

      toast({ title: "Bem-vindo", description: "Acesso autorizado via Google com sucesso." })
    } catch (error: any) {
      console.error(error);
      setError("Não foi possível realizar o login com o Google.")
      toast({ title: "Erro de Acesso", description: "Falha na autenticação via Google.", variant: "destructive" })
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
            <div className="relative w-full flex items-center justify-center my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-muted-foreground/20"></div></div>
              <div className="relative px-2 bg-background text-xs text-muted-foreground uppercase">Ou</div>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-11 font-medium bg-white text-black hover:bg-gray-50 flex items-center justify-center gap-2" 
              disabled={loading}
              onClick={handleGoogleLogin}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59727 3.68182 9C3.68182 8.40273 3.78409 7.83 3.96409 7.29H0.957275V4.95818C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
              </svg>
              Entrar com Google
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
