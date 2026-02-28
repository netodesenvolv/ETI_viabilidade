'use server';
/**
 * @fileOverview This file implements a Genkit flow to generate an AI-powered executive narrative report.
 *
 * - generateExecutiveFinancialReport - A function that triggers the AI to produce a financial report.
 * - GenerateExecutiveFinancialReportInput - The input type for the function, containing all necessary financial data.
 * - GenerateExecutiveFinancialReportOutput - The output type for the function, which is the narrative report text.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CompositionItemSchema = z.object({
  amount: z.number().describe('The total amount for this revenue source.'),
  percentage: z.number().describe('The percentage this revenue source contributes to the total.'),
});

const GenerateExecutiveFinancialReportInputSchema = z.object({
  municipio: z.string().describe('The name of the municipality.'),
  uf: z.string().describe('The state (UF) of the municipality.'),
  exercicio: z.number().describe('The fiscal year for the report.'),
  totalMatriculas: z.number().describe('Total number of enrollments in the network.'),
  totalETI: z.number().describe('Total number of full-time education (ETI) enrollments.'),
  percentualETI: z.number().describe('Percentage of ETI enrollments compared to total enrollments.'),
  custoAlunoMedio: z.number().describe('Average cost per student in the network.'),
  receitaAlunoMedio: z.number().describe('Average revenue per student in the network.'),
  saldoTotalRede: z.number().describe('Total financial balance of the network.'),
  saldoStatus: z.string().describe('Financial status of the network (e.g., "superávit", "déficit").'),
  escolasEmDeficit: z.number().describe('Number of schools operating at a deficit.'),
  totalEscolas: z.number().describe('Total number of schools in the network.'),
  escolasETIlt20Percent: z.number().describe('Number of schools with less than 20% ETI enrollments.'),
  composicaoReceitas: z.object({
    fundebVaaf: CompositionItemSchema,
    vaat: CompositionItemSchema,
    pnae: CompositionItemSchema,
    mdeLiquido: CompositionItemSchema,
    outros: CompositionItemSchema,
  }).describe('Composition of revenues for the entire network.'),
  escolasEmAtencao: z.array(z.string()).describe('List of 3-5 schools with the worst financial situation.'),
});

export type GenerateExecutiveFinancialReportInput = z.infer<typeof GenerateExecutiveFinancialReportInputSchema>;

const GenerateExecutiveFinancialReportOutputSchema = z.object({
  report: z.string().describe('The detailed executive narrative financial report.'),
});

export type GenerateExecutiveFinancialReportOutput = z.infer<typeof GenerateExecutiveFinancialReportOutputSchema>;

const financialReportPrompt = ai.definePrompt({
  name: 'financialReportPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: GenerateExecutiveFinancialReportInputSchema },
  output: { schema: GenerateExecutiveFinancialReportOutputSchema },
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  prompt: `Você é um especialista em financiamento da educação básica municipal brasileira.
Com base nos dados abaixo da rede municipal de {{{municipio}}}/{{{uf}}} para o exercício {{{exercicio}}},
gere um relatório executivo de diagnóstico financeiro para a Escola em Tempo Integral:

DADOS DA REDE:
- Total de matrículas: {{totalMatriculas}}
- Total em tempo integral (ETI): {{totalETI}} ({{percentualETI}}% das matrículas)
- Custo-aluno médio: R$ {{custoAlunoMedio}}
- Receita-aluno médio: R$ {{receitaAlunoMedio}}
- Saldo total da rede: R$ {{saldoTotalRede}} ({{saldoStatus}})
- Escolas em déficit: {{escolasEmDeficit}} de {{totalEscolas}}
- Escolas com % ETI < 20%: {{escolasETIlt20Percent}}

COMPOSIÇÃO DE RECEITAS (rede total):
- FUNDEB VAAF: R$ {{composicaoReceitas.fundebVaaf.amount}} ({{composicaoReceitas.fundebVaaf.percentage}}%)
- VAAT: R$ {{composicaoReceitas.vaat.amount}} ({{composicaoReceitas.vaat.percentage}}%)
- PNAE: R$ {{composicaoReceitas.pnae.amount}} ({{composicaoReceitas.pnae.percentage}}%)
- MDE Líquido: R$ {{composicaoReceitas.mdeLiquido.amount}} ({{composicaoReceitas.mdeLiquido.percentage}}%)
- Outros: R$ {{composicaoReceitas.outros.amount}} ({{composicaoReceitas.outros.percentage}}%)

ESCOLAS EM ATENÇÃO:
{{#each escolasEmAtencao}}
- {{{this}}}
{{/each}}

Produza o relatório no campo "report" do JSON de saída contendo:
1. Diagnóstico geral da rede (2 parágrafos)
2. Principais riscos identificados (bullet points)
3. Escolas que requerem atenção imediata (máximo 5, com justificativa)
4. Recomendações para o próximo exercício (3-5 recomendações priorizadas)
5. Perspectiva de expansão do tempo integral (1 parágrafo)

Tom: técnico, objetivo, adequado para apresentação à Secretaria de Finanças e ao CACS/FUNDEB.
Idioma: Português brasileiro.`,
});

const generateExecutiveFinancialReportFlow = ai.defineFlow(
  {
    name: 'generateExecutiveFinancialReportFlow',
    inputSchema: GenerateExecutiveFinancialReportInputSchema,
    outputSchema: GenerateExecutiveFinancialReportOutputSchema,
  },
  async (input) => {
    const { output } = await financialReportPrompt(input);
    if (!output || !output.report) {
      throw new Error('Falha ao gerar o diagnóstico da IA. Verifique os dados de entrada ou tente novamente.');
    }
    return output;
  }
);

export async function generateExecutiveFinancialReport(
  input: GenerateExecutiveFinancialReportInput
): Promise<GenerateExecutiveFinancialReportOutput> {
  return generateExecutiveFinancialReportFlow(input);
}
