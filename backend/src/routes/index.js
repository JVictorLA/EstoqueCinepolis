const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middlewares/auth");

const authCtrl = require("../controllers/authController");
const produtoCtrl = require("../controllers/produtoController");
const movCtrl = require("../controllers/movimentacaoController");
const estoqueCtrl = require("../controllers/estoqueController");
const usuarioCtrl = require("../controllers/usuarioController");
const categoriaCtrl = require("../controllers/categoriaController");
const setupCtrl = require("../controllers/setupController");
const estoqueRoutes = require("./estoqueRoutes");
const desperdicioRoutes = require("./desperdicioRoutes");

const router = Router();

// Categorias
router.get("/categorias", asyncHandler(categoriaCtrl.listar));
router.post("/categorias", auth.authMiddleware, auth.adminOnly, asyncHandler(categoriaCtrl.criar));
router.patch(
  "/categorias/:id",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(categoriaCtrl.atualizar),
);
router.delete(
  "/categorias/:id",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(categoriaCtrl.remover),
);

// Health
router.get("/health", (_req, res) =>
  res.json({
    success: true,
    message: "API online",
    data: { ts: new Date() },
    error: null,
  }),
);

// Auth (somente admin)
router.post("/login", asyncHandler(authCtrl.login));

// Setup inicial
router.get("/setup/status", asyncHandler(setupCtrl.status));
router.post("/setup/master", asyncHandler(setupCtrl.criarMaster));

// Produtos
router.get("/produtos", asyncHandler(produtoCtrl.listar));
router.patch(
  "/produtos/:id/status",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(produtoCtrl.alterarStatus),
);
router.put(
  "/produtos/:id",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(produtoCtrl.atualizar),
);
router.delete(
  "/produtos/:id",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(produtoCtrl.remover),
);
router.get("/produtos/:codigo_barras", asyncHandler(produtoCtrl.buscarPorCodigo));
router.post("/produtos", auth.authMiddleware, auth.adminOnly, asyncHandler(produtoCtrl.criar));

// Movimentações
router.post("/movimentacoes/transferencia", asyncHandler(movCtrl.transferir));
router.post("/movimentacoes", asyncHandler(movCtrl.criar));
router.get("/movimentacoes", asyncHandler(movCtrl.listar));

// Estoque
router.get("/estoque", asyncHandler(estoqueCtrl.listar));
router.use("/estoques", estoqueRoutes);
router.use("/", desperdicioRoutes);

// ================= USUÁRIOS =================

// Listar usuários
router.get("/usuarios", auth.authMiddleware, auth.adminOnly, asyncHandler(usuarioCtrl.listar));

// Criar usuário
router.post("/usuarios", auth.authMiddleware, auth.adminOnly, asyncHandler(usuarioCtrl.criar));

// Atualizar usuário
router.put(
  "/usuarios/:id",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(usuarioCtrl.atualizar),
);

// Alterar senha
router.put("/usuarios/:id/senha", asyncHandler(usuarioCtrl.alterarSenha));

// Alterar status
router.patch(
  "/usuarios/:id/status",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(usuarioCtrl.alterarStatus),
);

// 🔥 IMPORTANTE: DEIXAR POR ÚLTIMO

router.get("/usuarios/:matricula", asyncHandler(usuarioCtrl.buscarPorMatricula));

router.patch(
  "/usuarios/:id/resetar-senha",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(usuarioCtrl.resetarSenha),
);

/* 
// ✅ ALTERNATIVA MAIS SEGURA (recomendado)
router.get(
  "/usuarios/matricula/:matricula",
  asyncHandler(usuarioCtrl.buscarPorMatricula)
); */

module.exports = router;
