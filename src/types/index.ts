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
  /** Alunos da educação especial (INEP QT_MAT_ESP). Já estão contados nas etapas; no FUNDEB recebem o fator F2 no lugar do fator da etapa. */
  especial_aee: number;
  /** Matrículas de AEE no contraturno (dupla matrícula): somam o fator F1 ao da matrícula regular. */
  aee?: number;
  indigena_quilombola: number;
  campo_rural: number;
}

export interface School {
  id: string;
  codigo_inep: string;
  nome: string;
  localizacao: 'urbana' | 'rural';
  tp_dependencia: string;
  matriculas: EnrollmentCounts;
  total_matriculas: number;
  total_eti: number;
  percentual_eti: number;
  /** Tempo integral conferido pela rede (corrige erros do INEP sem alterar o dado oficial). */
  total_eti_verificado?: number | null;
}

export interface FundingParameters {
  vaaf_base: number;
  fatores: {
    A1: number; A2: number; A3: number; A4: number;
    B1: number; B2: number;
    C1: number; C2: number;
    D1: number; D2: number;
    E1: number; E2: number;
    /** F1 = AEE (dupla matrícula, soma ao fator da etapa); F2 = educação especial (substitui o fator da etapa) */
    F1: number; F2?: number;
    /** G1 = multiplicador indígena/quilombola (×1,40); G2 = multiplicador campo/rural (×1,15) */
    G1: number; G2: number;
  };
  /** Ponderador de nível socioeconômico (planilha FNDE do exercício). Padrão 1. */
  nse?: number;
  /** Ponderador de disponibilidade de recursos (planilha FNDE do exercício). Padrão 1. */
  drec?: number;
  /** Estimativa oficial do FUNDEB (Portaria). Quando preenchida, substitui o cálculo automático no total da rede. */
  fundeb_estimativa_oficial?: number | null;
  /** Receita de royalties vinculados à Educação (fonte 1573), lançada à mão. */
  royalties?: number;
  vaat_total_rede: number;
  vaar_total_rede: number;
  pnae: {
    /** Creche (parcial ou integral) — R$ 1,57 (Res. CD/FNDE 1/2026) */
    creche_dia?: number;
    /** AEE no contraturno — R$ 0,78 */
    aee_dia?: number;
    integral_dia: number;
    pre_parcial_dia: number;
    ef_parcial_dia: number;
    eja_dia: number;
    indigena_dia: number;
    dias_letivos: number;
  };
  mde_liquido_eti: number;
  /** Metas de tempo integral (padrão: novo PNE, Lei 15.388/2026, Meta 6.a). Percentuais. */
  metas?: { m2031: { matriculas: number; escolas: number }; m2036: { matriculas: number; escolas: number } };
  qse: number;
  pdde: number;
  outros_repasses: number;
  /** Premissas de custo da expansão do tempo integral (modelo por turma). */
  custos_eti?: CustosETI;
}

/**
 * Custo a mais de transformar uma turma parcial em integral (modelo por turma).
 * Valores mensais; o sistema anualiza com `meses_ano` (12 + 13º + 1/3 de férias) e `encargos`.
 */
export interface CustosETI {
  /** Professor de 20h (salário-base mensal, sem encargos) */
  prof20h_mensal: number;
  /** Profissional de apoio de 40h (mensal, sem encargos) */
  apoio40h_mensal: number;
  /** Meses pagos no ano: 12 + 13º + 1/3 de férias ≈ 13,33 */
  meses_ano: number;
  /** Encargos patronais (0,24 = 24%) */
  encargos: number;
  /** Ensino fundamental: alunos por turma, professores 20h a mais e apoios 40h por turma */
  ef_alunos_turma: number;
  ef_prof_turma: number;
  ef_apoio_turma: number;
  /** Educação infantil: alunos por turma, professores 20h a mais e apoios 40h por turma */
  ei_alunos_turma: number;
  ei_prof_turma: number;
  ei_apoio_turma: number;
  /** Merenda a mais por aluno integral (R$/mês) */
  merenda_extra_mes: number;
  /** Meses letivos com merenda */
  meses_merenda: number;
  /** Investimento (obra/equipamento) por turma nova — gasto único, fora do custo anual */
  capital_por_turma: number;
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
