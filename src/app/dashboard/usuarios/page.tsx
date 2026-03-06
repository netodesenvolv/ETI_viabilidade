
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserPlus, UserCog, Mail, Shield, Trash2, Search, Loader2, MapPin, Lock, ShieldAlert, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useCollection, useFirestore, useAuth, useUser, useDoc } from "@/firebase"
import { collection, doc, setDoc, deleteDoc } from "firebase/firestore"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { ScrollArea } from "@/components/ui/scroll-area"

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

export default function UsuariosPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser(auth)
  
  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);
  
  const { data: users, loading: usersLoading } = useCollection(db ? collection(db, "users") : null)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Estados para busca de cidades
  const [cityQuery, setCityQuery] = useState("")
  const [cityResults, setCityResults] = useState<IBGECity[]>([])
  const [isSearchingCity, setIsSearchingCity] = useState(false)

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "Leitor",
    municipio: "",
    municipioId: "",
    uf: ""
  })

  // Efeito para buscar cidades na API do IBGE
  useEffect(() => {
    const searchCities = async () => {
      if (cityQuery.length < 3) {
        setCityResults([]);
        return;
      }
      setIsSearchingCity(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${cityQuery}`);
        const data = await response.json();
        // A API retorna muitos resultados, filtramos para os que começam com a query para ser mais preciso
        const filtered = data
          .filter((c: any) => c.nome.toLowerCase().includes(cityQuery.toLowerCase()))
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
  }, [cityQuery]);

  const handleSelectCity = (city: IBGECity) => {
    setNewUser({
      ...newUser,
      municipio: city.nome,
      municipioId: city.id.toString(),
      uf: city.microrregiao.mesorregiao.UF.sigla
    });
    setCityQuery(city.nome);
    setCityResults([]);
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !auth) return
    setIsAdding(true)

    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
      const { firebaseConfig } = await import('@/firebase/config');

      let secondaryApp;
      const apps = getApps();
      const existingApp = apps.find(a => a.name === 'SecondaryCreator');
      if (existingApp) {
        secondaryApp = existingApp;
      } else {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryCreator');
      }
      
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      const uid = userCredential.user.uid;
      await signOut(secondaryAuth);

      const userRef = doc(db, "users", uid);
      const userData = {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        municipio: newUser.municipio,
        municipioId: newUser.municipioId,
        uf: newUser.uf,
        status: "Ativo",
        createdAt: new Date().toISOString()
      }

      await setDoc(userRef, userData);

      setIsOpen(false)
      setNewUser({ name: "", email: "", password: "", role: "Leitor", municipio: "", municipioId: "", uf: "" })
      setCityQuery("");
      toast({
        title: "Usuário cadastrado",
        description: `O acesso para ${userData.name} foi criado com sucesso no município de ${userData.municipio}.`,
      })
    } catch (error: any) {
      let message = "Erro ao criar usuário."
      if (error.code === 'auth/email-already-in-use') message = "Este e-mail já está sendo usado por outro usuário."
      if (error.code === 'auth/weak-password') message = "A senha deve ter pelo menos 6 caracteres."
      
      toast({
        title: "Falha no Cadastro",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteUser = (userId: string) => {
    if (!db) return
    deleteDoc(doc(db, "users", userId))
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: `users/${userId}`,
          operation: 'delete',
        })
        errorEmitter.emit('permission-error', permissionError)
      })
  }

  if (profileLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (profile?.role !== 'Admin') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive/50" />
        <h3 className="text-xl font-bold text-primary font-headline">Acesso Restrito</h3>
        <p className="text-muted-foreground max-sm">
          Apenas Administradores Gerais podem gerenciar permissões e convites de novos usuários.
        </p>
      </div>
    )
  }

  const filteredUsers = (users || []).filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.municipio?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Gerenciamento de Usuários</h2>
          <p className="text-muted-foreground">Controle quem tem acesso e quais as permissões na plataforma por município</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
              <DialogDescription>
                Insira os dados e atribua o município e a senha inicial do colaborador.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: João da Silva" 
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail Institucional</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nome@prefeitura.gov.br" 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha Inicial</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password"
                    placeholder="Mínimo 6 caracteres" 
                    className="pl-9"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    required 
                  />
                </div>
              </div>
              
              <div className="space-y-2 relative">
                <Label htmlFor="city-search">Buscar Município</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="city-search"
                    placeholder="Digite o nome da cidade..."
                    className="pl-9"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {isSearchingCity && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                
                {cityResults.length > 0 && (
                  <Card className="absolute z-50 w-full mt-1 shadow-xl border-primary/20">
                    <ScrollArea className="max-h-[200px]">
                      <div className="p-1">
                        {cityResults.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 rounded-md transition-colors flex justify-between items-center"
                            onClick={() => handleSelectCity(city)}
                          >
                            <span>{city.nome} - {city.microrregiao.mesorregiao.UF.sigla}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{city.id}</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Município Selecionado</Label>
                  <Input 
                    value={newUser.municipio}
                    readOnly
                    className="bg-muted text-xs font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código IBGE</Label>
                  <Input 
                    value={newUser.municipioId}
                    readOnly
                    className="bg-muted text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Perfil de Acesso</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(v) => setNewUser({...newUser, role: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Administrador (Total)</SelectItem>
                    <SelectItem value="Editor">Editor (Lançamentos e Censo)</SelectItem>
                    <SelectItem value="Leitor">Leitor (Apenas Visualização)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full" disabled={isAdding || !newUser.municipioId}>
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Finalizar Cadastro"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg text-primary flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Regras de Segmentação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 border rounded-lg bg-primary/5 border-primary/10">
              <p className="text-xs font-bold mb-1">Multi-Município</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cada usuário visualiza e edita apenas as escolas vinculadas ao seu respectivo município.
              </p>
            </div>
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <UserCog className="h-4 w-4 text-accent" />
                <span className="text-sm font-bold">Acesso Granular</span>
              </div>
              <p className="text-[11px] text-muted-foreground">O perfil Editor pode gerenciar o Censo e Despesas, mas não altera parâmetros estruturais.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">Lista de Acessos Segmentada</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar..." 
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{user.name}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3 text-primary" />
                            {user.municipio} ({user.municipioId})
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'Admin' ? 'default' : user.role === 'Editor' ? 'secondary' : 'outline'} className="text-[10px]">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-[10px]">
                            {user.status || "Ativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(user.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhum usuário cadastrado no banco.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
