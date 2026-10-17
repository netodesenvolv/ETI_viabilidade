import { School, FundingParameters, EnrollmentCounts } from "@/types";

/**
 * Regras de ponderação do FUNDEB (VAAF) — Lei 14.113/2020 e Resoluções CIF.
 *
 * - Cada etapa tem seu fator (A1…E2).
 * - Escola do campo/rural: o fator é multiplicado por G2 (1,15).
 * - Educação especial (INEP QT_MAT_ESP): esses alunos já estão contados nas etapas,
 *   mas o FNDE os pondera com F2 (1,40) no lugar do fator da etapa.
 *   Como o Censo da escola não diz em que etapa está cada aluno, usamos o fator médio
 *   das etapas da própria escola para fazer a troca.
 * - AEE no contraturno (dupla matrícula): soma F1 (1,40) ao fator da matrícula regular.
 * - O total é multiplicado pelos ponderadores NSE e DRec do exercício.
 */

type Segmento = { raw: number; weighted: number };
export type PonderadasSegmentos = {
  infantil: Segmento; ai: Segmento; af: Segmento; eja: Segmento; especial: Segmento;
};

function n(v: any) { return Number(v) || 0; }

export function ponderadasPorSegmento(
  matriculas: EnrollmentCounts | undefined,
  parametros: FundingParameters,
  localizacao?: string
): PonderadasSegmentos {
  const m: any = matriculas || {};
  const f: any = parametros.fatores || {};
  const campo = String(localizacao || '').toLowerCase() === 'rural' ? (f.G2 || 1.15) : 1;

  const infRaw = n(m.creche_integral) + n(m.creche_parcial) + n(m.creche_conveniada_int) + n(m.creche_conveniada_par) + n(m.pre_integral) + n(m.pre_parcial);
  const infW = (
    n(m.creche_integral) * (f.A1 ?? 1.55) +
    n(m.creche_parcial) * (f.A2 ?? 1.25) +
    n(m.creche_conveniada_int) * (f.A3 ?? 1.45) +
    n(m.creche_conveniada_par) * (f.A4 ?? 1.15) +
    n(m.pre_integral) * (f.B1 ?? 1.5) +
    n(m.pre_parcial) * (f.B2 ?? 1.15)
  ) * campo;

  const aiRaw = n(m.ef_ai_integral) + n(m.ef_ai_parcial);
  const aiW = (n(m.ef_ai_integral) * (f.C1 ?? 1.5) + n(m.ef_ai_parcial) * (f.C2 ?? 1.0)) * campo;

  const afRaw = n(m.ef_af_integral) + n(m.ef_af_parcial);
  const afW = (n(m.ef_af_integral) * (f.D1 ?? 1.5) + n(m.ef_af_parcial) * (f.D2 ?? 1.1)) * campo;

  const ejaRaw = n(m.eja_fundamental) + n(m.eja_medio);
  const ejaW = (n(m.eja_fundamental) * (f.E1 ?? 1.0) + n(m.eja_medio) * (f.E2 ?? 1.0)) * campo;

  // Educação especial: troca o fator médio das etapas da escola por F2
  const etapasRaw = infRaw + aiRaw + afRaw + ejaRaw;
  const etapasW = infW + aiW + afW + ejaW;
  const esp = Math.min(n(m.especial_aee), etapasRaw);
  const fatorMedio = etapasRaw > 0 ? etapasW / etapasRaw : 0;
  const retirada = esp * fatorMedio;                 // peso que sai das etapas
  const share = etapasW > 0 ? retirada / etapasW : 0; // proporção retirada de cada etapa
  const espW = esp * (f.F2 ?? 1.4) * campo + n(m.aee) * (f.F1 ?? 1.4);

  return {
    infantil: { raw: infRaw, weighted: infW * (1 - share) },
    ai: { raw: aiRaw, weighted: aiW * (1 - share) },
    af: { raw: afRaw, weighted: afW * (1 - share) },
    eja: { raw: ejaRaw, weighted: ejaW * (1 - share) },
    especial: { raw: n(m.especial_aee) + n(m.aee), weighted: espW },
  };
}

/** Matrículas ponderadas pelos fatores (antes de NSE e DRec). */
export function calcularPonderadas(matriculas: EnrollmentCounts | undefined, parametros: FundingParameters, localizacao?: string) {
  const s = ponderadasPorSegmento(matriculas, parametros, localizacao);
  return s.infantil.weighted + s.ai.weighted + s.af.weighted + s.eja.weighted + s.especial.weighted;
}

/** Ponderador final do exercício (NSE × DRec). */
export function ponderadorExercicio(parametros: FundingParameters) {
  return (parametros.nse || 1) * (parametros.drec || 1);
}

/**
 * 1. FUNDEB (VAAF) da escola = matrículas ponderadas × NSE × DRec × valor por matrícula ponderada.
 * O valor por matrícula ponderada vem de `vaaf_base`, já ajustado por `resolverParametros`
 * quando a estimativa oficial estiver preenchida.
 */
