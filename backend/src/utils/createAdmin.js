/**
 * Cria (ou atualiza a senha de) um usuário ADMIN inicial.
 * Uso:
 *   node src/utils/createAdmin.js <matricula> <nome> <senha> [email]
 *
 * Exemplo:
 *   node src/utils/createAdmin.js 0001 "Gerente" Senha@123 gerente@cinepolis.com
 */
const bcrypt = require("bcrypt");
const { pool } = require("../database/connection");

(async () => {
  const [, , matricula, nome, senha, email] = process.argv;
  if (!matricula || !nome || !senha) {
    console.error("Uso: node src/utils/createAdmin.js <matricula> <nome> <senha> [email]");
    process.exit(1);
  }
  const senha_hash = await bcrypt.hash(senha, 10);
  const [existing] = await pool.query(
    "SELECT id FROM usuarios WHERE matricula = ? LIMIT 1",
    [matricula]
  );
  if (existing.length) {
    await pool.query(
      "UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, tipo = 'admin', ativo = 1, atualizado_em = NOW(), senha_atualizada_em = NOW(), precisa_trocar_senha = 0 WHERE id = ?",
      [nome, email || null, senha_hash, existing[0].id]
    );
    console.log(`✅ Admin atualizado (id=${existing[0].id}, matrícula=${matricula})`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO usuarios
        (matricula, nome, email, senha_hash, tipo, ativo, criado_em, atualizado_em, senha_atualizada_em, precisa_trocar_senha)
       VALUES (?, ?, ?, ?, 'admin', 1, NOW(), NOW(), NOW(), 0)`,
      [matricula, nome, email || null, senha_hash]
    );
    console.log(`✅ Admin criado (id=${r.insertId}, matrícula=${matricula})`);
  }
  process.exit(0);
})().catch((e) => {
  console.error("❌ Erro:", e.message);
  process.exit(1);
});
