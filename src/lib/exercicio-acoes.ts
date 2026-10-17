import { Firestore, getDocs, getDoc, writeBatch, doc, DocumentReference } from "firebase/firestore";
import { refsExercicio, refsLegado, censoDoExercicio } from "@/lib/exercicio";
import { normalizarParametros, FATORES_OFICIAIS } from "@/lib/constants";
import {
  resolverParametros, calcularVAAF, calcularVAAT, calcularVAAR, calcularPNAE, calcularMDE, calcularOutros, etiConsiderado,
} from "@/lib/calculations";

/** Grava uma lista de (ref, dados) em lotes de até 400 operações. */
async function gravarEmLotes(db: Firestore, itens: { ref: DocumentReference; data: any; merge?: boolean }[]) {
  for (let i = 0; i < itens.length; i += 400) {
    const batch = writeBatch(db);
    itens.slice(i, i + 400).forEach(it => batch.set(it.ref, it.data, it.merge ? { merge: true } : {}));
    await batch.commit();
  }
}

/** Quantos registros existem na estrutura antiga (antes da separação por exercício). */
export async function contarLegado(db: Firestore, municipioId: string) {
  const l = refsLegado(db, municipioId);
  const [s, e, p] = await Promise.all([getDocs(l.schools), getDocs(l.expenses), getDoc(l.params)]);
  return { escolas: s.size, despesas: e.size, parametros: p.exists() };
}

/**
 * Copia os dados da estrutura antiga (municipios/{id}/schools, expenses, config/parameters)
 * para o exercício informado. Não apaga nada da estrutura antiga.
 * Os fatores de ponderação são atualizados para a tabela oficial do exercício;
 * os fatores antigos ficam guardados em `_fatores_anteriores`.
 */
export async function migrarLegadoParaExercicio(db: Firestore, municipioId: string, ano: number) {
  const l = refsLegado(db, municipioId);
  const r = refsExercicio(db, municipioId, ano);
  const [schoolsSnap, expSnap, paramsSnap] = await Promise.all([getDocs(l.schools), getDocs(l.expenses), getDoc(l.params)]);

  const itens: { ref: DocumentReference; data: any; merge?: boolean }[] = [];
  schoolsSnap.docs.forEach(d => itens.push({ ref: doc(r.schools, d.id), data: { ...d.data(), censoAno: censoDoExercicio(ano), migradoEm: new Date().toISOString() } }));
  expSnap.docs.forEach(d => itens.push({ ref: doc(r.expenses, d.id), data: { ...d.data(), year: ano } }));

  if (paramsSnap.exists()) {
    const antigos: any = paramsSnap.data();
    const novos = normalizarParametros(antigos);
    itens.push({
      ref: r.params,
      data: {
        ...novos,
        fatores: { ...(FATORES_OFICIAIS[ano] || novos.fatores) },
        _fatores_anteriores: antigos.fatores || null,
        exercicio: ano,
        censoAno: censoDoExercicio(ano),
        migradoEm: new Date().toISOString(),
      },
    });
  }
  itens.push({
    ref: r.meta,
    data: { ano, censoAno: censoDoExercicio(ano), status: "realizado", origem: "migracao_estrutura_antiga", criadoEm: new Date().toISOString() },
    merge: true,
  });

  await gravarEmLotes(db, itens);
  return { escolas: schoolsSnap.size, despesas: expSnap.size, parametros: paramsSnap.exists() };
}

/**
 * Copia SÓ as despesas da estrutura antiga para o exercício (não mexe nas escolas).
 * Usado quando o exercício já existe (ex.: criado pelo Importador) e as despesas ficaram para trás.
 */
export async function migrarDespesasLegado(db: Firestore, municipioId: string, ano: number) {
  const l = refsLegado(db, municipioId);
  const r = refsExercicio(db, municipioId, ano);
  const expSnap = await getDocs(l.expenses);
  const itens = expSnap.docs.map(d => ({ ref: doc(r.expenses, d.id), data: { ...d.data(), year: ano, migradoEm: new Date().toISOString() } }));
  await gravarEmLotes(db, itens);
  return { despesas: expSnap.size };
}

/** Copia SÓ os parâmetros da estrutura antiga (fatores atualizados para a tabela oficial do exercício). */
export async function migrarParametrosLegado(db: Firestore, municipioId: string, ano: number) {
  const l = refsLegado(db, municipioId);
  const r = refsExercicio(db, municipioId, ano);
  const paramsSnap = await getDoc(l.params);
  if (!paramsSnap.exists()) return { parametros: false };
  const antigos: any = paramsSnap.data();
  const novos = normalizarParametros(antigos);
  await gravarEmLotes(db, [{
    ref: r.params,
    data: {
      ...novos,
      fatores: { ...(FATORES_OFICIAIS[ano] || novos.fatores) },
      _fatores_anteriores: antigos.fatores || null,
      exercicio: ano,
      censoAno: censoDoExercicio(ano),
      migradoEm: new Date().toISOString(),
    },
  }]);
  return { parametros: true };
}

/** Grupo de reajuste de cada categoria de despesa do EduFin. */
export function grupoDaCategoria(categoria: string): "pessoal" | "alimentacao" | "transporte" | "custeio" {
  const c = (categoria || "").toLowerCase();
  if (c.startsWith("pessoal")) return "pessoal";
  if (c.includes("alimenta")) return "alimentacao";
  if (c.includes("transporte")) return "transporte";
  return "custeio";
}

export interface OpcoesNovoExercicio {
  anoBase: number;
  anoNovo: number;
  /** Percentuais (ex.: 0.06 = 6%) */
  reajustes: { pessoal: number; alimentacao: number; transporte: number; custeio: number };
  /** Crescimento do valor por matrícula ponderada (ex.: 0.05 = 5%) */
  crescimentoValorPonderada: number;
  copiarEscolas: boolean;
}

