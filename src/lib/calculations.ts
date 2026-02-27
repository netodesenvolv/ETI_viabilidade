import { School, FundingParameters, EnrollmentCounts } from "@/types";

export function calcularVAAF(matriculas: EnrollmentCounts, parametros: FundingParameters) {
  const { vaaf_base, fatores } = parametros;
  
  const soma_ponderada = 
    (matriculas.creche_integral || 0)       * (fatores.A1 || 0) +
    (matriculas.creche_parcial || 0)        * (fatores.A2 || 0) +
    (matriculas.creche_conveniada_int || 0) * (fatores.A3 || 0) +
    (matriculas.creche_conveniada_par || 0) * (fatores.A4 || 0) +
    (matriculas.pre_integral || 0)          * (fatores.B1 || 0) +
    (matriculas.pre_parcial || 0)           * (fatores.B2 || 0) +
    (matriculas.ef_ai_integral || 0)        * (fatores.C1 || 0) +
    (matriculas.ef_ai_parcial || 0)         * (fatores.C2 || 0) +
    (matriculas.ef_af_integral || 0)        * (fatores.D1 || 0) +
    (matriculas.ef_af_parcial || 0)         * (fatores.D2 || 0) +
    (matriculas.eja_fundamental || 0)       * (fatores.E1 || 0) +
    (matriculas.eja_medio || 0)             * (fatores.E2 || 0) +
    (matriculas.especial_aee || 0)          * ((fatores.C2 || 0) + (fatores.F1 || 0)) +
    (matriculas.indigena_quilombola || 0)   * (fatores.C2 || 0) * (fatores.G1 || 0) +
    (matriculas.campo_rural || 0)           * (fatores.C2 || 0) * (fatores.G2 || 0);
  
  return soma_ponderada * vaaf_base;
}

export function calcularVAAT(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  const { vaat_total_rede } = parametros;
  const total = escola.total_matriculas || 0;
  return totalMatriculasRede > 0 ? (vaat_total_rede * total) / totalMatriculasRede : 0;
}

export function calcularPNAE(matriculas: EnrollmentCounts, parametros: FundingParameters) {
  const { pnae } = parametros;
  const m = matriculas || {};
  return (
    (m.creche_integral || 0)    * pnae.integral_dia    * pnae.dias_letivos +
    (m.creche_parcial || 0)     * pnae.ef_parcial_dia  * pnae.dias_letivos +
    (m.pre_integral || 0)       * pnae.integral_dia    * pnae.dias_letivos +
    (m.pre_parcial || 0)        * pnae.pre_parcial_dia * pnae.dias_letivos +
    (m.ef_ai_integral || 0)     * pnae.integral_dia    * pnae.dias_letivos +
    (m.ef_ai_parcial || 0)      * pnae.ef_parcial_dia  * pnae.dias_letivos +
    (m.ef_af_integral || 0)     * pnae.integral_dia    * pnae.dias_letivos +
    (m.ef_af_parcial || 0)      * pnae.ef_parcial_dia  * pnae.dias_letivos +
    (m.eja_fundamental || 0)    * pnae.eja_dia         * pnae.dias_letivos +
    (m.eja_medio || 0)          * pnae.eja_dia         * pnae.dias_letivos +
    (m.indigena_quilombola || 0) * pnae.indigena_dia   * pnae.dias_letivos
  );
}

export function calcularMDE(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  const total = escola.total_matriculas || 0;
  return totalMatriculasRede > 0 ? (parametros.mde_liquido_eti * total) / totalMatriculasRede : 0;
}

export function calcularOutros(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  const total_outros = (parametros.qse || 0) + (parametros.pdde || 0) + (parametros.outros_repasses || 0);
  const total = escola.total_matriculas || 0;
  return totalMatriculasRede > 0 ? (total_outros * total) / totalMatriculasRede : 0;
}
