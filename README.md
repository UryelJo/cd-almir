# 📑 Sistema Distribuído de Geração de Relatórios em PDF
### Arquitetura Orientada a Serviços (SOA), Microserviços, BullMQ, Puppeteer e Docker

Projeto desenvolvido para a disciplina acadêmica, demonstrando na prática o desacoplamento de serviços, processamento assíncrono em fila e renderização isolada de documentos PDF via Chromium Headless.

---

## 🎯 Conceitos Acadêmicos Aplicados (5 Conceitos)

| Conceito | Aplicação Prática no Projeto |
| :--- | :--- |
| **1. Microserviços** | Separação estrita de responsabilidades entre o `backend-publisher` (API Gateway / Produtor REST) e o `backend-consumer` (Worker isolado de renderização pesada em Chromium), comunicando-se via eventos Redis. |
| **2. Webservice (REST & SSE)** | Endpoints REST (`POST /api/reports`, `GET /api/reports`, `GET /api/reports/:id/pdf`) e canal em tempo real via **Server-Sent Events** (`GET /api/reports/events`) para retorno instantâneo no Front-end sem necessidade de polling. |
| **3. SOA (Arquitetura Orientada a Serviços)** | Desacoplamento através de barramento de mensagens/fila assíncrona, contratos de dados bem definidos (DTOs) e capacidade de reutilização do serviço gerador para múltiplos formatos e sistemas. |
| **4. Docker & Containerização** | `Dockerfile` customizado para cada serviço (com dependências nativas Linux e fontes gráficas para o Puppeteer no consumer e Nginx no front-end) orquestrados via `docker-compose.yml`. |
| **5. DevOps & Nuvem** | Padrão *Queue-Based Load Leveling*, builds multi-stage enxutos, volume compartilhado para persistência temporária de relatórios e isolamento de recursos (`shm_size`, rede bridge interna). |

---

## 🏗️ Arquitetura do Sistema

```
+-------------------------------------------------------------------------+
|                               FRONTEND                                  |
|            (Angular Standalone + Nginx Proxy Reverso - Porta 4200)      |
|  - Formulário Dinâmico de Edição de Relatórios                          |
|  - Monitor da Fila BullMQ com Retorno Direto via Server-Sent Events     |
+-------------------+----------------------------------^------------------+
                    | POST /api/reports                | SSE Stream (tempo real)
                    v                                  |
+------------------------------------------------------+------------------+
|                           BACKEND-PUBLISHER                             |
|              (NestJS API Gateway & Producer - Porta 3000)               |
|  - Validação de DTOs & Construção do Template HTML                      |
|  - Enfileiramento de Jobs na Fila BullMQ                                |
|  - Escuta Eventos de Conclusão (@EventPattern)                          |
+-------------------+----------------------------------^------------------+
                    | Enfileira Job                    | Emite Conclusão
                    v                                  |
        +----------------------------------------------------------+
        |                  REDIS (BullMQ + Pub/Sub)                |
        +----------------------------------------------------------+
                    | Consome Job                      ^
                    v                                  |
+------------------------------------------------------+------------------+
|                           BACKEND-CONSUMER                              |
|                       (NestJS Worker + Puppeteer)                       |
|  - Executa Chromium Headless com flags de isolamento Docker              |
|  - Renderiza HTML em formato A4 profissional                            |
|  - Salva PDF no volume compartilhado (/app/storage/pdfs)                |
|  - Notifica conclusão via ClientProxy (@nestjs/microservices)           |
+-------------------+-----------------------------------------------------+
                    |
                    v
        +----------------------------------------------------------+
        |       VOLUME COMPARTILHADO DOCKER (pdf_storage)          |
        +----------------------------------------------------------+
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Docker** e **Docker Compose** instalados na máquina.

### Passo 1: Subir toda a infraestrutura com 1 comando
Na raiz do projeto (`Almir/`), execute no terminal:

```bash
docker compose up --build
```

*(Ou com `-d` para rodar em segundo plano: `docker compose up --build -d`)*

### Passo 2: Acessar as aplicações
- **Front-end (Aplicação Web)**: [http://localhost:4200](http://localhost:4200)
- **API Publisher (REST)**: [http://localhost:3000/api/reports](http://localhost:3000/api/reports)
- **Redis**: Porta `6379`

---

## 🧪 Roteiro de Testes e Demonstração para a Apresentação

Para apresentar com facilidade para a banca ou professor, siga este roteiro:

### 1. Teste de Fluxo Completo (Retorno Direto)
1. Abra [http://localhost:4200](http://localhost:4200) no navegador.
2. Observe o indicador verde **"SSE Conectado (Tempo Real)"** no topo.
3. Edite o Título, Cliente, selecione uma cor de tema e adicione/remova itens na tabela.
4. Clique em **"Gerar Relatório em PDF (Enfileirar)"**.
5. Na coluna da direita, observe a transição automática de status:
   - `Na Fila` (BullMQ recebeu o job)
   - `Renderizando no Puppeteer...` (O worker Chromium iniciou a geração em background)
   - `PDF Pronto!` (O consumer finalizou, avisou o publisher via microserviço e o frontend recebeu o retorno direto)
6. Clique em **"Visualizar PDF"** ou **"Baixar"** para conferir o PDF formatado e estilizado.

### 2. Teste de Carga e Concorrência (Fila em Ação)
1. Clique no botão roxo **"⚡ Disparar Lote (5 PDFs)"**.
2. O sistema enviará 5 relatórios simultâneos com diferentes temas e dados.
3. Veja os contadores da fila mudando e os jobs sendo processados um a um pelo Puppeteer sem sobrecarregar a API principal.

### 3. Teste de Resiliência e Desacoplamento (Tolerância a Falhas)
1. Pare o container do Worker Puppeteer no terminal:
   ```bash
   docker compose stop backend-consumer
   ```
2. Envie 2 relatórios pelo Front-end: note que a API continua funcionando normalmente e os relatórios ficam aguardando na fila (`waiting`) sem gerar erro 500 para o usuário.
3. Reative o worker:
   ```bash
   docker compose start backend-consumer
   ```
4. Veja o Puppeteer acordar, consumir os relatórios acumulados e o Front-end atualizar para concluído automaticamente!

---

## 🛠️ Tecnologias Utilizadas

- **NestJS v11** (Framework Node.js com TypeScript e arquitetura modular)
- **BullMQ & Redis 7** (Fila robusta de alto desempenho baseada em Redis Streams)
- **Puppeteer & Chromium Headless** (Renderização fiel de HTML/CSS para formato A4)
- **Angular 19** (Front-end Standalone moderno, reativo com RxJS e Server-Sent Events)
- **Nginx Alpine** (Proxy reverso SPA de alta performance)
- **Docker & Docker Compose** (Empacotamento multi-stage e orquestração de microsserviços)

