# Sistema de Controle de Estoque — Cinépolis (Frontend)

Sistema ERP visual completo, tema claro moderno, responsivo, pronto para integração futura com backend. Sem dados mockados — listas vazias com estados "empty" elegantes. Apenas o **scanner de código de barras é funcional de verdade** (câmera real em mobile/tablet).

## Identidade Visual

- Tema claro, paleta neutra com verde Cinépolis como cor primária (verde vibrante para CTAs e sucesso, vermelho para erro/saída, âmbar para alertas de estoque baixo).
- Tipografia limpa (Inter), cards arredondados, sombras suaves, transições fluidas.
- Sidebar fixa à esquerda com ícones + labels; topbar com busca, ajuda, avatar do usuário.
- Layout responsivo: sidebar colapsa em drawer no mobile/tablet.

## Fluxo de Acesso

**Tela de Login (rota `/`)**
- Card central com logo, dois botões grandes lado a lado:
  - **Login Admin** → abre formulário (usuário + senha) → painel admin.
  - **Modo Operador** → entra direto no painel operador (sem login).
- Validação visual apenas; integração com backend virá depois.

## Painel ADMIN

**Sidebar:** Dashboard · Produtos · Entrada · Retirada · Movimentações · Inventário · Usuários · Configurações.
**Topbar:** busca global, ícone de ajuda, avatar + nome.

### Telas
1. **Dashboard** — cards de KPI (total produtos, estoque baixo, sem estoque, valor em estoque), gráfico de movimentações recentes, lista de últimas atividades. Estados vazios.
2. **Produtos** (tela principal, baseada na imagem) — título "Produtos" + contador, 4 cards superiores de KPI, barra com busca + filtros + categorias + exportar + **+ Produto**, tabela com colunas: favorito (estrela), produto (imagem + nome), categoria, estoque, preço, catálogo (toggle ativo/inativo), ações (editar/excluir).
3. **Cadastro de Produto** (modal/drawer ou rota) — campos: código de barras (com botão escanear no mobile), nome, categoria, unidade, preço, estoque inicial, estoque mínimo, upload de imagem. Botão **Cadastrar Produto**.
4. **Entrada de Produtos** — código de barras (com scanner mobile), área que mostra produto encontrado + estoque atual, quantidade, observação opcional, botão **Confirmar Entrada**.
5. **Retirada de Produtos** — código de barras, quantidade, matrícula, área com produto + estoque atual, botão **Confirmar Retirada** → modal pedindo senha + exibindo nome do responsável.
6. **Movimentações / Inventário** — abas (Movimentações | Estoque Atual), filtros por data, categoria e tipo, tabela: produto, tipo (entrada/saída badge colorido), quantidade, usuário, data, hora. Botão **Imprimir Relatório**.
7. **Usuários** — tabela de usuários (nome, matrícula, tipo, status), criar/editar via drawer, toggle ativo/inativo, seletor Administrador/Operador, permissões.
8. **Configurações** — placeholder com seções (perfil, sistema, notificações).

## Painel OPERADOR

**Sidebar simplificada:** Entrada de Produtos · Retirada de Produtos · Histórico.
**Topbar:** indicador "Modo Operador" + botão sair.

### Telas
1. **Entrada** — código de barras (scanner mobile), produto identificado, quantidade. Ao confirmar → modal de matrícula + senha; registra nome, data, hora.
2. **Retirada** — mesmo fluxo, com confirmação por matrícula + senha.
3. **Histórico** — lista cronológica das movimentações (entradas/saídas) com nome, data, hora, produto, quantidade, tipo (badge).

## Scanner de Código de Barras (FUNCIONAL)

- Biblioteca: **html5-qrcode** (suporta EAN/UPC/Code128, abre câmera traseira automaticamente, funciona em Android/iOS/Chrome/Safari).
- Detecção de dispositivo: botão **"Escanear código"** aparece **apenas em mobile/tablet** (via media query + user-agent). Em desktop, somente o input manual.
- Ao clicar: abre modal full-screen com viewfinder, preview da câmera traseira, animação de linha de leitura, botão cancelar.
- Ao detectar código: feedback visual verde + vibração (se suportado) + fecha modal + preenche o campo automaticamente.
- Tratamento de permissão negada com mensagem clara e botão para tentar novamente.
- Componente reutilizável usado em: Cadastro, Entrada e Retirada (admin e operador).

## Arquitetura Técnica

- **TanStack Start** com rotas separadas: `/`, `/admin/*`, `/operador/*`, layouts protegidos por estado de sessão local (placeholder até integração).
- Camada de dados isolada em `src/services/` com funções tipadas (`getProducts`, `createProduct`, `registerEntry`, etc.) retornando `Promise` — hoje retornam arrays vazios; amanhã trocam para chamadas reais ao backend sem tocar nas telas.
- Tipos TypeScript centralizados em `src/types/` (Product, Movement, User, etc.).
- Componentes shadcn/ui já disponíveis (table, dialog, drawer, form, toggle, tabs, sonner para toasts de sucesso/erro).
- `src/components/scanner/BarcodeScanner.tsx` encapsula html5-qrcode; hook `useIsMobileOrTablet` controla visibilidade do botão.
- Feedback global via toasts (verde sucesso / vermelho erro).

## Entregáveis

- Telas de Login, Painel Admin completo (8 telas) e Painel Operador completo (3 telas).
- Scanner real funcional em mobile/tablet, integrado nos 3 fluxos que usam código de barras.
- Estrutura de serviços/tipos pronta para plugar backend real depois.
- Sem dados mockados — estados vazios profissionais em todas as listas.
