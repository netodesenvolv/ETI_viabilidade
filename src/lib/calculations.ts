import { School, FundingParameters, EnrollmentCounts } from "@/types";

/**
 * 1. FUNDEB VAAF — Cálculo ponderado por segmento de matrícula.
 * Fórmula: VAAF = soma(quantidade × fator) × VAAf_base
 */
export function calcularVAAF(matriculas: EnrollmentCounts | undefined, parametros: FundingParameters) {
  if (!matriculas) return 0;
  const { vaaf_base } = parametros;
  
  // Fatores fixos 2026 conforme solicitado
  const soma_ponderada = 
    (matriculas.creche_integral || 0)    * 1.550 +
    (matriculas.creche_parcial || 0)     * 1.250 +
    (matriculas.pre_integral || 0)       * 1.500 +
    (matriculas.pre_parcial || 0)        * 1.150 +
    (matriculas.ef_ai_integral || 0)     * 1.300 +
    (matriculas.ef_ai_parcial || 0)      * 1.000 +
    (matriculas.ef_af_integral || 0)     * 1.300 +
    (matriculas.ef_af_parcial || 0)      * 1.100 +
    (matriculas.eja_fundamental || 0)    * 0.800 +
    (matriculas.eja_medio || 0)          * 0.850 +
    (matriculas.especial_aee || 0)       * 2.400; // 1.000 (base) + 1.400 (adicional AEE)
  
  return soma_ponderada * vaaf_base;
}

/**
 * 2. VAAT — Distribuído proporcionalmente pelo total de matrículas da escola.
 * Reflete o repasse total que a rede recebeu do FNDE.
 */
export function calcularVAAT(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const { vaat_total_rede } = parametros;
  return (vaat_total_rede * escola.total_matriculas) / totalMatriculasRede;
}

/**
 * 3. PNAE — Por tipo de matrícula x dias letivos (200 dias).
 * Valores anuais calculados conforme solicitado.
 */
export function calcularPNAE(matriculas: EnrollmentCounts | undefined) {
  if (!matriculas) return 0;
  
  return (
    (matriculas.creche_integral || 0)    * 314 +
    (matriculas.creche_parcial || 0)     * 114 +
    (matriculas.pre_integral || 0)       * 314 +
    (matriculas.pre_parcial || 0)        * 164 +
    (matriculas.ef_ai_integral || 0)     * 314 +
    (matriculas.ef_ai_parcial || 0)      * 114 +
    (matriculas.ef_af_integral || 0)     * 314 +
    (matriculas.ef_af_parcial || 0)      * 114 +
    (matriculas.eja_fundamental || 0)    * 114 +
    (matriculas.eja_medio || 0)          * 114 +
    (matriculas.especial_aee || 0)       * 114
  );
}

/**
 * 4. MDE Líquido — Distribuído proporcionalmente.
 */
export function calcularMDE(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  return (parametros.mde_liquido_eti * escola.total_matriculas) / totalMatriculasRede;
}

/**
 * 5. QSE / Salário Educação e Outros — Distribuídos proporcionalmente.
 */
export function calcularOutros(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const total_outros = (parametros.qse || 0) + (parametros.pdde || 0) + (parametros.outros_repasses || 0);
  return (total_outros * escola.total_matriculas) / totalMatriculasRede;
}
