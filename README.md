# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade]

## ☁️ Guia de Implantação (Firebase App Hosting)

### 1. Corrigir o erro de Build:
O arquivo `apphosting.yaml` foi ajustado para incluir o campo `value` obrigatório. Para que o build funcione:
1. Certifique-se de preencher as chaves do Firebase no arquivo `apphosting.yaml` ou configure-as como **Segredos** no Console do Firebase.
2. Faça o push das alterações:
   - `git add .`
   - `git commit -m "fix: adiciona campos obrigatórios ao apphosting.yaml"`
   - `git push`

### 2. Configurar o Secret Manager (OBRIGATÓRIO para a IA):
1. Vá ao [Google Cloud Console](https://console.cloud.google.com/).
2. Procure por **Secret Manager**.
3. Crie um segredo chamado: `GEMINI_API_KEY`.
4. O valor deve ser a sua API Key do [Google AI Studio](https://aistudio.google.com/).
5. Conceda a permissão de "Acessador de Segredos" para a conta de serviço do App Hosting (geralmente termina em `@gcp-sa-apphosting.iam.gserviceaccount.com`).

### 🌐 Configuração de Domínio (etiviabilidade.com)
1. No Console do Firebase, vá em **App Hosting**.
2. Clique no seu backend `edufin-insights`.
3. Vá na aba **Configurações** > **Domínios**.
4. Adicione `etiviabilidade.com` e siga as instruções de DNS (Registros A e TXT).

---

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais.
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas baseadas em dados fiscais reais.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas.
- **Redimensionamento Operacional:** Recálculo automático de custos baseado na ocupação.

Desenvolvido para gestão estratégica de redes municipais de educação.
