# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## ☁️ Guia de Implantação (Firebase App Hosting)

Para concluir a configuração que você está vendo no console do Firebase, siga estas instruções:

### 1. Configurar o back-end (Sua tela atual):
- **ID do back-end:** Digite `edufin-insights` (ou outro nome de sua preferência entre 3 e 30 caracteres, sem espaços).
- **Variáveis de ambiente:** O sistema já vai detectar as configurações do arquivo `apphosting.yaml`. Você não precisa adicionar nada manualmente nesta tela agora, pois as chaves do Firebase são injetadas automaticamente.
- **Botão Avançar:** Após digitar o ID, o botão ficará azul. Clique nele para prosseguir.

### 2. Associar um app da Web do Firebase:
- Na próxima tela (Passo 5), selecione o seu App Web existente ou crie um novo para vincular ao domínio.

### 🌐 Configuração de Domínio (etiviabilidade.com)
Após o término do build (que leva uns 3-5 minutos):
1. No menu lateral, vá em **App Hosting**.
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

---

## 🔐 Configuração do Secret Manager (OBRIGATÓRIO)

Para que a IA funcione no link externo, você **precisa** configurar a chave no Google Cloud:
1. Vá ao [Google Cloud Console](https://console.cloud.google.com/).
2. Procure por **Secret Manager**.
3. Crie um segredo chamado: `GEMINI_API_KEY`.
4. O valor deve ser a sua API Key do [Google AI Studio](https://aistudio.google.com/).
5. No Firebase App Hosting, certifique-se de que a conta de serviço tenha permissão "Acessador de Segredos".

Desenvolvido para gestão estratégica de redes municipais de educação.
