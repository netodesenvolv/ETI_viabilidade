import { Firestore, collection, doc } from "firebase/firestore";

/**
 * Regra do sistema: o exercício financeiro N usa o Censo Escolar N-1.
 * Ex.: exercício 2026 = Censo 2025; exercício 2027 = Censo 2026.
 */
export const EXERCICIO_PADRAO = 2026;
export const censoDoExercicio = (exercicio: number) => exercicio - 1;

export type StatusExercicio = "realizado" | "projecao";

export interface ExercicioMeta {
  ano: number;
  censoAno: number;
  status: StatusExercicio;
  origem?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

/** Caminhos do Firestore de um exercício: municipios/{id}/exercicios/{ano}/... */
export function refsExercicio(db: Firestore, municipioId: string, exercicio: number) {
  const meta = doc(db, "municipios", municipioId, "exercicios", String(exercicio));
  return {
    meta,
    schools: collection(meta, "schools"),
    expenses: collection(meta, "expenses"),
    params: doc(meta, "config", "parameters"),
  };
}

/** Caminhos antigos (antes da separação por exercício). Usados só na migração. */
export function refsLegado(db: Firestore, municipioId: string) {
  return {
    schools: collection(db, "municipios", municipioId, "schools"),
    expenses: collection(db, "municipios", municipioId, "expenses"),
    params: doc(db, "municipios", municipioId, "config", "parameters"),
  };
}

export function rotuloExercicio(exercicio: number, status?: StatusExercicio) {
  const s = status === "projecao" ? "Projeção" : status === "realizado" ? "Realizado" : "";
  return `Exercício ${exercicio} · Censo ${censoDoExercicio(exercicio)}${s ? " · " + s : ""}`;
}
