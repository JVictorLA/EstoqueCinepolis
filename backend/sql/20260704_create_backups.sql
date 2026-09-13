CREATE TABLE IF NOT EXISTS backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho_arquivo VARCHAR(500) NOT NULL,
  tamanho_bytes BIGINT NULL,
  tipo ENUM('manual', 'automatico') NOT NULL DEFAULT 'manual',
  status ENUM('sucesso', 'falha') NOT NULL DEFAULT 'sucesso',
  mensagem_erro TEXT NULL,
  criado_por INT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_backups_usuario
    FOREIGN KEY (criado_por)
    REFERENCES usuarios(id)
    ON DELETE SET NULL
);
