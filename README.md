# EduFin Insights - Plataforma de Gestão ETI (v1.5-Pro)

Este é um sistema avançado para análise de viabilidade financeira e técnica de **Escolas em Tempo Integral (ETI)** para redes municipais de educação, focado nos parâmetros do **FUNDEB 2026**.

## 🚀 Repositório Oficial
Acompanhe o desenvolvimento em: [https://github.com/netodesenvolv/ETI_viabilidade](https://github.com/netodesenvolv/ETI_viabilidade)

## ☁️ Deploy Moderno (Firebase App Hosting) - PASSO A PASSO FINAL

Conforme sua tela de configuração, preencha os campos exatamente assim para concluir:

### 1. Configurações de Implantação (Sua tela atual):
- **Ramificação ativa:** Digite `main` (ou a branch que você está usando no GitHub).
- **Diretório raiz do app:** Mantenha como `/`.
- **Lançamentos automáticos:** Deixe ativado (azul).
- **Avançar:** Clique no botão para prosseguir.

### 2. Configurações de Build (Próxima tela):
- **Nome do Backend:** `edufin-insights`
- **Região:** Mantenha `us-east4` (conforme você selecionou anteriormente).
- **Finalizar:** Clique em "Concluir".

**O que acontece agora?**
O Firebase vai detectar seu arquivo `apphosting.yaml`, rodar o build nos servidores do Google e gerar um **link automático**. Você poderá acompanhar o progresso na aba "App Hosting".

### 🌐 Configuração de Domínio (etiviabilidade.com)
Após o build terminar com sucesso:
1. Dentro da aba **App Hosting**, vá em **Configurações**.
2. Clique em **Domínios** e adicione `etiviabilidade.com`.
3. Siga as instruções de DNS (Registros A e TXT) que aparecerão lá na sua registradora de domínio.

---

## Funcionalidades Extraordinárias

### 🧠 Inteligência Artificial (Genkit + Gemini 2.5 Flash)
- **Estrategista ETI:** Geração de roteiros estratégicos personalizados com cronogramas plurianuais.
- **Diagnóstico Executivo:** Narrativas técnicas automatizadas baseadas em dados fiscais reais.

### 📊 Simulador de Expansão de Alta Precisão
- **Modelagem 1:1 e 1:2:** Projeção de impacto físico e financeiro ao converter turmas.
- **Redimensionamento Operacional:** Recálculo automático de custos baseado na ocupação.

---

## Checklist de Produção (Secret Manager) - OBRIGATÓRIO

Para que a IA funcione no link externo, você **precisa** configurar a chave no Google Cloud:
1. No [Google Cloud Console](https://console.cloud.google.com/), vá em **Secret Manager**.
2. Crie um segredo exatamente com o nome: `GEMINI_API_KEY`.
3. Adicione sua chave do Google AI Studio como o valor do segredo.
4. No Firebase App Hosting, conceda permissão para que o serviço acesse este segredo.

Desenvolvido para gestão estratégica de redes municipais de educação.