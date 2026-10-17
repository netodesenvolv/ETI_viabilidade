
'use server';
/**
 * @fileOverview Genkit flow to generate a strategic ETI expansion roadmap.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEtiStrategyInputSchema = z.object({
  municipio: z.string(),
  uf: z.string(),
  totalMatriculas: z.number(),
  totalETI: z.number(),
  pctETI: z.number(),
  vaaf: z.number(),
  receitaTotal: z.number(),
  despesaTotal: z.number(),
  saldo: z.number(),
  numEscolas: z.number(),
  metaPct: z.number(),
  prazoAnos: z.number(),
  prioridade: z.string(),
  restricao: z.string().optional(),
  observacoes: z.string().optional(),
  /** Custo anual a mais por aluno convertido (modelo por turma, aba Custos ETI) */
  custoExtraAlunoEF: z.number().optional(),
  custoExtraAlunoEI: z.number().optional(),
  /** Mínimo anual de 4% do FUNDEB para tempo integral (Res. CIF 23/2026) */
  minimo4Pct: z.number().optional(),
});

export type GenerateEtiStrategyInput = z.infer<typeof GenerateEtiStrategyInputSchema>;

const GenerateEtiStrategyOutputSchema = z.object({
  report: z.string().describe('The strategic roadmap in markdown format.'),
});

export type GenerateEtiStrategyOutput = z.infer<typeof GenerateEtiStrategyOutputSchema>;

const etiStrategyPrompt = ai.definePrompt({
  name: 'etiStrategyPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: GenerateEtiStrategyInputSchema },
  output: { schema: GenerateEtiStrategyOutputSchema },
  prompt: `Você é um especialista em financiamento da educação básica brasileira, com profundo conhecimento do FUNDEB, PNAE, PNE e política de Educação em Tempo Integral (ETI). Analisa dados reais de redes municipais e produz roteiros estratégicos práticos e financeiramente viáveis.

Analise a situação da rede municipal de {{{municipio}}}/{{{uf}}} e elabore um roteiro estratégico de expansão ETI.

DADOS ATUAIS DA REDE:
- Total de matrículas (sem EJA, critério do PNE/MEC): {{totalMatriculas}}
- Matrículas ETI hoje: {{totalETI}} ({{pctETI}}%)
- Meta desejada: {{metaPct}}% em {{prazoAnos}} anos
- VAAF atual: R$ {{vaaf}}
- Receita total estimada: R$ {{receitaTotal}}
- Despesa registrada: R$ {{despesaTotal}}
- Saldo atual: R$ {{saldo}}
- Escolas da rede: {{numEscolas}}
- Prioridade definida: {{prioridade}}
- Restrição orçamentária anual: {{#if restricao}}R$ {{restricao}}{{else}}Não informada{{/if}}
- Observações: {{#if observacoes}}{{{observacoes}}}{{else}}Nenhuma{{/if}}
{{#if custoExtraAlunoEF}}- Custo a mais por aluno/ano ao passar para integral: fundamental R$ {{custoExtraAlunoEF}}; educação infantil R$ {{custoExtraAlunoEI}}{{/if}}
{{#if minimo4Pct}}- Mínimo anual de 4% do FUNDEB destinado à criação de matrículas em tempo integral: R$ {{minimo4Pct}}{{/if}}

REGRAS OBRIGATÓRIAS PARA OS CÁLCULOS:
- Use exatamente os custos por aluno informados acima (não invente outros valores).
- A meta é medida sobre as matrículas sem EJA, conferida pelo Censo Escolar do ano do marco.
- A receita a mais do FUNDEB de um aluno integral só chega no exercício seguinte ao Censo em que ele foi contado; no primeiro ano a rede paga o custo sem a receita.
- Diferença de fator (integral − parcial) sobre o VAAF: creche 0,30; pré 0,35; anos iniciais 0,50; anos finais 0,40.
- Se houver restrição orçamentária, o custo adicional anual não pode ultrapassá-la.

ELABORE UM ROTEIRO COMPLETO (Markdown):
1. Diagnóstico financeiro atual (2-3 parágrafos focando na sustentabilidade).
2. Cronograma ano a ano em tabela: Colunas (Ano | Novas ETI | Acumulado % | Impacto VAAF | Custo Adicional | Saldo Projetado).
3. Estratégias prioritárias por escola (quais converter primeiro considerando o perfil de receita/custo).
4. Riscos e mitigações (Jurídico, Pedagógico e Financeiro).
5. Indicadores de monitoramento trimestral.
6. Recomendações para captação de recursos adicionais (VAAR, convênios, PDDE Integral).

Tom: altamente profissional, consultivo e focado em viabilidade fiscal.`,
});

const generateEtiStrategyFlow = ai.defineFlow(
  {
    name: 'generateEtiStrategyFlow',
    inputSchema: GenerateEtiStrategyInputSchema,
    outputSchema: GenerateEtiStrategyOutputSchema,
  },
  async (input) => {
    const { output } = await etiStrategyPrompt(input);
    if (!output) throw new Error('Falha ao gerar o roteiro estratégico.');
    return output;
  }
);

export async function generateEtiStrategy(
  input: GenerateEtiStrategyInput
): Promise<GenerateEtiStrategyOutput> {
  return generateEtiStrategyFlow(input);
}
