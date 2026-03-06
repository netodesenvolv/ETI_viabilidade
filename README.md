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

## 🌐 Deploy em Produção (Ambiente Externo)

Esta aplicação está preparada para o **Firebase App Hosting**.

### Checklist Final de Deploy:

1. **Configurar Segredos (Obrigatório):** 
   - No Google Cloud Console, vá em **Secret Manager**.
   - Crie um segredo chamado `GEMINI_API_KEY` e insira sua chave do Google AI Studio.
   - Conceda permissão de "Acessador de Segredos" para a conta de serviço do App Hosting.

2. **Conectar Repositório:** 
   - No Console do Firebase, vá em "App Hosting".
   - Conecte seu repositório do GitHub.
   - O Firebase detectará o arquivo `apphosting.yaml` e iniciará o build automaticamente.

3. **Variáveis de Ambiente (Públicas):** 
   - Configure as variáveis `NEXT_PUBLIC_FIREBASE_*` no painel do App Hosting para que o Firebase Client funcione corretamente no navegador.

### Comandos de Terminal para Envio:

```bash
git add .
git commit -m "release: v1.5-pro - estrategista IA, simulador 1:2 e integração IBGE"
git push origin main
```

---
Desenvolvido como protótipo de alta fidelidade para gestão estratégica de redes municipais de educação.