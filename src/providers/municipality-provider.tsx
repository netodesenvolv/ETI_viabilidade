'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface MunicipalityContextType {
  activeMunicipioId: string | null;
  activeMunicipioName: string | null;
  activeUF: string | null;
  isViewOnly: boolean;
  setMunicipio: (id: string, name: string, uf: string) => void;
  resetToProfile: () => void;
}

const MunicipalityContext = createContext<MunicipalityContextType | undefined>(undefined);

export function MunicipalityProvider({ 
  children, 
  profile,
  isAdmin 
}: { 
  children: ReactNode; 
  profile: any;
  isAdmin: boolean;
}) {
  const [activeMunicipioId, setActiveMunicipioId] = useState<string | null>(null);
  const [activeMunicipioName, setActiveMunicipioName] = useState<string | null>(null);
  const [activeUF, setActiveUF] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Inicializa a partir do perfil ou sessionStorage
  useEffect(() => {
    const sessionCityId = sessionStorage.getItem('view_municipio_id');
    const sessionCityName = sessionStorage.getItem('view_municipio_name');
    const sessionUF = sessionStorage.getItem('view_uf');

    if (isAdmin && sessionCityId && sessionCityName) {
      setActiveMunicipioId(sessionCityId);
      setActiveMunicipioName(sessionCityName);
      setActiveUF(sessionUF);
      setIsViewOnly(sessionCityId !== profile?.municipioId);
    } else if (profile?.municipioId) {
      setActiveMunicipioId(profile.municipioId);
      setActiveMunicipioName(profile.municipio);
      setActiveUF(profile.uf);
      setIsViewOnly(false);
    }
  }, [profile, isAdmin]);

  const setMunicipio = (id: string, name: string, uf: string) => {
    if (!isAdmin) return;
    
    setActiveMunicipioId(id);
    setActiveMunicipioName(name);
    setActiveUF(uf);
    setIsViewOnly(id !== profile?.municipioId);

    sessionStorage.setItem('view_municipio_id', id);
    sessionStorage.setItem('view_municipio_name', name);
    sessionStorage.setItem('view_uf', uf);
  };

  const resetToProfile = () => {
    if (profile?.municipioId) {
      setActiveMunicipioId(profile.municipioId);
      setActiveMunicipioName(profile.municipio);
      setActiveUF(profile.uf);
      setIsViewOnly(false);
      
      sessionStorage.removeItem('view_municipio_id');
      sessionStorage.removeItem('view_municipio_name');
      sessionStorage.removeItem('view_uf');
    }
  };

  return (
    <MunicipalityContext.Provider value={{ 
      activeMunicipioId, 
      activeMunicipioName, 
      activeUF,
      isViewOnly, 
      setMunicipio, 
      resetToProfile 
    }}>
      {children}
    </MunicipalityContext.Provider>
  );
}

export function useMunicipality() {
  const context = useContext(MunicipalityContext);
  if (context === undefined) {
    throw new Error('useMunicipality must be used within a MunicipalityProvider');
  }
  return context;
}
