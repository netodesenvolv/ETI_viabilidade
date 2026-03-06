# EduFin Insights - Plataforma de Gestão ETI (v1.0-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## Funcionalidades Implementadas (Versão Atual)

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais, análise de impacto fiscal e sugestões de captação (VAAR/PDDE).
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas no Painel Executivo e Análise Custo-Aluno para apresentações em Secretarias de Finanças e CACS.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas parciais em integrais.
- **Redimensionamento Operacional:** Recálculo automático de custos variáveis (merenda, transporte, utilidades) baseado na nova ocupação da escola, mantendo a folha de pagamento fixa.
- **Auditoria de Viabilidade:** Comparativo detalhado de rubricas antes e depois da expansão.

### 🏦 Motor de Cálculo FUNDEB 2026
- **Regra AEE Adicional:** Implementação da lógica de dupla matrícula onde o aluno de inclusão recebe o peso da etapa regular (ex: 1,10) **MAIS** o adicional de 1,40 (Total 2,50).
- **PNAE por CPF Único:** Garantia de que alunos de inclusão não dupliquem o custo da merenda escolar.
- **Rateio Municipal:** Ferramenta para distribuir custos centralizados (Transporte/Merenda) proporcionalmente por matrícula entre as unidades.

### 🛠️ Gestão de Dados e Admin
- **Pipeline Nacional 2025:** Importador mestre para distribuição de microdados INEP entre municípios.
- **Limpeza de Dados Órfãos:** Ferramenta para remover "lixo" de importações anteriores (escolas desativadas ou sem matrículas).
- **Gestão de Usuários:** Controle de acesso segmentado por município (Admin, Editor e Leitor).

## Tecnologias Utilizadas

- **Frontend:** Next.js 15, React 19, Tailwind CSS, Lucide React.
- **UI Components:** Radix UI, Shadcn UI.
- **Backend/Database:** Firebase (Auth, Firestore).
- **IA/LLM:** Genkit com Google Gemini 2.5 Flash.

## Como Comitar e Atualizar o GitHub

Sempre que concluir uma rodada de melhorias, execute no seu terminal:

1. `git add .`
2. `git commit -m "feat: implementado estrategista ia e refinamento de calculo aee"`
3. `git push`

---
Desenvolvido como protótipo de alta fidelidade para gestão estratégica de redes municipais de educação.
