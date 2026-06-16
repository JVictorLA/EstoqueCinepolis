USE zytrex_inventory;

-- Historico corrigido para demonstracao/seed.
-- Periodo coberto: 2026-01-01 ate 2026-05-19.
-- Regra importante: desperdicios ficam distribuidos entre 2026-01-01 e 2026-05-19.
--
-- Banco esperado antes de rodar: apenas usuarios existentes, IDs 2 a 10.

-- =========================
-- LIMPEZA SEGURA PARA RERODAR O SEED
-- =========================
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM alertas_estoque WHERE id >= 0;
DELETE FROM desperdicios WHERE id >= 0;
DELETE FROM movimentacoes WHERE id >= 0;
DELETE FROM estoque_produtos WHERE id >= 0;
DELETE FROM produtos WHERE id >= 0;
DELETE FROM categorias WHERE id >= 0;
DELETE FROM estoques WHERE id >= 0;
DELETE FROM motivos_desperdicio WHERE id >= 0;
SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE categorias AUTO_INCREMENT = 1;
ALTER TABLE estoques AUTO_INCREMENT = 1;
ALTER TABLE motivos_desperdicio AUTO_INCREMENT = 1;
ALTER TABLE produtos AUTO_INCREMENT = 1;
ALTER TABLE estoque_produtos AUTO_INCREMENT = 1;
ALTER TABLE movimentacoes AUTO_INCREMENT = 1;
ALTER TABLE desperdicios AUTO_INCREMENT = 1;
ALTER TABLE alertas_estoque AUTO_INCREMENT = 1;

ALTER TABLE movimentacoes
MODIFY tipo ENUM('entrada', 'saida', 'desperdicio') NOT NULL;

-- =========================
-- CATEGORIAS
-- =========================
INSERT INTO categorias (id, nome, exige_validade) VALUES
(1, 'Refrigerantes', 1),
(2, 'Aguas', 1),
(3, 'Sucos', 1),
(4, 'Chocolates', 1),
(5, 'Snacks', 1),
(6, 'Pipocas', 1),
(7, 'Sorvetes', 1),
(8, 'Congelados', 1),
(9, 'Produtos VIP', 1),
(10, 'Limpeza', 1),
(11, 'Descartaveis', 0),
(12, 'Brindes', 0),
(13, 'Embalagens', 0),
(14, 'Materiais Operacionais', 0);

-- =========================
-- ESTOQUES
-- =========================
INSERT INTO estoques (id, nome, ativo, criado_em) VALUES
(1, 'Estoque Principal', 1, '2026-01-01 08:00:00'),
(2, 'Estoque VIP', 1, '2026-01-01 08:00:00'),
(3, 'Estoque Limpeza', 1, '2026-01-01 08:00:00');

-- =========================
-- MOTIVOS DE DESPERDICIO
-- =========================
INSERT INTO motivos_desperdicio (id, nome, ativo, criado_em) VALUES
(1, 'Produto vencido', 1, '2026-01-01 08:00:00'),
(2, 'Produto danificado', 1, '2026-01-01 08:00:00'),
(3, 'Produto aberto por engano', 1, '2026-01-01 08:00:00'),
(4, 'Produto derramado', 1, '2026-01-01 08:00:00'),
(5, 'Erro operacional', 1, '2026-01-01 08:00:00'),
(6, 'Quebra de embalagem', 1, '2026-01-01 08:00:00'),
(7, 'Contaminacao', 1, '2026-01-01 08:00:00'),
(8, 'Perda no preparo', 1, '2026-01-01 08:00:00'),
(9, 'Sobra descartada', 1, '2026-01-01 08:00:00'),
(10, 'Outro', 1, '2026-01-01 08:00:00');

