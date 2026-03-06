# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## ☁️ Guia de Implantação (Firebase App Hosting)

### 1. Corrigir o erro de Build (Sua tela atual):
O arquivo `apphosting.yaml` foi corrigido para o formato padrão exigido pelo Google. Agora, basta você fazer o commit e push das alterações:
1. `git add .`
2. `git commit -m "fix: corrige formato do apphosting.yaml"`
3. `git push`

### 2. Configurar o Secret Manager (OBRIGATÓRIO para a IA funcionar):
Como você está usando o plano Blaze, você **precisa** configurar a chave no Google Cloud para que o link externo funcione:
1. Vá ao [Google Cloud Console](https://console.cloud.google.com/).
2. Procure por **Secret Manager**.
3. Crie um segredo chamado: `GEMINI_API_KEY`.
4. O valor deve ser a sua API Key do [Google AI Studio](https://aistudio.google.com/).
5. Dê permissão de "Acessador de Segredos" para a conta de serviço do App Hosting.

### 🌐 Configuração de Domínio (etiviabilidade.com)
Após o término do build (que leva uns 3-5 minutos):
1. No menu lateral, vá em **App Hosting**.
2. Clique no seu backend `edufin-insights`.
3. Vá na aba **Configurações** > **Domínios**.
4. Adicione `etiviabilidade.com` e siga as instruções de DNS.

---

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais.
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas baseadas em dados fiscais reais.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas.
- **Redimensionamento Operacional:** Recálculo automático de custos baseado na ocupação.

Desenvolvido para gestão estratégica de redes municipais de educação.
