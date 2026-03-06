# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade]

## ☁️ Guia de Implantação (Firebase App Hosting)

### 1. Corrigir o erro de Secret (PASSO OBRIGATÓRIO AGORA):
O build falhou porque o sistema busca a chave `GEMINI_API_KEY` no seu cofre de segurança. Siga estes passos:

1. Vá ao [Google Cloud Console](https://console.cloud.google.com/).
2. No topo, verifique se você está no projeto correto: `studio-6010766644-addb1`.
3. Pesquise por **Secret Manager** (Gerenciador de Segredos).
4. Clique em **Criar Segredo**.
5. Em **Nome**, digite exatamente: `GEMINI_API_KEY`.
6. Em **Valor do segredo**, cole a sua API Key gerada no [Google AI Studio](https://aistudio.google.com/app/apikey).
7. Clique em **Criar**.
8. **IMPORTANTE (Permissão):** Após criar, vá na aba "Permissões" do segredo, clique em "Conceder Acesso" e adicione o e-mail da conta de serviço do App Hosting (geralmente termina em `@gcp-sa-apphosting.iam.gserviceaccount.com`) com a função **Acessador de Segredos do Secret Manager**.

### 2. Reiniciar o Build:
Após criar o segredo acima, volte ao console do Firebase App Hosting e clique em **Criar Lançamento** ou faça um novo `git push`.

---

## 🛠️ Comandos de Atualização (Terminal)

Sempre que fizer mudanças no código, use esta sequência:

1. `git add .`
2. `git commit -m "feat: descrição da mudança"`
3. `git push`

---

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais.
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas baseadas em dados fiscais reais.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas.
- **Redimensionamento Operacional:** Recálculo automático de custos baseado na ocupação.

Desenvolvido para gestão estratégica de redes municipais de educação.
