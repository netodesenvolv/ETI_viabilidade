import { FundingParameters, Network, School } from "@/types";
import { METAS_PNE, metasDosParametros } from "@/lib/metas-pne";

/**
 * Parâmetros padrão.
 * Fatores VAAF 2026 e 2027: Resoluções CIF nº 16/2025 e nº 26/2026 (iguais aos de 2025),
 * conferidos com a planilha FNDE "matrículas ponderadas FUNDEB 2026".
 * Atenção: a tabela publicada no site do MEC traz erros de digitação na coluna 2026
 * ("0,10" para anos finais urbano etc.); os valores corretos são os de 2025/2027.
 * PNAE: Resolução CD/FNDE nº 1, de 18/02/2026.
 */
export const DEFAULT_PARAMETERS: FundingParameters = {
  // Valor por matrícula ponderada. Padrão = VAAF mínimo nacional; troque pelo valor do estado
  // (estimativa oficial ÷ matrículas ponderadas) ou preencha a estimativa oficial.
  vaaf_base: 5962.79,
  fatores: {
    A1: 1.550, A2: 1.250, A3: 1.450, A4: 1.150,
    B1: 1.500, B2: 1.150,
    C1: 1.500, C2: 1.000,
    D1: 1.500, D2: 1.100,
    E1: 1.000, E2: 1.000,
    F1: 1.400, // AEE: soma ao fator da matrícula regular (dupla matrícula)
    F2: 1.400, // Educação especial: substitui o fator da etapa
    G1: 1.400, // Indígena/quilombola: multiplica o fator
    G2: 1.150, // Campo/rural: multiplica o fator
  },
  nse: 1,
  drec: 1,
  fundeb_estimativa_oficial: null,
  vaat_total_rede: 0,
  vaar_total_rede: 0,
  pnae: {
    creche_dia: 1.57,
    aee_dia: 0.78,
    integral_dia: 1.57,
    pre_parcial_dia: 0.82,
    ef_parcial_dia: 0.57,
    eja_dia: 0.57,
    indigena_dia: 0.98,
    dias_letivos: 200,
  },
  mde_liquido_eti: 0,
  royalties: 0,
  qse: 0,
  pdde: 0,
  outros_repasses: 0,
  metas: { m2031: { ...METAS_PNE.m2031 }, m2036: { ...METAS_PNE.m2036 } },
  // Custo da expansão (modelo por turma). Referência: Teixeira de Freitas, folha ago/2026 e merenda fev–set/2026.
  custos_eti: {
    prof20h_mensal: 3335,
    apoio40h_mensal: 2200,
    meses_ano: 13.33,
    encargos: 0.24,
    ef_alunos_turma: 25,
    ef_prof_turma: 1,
    ef_apoio_turma: 0.5,
    ei_alunos_turma: 20,
    ei_prof_turma: 1,
    ei_apoio_turma: 1,
    merenda_extra_mes: 94,
    meses_merenda: 10,
    capital_por_turma: 30000,
  },
};

/** Fatores oficiais do VAAF por exercício (valores da Resolução CIF do ano). */
export const FATORES_OFICIAIS: Record<number, FundingParameters["fatores"]> = {
  2026: { ...DEFAULT_PARAMETERS.fatores },
  2027: { ...DEFAULT_PARAMETERS.fatores },
};

/** Junta os parâmetros salvos com os padrões, preenchendo campos novos que ainda não existiam no banco. */
export function normalizarParametros(custom: any): FundingParameters {
  const c = custom || {};
  return {
    ...DEFAULT_PARAMETERS,
    ...c,
    fatores: { ...DEFAULT_PARAMETERS.fatores, ...(c.fatores || {}) },
    pnae: { ...DEFAULT_PARAMETERS.pnae, ...(c.pnae || {}) },
    metas: metasDosParametros(c),
    custos_eti: { ...DEFAULT_PARAMETERS.custos_eti!, ...(c.custos_eti || {}) },
  };
}

// Limpando dados de simulação para entrada de dados reais
export const MOCK_NETWORK: Network | null = null;

export const MOCK_SCHOOLS: School[] = [];
