const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middlewares/auth");
const estoqueCtrl = require("../controllers/estoqueController");

const router = Router();

router.get("/", asyncHandler(estoqueCtrl.listarEstoques));
router.post("/", auth.authMiddleware, auth.adminOnly, asyncHandler(estoqueCtrl.criar));
router.patch("/:id/arquivar", auth.authMiddleware, auth.adminOnly, asyncHandler(estoqueCtrl.arquivar));
router.patch("/:id/status", auth.authMiddleware, auth.adminOnly, asyncHandler(estoqueCtrl.alterarStatus));

module.exports = router;
