"use client";

import Link from "next/link";
import { CalendarRange, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMunicipality } from "@/providers/municipality-provider";

/**
 * Chave de exercício: fica no topo de todas as telas.
 * Exercício N = Censo N-1. Todas as páginas leem e gravam no exercício escolhido aqui.
 */
export function ExercicioSelector() {
  const { exercicio, censoAno, statusExercicio, exerciciosDisponiveis, exercicioExiste, setExercicio } = useMunicipality();
  const anos = Array.from(new Set([...exerciciosDisponiveis.map(e => e.ano), exercicio])).sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="h-4 w-4 text-primary hidden sm:block" />
      <Select value={String(exercicio)} onValueChange={(v) => setExercicio(Number(v))}>
        <SelectTrigger className="h-8 w-[230px] text-xs font-bold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anos.map(a => {
            const meta = exerciciosDisponiveis.find(e => e.ano === a);
            return (
              <SelectItem key={a} value={String(a)} className="text-xs">
                Exercício {a} · Censo {a - 1}{meta ? (meta.status === "projecao" ? " · Projeção" : " · Realizado") : " · não aberto"}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {statusExercicio === "projecao" && (
        <span className="hidden md:inline text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Projeção</span>
      )}
      {!exercicioExiste && (
        <Link href="/dashboard/exercicios" className="hidden md:flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:underline" title={`O exercício ${exercicio} (Censo ${censoAno}) ainda não foi aberto`}>
          <AlertTriangle className="h-3 w-3" /> abrir/migrar
        </Link>
      )}
    </div>
  );
}
