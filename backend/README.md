# Estoque Cinépolis — Backend API

API REST profissional em **Node.js + Express + MySQL2** para o sistema de
controle de estoque do cinema. Conecta-se ao banco MySQL real
(`estoque_cinema`) usando **exatamente** os nomes de tabelas e colunas já
existentes — nada é renomeado nem inventado.

## Estrutura

```
src/
  config/         # leitura de .env
  database/       # pool de conexão MySQL
  middlewares/    # auth JWT, adminOnly, erros
  controllers/    # regras das rotas
  routes/         # registro de rotas
  services/       # acesso ao banco (produtos, usuários, movimentações)
  utils/          # respostas padrão, async handler, seed admin
  app.js          # instancia o Express
  server.js       # sobe o servidor
```

## Como rodar

```bash
cp .env.example .env       # ajuste se necessário
npm install
npm run start              # produção
npm run dev                # desenvolvimento (nodemon)
```

A API sobe em `http://localhost:3333`.

### Criar o primeiro admin

```bash
node src/utils/createAdmin.js 0001 "Gerente" SenhaSegura123 gerente@cinepolis.com
```

## Banco

Conecta a `127.0.0.1:3306`, banco `estoque_cinema`, usuário `cinepolis_estacao`.
Edite `.env` para apontar para outro host se precisar.

Tabelas usadas (nomes EXATOS do banco real):

- `categorias` — id, nome
- `produtos` — id, codigo_barras, nome, categoria_id, unidade, preco_venda, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em
- `alertas_estoque` — id, produto_id, tipo, resolvido, criado_em
- `usuarios` — id, matricula, nome, email, senha_hash, tipo, ativo, criado_em
- `movimentacoes` — id, produto_id, usuario_id, tipo, quantidade, estoque_antes, estoque_depois, usuario_nome, produto_nome, observacao, criado_em

## Padrão de resposta

Todas as respostas seguem:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... },
  "error": null
}
```

## Rotas

| Método | Rota                          | Acesso             | Descrição |
|-------:|-------------------------------|--------------------|-----------|
| GET    | `/health`                     | público            | status da API |
| POST   | `/login`                      | público (admin)    | login por matrícula + senha (apenas tipo=admin) |
| GET    | `/produtos`                   | público*           | lista produtos com categoria e flags de estoque |
| GET    | `/produtos/:codigo_barras`    | público*           | busca por código de barras |
| POST   | `/produtos`                   | **admin (JWT)**    | cadastra novo produto |
| POST   | `/movimentacoes`              | matrícula+senha    | entrada ou saída (admin OU operador) |
| GET    | `/movimentacoes`              | público*           | lista com filtros: data_inicial, data_final, tipo, produto_id, codigo_barras, usuario_id |
| GET    | `/estoque`                    | público*           | posição atual com status (`ok` / `baixo_estoque` / `sem_estoque`) |
| GET    | `/usuarios`                   | **admin (JWT)**    | lista usuários |
| POST   | `/usuarios`                   | **admin (JWT)**    | cria usuário (senha → bcrypt) |
| PUT    | `/usuarios/:id`               | **admin (JWT)**    | edita usuário |
| PATCH  | `/usuarios/:id/status`        | **admin (JWT)**    | ativa/desativa |

\* Rotas marcadas como "público" devem ser consumidas pelo frontend que já
roda na rede interna do cinema. Se quiser exigir JWT também nelas, basta
adicionar `auth.authMiddleware` em `src/routes/index.js`.

### Login (admin)

```
POST /login
{ "matricula": "0001", "senha": "SenhaSegura123" }
```

Retorno:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "usuario": { "id": 1, "matricula": "0001", "nome": "Gerente", "tipo": "admin", "ativo": true }
  }
}
```

Use o token nos endpoints admin: `Authorization: Bearer <token>`.

### Movimentação (entrada/saída)

```
POST /movimentacoes
{
  "codigo_barras": "7891234567890",
  "matricula": "1234",
  "senha": "senhaDoOperador",
  "tipo": "saida",            // ou "entrada"
  "quantidade": 2,
  "observacao": "Sessão 19h"   // opcional
}
```

Regras aplicadas:
- valida matrícula + senha (bcrypt) — admin **ou** operador
- bloqueia usuário inativo
- usa transação MySQL com `SELECT ... FOR UPDATE` no produto
- nunca permite estoque negativo
- atualiza `produtos.estoque_atual` + `atualizado_em`
- grava em `movimentacoes` com `estoque_antes`, `estoque_depois`, `usuario_nome`, `produto_nome`
- se `estoque_depois <= estoque_minimo`, cria alerta `baixo_estoque` em `alertas_estoque` (não duplica se já houver um aberto)

## Segurança

- Senhas armazenadas em `senha_hash` com **bcrypt** (rounds = 10)
- JWT com expiração configurável (`JWT_EXPIRES_IN`)
- Middleware `authMiddleware` valida token; `adminOnly` restringe rotas admin
- Toda movimentação revalida senha do usuário, mesmo após login
- Operador **nunca** pode acessar rotas admin (`/produtos POST`, `/usuarios*`)

## Integração com o frontend

O frontend já está pronto com a camada `src/services/api.ts` retornando
`Promise`. Basta substituir aquelas funções por `fetch` para esta API:

```ts
const API = "http://SEU-SERVIDOR:3333";

export async function getProducts() {
  const r = await fetch(`${API}/produtos`);
  const j = await r.json();
  return j.data;
}
```
