"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth, useUser, useDoc, useFirestore } from "@/firebase";
import { Loader2, ShieldAlert, MapPin, RefreshCw } from "lucide-react";
import { doc } from "firebase/firestore";
import { MunicipalityProvider, useMunicipality } from "@/providers/municipality-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user, loading } = useUser(auth);
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loading, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground animate-pulse font-headline">Sincronizando acesso seguro...</p>
      </div>
    );
  }

  return (
    <AuthorizedLayout user={user}>
      {children}
    </AuthorizedLayout>
  );
}

// Sub-componente para lidar com hooks que dependem de auth após autorização
function AuthorizedLayout({ children, user }: { children: React.ReactNode; user: any }) {
  const db = useFirestore();
  const userProfileRef = useMemo(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  if (profileLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-muted-foreground animate-pulse font-headline">Carregando perfil municipal...</p>
      </div>
    );
  }

  const isAdmin = profile?.role === 'Admin';

  return (
    <MunicipalityProvider profile={profile} isAdmin={isAdmin}>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 sticky top-0 bg-background/80 backdrop-blur-md z-50 border-b">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex-1 flex items-center gap-2">
              <h1 className="text-lg font-headline font-semibold text-primary">Plataforma de Gestão ETI</h1>
              <MunicipalityBadge />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full">
                <ShieldAlert className="h-3 w-3 text-primary" />
                <span className="text-[10px] uppercase font-bold text-primary tracking-widest">Ambiente Autenticado</span>
              </div>
            </div>
          </header>
          <div className="p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </MunicipalityProvider>
  );
}

function MunicipalityBadge() {
  const { activeMunicipioName, isViewOnly, resetToProfile } = useMunicipality();
  
  if (!activeMunicipioName) return null;

  return (
    <div className={`flex items-center gap-2 px-2 py-0.5 rounded-md text-[10px] font-bold border animate-in slide-in-from-left-2 duration-300 ${isViewOnly ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-primary/5 text-primary border-primary/10'}`}>
      <MapPin className="h-3 w-3" />
      <span>{activeMunicipioName}</span>
      {isViewOnly && (
        <button 
          onClick={resetToProfile}
          className="ml-1 hover:text-orange-800 transition-colors"
          title="Voltar para meu município"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
