import { FundingParameters, Network, School } from "@/types";

export const DEFAULT_PARAMETERS: FundingParameters = {
  vaaf_base: 5962.79,
  fatores: {
    A1: 1.550, A2: 1.250, A3: 1.450, A4: 1.150,
    B1: 1.500, B2: 1.150,
    C1: 1.300, C2: 1.000,
    D1: 1.300, D2: 1.100,
    E1: 0.800, E2: 0.850,
    F1: 1.400, G1: 1.400, G2: 1.150,
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

export const MOCK_NETWORK: Network = {
  id: "1",
  municipio: "São João dos Campos",
  uf: "MG",
  codigo_ibge: "3162500",
  codigo_inep_rede: "31000",
  exercicio: 2026,
};

export const MOCK_SCHOOLS: School[] = [
  {
    id: "s1",
    codigo_inep: "31123456",
    nome: "EMEI Girassol",
    localizacao: "urbana",
    matriculas: {
      creche_integral: 60, creche_parcial: 40, creche_conveniada_int: 0, creche_conveniada_par: 0,
      pre_integral: 80, pre_parcial: 60,
      ef_ai_integral: 0, ef_ai_parcial: 0, ef_af_integral: 0, ef_af_parcial: 0,
      eja_fundamental: 0, eja_medio: 0, especial_aee: 10, indigena_quilombola: 0, campo_rural: 0
    },
    total_matriculas: 240,
    total_eti: 140,
    percentual_eti: 58.3
  },
  {
    id: "s2",
    codigo_inep: "31123457",
    nome: "EMEF Santos Dumont",
    localizacao: "urbana",
    matriculas: {
      creche_integral: 0, creche_parcial: 0, creche_conveniada_int: 0, creche_conveniada_par: 0,
      pre_integral: 0, pre_parcial: 0,
      ef_ai_integral: 120, ef_ai_parcial: 180, ef_af_integral: 80, ef_af_parcial: 220,
      eja_fundamental: 0, eja_medio: 0, especial_aee: 25, indigena_quilombola: 0, campo_rural: 0
    },
    total_matriculas: 600,
    total_eti: 200,
    percentual_eti: 33.3
  },
  {
    id: "s3",
    codigo_inep: "31123458",
    nome: "EMEF Rio Branco",
    localizacao: "rural",
    matriculas: {
      creche_integral: 0, creche_parcial: 0, creche_conveniada_int: 0, creche_conveniada_par: 0,
      pre_integral: 0, pre_parcial: 0,
      ef_ai_integral: 0, ef_ai_parcial: 250, ef_af_integral: 0, ef_af_parcial: 200,
      eja_fundamental: 60, eja_medio: 0, especial_aee: 15, indigena_quilombola: 0, campo_rural: 450
    },
    total_matriculas: 510,
    total_eti: 0,
    percentual_eti: 0
  },
  {
    id: "s4",
    codigo_inep: "31123459",
    nome: "EMEF Dom Pedro I",
    localizacao: "urbana",
    matriculas: {
      creche_integral: 0, creche_parcial: 0, creche_conveniada_int: 0, creche_conveniada_par: 0,
      pre_integral: 0, pre_parcial: 0,
      ef_ai_integral: 200, ef_ai_parcial: 100, ef_af_integral: 150, ef_af_parcial: 80,
      eja_fundamental: 0, eja_medio: 0, especial_aee: 30, indigena_quilombola: 0, campo_rural: 0
    },
    total_matriculas: 530,
    total_eti: 350,
    percentual_eti: 66.0
  }
];
