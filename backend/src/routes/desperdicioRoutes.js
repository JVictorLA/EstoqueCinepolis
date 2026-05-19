const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middlewares/auth");
const desperdicioCtrl = require("../controllers/desperdicioController");

const router = Router();

router.get("/motivos-desperdicio", asyncHandler(desperdicioCtrl.listarMotivos));
router.post("/desperdicios", asyncHandler(desperdicioCtrl.criar));
router.get("/desperdicios", asyncHandler(desperdicioCtrl.listar));
router.get("/desperdicios/resumo", asyncHandler(desperdicioCtrl.resumo));
router.post(
  "/desperdicios/processar-vencidos",
  auth.authMiddleware,
  auth.adminOnly,
  asyncHandler(desperdicioCtrl.processarVencidos),
);

module.exports = router;
