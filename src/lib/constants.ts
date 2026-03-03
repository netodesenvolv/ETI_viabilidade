import { FundingParameters, Network, School } from "@/types";

export const DEFAULT_PARAMETERS: FundingParameters = {
  vaaf_base: 5962.79,
  fatores: {
    A1: 1.550, A2: 1.250, A3: 1.450, A4: 1.150,
    B1: 1.500, B2: 1.150,
    C1: 1.300, C2: 1.000,
    D1: 1.300, D2: 1.100,
    E1: 0.800, E2: 0.850,
    F1: 1.400, // Adicional AEE
    G1: 1.400, G2: 1.150,
  },
  vaat_total_rede: 850000,
  pnae: {
    integral_dia: 1.57,
    pre_parcial_dia: 0.82,
    ef_parcial_dia: 0.57,
    eja_dia: 0.57,
    indigena_dia: 0.98,
    dias_letivos: 200,
  },
  mde_liquido_eti: 1200000,
  qse: 180000,
  pdde: 50000,
  outros_repasses: 30000,
};

// Limpando dados de simulação para entrada de dados reais
export const MOCK_NETWORK: Network | null = null;

export const MOCK_SCHOOLS: School[] = [];
