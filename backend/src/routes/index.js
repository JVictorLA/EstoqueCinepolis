const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middlewares/auth");

const authCtrl = require("../controllers/authController");
const produtoCtrl = require("../controllers/produtoController");
const movCtrl = require("../controllers/movimentacaoController");
const estoqueCtrl = require("../controllers/estoqueController");
const usuarioCtrl = require("../controllers/usuarioController");
const categoriaCtrl = require("../controllers/categoriaController");

const router = Router();

// Categorias
router.get("/categorias", asyncHandler(categoriaCtrl.listar));

// Health
router.get("/health", (_req, res) =>
  res.json({ success: true, message: "API online", data: { ts: new Date() }, error: null })
);

// Auth (somente admin)
router.post("/login", asyncHandler(authCtrl.login));

// Produtos
router.get("/produtos", asyncHandler(produtoCtrl.listar));
router.get("/produtos/:codigo_barras", asyncHandler(produtoCtrl.buscarPorCodigo));
router.post(
  "/produtos",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(produtoCtrl.criar)
);

// Movimentações
// POST não exige JWT — autentica pela matrícula+senha do operador/admin no body.
router.post("/movimentacoes", asyncHandler(movCtrl.criar));
router.get("/movimentacoes", asyncHandler(movCtrl.listar));

// Estoque
router.get("/estoque", asyncHandler(estoqueCtrl.listar));

// Usuários (apenas admin autenticado)
router.get(
  "/usuarios",
  auth.authMiddleware, auth.adminOnly,
  asyncHandler(usuarioCtrl.listar)
);
router.post(
  "/usuarios",
  auth.authMiddleware, auth.adminOnly,
  asyncHandler(usuarioCtrl.criar)
);
router.put(
  "/usuarios/:id",
  auth.authMiddleware, auth.adminOnly,
  asyncHandler(usuarioCtrl.atualizar)
);
router.patch(
  "/usuarios/:id/status",
  auth.authMiddleware, auth.adminOnly,
  asyncHandler(usuarioCtrl.alterarStatus)
);

module.exports = router;
