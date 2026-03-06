# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## ☁️ Deploy Moderno (Firebase App Hosting) - IMPORTANTE

A imagem que você vê no console (Aguardando sua primeira versão) refere-se ao Hosting tradicional. **Para este projeto, você deve usar o APP HOSTING**.

### Passo a Passo para Ativar o Link Externo:

1. **Vá para o Menu Correto:** No Console do Firebase, no menu lateral esquerdo, clique em **Build (Criação)** e depois em **App Hosting** (fica logo abaixo do Hosting tradicional).
2. **Criar um Backend:** Clique em "Começar" ou "Adicionar Backend".
3. **Conectar ao GitHub:**
   - Selecione sua conta do GitHub.
   - Escolha o repositório `ETI_viabilidade`.
4. **Configurações de Build:**
   - Nome do Backend: `edufin-insights`
   - Região: `us-central1` (ou a de sua preferência).
   - Branch: `main` (ou a que você está usando).
5. **Finalizar:** Clique em "Concluir".

**O que acontece agora?**
O Firebase vai detectar seu arquivo `apphosting.yaml` e `package.json`, rodar o build nos servidores do Google e gerar um **novo link** automático. É neste novo link (dentro da aba App Hosting) que a Inteligência Artificial e o Banco de Dados funcionarão corretamente.

### 🌐 Configuração de Domínio (etiviabilidade.com)
Após criar o backend no **App Hosting**:
1. Dentro da aba **App Hosting**, vá em **Configurações**.
2. Clique em **Domínios** e adicione `etiviabilidade.com`.
3. Siga as instruções de DNS (Registros A e TXT) que aparecerão lá.

---

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais.
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas baseadas em dados fiscais reais.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas.
- **Redimensionamento Operacional:** Recálculo automático de custos baseado na ocupação.

---

## Checklist de Produção (Secret Manager)

Para que a IA funcione no link externo, você **precisa** configurar a chave no Google Cloud:
1. No [Google Cloud Console](https://console.cloud.google.com/), vá em **Secret Manager**.
2. Crie um segredo exatamente com o nome: `GEMINI_API_KEY`.
3. Adicione sua chave do Google AI Studio como o valor do segredo.
4. No Firebase App Hosting, conceda permissão para que o serviço acesse este segredo.

Desenvolvido para gestão estratégica de redes municipais de educação.