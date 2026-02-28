import { School, FundingParameters, EnrollmentCounts } from "@/types";

/**
 * 1. FUNDEB VAAF 2026 — Cálculo ponderado por segmento de matrícula.
 * Fórmula: VAAF = soma(quantidade × fator) × VAAf_base
 */
export function calcularVAAF(matriculas: EnrollmentCounts | undefined, parametros: FundingParameters) {
  if (!matriculas) return 0;
  const { vaaf_base } = parametros;
  
  const soma_ponderada = 
    (matriculas.creche_integral || 0)    * 1.550 +
    (matriculas.creche_parcial || 0)     * 1.250 +
    (matriculas.creche_conveniada_int || 0) * 1.450 +
    (matriculas.creche_conveniada_par || 0) * 1.150 +
    (matriculas.pre_integral || 0)       * 1.500 +
    (matriculas.pre_parcial || 0)        * 1.150 +
    (matriculas.ef_ai_integral || 0)     * 1.300 +
    (matriculas.ef_ai_parcial || 0)      * 1.000 +
    (matriculas.ef_af_integral || 0)     * 1.300 +
    (matriculas.ef_af_parcial || 0)      * 1.100 +
    (matriculas.eja_fundamental || 0)    * 0.800 +
    (matriculas.eja_medio || 0)          * 0.850 +
    (matriculas.especial_aee || 0)       * 2.400;
  
  return soma_ponderada * (vaaf_base || 5962.79);
}

/**
 * 2. VAAT — Distribuído proporcionalmente pelo total de matrículas da escola.
 */
export function calcularVAAT(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (!escola || totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const { vaat_total_rede } = parametros;
  return ((vaat_total_rede || 0) * escola.total_matriculas) / totalMatriculasRede;
}

/**
 * 3. PNAE 2026 — Por tipo de matrícula × valor anual (Regra: Valor Dia * 200 dias).
 */
export function calcularPNAE(matriculas: EnrollmentCounts | undefined, parametros?: FundingParameters) {
  if (!matriculas) return 0;
  
  // Valores anuais conforme regra 2026 (Valor Dia * 200)
  const p = parametros?.pnae;
  const dias = p?.dias_letivos || 200;
  const int_dia = p?.integral_dia || 1.57;
  const pre_par_dia = p?.pre_parcial_dia || 0.82;
  const common_dia = p?.ef_parcial_dia || 0.57;

  return (
    (matriculas.creche_integral || 0)    * int_dia * dias +
    (matriculas.creche_parcial || 0)     * common_dia * dias +
    (matriculas.creche_conveniada_int || 0) * int_dia * dias +
    (matriculas.creche_conveniada_par || 0) * common_dia * dias +
    (matriculas.pre_integral || 0)       * int_dia * dias +
    (matriculas.pre_parcial || 0)        * pre_par_dia * dias +
    (matriculas.ef_ai_integral || 0)     * int_dia * dias +
    (matriculas.ef_ai_parcial || 0)      * common_dia * dias +
    (matriculas.ef_af_integral || 0)     * int_dia * dias +
    (matriculas.ef_af_parcial || 0)      * common_dia * dias +
    (matriculas.eja_fundamental || 0)    * common_dia * dias +
    (matriculas.eja_medio || 0)          * common_dia * dias +
    (matriculas.especial_aee || 0)       * common_dia * dias
  );
}

/**
 * 4. MDE Líquido — Distribuído proporcionalmente.
 */
export function calcularMDE(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (!escola || totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  return ((parametros.mde_liquido_eti || 0) * escola.total_matriculas) / totalMatriculasRede;
}

/**
 * 5. QSE / Salário Educação e Outros — Distribuídos proporcionalmente.
 */
export function calcularOutros(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (!escola || totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const total_outros = (parametros.qse || 0) + (parametros.pdde || 0) + (parametros.outros_repasses || 0);
  return (total_outros * escola.total_matriculas) / totalMatriculasRede;
}
