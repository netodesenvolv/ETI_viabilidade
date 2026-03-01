
'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth, useUser } from "@/firebase";
import { Loader2, ShieldAlert } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user, loading } = useUser(auth);
  const router = useRouter();

  useEffect(() => {
    // Redireciona para login apenas quando o carregamento terminar e o usuário for nulo
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Enquanto carrega o estado de autenticação, mostra um spinner centralizado
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground animate-pulse font-headline">Validando credenciais de acesso...</p>
      </div>
    );
  }

  // Se não houver usuário após o carregamento, não renderiza nada (o useEffect cuidará do redirect)
  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 sticky top-0 bg-background/80 backdrop-blur-md z-50 border-b">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
            <h1 className="text-lg font-headline font-semibold text-primary">Plataforma de Gestão ETI</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full">
              <ShieldAlert className="h-3 w-3 text-primary" />
              <span className="text-[10px] uppercase font-bold text-primary tracking-widest">Ambiente Seguro</span>
            </div>
          </div>
        </header>
        <div className="p-6 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
