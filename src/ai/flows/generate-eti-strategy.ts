
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
- Total de matrículas: {{totalMatriculas}}
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