-- =========================
-- 100 PRODUTOS
-- =========================
INSERT INTO produtos (id, codigo_barras, nome, categoria_id, unidade, preco_venda, ativo, criado_em) VALUES
(1, '7894900010015', 'Coca-Cola Original 600ml', 1, 'UN', 12.00, 1, '2026-01-01 08:00:00'),
(2, '7894900010022', 'Coca-Cola Zero 600ml', 1, 'UN', 12.00, 1, '2026-01-01 08:00:00'),
(3, '7894900010039', 'Fanta Laranja 600ml', 1, 'UN', 11.00, 1, '2026-01-01 08:00:00'),
(4, '7894900010046', 'Sprite Original 600ml', 1, 'UN', 11.00, 1, '2026-01-01 08:00:00'),
(5, '7894900010053', 'Guarana Antarctica 600ml', 1, 'UN', 11.00, 1, '2026-01-01 08:00:00'),
(6, '7894900010060', 'Pepsi Cola 600ml', 1, 'UN', 11.00, 1, '2026-01-01 08:00:00'),
(7, '7894900010077', 'Schweppes Citrus 350ml', 1, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(8, '7894900010084', 'Coca-Cola Original Lata 350ml', 1, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(9, '7891000100091', 'Agua Crystal Sem Gas 500ml', 2, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(10, '7891000100107', 'Agua Crystal Com Gas 500ml', 2, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(11, '7891000100114', 'Agua Bonafont 500ml', 2, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(12, '7891000100121', 'Agua Minalba 510ml', 2, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(13, '7891000100138', 'Agua Sao Lourenco Com Gas 300ml', 2, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(14, '7892840810011', 'Del Valle Uva 290ml', 3, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(15, '7892840810028', 'Del Valle Pessego 290ml', 3, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(16, '7892840810035', 'Del Valle Manga 290ml', 3, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(17, '7892840810042', 'Natural One Laranja 300ml', 3, 'UN', 14.00, 1, '2026-01-01 08:00:00'),
(18, '7892840810059', 'Natural One Uva 300ml', 3, 'UN', 14.00, 1, '2026-01-01 08:00:00'),
(19, '7891000200197', 'KitKat Ao Leite', 4, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(20, '7891000200203', 'KitKat Branco', 4, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(21, '7891000200210', 'Bis Xtra Chocolate', 4, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(22, '7891000200227', 'Twix Chocolate', 4, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(23, '7891000200234', 'Snickers Chocolate', 4, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(24, '7891000200241', 'M&M Chocolate', 4, 'UN', 12.00, 1, '2026-01-01 08:00:00'),
(25, '7891000200258', 'M&M Amendoim', 4, 'UN', 12.00, 1, '2026-01-01 08:00:00'),
(26, '7891000200265', 'Lacta Ao Leite 90g', 4, 'UN', 11.00, 1, '2026-01-01 08:00:00'),
(27, '7891000200272', 'Hersheys Cookies n Creme', 4, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(28, '7891000200289', 'Kinder Bueno', 4, 'UN', 13.00, 1, '2026-01-01 08:00:00'),
(29, '7891000300292', 'Doritos Queijo Nacho 84g', 5, 'UN', 16.00, 1, '2026-01-01 08:00:00'),
(30, '7891000300308', 'Doritos Sweet Chili 84g', 5, 'UN', 16.00, 1, '2026-01-01 08:00:00'),
(31, '7891000300315', 'Ruffles Original 76g', 5, 'UN', 15.00, 1, '2026-01-01 08:00:00'),
(32, '7891000300322', 'Cheetos Requeijao 76g', 5, 'UN', 12.00, 1, '2026-01-01 08:00:00'),
(33, '7891000300339', 'Fandangos Presunto 59g', 5, 'UN', 11.00, 1, '2026-01-01 08:00:00'),
(34, '7891000300346', 'Tostitos Salsa 90g', 5, 'UN', 18.00, 1, '2026-01-01 08:00:00'),
(35, '7891000300353', 'Amendoim Japones Dori', 5, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(36, '7891000300360', 'Pringles Original', 5, 'UN', 22.00, 1, '2026-01-01 08:00:00'),
(37, '7891000400373', 'Pipoca Salgada P', 6, 'UN', 27.00, 1, '2026-01-01 08:00:00'),
(38, '7891000400380', 'Pipoca Salgada M', 6, 'UN', 32.00, 1, '2026-01-01 08:00:00'),
(39, '7891000400397', 'Pipoca Salgada G', 6, 'UN', 35.00, 1, '2026-01-01 08:00:00'),
(40, '7891000400403', 'Pipoca Doce P', 6, 'UN', 31.00, 1, '2026-01-01 08:00:00'),
(41, '7891000400410', 'Pipoca Doce M', 6, 'UN', 36.00, 1, '2026-01-01 08:00:00'),
(42, '7891000400427', 'Pipoca Doce G', 6, 'UN', 40.00, 1, '2026-01-01 08:00:00'),
(43, '7891000400434', 'Pipoca Balde Salgada', 6, 'UN', 39.00, 1, '2026-01-01 08:00:00'),
(44, '7891000400441', 'Pipoca Balde Doce', 6, 'UN', 44.00, 1, '2026-01-01 08:00:00'),
(45, '7891000500450', 'Magnum Classico', 7, 'UN', 18.00, 1, '2026-01-01 08:00:00'),
(46, '7891000500467', 'Magnum Branco', 7, 'UN', 18.00, 1, '2026-01-01 08:00:00'),
(47, '7891000500474', 'Cornetto Chocolate', 7, 'UN', 15.00, 1, '2026-01-01 08:00:00'),
(48, '7891000500481', 'Cornetto Morango', 7, 'UN', 15.00, 1, '2026-01-01 08:00:00'),
(49, '7891000500498', 'Picole Fruttare Limao', 7, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(50, '7891000500504', 'Picole Fruttare Uva', 7, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(51, '7891000600511', 'Batata Congelada McCain 2kg', 8, 'KG', 38.00, 1, '2026-01-01 08:00:00'),
(52, '7891000600528', 'Nuggets Sadia 1kg', 8, 'KG', 32.00, 1, '2026-01-01 08:00:00'),
(53, '7891000600535', 'Hamburguer Bovino Seara 1kg', 8, 'KG', 42.00, 1, '2026-01-01 08:00:00'),
(54, '7891000600542', 'Queijo Mussarela Fatiado', 8, 'KG', 45.00, 1, '2026-01-01 08:00:00'),
(55, '7891000600559', 'Pao de Queijo Congelado', 8, 'KG', 28.00, 1, '2026-01-01 08:00:00'),
(56, '7891000700566', 'Espumante Salton Brut', 9, 'UN', 95.00, 1, '2026-01-01 08:00:00'),
(57, '7891000700573', 'Vinho Miolo Tinto', 9, 'UN', 89.00, 1, '2026-01-01 08:00:00'),
(58, '7891000700580', 'Castanha de Caju Premium', 9, 'UN', 35.00, 1, '2026-01-01 08:00:00'),
(59, '7891000700597', 'Mix de Nuts Premium', 9, 'UN', 42.00, 1, '2026-01-01 08:00:00'),
(60, '7891000700603', 'Chocolate Lindt Excellence', 9, 'UN', 32.00, 1, '2026-01-01 08:00:00'),
(61, '7891000700610', 'Agua Perrier 330ml', 9, 'UN', 22.00, 1, '2026-01-01 08:00:00'),
(62, '7891000700627', 'Red Bull Energy Drink', 9, 'UN', 18.00, 1, '2026-01-01 08:00:00'),
(63, '7891000800634', 'Detergente Ype Neutro', 10, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(64, '7891000800641', 'Agua Sanitaria Qboa 1L', 10, 'UN', 9.00, 1, '2026-01-01 08:00:00'),
(65, '7891000800658', 'Desinfetante Pinho Sol 1L', 10, 'UN', 14.00, 1, '2026-01-01 08:00:00'),
(66, '7891000800665', 'Alcool 70% 1L', 10, 'UN', 15.00, 1, '2026-01-01 08:00:00'),
(67, '7891000800672', 'Sabao em Po Omo 1kg', 10, 'UN', 22.00, 1, '2026-01-01 08:00:00'),
(68, '7891000800689', 'Veja Multiuso 500ml', 10, 'UN', 12.00, 1, '2026-01-01 08:00:00'),
(69, '7891000800696', 'Luva Descartavel Caixa', 10, 'CX', 35.00, 1, '2026-01-01 08:00:00'),
(70, '7891000800702', 'Saco de Lixo 100L', 10, 'PCT', 45.00, 1, '2026-01-01 08:00:00'),
(71, '7891000800719', 'Pano Multiuso', 10, 'PCT', 10.00, 1, '2026-01-01 08:00:00'),
(72, '7891000800726', 'Papel Toalha Interfolha', 10, 'PCT', 18.00, 1, '2026-01-01 08:00:00'),
(73, '7891000900733', 'Copo Descartavel 500ml', 11, 'PCT', 20.00, 1, '2026-01-01 08:00:00'),
(74, '7891000900740', 'Tampa Copo 500ml', 11, 'PCT', 12.00, 1, '2026-01-01 08:00:00'),
(75, '7891000900757', 'Canudo Biodegradavel', 11, 'PCT', 10.00, 1, '2026-01-01 08:00:00'),
(76, '7891000900764', 'Guardanapo Papel', 11, 'PCT', 8.00, 1, '2026-01-01 08:00:00'),
(77, '7891000900771', 'Colher Descartavel', 11, 'PCT', 9.00, 1, '2026-01-01 08:00:00'),
(78, '7891001000786', 'Balde Mario Bros', 12, 'UN', 89.00, 1, '2026-01-01 08:00:00'),
(79, '7891001000793', 'Copo Mario Bros', 12, 'UN', 49.00, 1, '2026-01-01 08:00:00'),
(80, '7891001000809', 'Balde Stitch', 12, 'UN', 99.00, 1, '2026-01-01 08:00:00'),
(81, '7891001000816', 'Copo Stitch', 12, 'UN', 59.00, 1, '2026-01-01 08:00:00'),
(82, '7891001000823', 'Balde Minecraft', 12, 'UN', 89.00, 1, '2026-01-01 08:00:00'),
(83, '7891001000830', 'Copo Minecraft', 12, 'UN', 49.00, 1, '2026-01-01 08:00:00'),
(84, '7891001000847', 'Chaveiro Sonic', 12, 'UN', 25.00, 1, '2026-01-01 08:00:00'),
(85, '7891001100854', 'Caixa Pipoca P', 13, 'UN', 2.00, 1, '2026-01-01 08:00:00'),
(86, '7891001100861', 'Caixa Pipoca M', 13, 'UN', 3.00, 1, '2026-01-01 08:00:00'),
(87, '7891001100878', 'Caixa Pipoca G', 13, 'UN', 4.00, 1, '2026-01-01 08:00:00'),
(88, '7891001100885', 'Balde Pipoca Papel', 13, 'UN', 5.00, 1, '2026-01-01 08:00:00'),
(89, '7891001100892', 'Sacola Delivery', 13, 'UN', 1.50, 1, '2026-01-01 08:00:00'),
(90, '7891001100908', 'Caixa Hot Dog', 13, 'UN', 2.50, 1, '2026-01-01 08:00:00'),
(91, '7891001200915', 'Bobina Termica Caixa', 14, 'UN', 10.00, 1, '2026-01-01 08:00:00'),
(92, '7891001200922', 'Papel Impressora A4', 14, 'UN', 30.00, 1, '2026-01-01 08:00:00'),
(93, '7891001200939', 'Etiqueta Codigo de Barras', 14, 'UN', 15.00, 1, '2026-01-01 08:00:00'),
(94, '7891001200946', 'Fita Adesiva Transparente', 14, 'UN', 8.00, 1, '2026-01-01 08:00:00'),
(95, '7891001200953', 'Caneta Bic Azul', 14, 'UN', 3.00, 1, '2026-01-01 08:00:00'),
(96, '7891001200960', 'Prancheta Plastica', 14, 'UN', 18.00, 1, '2026-01-01 08:00:00'),
(97, '7891001200977', 'Lacre Plastico Numerado', 14, 'PCT', 25.00, 1, '2026-01-01 08:00:00'),
(98, '7891001200984', 'Etiqueta Validade', 14, 'PCT', 12.00, 1, '2026-01-01 08:00:00'),
(99, '7891001200991', 'Marcador Permanente', 14, 'UN', 7.00, 1, '2026-01-01 08:00:00'),
(100, '7891001201004', 'Pasta Arquivo', 14, 'UN', 6.00, 1, '2026-01-01 08:00:00');

DROP PROCEDURE IF EXISTS popular_historico_estoque;

DELIMITER $$

CREATE PROCEDURE popular_historico_estoque()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE v_categoria INT;
  DECLARE v_estoque INT;
  DECLARE v_produto_nome VARCHAR(150);
  DECLARE v_preco DECIMAL(10,2);
  DECLARE v_validade DATE;
  DECLARE v_ep_id INT;
  DECLARE v_usuario INT;
  DECLARE v_usuario_nome VARCHAR(100);
  DECLARE v_qtd_entrada DECIMAL(10,2);
  DECLARE v_qtd_saida_1 DECIMAL(10,2);
  DECLARE v_qtd_saida_2 DECIMAL(10,2);
  DECLARE v_qtd_desperdicio DECIMAL(10,2);
  DECLARE v_saldo DECIMAL(10,2);
  DECLARE v_minimo DECIMAL(10,2);
  DECLARE v_motivo INT;
  DECLARE v_motivo_nome VARCHAR(100);
  DECLARE v_data_entrada DATETIME;
  DECLARE v_data_saida_1 DATETIME;
  DECLARE v_data_saida_2 DATETIME;
  DECLARE v_data_desperdicio DATETIME;

  WHILE i <= 100 DO
    SELECT categoria_id, nome, preco_venda
    INTO v_categoria, v_produto_nome, v_preco
    FROM produtos
    WHERE id = i;

    SET v_estoque = CASE
      WHEN v_categoria = 9 THEN 2
      WHEN v_categoria = 10 THEN 3
      ELSE 1
    END;

    SET v_usuario = COALESCE(
      (SELECT id FROM usuarios WHERE id = 2 + (i MOD 9) LIMIT 1),
      (SELECT id FROM usuarios ORDER BY id LIMIT 1)
    );

    SELECT nome
    INTO v_usuario_nome
    FROM usuarios
    WHERE id = v_usuario
    LIMIT 1;

    SET v_usuario_nome = COALESCE(v_usuario_nome, 'Administrador');
    SET v_qtd_entrada = 80 + (i MOD 70);
    SET v_minimo = CASE
      WHEN v_categoria IN (9, 12) THEN 3
      WHEN v_categoria = 10 THEN 8
      ELSE 15
    END;

    -- Produtos 1 a 50 ficam vencidos e geram desperdicios ao longo do periodo.
    SET v_validade = CASE
      WHEN v_categoria IN (11, 12, 13, 14) THEN NULL
      WHEN i <= 50 THEN DATE_ADD('2026-01-01', INTERVAL (i MOD 90) DAY)
      WHEN i BETWEEN 51 AND 70 THEN DATE_ADD('2026-05-19', INTERVAL (i MOD 7 + 1) DAY)
      ELSE DATE_ADD('2026-05-19', INTERVAL (90 + i) DAY)
    END;

    INSERT INTO estoque_produtos (
      estoque_id,
      produto_id,
      estoque_atual,
      estoque_minimo,
      data_validade,
      criado_em
    )
    VALUES (
      v_estoque,
      i,
      0,
      v_minimo,
      v_validade,
      '2026-01-01 08:00:00'
    );

    SET v_ep_id = LAST_INSERT_ID();

    -- Entrada inicial distribuida entre janeiro e fevereiro.
    SET v_data_entrada = TIMESTAMP(
      DATE_ADD('2026-01-01', INTERVAL ((i * 3) MOD 50) DAY),
      MAKETIME(8 + (i MOD 9), i MOD 60, 0)
    );

    INSERT INTO movimentacoes (
      produto_id,
      usuario_id,
      tipo,
      quantidade,
      estoque_antes,
      estoque_depois,
      usuario_nome,
      produto_nome,
      observacao,
      criado_em,
      estoque_id
    )
    VALUES (
      i,
      v_usuario,
      'entrada',
      v_qtd_entrada,
      0,
      v_qtd_entrada,
      v_usuario_nome,
      v_produto_nome,
      'Entrada inicial de abastecimento',
      v_data_entrada,
      v_estoque
    );

    SET v_saldo = v_qtd_entrada;

    -- Primeira saida operacional distribuida entre fevereiro e abril.
    SET v_qtd_saida_1 = 5 + (i MOD 25);
    SET v_data_saida_1 = TIMESTAMP(
      DATE_ADD('2026-02-01', INTERVAL ((i * 5) MOD 85) DAY),
      MAKETIME(10 + (i MOD 8), (i * 2) MOD 60, 0)
    );

    INSERT INTO movimentacoes (
      produto_id,
      usuario_id,
      tipo,
      quantidade,
      estoque_antes,
      estoque_depois,
      usuario_nome,
      produto_nome,
      observacao,
      criado_em,
      estoque_id
    )
    VALUES (
      i,
      v_usuario,
      'saida',
      v_qtd_saida_1,
      v_saldo,
      v_saldo - v_qtd_saida_1,
      v_usuario_nome,
      v_produto_nome,
      'Saida operacional para consumo/venda',
      v_data_saida_1,
      v_estoque
    );

    SET v_saldo = v_saldo - v_qtd_saida_1;

    -- Segunda saida para fazer o historico chegar ate 19/05/2026.
    IF i MOD 2 = 0 THEN
      SET v_qtd_saida_2 = 3 + (i MOD 14);
      SET v_data_saida_2 = TIMESTAMP(
        DATE_ADD('2026-03-01', INTERVAL ((i * 7) MOD 80) DAY),
        MAKETIME(11 + (i MOD 7), (i * 4) MOD 60, 0)
      );

      INSERT INTO movimentacoes (
        produto_id,
        usuario_id,
        tipo,
        quantidade,
        estoque_antes,
        estoque_depois,
        usuario_nome,
        produto_nome,
        observacao,
        criado_em,
        estoque_id
      )
      VALUES (
        i,
        v_usuario,
        'saida',
        v_qtd_saida_2,
        v_saldo,
        v_saldo - v_qtd_saida_2,
        v_usuario_nome,
        v_produto_nome,
        'Saida operacional complementar',
        v_data_saida_2,
        v_estoque
      );

      SET v_saldo = v_saldo - v_qtd_saida_2;
    END IF;

    -- Desperdicio:
    -- 1) produtos vencidos: todo saldo restante e lancado ao longo do periodo;
    -- 2) demais perdas: historico espalhado entre 01/01/2026 e 19/05/2026.
    IF i <= 50 THEN
      SET v_motivo = 1;
      SET v_qtd_desperdicio = v_saldo;
      SET v_data_desperdicio = TIMESTAMP(
        DATE_ADD('2026-01-01', INTERVAL ((i * 11) MOD 139) DAY),
        MAKETIME(8 + (i MOD 10), (i * 3) MOD 60, 0)
      );
    ELSEIF i MOD 7 = 0 THEN
      SET v_motivo = 2 + (i MOD 8);
      SET v_qtd_desperdicio = LEAST(v_saldo, 1 + (i MOD 5));
      SET v_data_desperdicio = TIMESTAMP(
        DATE_ADD('2026-01-01', INTERVAL ((i * 11) MOD 139) DAY),
        MAKETIME(11 + (i MOD 7), (i * 4) MOD 60, 0)
      );
    ELSE
      SET v_motivo = NULL;
      SET v_qtd_desperdicio = 0;
    END IF;

    IF v_motivo IS NOT NULL AND v_qtd_desperdicio > 0 THEN
      SELECT nome
      INTO v_motivo_nome
      FROM motivos_desperdicio
      WHERE id = v_motivo
      LIMIT 1;

      INSERT INTO desperdicios (
        estoque_id,
        produto_id,
        usuario_id,
        motivo_id,
        quantidade,
        estoque_antes,
        estoque_depois,
        valor_unitario,
        valor_total,
        criado_em
      )
      VALUES (
        v_estoque,
        i,
        v_usuario,
        v_motivo,
        v_qtd_desperdicio,
        v_saldo,
        v_saldo - v_qtd_desperdicio,
        v_preco,
        ROUND(v_preco * v_qtd_desperdicio, 2),
        v_data_desperdicio
      );

      INSERT INTO movimentacoes (
        produto_id,
        usuario_id,
        tipo,
        quantidade,
        estoque_antes,
        estoque_depois,
        usuario_nome,
        produto_nome,
        observacao,
        criado_em,
        estoque_id
      )
      VALUES (
        i,
        v_usuario,
        'desperdicio',
        v_qtd_desperdicio,
        v_saldo,
        v_saldo - v_qtd_desperdicio,
        v_usuario_nome,
        v_produto_nome,
        CONCAT('Desperdicio registrado: ', v_motivo_nome),
        v_data_desperdicio,
        v_estoque
      );

      SET v_saldo = v_saldo - v_qtd_desperdicio;
    END IF;

    UPDATE estoque_produtos
    SET estoque_atual = v_saldo
    WHERE id = v_ep_id;

    SET i = i + 1;
  END WHILE;
END$$

DELIMITER ;

CALL popular_historico_estoque();

DROP PROCEDURE popular_historico_estoque;

INSERT INTO alertas_estoque (
  produto_id,
  estoque_id,
  tipo,
  resolvido,
  criado_em
)
SELECT
  ep.produto_id,
  ep.estoque_id,
  'baixo_estoque',
  0,
  '2026-05-19 18:00:00'
FROM estoque_produtos ep
WHERE ep.estoque_atual <= ep.estoque_minimo;
