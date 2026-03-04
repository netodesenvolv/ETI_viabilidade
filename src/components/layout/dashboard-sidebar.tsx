
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
  Map
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
import { doc } from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { signOut } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"

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

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser(auth)
  const [mounted, setMounted] = React.useState(false)

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
        <div className="bg-white/10 rounded-lg p-3 group-data-[collapsible=icon]:hidden border border-white/5">
          <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider mb-1">Exercício 2026</p>
          <div className="flex items-center gap-2">
            <Building2 className="h-3 w-3 text-white/60" />
            <div className="flex-1 overflow-hidden">
              {!mounted || loading ? (
                <Skeleton className="h-3 w-full bg-white/10" />
              ) : (
                <p className="text-xs font-medium text-white truncate">
                  {profile?.municipio || "Município não definido"}
                </p>
              )}
            </div>
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
