# Pelada Manager

Aplicacao web para gerenciar peladas entre amigos com perfis `ADM` e `JOGADOR`.

## Stack

- Backend: Node.js + Fastify + MongoDB
- Frontend: Angular 17 + Angular Material

> Observacao: no pedido veio "Node.js com FastAPI". Como FastAPI e do ecossistema Python, implementei em **Fastify** para manter backend em Node.js.

## Funcionalidades implementadas

- Login e signup (signup sempre cria `JOGADOR`)
- Cadastro de pelada por data (ADM)
- Configuracao de times (4 times com 5 jogadores cada, goleiros separados)
- Cadastro de resultados por time (vitoria/empate/derrota)
- Cadastro de gols e assistencias por jogador
- Abertura e finalizacao de votacao por pelada
- Votacao de nota (1 a 5) entre participantes da pelada
- Ranking geral de jogadores com totais e nota media
- Recalculo global consistente dos totais quando dados da pelada mudam

## Estrutura do projeto

- `backend/`: API Fastify + Mongoose
- `frontend/`: Aplicacao Angular

## Como rodar

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API sobe por padrao em `http://localhost:3000`.

### 2) Criar/atualizar usuario ADM (opcional)

```bash
cd backend
npm run seed:admin -- "Administrador" "admin" "admin123"
```

### 3) Frontend

```bash
cd frontend
npm install
npm start
```

App sobe por padrao em `http://localhost:4200` e usa a API em `http://localhost:3000`.

## Principais rotas da API

### Auth

- `POST /auth/signup`
- `POST /auth/login`

### Usuarios

- `GET /users/me`
- `GET /users`
- `PATCH /users/:id/initial-rating` (ADM)

### Peladas

- `GET /peladas`
- `POST /peladas` (ADM)
- `GET /peladas/:id`
- `PATCH /peladas/:id/teams` (ADM)
- `PATCH /peladas/:id/results` (ADM)
- `PATCH /peladas/:id/player-stats` (ADM)
- `POST /peladas/:id/voting/open` (ADM)
- `POST /peladas/:id/voting/finish` (ADM)
- `GET /peladas/:id/rating-cards`
- `POST /peladas/:id/votes`

## MongoDB local com Docker Compose

Na raiz do projeto:

```bash
docker compose up -d mongodb
```

Para verificar status:

```bash
docker compose ps
```

Para parar o banco:

```bash
docker compose down
```

A conexao do backend continua:

```env
MONGO_URI=mongodb://localhost:27017/pelada_manager
```
