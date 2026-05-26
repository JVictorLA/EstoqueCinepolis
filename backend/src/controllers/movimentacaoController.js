const produtoService = require("../services/produtoService");
const usuarioService = require("../services/usuarioService");
const movService = require("../services/movimentacaoService");
const { ok, created, fail } = require("../utils/response");

async function criar(req, res) {
  const {
    codigo_barras,
    matricula,
    senha,
    tipo,
    quantidade,
    estoque_id,
    observacao,
    lote,
    data_validade,
    confirmar_ignorar_fefo,
    justificativa_fefo,
  } =
    req.body || {};

  if (!codigo_barras) return fail(res, 400, "codigo_barras e obrigatorio");
  if (!Number(estoque_id)) return fail(res, 400, "estoque_id e obrigatorio");
  if (!matricula || !senha) return fail(res, 400, "matricula e senha sao obrigatorias");
  if (!["entrada", "saida"].includes(tipo)) {
    return fail(res, 400, "tipo deve ser 'entrada' ou 'saida'");
  }
  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return fail(res, 400, "quantidade invalida");
  }

  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "Matricula ou senha invalidos");
  if (cred.error === "inactive") return fail(res, 403, "Usuario inativo");

  const produto =
    tipo === "entrada"
      ? await produtoService.findByBarcode(codigo_barras, "all")
      : await produtoService.findByBarcode(codigo_barras, estoque_id);
  if (!produto) return fail(res, 404, "Produto nao encontrado");
  if (!produto.ativo) return fail(res, 400, "Produto inativo");
  if (produto.exige_validade && !lote) return fail(res, 400, "lote e obrigatorio");
  if (tipo === "saida" && !produto.estoque_id) {
    return fail(res, 404, "Produto nao vinculado ao estoque");
  }

  try {
    const mov = await movService.registrarMovimentacao({
      produto,
      estoque_id: Number(estoque_id),
      usuario: { id: cred.id, nome: cred.nome },
      tipo,
      quantidade: qtd,
      observacao,
      lote,
      data_validade,
      confirmar_ignorar_fefo: !!confirmar_ignorar_fefo,
      justificativa_fefo,
    });

    if (mov.bloqueado_vencido) {
      return res.status(400).json({
        success: false,
        message: mov.message,
        data: mov,
        error: mov.message,
      });
    }

    return created(res, mov, "Movimentacao registrada");
  } catch (e) {
    if (e.fefo) {
      return res.status(e.status || 409).json({
        success: false,
        message: e.message,
        data: { fefo: e.fefo },
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao registrar movimentacao");
  }
}

async function criarEntrada(req, res) {
  req.body = { ...(req.body || {}), tipo: "entrada" };
  return criar(req, res);
}

async function criarSaida(req, res) {
  req.body = { ...(req.body || {}), tipo: "saida" };
  return criar(req, res);
}

async function transferir(req, res) {
  const {
    codigo_barras,
    matricula,
    senha,
    quantidade,
    estoque_origem_id,
    estoque_destino_id,
    observacao,
    lote,
    confirmar_ignorar_fefo,
    justificativa_fefo,
  } = req.body || {};

  if (!codigo_barras) return fail(res, 400, "codigo_barras e obrigatorio");
  if (!Number(estoque_origem_id)) return fail(res, 400, "estoque_origem_id e obrigatorio");
  if (!Number(estoque_destino_id)) return fail(res, 400, "estoque_destino_id e obrigatorio");
  if (Number(estoque_origem_id) === Number(estoque_destino_id)) {
    return fail(res, 400, "Estoque de destino deve ser diferente da origem");
  }
  if (!matricula || !senha) return fail(res, 400, "matricula e senha sao obrigatorias");

  const qtd = Number(quantidade);
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return fail(res, 400, "quantidade invalida");
  }

  const cred = await usuarioService.validateCredentials(matricula, senha);
  if (!cred) return fail(res, 401, "Matricula ou senha invalidos");
  if (cred.error === "inactive") return fail(res, 403, "Usuario inativo");

  const produto = await produtoService.findByBarcode(codigo_barras, estoque_origem_id);
  if (!produto) return fail(res, 404, "Produto nao encontrado no estoque de origem");
  if (!produto.ativo) return fail(res, 400, "Produto inativo");
  if (produto.exige_validade && !lote) return fail(res, 400, "lote e obrigatorio");
  if (!produto.estoque_id) return fail(res, 404, "Produto nao vinculado ao estoque de origem");

  try {
    const transferencia = await movService.transferirEstoque({
      produto,
      estoque_origem_id: Number(estoque_origem_id),
      estoque_destino_id: Number(estoque_destino_id),
      usuario: { id: cred.id, nome: cred.nome },
      quantidade: qtd,
      observacao,
      lote,
      confirmar_ignorar_fefo: !!confirmar_ignorar_fefo,
      justificativa_fefo,
    });
    return created(res, transferencia, "Transferencia registrada");
  } catch (e) {
    if (e.fefo) {
      return res.status(e.status || 409).json({
        success: false,
        message: e.message,
        data: { fefo: e.fefo },
        error: e.message,
      });
    }
    return fail(res, e.status || 500, e.message || "Erro ao transferir produto");
  }
}

async function listar(req, res) {
  const rows = await movService.listar({
    data_inicial: req.query.data_inicial,
    data_final: req.query.data_final,
    tipo: req.query.tipo,
    categoria_id: req.query.categoria_id,
    produto_id: req.query.produto_id,
    codigo_barras: req.query.codigo_barras,
    usuario_id: req.query.usuario_id,
    estoque_id: req.query.estoque_id,
  });
  return ok(res, rows);
}

module.exports = { criar, criarEntrada, criarSaida, transferir, listar };