export function calcularVAAF(matriculas: EnrollmentCounts | undefined, parametros: FundingParameters, localizacao?: string) {
  if (!matriculas) return 0;
  return calcularPonderadas(matriculas, parametros, localizacao) * ponderadorExercicio(parametros) * (parametros.vaaf_base || 0);
}

/** Total de matrículas ponderadas da rede municipal (com NSE e DRec). */
export function totalPonderadasRede(schools: any[] | null | undefined, parametros: FundingParameters) {
  const lista = (schools || []).filter((s: any) => String(s.tp_dependencia ?? '3') === '3');
  return lista.reduce((acc: number, s: any) => acc + calcularPonderadas(s.matriculas, parametros, s.localizacao), 0) * ponderadorExercicio(parametros);
}

export type ParametrosResolvidos = FundingParameters & {
  _origemFundeb: 'oficial' | 'calculado';
  _valorPonderadaCalculado: number;
  _totalPonderadas: number;
  _fundebCalculado: number;
};

/**
 * Devolve os parâmetros prontos para uso:
 * - se houver estimativa oficial do FUNDEB, o valor por matrícula ponderada passa a ser
 *   estimativa ÷ matrículas ponderadas da rede (o total fecha com a Portaria);
 * - senão, usa o `vaaf_base` digitado (cálculo automático).
 */
export function resolverParametros(parametros: FundingParameters, schools: any[] | null | undefined): ParametrosResolvidos {
  const total = totalPonderadasRede(schools, parametros);
  const oficial = Number(parametros.fundeb_estimativa_oficial) || 0;
  const base = {
    _valorPonderadaCalculado: parametros.vaaf_base,
    _totalPonderadas: total,
    _fundebCalculado: total * (parametros.vaaf_base || 0),
  };
  if (oficial > 0 && total > 0) {
    return { ...parametros, ...base, vaaf_base: oficial / total, _origemFundeb: 'oficial' };
  }
  return { ...parametros, ...base, _origemFundeb: 'calculado' };
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
 * 2.5. VAAR — Complementação baseada em resultados, distribuída proporcionalmente.
 */
export function calcularVAAR(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (!escola || totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const { vaar_total_rede } = parametros;
  return ((vaar_total_rede || 0) * escola.total_matriculas) / totalMatriculasRede;
}

/**
 * 3. PNAE — valor per capita diário × dias letivos (Res. CD/FNDE nº 1/2026).
 * Creche (parcial ou integral) R$ 1,57; tempo integral R$ 1,57; pré-escola R$ 0,82;
 * fundamental/EJA R$ 0,57; AEE no contraturno R$ 0,78.
 * Alunos da educação especial não são somados de novo (já estão nas etapas).
 */
export function calcularPNAE(matriculas: EnrollmentCounts | undefined, parametros?: FundingParameters) {
  if (!matriculas) return 0;
  const m: any = matriculas;
  const p: any = parametros?.pnae || {};
  const dias = p.dias_letivos || 200;
  const integral = p.integral_dia ?? 1.57;
  const creche = p.creche_dia ?? 1.57;
  const pre = p.pre_parcial_dia ?? 0.82;
  const ef = p.ef_parcial_dia ?? 0.57;
  const eja = p.eja_dia ?? 0.57;
  const aee = p.aee_dia ?? 0.78;

  return dias * (
    (n(m.creche_integral) + n(m.creche_conveniada_int)) * Math.max(integral, creche) +
    (n(m.creche_parcial) + n(m.creche_conveniada_par)) * creche +
    n(m.pre_integral) * integral +
    n(m.pre_parcial) * pre +
    (n(m.ef_ai_integral) + n(m.ef_af_integral)) * integral +
    (n(m.ef_ai_parcial) + n(m.ef_af_parcial)) * ef +
    (n(m.eja_fundamental) + n(m.eja_medio)) * eja +
    n(m.aee) * aee
  );
}

/**
 * 4. Recursos próprios da Educação (1500.1001) + royalties (1573) — lançados à mão e
 * distribuídos pelas matrículas. Não incluir aqui a parte do MDE que já foi para o FUNDEB.
 */
export function calcularMDE(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (!escola || totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const total = (parametros.mde_liquido_eti || 0) + (parametros.royalties || 0);
  return (total * escola.total_matriculas) / totalMatriculasRede;
}

/**
 * 5. QSE / Salário Educação e Outros — Distribuídos proporcionalmente.
 */
export function calcularOutros(escola: School, parametros: FundingParameters, totalMatriculasRede: number) {
  if (!escola || totalMatriculasRede <= 0 || !escola.total_matriculas) return 0;
  const total_outros = (parametros.qse || 0) + (parametros.pdde || 0) + (parametros.outros_repasses || 0);
  return (total_outros * escola.total_matriculas) / totalMatriculasRede;
}

/** Matrículas em tempo integral consideradas: o número verificado pela rede, quando houver; senão, o do INEP. */
export function etiConsiderado(escola: any) {
  const v = escola?.total_eti_verificado;
  return v !== undefined && v !== null && v !== '' ? Number(v) || 0 : Number(escola?.total_eti) || 0;
}
