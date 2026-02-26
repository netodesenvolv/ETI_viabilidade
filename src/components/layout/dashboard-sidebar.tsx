"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Settings,
  Database,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  FileText,
  Calculator,
  ChevronRight,
  GraduationCap
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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

const menuItems = [
  { title: "Painel Executivo", icon: LayoutDashboard, href: "/dashboard" },
  { title: "Parâmetros 2026", icon: Settings, href: "/dashboard/parametros" },
  { title: "Censo Escolar", icon: Database, href: "/dashboard/censo" },
  { title: "Mapa de Receitas", icon: CreditCard, href: "/dashboard/receitas" },
  { title: "Gestão de Despesas", icon: TrendingUp, href: "/dashboard/despesas" },
  { title: "Análise Custo-Aluno", icon: Calculator, href: "/dashboard/analise" },
  { title: "Simulador ETI", icon: GraduationCap, href: "/dashboard/simulador" },
]

export function DashboardSidebar() {
  const pathname = usePathname()

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
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.title}
                className="hover:bg-sidebar-accent"
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
      <SidebarFooter className="p-4">
        <div className="bg-white/10 rounded-lg p-3 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-white/60">Exercício 2026</p>
          <p className="text-sm font-medium text-white truncate">São João dos Campos</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
