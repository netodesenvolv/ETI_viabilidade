export interface Network {
  id: string;
  municipio: string;
  uf: string;
  codigo_ibge: string;
  codigo_inep_rede: string;
  exercicio: number;
}

export interface EnrollmentCounts {
  creche_integral: number;
  creche_parcial: number;
  creche_conveniada_int: number;
  creche_conveniada_par: number;
  pre_integral: number;
  pre_parcial: number;
  ef_ai_integral: number;
  ef_ai_parcial: number;
  ef_af_integral: number;
  ef_af_parcial: number;
  eja_fundamental: number;
  eja_medio: number;
  especial_aee: number;
  indigena_quilombola: number;
  campo_rural: number;
}

export interface School {
  id: string;
  codigo_inep: string;
  nome: string;
  localizacao: 'urbana' | 'rural';
  matriculas: EnrollmentCounts;
  total_matriculas: number;
  total_eti: number;
  percentual_eti: number;
}

export interface FundingParameters {
  vaaf_base: number;
  fatores: {
    A1: number; A2: number; A3: number; A4: number;
    B1: number; B2: number;
    C1: number; C2: number;
    D1: number; D2: number;
    E1: number; E2: number;
    F1: number; G1: number; G2: number;
  };
  vaat_total_rede: number;
  pnae: {
    integral_dia: number;
    pre_parcial_dia: number;
    ef_parcial_dia: number;
    eja_dia: number;
    indigena_dia: number;
    dias_letivos: number;
  };
  mde_liquido_eti: number;
  qse: number;
  pdde: number;
  outros_repasses: number;
}

export interface SchoolExpenses {
  pessoal_docentes: number;
  pessoal_monitores: number;
  pessoal_gestao: number;
  pessoal_apoio: number;
  alimentacao_complemento: number;
  transporte: number;
  energia: number;
  agua: number;
  internet: number;
  material_didatico: number;
  servicos_terceirizados: number;
  outros: number;
}

export interface AnalysisResult {
  receita_total: number;
  despesa_total: number;
  saldo: number;
  custo_aluno: number;
  receita_aluno: number;
  cobertura: number;
  status: 'superavit' | 'neutro' | 'deficit';
}
