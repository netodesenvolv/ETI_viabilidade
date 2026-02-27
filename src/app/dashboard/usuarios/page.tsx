"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserPlus, UserCog, Mail, Shield, Trash2, Search, Loader2 } from "lucide-react"
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

const MOCK_USERS = [
  { id: "1", name: "Ricardo Silva", email: "ricardo.silva@prefeitura.gov.br", role: "Admin", status: "Ativo" },
  { id: "2", name: "Maria Oliveira", email: "maria.educacao@prefeitura.gov.br", role: "Editor", status: "Ativo" },
  { id: "3", name: "João Santos", email: "joao.financas@prefeitura.gov.br", role: "Leitor", status: "Inativo" },
]

export default function UsuariosPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Leitor"
  })

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault()
    setIsAdding(true)

    // Simulando delay de rede
    setTimeout(() => {
      setIsAdding(false)
      setIsOpen(false)
      setNewUser({ name: "", email: "", role: "Leitor" })
      
      toast({
        title: "Usuário convidado",
        description: `Um convite foi enviado para ${newUser.email}.`,
      })
    }, 1000)
  }

  const filteredUsers = MOCK_USERS.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-primary">Gerenciamento de Usuários</h2>
          <p className="text-muted-foreground">Controle quem tem acesso e quais as permissões na plataforma</p>
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
                Insira os dados do colaborador para liberar o acesso ao sistema.
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
                <Button type="submit" className="w-full" disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Enviar Convite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Perfis de Acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">Administrador</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Acesso total ao sistema, parâmetros e gestão de usuários.</p>
            </div>
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <UserCog className="h-4 w-4 text-accent" />
                <span className="text-sm font-bold">Editor</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Pode importar o Censo, lançar despesas e usar simuladores.</p>
            </div>
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold">Leitor</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Pode visualizar relatórios e gráficos, mas não pode alterar dados.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg">Lista de Acessos</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar usuário..." 
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'Admin' ? 'default' : user.role === 'Editor' ? 'secondary' : 'outline'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={user.status === 'Ativo' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200' : 'bg-muted text-muted-foreground border-transparent'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
