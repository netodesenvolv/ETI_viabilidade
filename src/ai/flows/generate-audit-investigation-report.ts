'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AuditOutlierSchema = z.object({
  schoolName: z.string(),
  category: z.string(),
  value: z.number(),
  avgNetwork: z.number(),
  diffPercentage: z.number(),
});

const GenerateAuditInvestigationInputSchema = z.object({
  municipio: z.string(),
  uf: z.string(),
  exercicio: z.number(),
  avgTotalCost: z.number(),
  topOutliers: z.array(AuditOutlierSchema),
  networkAverages: z.record(z.number()),
});

export type GenerateAuditInvestigationInput = z.infer<typeof GenerateAuditInvestigationInputSchema>;

const GenerateAuditInvestigationOutputSchema = z.object({
  report: z.string().describe('The detailed audit investigation report.'),
});

export type GenerateAuditInvestigationOutput = z.infer<typeof GenerateAuditInvestigationOutputSchema>;

const auditInvestigationPrompt = ai.definePrompt({
  name: 'auditInvestigationPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: GenerateAuditInvestigationInputSchema },
  output: { schema: GenerateAuditInvestigationOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `Você é um Auditor de Controle Externo especializado em Contas Públicas da Educação.
Sua missão é gerar um plano de investigação direcionada para o município de {{{municipio}}}/{{{uf}}} (Exercício {{{exercicio}}}).

CONTEXTO DA REDE:
- Custo-Aluno Médio Consolidado: R$ {{avgTotalCost}}
- Médias por Categoria:
{{#each networkAverages}}
  * {{@key}}: R$ {{this}}
{{/each}}

CASOS PARA INVESTIGAÇÃO PRIORITÁRIA (OUTLIERS):
{{#each topOutliers}}
- Unidade: {{{schoolName}}}
  * Item Crítico: {{{category}}}
  * Valor Praticado: R$ {{value}} (Custo/Aluno)
  * Média da Rede: R$ {{avgNetwork}}
  * Desvio: +{{diffPercentage}}% acima da média.
{{/each}}

Sua resposta deve ser um "Roteiro de Investigação de Auditoria" estruturado em:
1. ANÁLISE DE DISPARIDADE (1 parágrafo explicando o impacto fiscal dos desvios encontrados)
2. FOCOS DE INVESTIGAÇÃO (Para cada uma das top 5 unidades citadas, aponte especificamente o que auditar: ex: conferência de contratos, folha de pagamento, desperdício de insumos, etc.)
3. HIPÓTESES DE ERRO (Liste 3 possíveis causas para esses desvios: erros de lançamento, ineficiência logística ou sobrepreço)
4. AÇÕES CORRETIVAS SUGERIDAS (3 ações práticas para reequilibrar esses custos)

Mantenha um tom de auditoria: rigoroso, analítico, preventivo e focado em eficiência do gasto público.
Idioma: Português brasileiro.`,
});

const generateAuditInvestigationFlow = ai.defineFlow(
  {
    name: 'generateAuditInvestigationFlow',
    inputSchema: GenerateAuditInvestigationInputSchema,
    outputSchema: GenerateAuditInvestigationOutputSchema,
  },
  async (input) => {
    const { output } = await auditInvestigationPrompt(input);
    if (!output || !output.report) {
      throw new Error('Falha ao gerar o relatório de auditoria.');
    }
    return output;
  }
);

export async function generateAuditInvestigationReport(
  input: GenerateAuditInvestigationInput
): Promise<GenerateAuditInvestigationOutput> {
  return generateAuditInvestigationFlow(input);
}
