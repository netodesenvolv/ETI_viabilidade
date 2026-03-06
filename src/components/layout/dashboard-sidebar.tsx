
"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Settings,
  Database,
  TrendingUp,
  CreditCard,
  ChevronRight,
  GraduationCap,
  Users,
  LogOut,
  Calculator,
  Building2,
  FileJson,
  Sparkles,
  Map,
  MapPin,
  RefreshCw,
  Search,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { signOut } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

const menuItems = [
  { title: "Painel Executivo", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Estrategista ETI", icon: Sparkles, href: "/dashboard/estrategista" },
  { title: "Parâmetros 2026", icon: Settings, href: "/dashboard/parametros" },
  { title: "Censo Escolar", icon: Database, href: "/dashboard/censo" },
  { title: "Mapa de Receitas", icon: CreditCard, href: "/dashboard/receitas" },
  { title: "Gestão de Despesas", icon: TrendingUp, href: "/dashboard/despesas" },
  { title: "Análise Custo-Aluno", icon: Calculator, href: "/dashboard/analise" },
  { title: "Simulador ETI", icon: GraduationCap, href: "/dashboard/simulador" },
  { title: "Importador Mestre", icon: FileJson, href: "/dashboard/admin/pipeline", adminOnly: true },
  { title: "Usuários", icon: Users, href: "/dashboard/usuarios", adminOnly: true },
]

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

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser(auth)
  const [mounted, setMounted] = React.useState(false)

  // Estados para troca de município (Admin)
  const [isSwitching, setIsSwitching] = React.useState(false)
  const [cityQuery, setCityQuery] = React.useState("")
  const [cityResults, setCityResults] = React.useState<IBGECity[]>([])
  const [isSearchingCity, setIsSearchingCity] = React.useState(false)
  const [isDialogOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const userProfileRef = React.useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading } = useDoc(userProfileRef);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({ title: "Sessão Encerrada", description: "Você saiu do sistema com segurança." });
      router.push('/login');
    } catch (error) {
      toast({ title: "Erro ao sair", description: "Não foi possível encerrar a sessão.", variant: "destructive" });
    }
  };

  // Busca de cidades IBGE
  React.useEffect(() => {
    const searchCities = async () => {
      if (cityQuery.length < 3) {
        setCityResults([]);
        return;
      }
      setIsSearchingCity(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${cityQuery}`);
        const data = await response.json();
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

  const handleSwitchCity = async (city: IBGECity) => {
    if (!db || !user) return;
    setIsSwitching(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        municipio: city.nome,
        municipioId: city.id.toString(),
        uf: city.microrregiao.mesorregiao.UF.sigla
      }, { merge: true });
      
      toast({ title: "Município Alterado", description: `Migrando visão para ${city.nome}.` });
      setIsOpen(false);
      setCityQuery("");
      setCityResults([]);
      // Reload para garantir que todos os hooks de dados peguem o novo ID
      window.location.reload();
    } catch (e) {
      toast({ title: "Erro na Migração", description: "Não foi possível trocar de município.", variant: "destructive" });
    } finally {
      setIsSwitching(false);
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && profile?.role !== 'Admin') return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex items-center px-6">
        <div className="flex items-center gap-2 font-headline font-bold text-white text-xl overflow-hidden">
          <div className="p-2 bg-white/20 rounded-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="truncate group-data-[collapsible=icon]:hidden">EduFin Insights</span>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu className="px-2 py-4">
          {filteredMenuItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.title}
                className="hover:bg-sidebar-accent transition-colors"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        <div className="bg-white/10 rounded-lg p-3 group-data-[collapsible=icon]:hidden border border-white/5 relative">
          <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-1">Exercício 2026</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <Building2 className="h-3 w-3 text-white/60" />
              <div className="flex-1 overflow-hidden">
                {!mounted || loading ? (
                  <Skeleton className="h-3 w-full bg-white/10" />
                ) : (
                  <p className="text-xs font-medium text-white truncate">
                    {profile?.municipio || "Não definido"}
                  </p>
                )}
              </div>
            </div>
            
            {profile?.role === 'Admin' && (
              <Dialog open={isDialogOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white hover:bg-white/10">
                    <RefreshCw className={`h-3 w-3 ${isSwitching ? 'animate-spin' : ''}`} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Migrar de Município</DialogTitle>
                    <DialogDescription>
                      Como Administrador, você pode alterar sua visão para qualquer município da base nacional.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar município..." 
                        className="pl-9"
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                      />
                      {isSearchingCity && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>

                    {cityResults.length > 0 && (
                      <Card className="shadow-md border-primary/10">
                        <ScrollArea className="max-h-[200px]">
                          <div className="p-1">
                            {cityResults.map((city) => (
                              <button
                                key={city.id}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors flex justify-between items-center group"
                                onClick={() => handleSwitchCity(city)}
                                disabled={isSwitching}
                              >
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <span className="font-medium">{city.nome} - {city.microrregiao.mesorregiao.UF.sigla}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono">{city.id}</span>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </Card>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="text-red-300 hover:text-red-100 hover:bg-red-500/20"
              tooltip="Sair do Sistema"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair do Sistema</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
