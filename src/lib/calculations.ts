import { School, FundingParameters, EnrollmentCounts } from "@/types";

export function calcularVAAF(matriculas: EnrollmentCounts, parametros: FundingParameters) {
  const { vaaf_base, fatores } = parametros;
  
  const soma_ponderada = 
    matriculas.creche_integral       * fatores.A1 +
    matriculas.creche_parcial        * fatores.A2 +
    matriculas.creche_conveniada_int * fatores.A3 +
    matriculas.creche_conveniada_par * fatores.A4 +
    matriculas.pre_integral          * fatores.B1 +
    matriculas.pre_parcial           * fatores.B2 +
    matriculas.ef_ai_integral        * fatores.C1 +
    matriculas.ef_ai_parcial         * fatores.C2 +
    matriculas.ef_af_integral        * fatores.D1 +
    matriculas.ef_af_parcial         * fatores.D2 +
    matriculas.eja_fundamental       * fatores.E1 +
    matriculas.eja_medio             * fatores.E2 +
    matriculas.especial_aee          * (fatores.C2 + fatores.F1) +
    matriculas.indigena_quilombola   * fatores.C2 * fatores.G1 +
    matriculas.campo_rural           * fatores.C2 * fatores.G2;
  
  return soma_ponderada * vaaf_base;
}

export function calcularVAAT(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  const { vaat_total_rede } = parametros;
  return totalMatriculasRede > 0 ? (vaat_total_rede * escola.total_matriculas) / totalMatriculasRede : 0;
}

export function calcularPNAE(escola: School, parametros: FundingParameters) {
  const { pnae } = parametros;
  const m = escola.matriculas;
  return (
    m.creche_integral    * pnae.integral_dia    * pnae.dias_letivos +
    m.creche_parcial     * pnae.ef_parcial_dia  * pnae.dias_letivos +
    m.pre_integral       * pnae.integral_dia    * pnae.dias_letivos +
    m.pre_parcial        * pnae.pre_parcial_dia * pnae.dias_letivos +
    m.ef_ai_integral     * pnae.integral_dia    * pnae.dias_letivos +
    m.ef_ai_parcial      * pnae.ef_parcial_dia  * pnae.dias_letivos +
    m.ef_af_integral     * pnae.integral_dia    * pnae.dias_letivos +
    m.ef_af_parcial      * pnae.ef_parcial_dia  * pnae.dias_letivos +
    m.eja_fundamental    * pnae.eja_dia         * pnae.dias_letivos +
    m.eja_medio          * pnae.eja_dia         * pnae.dias_letivos +
    m.indigena_quilombola * pnae.indigena_dia   * pnae.dias_letivos
  );
}

export function calcularMDE(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  return totalMatriculasRede > 0 ? (parametros.mde_liquido_eti * escola.total_matriculas) / totalMatriculasRede : 0;
}

export function calcularOutros(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  const total_outros = parametros.qse + parametros.pdde + parametros.outros_repasses;
  return totalMatriculasRede > 0 ? (total_outros * escola.total_matriculas) / totalMatriculasRede : 0;
}