/**
 * Abre um exercício projetado a partir de um exercício base:
 * - parâmetros: copia os do base, aplica a tabela oficial de fatores do novo ano (se houver),
 *   projeta o valor por matrícula ponderada e limpa a estimativa oficial;
 * - escolas: copia as do base (provisórias até importar o Censo do novo exercício);
 * - despesas: projeta cada lançamento do base com o reajuste do seu grupo.
 */
export async function criarExercicioProjetado(db: Firestore, municipioId: string, o: OpcoesNovoExercicio) {
  const base = refsExercicio(db, municipioId, o.anoBase);
  const novo = refsExercicio(db, municipioId, o.anoNovo);

  const existe = await getDoc(novo.meta);
  if (existe.exists()) throw new Error(`O exercício ${o.anoNovo} já existe.`);

  const [schoolsSnap, expSnap, paramsSnap] = await Promise.all([getDocs(base.schools), getDocs(base.expenses), getDoc(base.params)]);
  const schools = schoolsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  const pBase = resolverParametros(normalizarParametros(paramsSnap.exists() ? paramsSnap.data() : null), schools);

  const { _origemFundeb, _valorPonderadaCalculado, _totalPonderadas, _fundebCalculado, ...pLimpo } = pBase as any;
  const paramsNovos = {
    ...pLimpo,
    fatores: { ...(FATORES_OFICIAIS[o.anoNovo] || pBase.fatores) },
    vaaf_base: Math.round(pBase.vaaf_base * (1 + o.crescimentoValorPonderada) * 100) / 100,
    fundeb_estimativa_oficial: null,
    exercicio: o.anoNovo,
    censoAno: censoDoExercicio(o.anoNovo),
    origem: `projecao_a_partir_de_${o.anoBase}`,
    criadoEm: new Date().toISOString(),
  };

  const itens: { ref: DocumentReference; data: any; merge?: boolean }[] = [];
  itens.push({ ref: novo.params, data: paramsNovos });

  if (o.copiarEscolas) {
    schoolsSnap.docs.forEach(d => itens.push({ ref: doc(novo.schools, d.id), data: { ...d.data(), copiadoDe: o.anoBase } }));
  }

  expSnap.docs.forEach(d => {
    const e: any = d.data();
    const grupo = grupoDaCategoria(e.category);
    const fator = 1 + (o.reajustes[grupo] || 0);
    const cat = String(e.category || "Outros").replace(/[\s/()]+/g, "_");
    const id = `${e.schoolId}_${cat}_${o.anoNovo}`;
    itens.push({
      ref: doc(novo.expenses, id),
      data: {
        schoolId: e.schoolId, category: e.category,
        value: Math.round((Number(e.value) || 0) * fator * 100) / 100,
        year: o.anoNovo, projetado: true, baseAno: o.anoBase, valorBase: Number(e.value) || 0, reajuste: o.reajustes[grupo] || 0,
        updatedAt: new Date().toISOString(),
      },
    });
  });

  itens.push({
    ref: novo.meta,
    data: {
      ano: o.anoNovo, censoAno: censoDoExercicio(o.anoNovo), status: "projecao",
      origem: `projecao_a_partir_de_${o.anoBase}`, reajustes: o.reajustes, crescimentoValorPonderada: o.crescimentoValorPonderada,
      criadoEm: new Date().toISOString(),
    },
  });

  await gravarEmLotes(db, itens);
  return { escolas: o.copiarEscolas ? schoolsSnap.size : 0, despesas: expSnap.size };
}

export interface ResumoExercicio {
  ano: number;
  escolas: number;
  matriculas: number;
  eti: number;
  ponderadas: number;
  origemFundeb: "oficial" | "calculado";
  fundeb: number;
  outrasReceitas: number;
  receita: number;
  despesa: number;
  saldo: number;
  despesasProjetadas: boolean;
}

/** Totais de um exercício (rede municipal) para o comparativo. */
export async function resumoExercicio(db: Firestore, municipioId: string, ano: number): Promise<ResumoExercicio> {
  const r = refsExercicio(db, municipioId, ano);
  const [schoolsSnap, expSnap, paramsSnap] = await Promise.all([getDocs(r.schools), getDocs(r.expenses), getDoc(r.params)]);
  const schools: any[] = schoolsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  const munic = schools.filter(s => String(s.tp_dependencia ?? "3") === "3");
  const p = resolverParametros(normalizarParametros(paramsSnap.exists() ? paramsSnap.data() : null), schools);
  const totalMat = munic.reduce((a, s) => a + (Number(s.total_matriculas) || 0), 0);

  let fundeb = 0, outras = 0;
  munic.forEach(s => {
    fundeb += calcularVAAF(s.matriculas, p, s.localizacao);
    outras += calcularVAAT(s, p, totalMat) + calcularVAAR(s, p, totalMat) + calcularPNAE(s.matriculas, p) + calcularMDE(s, p, totalMat) + calcularOutros(s, p, totalMat);
  });
  const despesas: any[] = expSnap.docs.map(d => d.data());
  const despesa = despesas.reduce((a, e) => a + (Number(e.value) || 0), 0);

  return {
    ano,
    escolas: munic.length,
    matriculas: totalMat,
    eti: munic.reduce((a, s) => a + etiConsiderado(s), 0),
    ponderadas: p._totalPonderadas,
    origemFundeb: p._origemFundeb,
    fundeb,
    outrasReceitas: outras,
    receita: fundeb + outras,
    despesa,
    saldo: fundeb + outras - despesa,
    despesasProjetadas: despesas.some(e => e.projetado),
  };
}
