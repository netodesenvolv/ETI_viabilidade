# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## ☁️ Deploy Moderno (Firebase App Hosting)

Diferente do Firebase Hosting tradicional, esta aplicação utiliza o **Firebase App Hosting**, que é otimizado para Next.js com Renderização no Servidor (SSR) e IA.

### Como funciona o Deploy:
1. **Você não precisa rodar** `npm run build` nem `firebase deploy` no seu computador.
2. **Fluxo de Trabalho:** Basta fazer o `git push` para o seu repositório no GitHub.
3. **Build na Nuvem:** O Firebase detecta a alteração, cria o ambiente de produção, instala o Node.js, roda o build e faz o deploy de forma 100% automatizada nos servidores do Google.

### Onde encontrar seu link:
1. Acesse o [Console do Firebase](https://console.firebase.google.com/).
2. Vá em **Build > App Hosting** no menu lateral.
3. Clique no seu backend (ex: `eti-viabilidade`).
4. A **URL de Produção** (terminando em `.web.app`) aparecerá no topo da página assim que o primeiro build terminar.

---

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais, análise de impacto fiscal e sugestões de captação (VAAR/PDDE).
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas no Painel Executivo e Análise Custo-Aluno.

### 🗺️ Gestão Inteligente de Localidades (API IBGE)
- **Busca Preditiva:** Integração com a API de Localidades do IBGE para preenchimento automático de Código IBGE e UF.
- **Alternador de Município (Admin):** Administradores podem trocar sua visão de rede instantaneamente para auditoria global.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas parciais em integrais.
- **Redimensionamento Operacional:** Recálculo automático de custos variáveis baseado na nova ocupação (Headcount) no modelo 1:2.

### 🏦 Motor de Cálculo FUNDEB 2026
- **Regra AEE Adicional:** Lógica de dupla matrícula (Fator Etapa + 1,40).
- **Sustentabilidade:** Comparativo detalhado de receitas e despesas no cenário simulado.

---

## Checklist de Produção (Secret Manager)

Para que a Inteligência Artificial funcione no link externo, você deve configurar a chave no Google Cloud:
1. No Google Cloud Console, vá em **Secret Manager**.
2. Crie um segredo chamado `GEMINI_API_KEY`.
3. Adicione sua chave do Google AI Studio como valor.
4. Garanta que a conta de serviço do App Hosting tenha a permissão "Secret Manager Secret Accessor".

Desenvolvido para gestão estratégica de redes municipais de educação.