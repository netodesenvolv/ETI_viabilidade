/**
 * Metas de educação em tempo integral.
 * Padrão = novo PNE (Lei nº 15.388, de 14/04/2026), Objetivo 6, Meta 6.a:
 *  - até 2031 (5º ano de vigência): ao menos 50% das escolas públicas com matrículas em tempo integral,
 *    atendendo ao menos 35% dos estudantes;
 *  - até 2036 (fim do decênio): ao menos 65% das escolas, atendendo ao menos 50% dos estudantes.
 * O município pode adotar metas próprias (PME / Plano de Expansão) mais ambiciosas em Parâmetros → Metas.
 */
export interface MetaMarco { matriculas: number; escolas: number }
export interface MetasETI { m2031: MetaMarco; m2036: MetaMarco }

export const METAS_PNE: MetasETI = {
  m2031: { matriculas: 35, escolas: 50 },
  m2036: { matriculas: 50, escolas: 65 },
};

export const MARCOS: { chave: keyof MetasETI; ano: number }[] = [
  { chave: "m2031", ano: 2031 },
  { chave: "m2036", ano: 2036 },
];

export function metasDosParametros(p: any): MetasETI {
  const m = p?.metas || {};
  return {
    m2031: { ...METAS_PNE.m2031, ...(m.m2031 || {}) },
    m2036: { ...METAS_PNE.m2036, ...(m.m2036 || {}) },
  };
}

export function metasSaoAsDoPNE(m: MetasETI) {
  return MARCOS.every(({ chave }) =>
    m[chave].matriculas === METAS_PNE[chave].matriculas && m[chave].escolas === METAS_PNE[chave].escolas);
}

export interface SituacaoMarco {
  ano: number;
  metaMatriculas: number;
  metaEscolas: number;
  percMatriculas: number;
  percEscolas: number;
  /** Matrículas em tempo integral que ainda faltam (0 se já atingiu) */
  faltamMatriculas: number;
  /** Escolas que ainda precisam passar a ter tempo integral (0 se já atingiu) */
  faltamEscolas: number;
  atingiuMatriculas: boolean;
  atingiuEscolas: boolean;
  /** Anos até o marco, contados a partir do exercício informado */
  anosRestantes: number;
  /** Matrículas ETI novas por ano necessárias para chegar no marco */
  matriculasPorAno: number;
}

/**
 * Compara a rede com cada marco. Usa a rede atual (sem projetar crescimento do total de alunos).
 */
export function situacaoMetas(
  totais: { matriculas: number; eti: number; escolas: number; escolasComEti: number },
  metas: MetasETI,
  exercicio: number
): SituacaoMarco[] {
  const percM = totais.matriculas > 0 ? (totais.eti / totais.matriculas) * 100 : 0;
  const percE = totais.escolas > 0 ? (totais.escolasComEti / totais.escolas) * 100 : 0;
  return MARCOS.map(({ chave, ano }) => {
    const meta = metas[chave];
    const alvoM = Math.ceil((meta.matriculas / 100) * totais.matriculas);
    const alvoE = Math.ceil((meta.escolas / 100) * totais.escolas);
    const faltamMatriculas = Math.max(0, alvoM - totais.eti);
    const faltamEscolas = Math.max(0, alvoE - totais.escolasComEti);
    // A conferência do MEC usa o Censo: o exercício N reflete o Censo N-1.
    const anosRestantes = Math.max(1, ano - (exercicio - 1));
    return {
      ano,
      metaMatriculas: meta.matriculas,
      metaEscolas: meta.escolas,
      percMatriculas: percM,
      percEscolas: percE,
      faltamMatriculas,
      faltamEscolas,
      atingiuMatriculas: percM >= meta.matriculas,
      atingiuEscolas: percE >= meta.escolas,
      anosRestantes,
      matriculasPorAno: Math.ceil(faltamMatriculas / anosRestantes),
    };
  });
}
