# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais, análise de impacto fiscal e sugestões de captação (VAAR/PDDE).
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas no Painel Executivo e Análise Custo-Aluno.

### 🗺️ Gestão Inteligente de Localidades (API IBGE)
- **Busca Preditiva:** Integração com a API de Localidades do IBGE para preenchimento automático de Código IBGE e UF.
- **Alternador de Município (Admin):** Administradores podem trocar sua visão de rede instantaneamente no menu lateral para auditoria global.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas parciais em integrais.
- **Redimensionamento Operacional:** Recálculo automático de custos variáveis baseado na nova ocupação da escola (Headcount).
- **Auditoria de Viabilidade:** Comparativo detalhado de receitas e despesas no cenário simulado.

### 🏦 Motor de Cálculo FUNDEB 2026
- **Regra AEE Adicional:** Lógica de dupla matrícula (Fator Etapa + 1,40).
- **PNAE por CPF Único:** Garantia de que alunos de inclusão não dupliquem o custo da merenda escolar.

## 🌐 Deploy e Link de Acesso (Firebase App Hosting)

Após realizar o `git push`, o Firebase inicia o processo de deploy automaticamente.

### Como obter seu Link de Produção:

1. **Acesse o Console do Firebase:** [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. **Selecione seu Projeto:** Clique no projeto "EduFin Insights".
3. **Vá em App Hosting:** No menu lateral esquerdo, procure por "Build" e depois **"App Hosting"**.
4. **Verifique o Status:** Você verá um card com o nome do seu backend (ex: `eti-viabilidade`). Aguarde o status mudar de "In progress" para "Success".
5. **Clique na URL:** Abaixo do nome do seu backend, aparecerá um link terminando em `.web.app` ou `.firebaseapp.com`. **Este é o seu link de acesso externo oficial.**

### Checklist de Configuração (Secret Manager):

Antes do link funcionar 100%, você deve garantir que sua chave de IA está configurada no Google Cloud:
1. Vá no **Secret Manager** do Google Cloud.
2. Crie um segredo chamado `GEMINI_API_KEY`.
3. Adicione o valor da sua chave do AI Studio.
4. Dê permissão de "Secret Manager Secret Accessor" para a conta de serviço que o App Hosting criou.

---
Desenvolvido como protótipo de alta fidelidade para gestão estratégica de redes municipais de educação.