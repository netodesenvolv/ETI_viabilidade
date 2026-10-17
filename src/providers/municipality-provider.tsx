'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { EXERCICIO_PADRAO, ExercicioMeta, StatusExercicio, censoDoExercicio, refsExercicio } from '@/lib/exercicio';

interface MunicipalityContextType {
  activeMunicipioId: string | null;
  activeMunicipioName: string | null;
  activeUF: string | null;
  isViewOnly: boolean;
  /** Exercício financeiro ativo (chave de todos os dados). Exercício N usa o Censo N-1. */
  exercicio: number;
  censoAno: number;
  statusExercicio: StatusExercicio | null;
  exerciciosDisponiveis: ExercicioMeta[];
  exercicioExiste: boolean;
  setExercicio: (ano: number) => void;
  /** Mantidos por compatibilidade: são o mesmo que exercicio/setExercicio. */
  projectionYear: number;
  setProjectionYear: (year: number) => void;
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
  const [projectionYear, setProjectionYearState] = useState<number>(EXERCICIO_PADRAO);

  // Inicializa a partir do perfil ou sessionStorage
  useEffect(() => {
    const sessionCityId = sessionStorage.getItem('view_municipio_id');
    const sessionCityName = sessionStorage.getItem('view_municipio_name');
    const sessionUF = sessionStorage.getItem('view_uf');
    const sessionYear = sessionStorage.getItem('exercicio') || sessionStorage.getItem('projection_year');

    if (sessionYear) {
      setProjectionYearState(parseInt(sessionYear));
    }

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

  const setProjectionYear = (year: number) => {
    if (!year || year < 2020 || year > 2040) return;
    setProjectionYearState(year);
    sessionStorage.setItem('exercicio', year.toString());
  };

  // Lista de exercícios cadastrados para o município ativo
  const db = useFirestore();
  const exerciciosRef = useMemo(
    () => (db && activeMunicipioId ? collection(db, 'municipios', activeMunicipioId, 'exercicios') : null),
    [db, activeMunicipioId]
  );
  const { data: exerciciosData } = useCollection(exerciciosRef);
  const exerciciosDisponiveis: ExercicioMeta[] = useMemo(
    () => ((exerciciosData || []) as any[])
      .map((e: any) => ({ ano: Number(e.ano ?? e.id), censoAno: Number(e.censoAno ?? Number(e.id) - 1), status: e.status, origem: e.origem, criadoEm: e.criadoEm }))
      .sort((a, b) => a.ano - b.ano),
    [exerciciosData]
  );
  const metaAtiva = exerciciosDisponiveis.find(e => e.ano === projectionYear) || null;

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
      exercicio: projectionYear,
      censoAno: censoDoExercicio(projectionYear),
      statusExercicio: metaAtiva?.status ?? null,
      exerciciosDisponiveis,
      exercicioExiste: !!metaAtiva,
      setExercicio: setProjectionYear,
      projectionYear,
      setProjectionYear,
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

/**
 * Referências do Firestore do exercício ativo.
 * Use em todas as páginas no lugar de collection(db, 'municipios', id, 'schools') etc.
 */
export function useExercicioRefs(municipioIdOverride?: string | null) {
  const db = useFirestore();
  const { activeMunicipioId, exercicio } = useMunicipality();
  const municipioId = municipioIdOverride ?? activeMunicipioId;
  return useMemo(() => {
    if (!db || !municipioId) return { municipioId: municipioId || null, exercicio, schoolsRef: null, expensesRef: null, paramsRef: null, metaRef: null };
    const r = refsExercicio(db, municipioId, exercicio);
    return { municipioId, exercicio, schoolsRef: r.schools, expensesRef: r.expenses, paramsRef: r.params, metaRef: r.meta };
  }, [db, municipioId, exercicio]);
}
