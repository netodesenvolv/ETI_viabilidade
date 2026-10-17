import { FundingParameters, CustosETI } from "@/types";
import { DEFAULT_PARAMETERS } from "@/lib/constants";
import { ponderadorExercicio, etiConsiderado } from "@/lib/calculations";

/**
 * Motor comum da expansão do tempo integral (usado pelo Simulador e pelo Estrategista).
 *
 * Regras adotadas:
 * - Meta do PNE (Lei 15.388/2026, Meta 6.a): o percentual é calculado SEM a EJA
 *   (mesmo critério do indicador do MEC): creche + pré + fundamental.
 * - Custo a mais: modelo por turma (professor 20h a mais + apoio + merenda extra).
 * - Receita a mais do FUNDEB: diferença entre o fator integral e o parcial da etapa.
 *   O dinheiro chega com defasagem: a matrícula do Censo do ano N só entra no FUNDEB de N+1.
 */

export type EtapaETI = "creche" | "pre" | "ef_ai" | "ef_af";
export type GrupoCusto = "ei" | "ef";

function n(v: any) { return Number(v) || 0; }

export function custosDosParametros(p?: Partial<FundingParameters> | null): CustosETI {
  return { ...DEFAULT_PARAMETERS.custos_eti!, ...((p as any)?.custos_eti || {}) };
}

export function grupoDaEtapa(etapa: EtapaETI): GrupoCusto {
  return etapa === "creche" || etapa === "pre" ? "ei" : "ef";
}

/** Custo anual a mais de UMA turma que passa de parcial para integral (pessoal + merenda). */
export function custoExtraPorTurma(etapa: EtapaETI, p?: Partial<FundingParameters> | null) {
  const c = custosDosParametros(p);
  const g = grupoDaEtapa(etapa);
  const alunos = g === "ei" ? c.ei_alunos_turma : c.ef_alunos_turma;
  const profs = g === "ei" ? c.ei_prof_turma : c.ef_prof_turma;
  const apoios = g === "ei" ? c.ei_apoio_turma : c.ef_apoio_turma;
  const fatorAnual = c.meses_ano * (1 + c.encargos);
  const pessoal = (profs * c.prof20h_mensal + apoios * c.apoio40h_mensal) * fatorAnual;
  const merenda = alunos * c.merenda_extra_mes * c.meses_merenda;
  return { pessoal, merenda, total: pessoal + merenda, alunos };
}

/** Custo anual a mais POR ALUNO que passa de parcial para integral. */
export function custoExtraPorAluno(etapa: EtapaETI, p?: Partial<FundingParameters> | null) {
  const t = custoExtraPorTurma(etapa, p);
  return t.alunos > 0 ? t.total / t.alunos : 0;
}

/** Diferença de fator FUNDEB (integral − parcial) por etapa. */
export function difFator(etapa: EtapaETI, p: FundingParameters) {
  const f: any = p.fatores || {};
  switch (etapa) {
    case "creche": return (f.A1 ?? 1.55) - (f.A2 ?? 1.25);
    case "pre": return (f.B1 ?? 1.5) - (f.B2 ?? 1.15);
    case "ef_ai": return (f.C1 ?? 1.5) - (f.C2 ?? 1.0);
    case "ef_af": return (f.D1 ?? 1.5) - (f.D2 ?? 1.1);
  }
}

/** Receita anual a mais do FUNDEB (VAAF) por aluno convertido — chega no exercício seguinte ao Censo. */
export function receitaExtraFundebPorAluno(etapa: EtapaETI, p: FundingParameters, rural = false) {
  const campo = rural ? (p.fatores?.G2 || 1.15) : 1;
  return difFator(etapa, p) * campo * (p.vaaf_base || 0) * ponderadorExercicio(p);
}

/** PNAE a mais por aluno convertido (valor integral − valor parcial da etapa) × dias letivos. */
export function receitaExtraPnaePorAluno(etapa: EtapaETI, p: FundingParameters) {
  const q: any = p.pnae || {};
  const dias = q.dias_letivos || 200;
  const integral = q.integral_dia ?? 1.57;
  const parcial = etapa === "creche" ? (q.creche_dia ?? 1.57) : etapa === "pre" ? (q.pre_parcial_dia ?? 0.82) : (q.ef_parcial_dia ?? 0.57);
  return Math.max(0, integral - parcial) * dias;
}

/** Exercício em que a matrícula do Censo `anoCenso` passa a gerar FUNDEB. */
export function exercicioDaReceita(anoCenso: number) {
  return anoCenso + 1;
}

/** Matrículas que contam na meta do PNE (sem EJA). */
export function baseMetaMatriculas(escola: any) {
  const m: any = escola?.matriculas || {};
  const soma =
    n(m.creche_integral) + n(m.creche_parcial) + n(m.creche_conveniada_int) + n(m.creche_conveniada_par) +
    n(m.pre_integral) + n(m.pre_parcial) +
    n(m.ef_ai_integral) + n(m.ef_ai_parcial) + n(m.ef_af_integral) + n(m.ef_af_parcial);
  // Escolas cadastradas sem o detalhe por etapa: usa o total menos a EJA
  if (soma === 0) return Math.max(0, n(escola?.total_matriculas) - n(m.eja_fundamental) - n(m.eja_medio));
  return soma;
}

/** Percentual de tempo integral da rede no critério do PNE (sem EJA). */
export function pctETIRede(schools: any[] | null | undefined) {
  const lista = (schools || []).filter((s: any) => String(s.tp_dependencia ?? "3") === "3");
  const base = lista.reduce((a, s) => a + baseMetaMatriculas(s), 0);
  const eti = lista.reduce((a, s) => a + etiConsiderado(s), 0);
  return { base, eti, pct: base > 0 ? (eti / base) * 100 : 0 };
}

/**
 * Mínimo de 4% do FUNDEB para criar matrículas em tempo integral (EC 135/2024; Res. CIF 23/2026).
 * Base: FUNDEB (estimativa oficial ou cálculo automático) + VAAT + VAAR.
 */
export function minimo4Pct(p: FundingParameters & { _fundebCalculado?: number }) {
  const fundeb = n(p.fundeb_estimativa_oficial) || n(p._fundebCalculado);
  const base = fundeb + n(p.vaat_total_rede) + n(p.vaar_total_rede);
  return { base, minimo: base * 0.04 };
}
