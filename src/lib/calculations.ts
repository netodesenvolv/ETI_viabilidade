import { School, FundingParameters, EnrollmentCounts } from "@/types";

/**
 * 1. FUNDEB VAAF 2026 — Cálculo ponderado por segmento de matrícula.
 * Regra de Dupla Matrícula: O aluno AEE gera o repasse da sua etapa regular MAIS o repasse do AEE.
 * Fator Final AEE = Fator da Etapa Regular + Adicional AEE (F1).
 */
export function calcularVAAF(matriculas: EnrollmentCounts | undefined, parametros: FundingParameters) {
  if (!matriculas) return 0;
  const { vaaf_base, fatores } = parametros;
  
  // Soma das matrículas regulares (Ensino Fundamental, Infantil e EJA)
  let soma_ponderada = 
    (matriculas.creche_integral || 0)    * (fatores.A1 || 1.550) +
    (matriculas.creche_parcial || 0)     * (fatores.A2 || 1.250) +
    (matriculas.creche_conveniada_int || 0) * (fatores.A3 || 1.450) +
    (matriculas.creche_conveniada_par || 0) * (fatores.A4 || 1.150) +
    (matriculas.pre_integral || 0)       * (fatores.B1 || 1.500) +
    (matriculas.pre_parcial || 0)        * (fatores.B2 || 1.150) +
    (matriculas.ef_ai_integral || 0)     * (fatores.C1 || 1.300) +
    (matriculas.ef_ai_parcial || 0)      * (fatores.C2 || 1.000) +
    (matriculas.ef_af_integral || 0)     * (fatores.D1 || 1.300) +
    (matriculas.ef_af_parcial || 0)      * (fatores.D2 || 1.100) +
    (matriculas.eja_fundamental || 0)    * (fatores.E1 || 0.800) +
    (matriculas.eja_medio || 0)          * (fatores.E2 || 0.850);

  // Lógica do Adicional AEE (F1) - Dupla Matrícula (Exatamente como na planilha: Fator Etapa + 1.4)
  // Identificamos o segmento predominante da escola para servir de base ao AEE
  const total_infantil = (matriculas.creche_integral || 0) + (matriculas.creche_parcial || 0) + (matriculas.pre_integral || 0) + (matriculas.pre_parcial || 0);
  const total_ai = (matriculas.ef_ai_integral || 0) + (matriculas.ef_ai_parcial || 0);
  const total_af = (matriculas.ef_af_integral || 0) + (matriculas.ef_af_parcial || 0);
  
  let fatorBaseAEE = fatores.C2 || 1.00; 
  if (total_af > total_ai && total_af > total_infantil) {
    fatorBaseAEE = fatores.D2 || 1.10;
  } else if (total_infantil > total_ai && total_infantil > total_af) {
    fatorBaseAEE = fatores.B2 || 1.15;
  }
  
  // Fator Final AEE = Fator da Etapa + Adicional (ex: 1.10 + 1.40 = 2.50)
  const fatorEspecial = fatorBaseAEE + (fatores.F1 || 1.40);
  soma_ponderada += (matriculas.especial_aee || 0) * fatorEspecial;
  
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
 * CRÍTICO: Não somar especial_aee separadamente para não duplicar CPFs.
 */
export function calcularPNAE(matriculas: EnrollmentCounts | undefined, parametros?: FundingParameters) {
  if (!matriculas) return 0;
  
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
    (matriculas.eja_medio || 0)          * common_dia * dias
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
