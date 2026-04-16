const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");
const registrarLog = require("../utils/logger");

// =========================================================================
// CONFIGURAÇÃO DE UPLOAD DE ARQUIVOS (MULTER)
// =========================================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/riscos';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'risco-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// =========================================================================
// CONFIGURAÇÃO DO PDFKIT-TABLE (GERAÇÃO DE PDF A PROVA DE FALHAS)
// =========================================================================
const PDFDocument = require('pdfkit-table');

// =========================================================================
// CONSTANTES E UTILITÁRIOS
// =========================================================================
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// =========================================================================
// ROTAS (MANTIDAS EXATAMENTE IGUAIS AS SUAS DE LISTAR, SALVAR E VER)
// =========================================================================

// --- 1. LISTAR LEVANTAMENTOS (GET) ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // Adicionado o IF para encurtar o nome da empresa em 30 caracteres
        let query = `
            SELECT 
                l.id_levantamento, 
                l.data_levantamento, 
                l.created_at,
                l.nome_grupo_ges,
                c.nome_empresa, 
                IF(CHAR_LENGTH(c.nome_empresa) > 30, CONCAT(LEFT(c.nome_empresa, 30), '...'), c.nome_empresa) AS nome_empresa_curto,
                c.cidade,
                u.nome_completo as nome_responsavel
            FROM levantamento_perigo l
            JOIN cliente c ON l.id_cliente = c.id_cliente
            JOIN usuario u ON l.id_responsavel_tecnico = u.id_usuario
            WHERE l.deleted_at IS NULL
        `;

        const params = [];

        if (!ehAdmin) {
            query += ` AND l.id_unidade = ?`;
            params.push(userLogado.id_unidade || userLogado.unidade_id);
        }

        query += ` ORDER BY l.data_levantamento DESC, l.created_at DESC`;

        const [levantamentos] = await db.query(query, params);

        const levantamentosFormatados = levantamentos.map(l => {
            // Lógica para pegar apenas o Primeiro e Segundo nome
            let nomeCurto = '-';
            if (l.nome_responsavel) {
                const partes = l.nome_responsavel.trim().split(' ');
                nomeCurto = partes.slice(0, 2).join(' '); // Pega os dois primeiros pedaços
            }

            return {
                ...l,
                nome_responsavel_curto: nomeCurto,
                data_formatada: new Date(l.data_levantamento).toLocaleDateString('pt-BR')
            };
        });

        res.render("formularios/levantamento-perigo-lista", {
            user: req.session.user,
            currentPage: 'levantamento-perigos',
            levantamentosJson: JSON.stringify(levantamentosFormatados)
        });

    } catch (error) {
        console.error("Erro ao buscar levantamentos:", error);
        res.status(500).send("Erro ao carregar lista.");
    }
});

// --- 2. FORMULÁRIO NOVO (GET) ---
router.get("/novo", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let queryClientes = "SELECT id_cliente, nome_empresa FROM cliente WHERE deleted_at IS NULL AND ativo = 1";
        let paramsClientes = [];
        if (!ehAdmin) {
            queryClientes += " AND id_unidade = ?";
            paramsClientes.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        queryClientes += " ORDER BY nome_empresa ASC";
        const [clientes] = await db.query(queryClientes, paramsClientes);

        let queryUsers = "SELECT id_usuario, nome_completo FROM usuario WHERE ativo = 1";
        let paramsUsers = [];
        if (!ehAdmin) {
            queryUsers += " AND id_unidade = ?";
            paramsUsers.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        const [usuarios] = await db.query(queryUsers, paramsUsers);

        const [epis] = await db.query("SELECT id_epi, nome_equipamento, ca FROM epi WHERE ativo = 1");
        const [epcs] = await db.query("SELECT id_epc, nome FROM epc WHERE ativo = 1");

        const [riscos] = await db.query(`
        SELECT 
        r.id_risco, 
        r.codigo_interno AS codigo, 
        r.nome_risco AS nome, 
        r.tipo_risco AS grupo,
        t24.codigo AS esocial
        FROM risco r
        LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
        WHERE r.deleted_at IS NULL
        `);

        res.render("formularios/levantamento-perigo-form", {
            user: userLogado,
            currentPage: 'levantamento-perigos',
            clientes,
            usuarios,
            epis,
            epcs,
            todosRiscos: riscos
        });

    } catch (error) {
        console.error("Erro ao abrir formulário novo:", error);
        res.redirect("/formularios/levantamento-perigo");
    }
});

// --- 3. SALVAR (POST) ---
router.post("/salvar", verificarAutenticacao, upload.any(), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const data = JSON.parse(req.body.dados_json);
        if (!data.assinatura_avaliador || !data.assinatura_responsavel_empresa) {
            return res.status(400).json({
                success: false,
                message: "As assinaturas são obrigatórias e não foram recebidas pelo servidor."
            });
        }

        const userLogado = req.session.user;
        const id_levantamento = uuidv4();
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        const toJson = (obj) => JSON.stringify(obj || {});

        const sqlLevantamento = `
            INSERT INTO levantamento_perigo (
                id_levantamento, id_unidade, id_cliente, data_levantamento, 
                id_responsavel_tecnico, responsavel_empresa_nome, responsavel_empresa_cargo, trabalho_externo,
                nome_grupo_ges,
                tipo_construcao, tipo_piso, tipo_paredes, cor_paredes, divisoes_internas_material, 
                tipo_cobertura, tipo_forro, tipo_iluminacao, tipo_ventilacao, possui_climatizacao, 
                escadas_tipo, passarelas_tipo, estruturas_auxiliares,
                area_m2, pe_direito_m, largura_m, comprimento_m, obs_condicoes_gerais,
                ausencia_risco_ambiental, ausencia_risco_ergonomico, ausencia_risco_mecanico,
                ausencia_risco_quimico, ausencia_risco_biologico,
                assinatura_avaliador, assinatura_responsavel_empresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await conn.query(sqlLevantamento, [
            id_levantamento, id_unidade, data.id_cliente, data.data_levantamento,
            data.id_responsavel_tecnico, data.responsavel_empresa_nome, data.responsavel_empresa_cargo, data.trabalho_externo ? 1 : 0,
            data.nome_grupo_ges || null, 
            toJson(data.tipo_construcao), toJson(data.tipo_piso), toJson(data.tipo_paredes), data.cor_paredes, toJson(data.divisoes_internas_material),
            toJson(data.tipo_cobertura), toJson(data.tipo_forro), toJson(data.tipo_iluminacao), toJson(data.tipo_ventilacao), data.possui_climatizacao ? 1 : 0,
            toJson(data.escadas_tipo), toJson(data.passarelas_tipo), JSON.stringify(data.estruturas_auxiliares || []),
            data.area_m2 || 0, data.pe_direito_m || 0, data.largura_m || 0, data.comprimento_m || 0, data.obs_condicoes_gerais,
            data.ausencia_risco_ambiental ? 1 : 0,
            data.ausencia_risco_ergonomico ? 1 : 0,
            data.ausencia_risco_mecanico ? 1 : 0,
            data.ausencia_risco_quimico ? 1 : 0,
            data.ausencia_risco_biologico ? 1 : 0,
            data.assinatura_avaliador || null,
            data.assinatura_responsavel_empresa || null
        ]);

        // ========================================================
        // CORREÇÃO: Salvando o GES com a coluna de ORDEM
        // ========================================================
        if (data.ges && Array.isArray(data.ges)) {
            for (let i = 0; i < data.ges.length; i++) {
                const g = data.ges[i];
                await conn.query(`
                    INSERT INTO levantamento_ges (id_ges, id_levantamento, setor, cargos, nome_trabalhador_excecao, observacoes, ordem)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id_levantamento, g.setor, g.cargos, g.excecao, g.obs || null, i]);
            }
        }

        // ========================================================
        // CORREÇÃO: Salvando os Químicos com a coluna de ORDEM
        // ========================================================
        if (data.quimicos && Array.isArray(data.quimicos)) {
            for (let i = 0; i < data.quimicos.length; i++) {
                const q = data.quimicos[i];
                await conn.query(`
                    INSERT INTO levantamento_quimico (id_quimico, id_levantamento, nome_rotulo, estado_fisico, tipo_exposicao, processo_quantidade, observacoes, ordem)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id_levantamento, q.rotulo, q.estado, q.exposicao, q.processo, q.obs || null, i]);
            }
        }

        if (data.riscos && Array.isArray(data.riscos)) {
            for (let i = 0; i < data.riscos.length; i++) {
                const r = data.riscos[i];
                const id_risco_identificado = uuidv4();

                const fileField = 'imagem_' + i;
                const file = req.files ? req.files.find(f => f.fieldname === fileField) : null;
                const anexo_imagem = file ? '/uploads/riscos/' + file.filename : null;

                await conn.query(`
                    INSERT INTO levantamento_risco_identificado (
                        id_risco_identificado, id_levantamento, id_risco, grupo_perigo, codigo_perigo, 
                        descricao_perigo, fontes_geradoras, tipo_tempo_exposicao, observacoes, anexo_imagem, ordem
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_risco_identificado, id_levantamento,
                    r.id_risco, r.grupo, r.codigo, r.nome, r.fontes, r.tempo, r.obs, anexo_imagem, i
                ]);

                if (r.epis && Array.isArray(r.epis)) {
                    for (const epiId of r.epis) {
                        await conn.query('INSERT INTO levantamento_risco_has_epi (id_risco_identificado, id_epi) VALUES (?, ?)', [id_risco_identificado, epiId]);
                    }
                }

                if (r.epcs && Array.isArray(r.epcs)) {
                    for (const epcId of r.epcs) {
                        await conn.query('INSERT INTO levantamento_risco_has_epc (id_risco_identificado, id_epc) VALUES (?, ?)', [id_risco_identificado, epcId]);
                    }
                }
            }
        }

        const [clienteResult] = await conn.query('SELECT nome_empresa FROM cliente WHERE id_cliente = ?', [data.id_cliente]);
        const nomeEmpresaLog = clienteResult.length > 0 ? clienteResult[0].nome_empresa : 'Cliente Desconhecido';

        await registrarLog({
            id_unidade: id_unidade,
            id_usuario: userLogado.id_usuario,
            acao: 'INSERT',
            tabela: 'levantamento_perigo',
            id_registro: id_levantamento,
            dados_novos: {
                id_cliente: data.id_cliente,
                nome_cliente: nomeEmpresaLog,
                data_levantamento: data.data_levantamento,
                nome_grupo_ges: data.nome_grupo_ges || null,
                total_setores_cadastrados: data.ges ? data.ges.length : 0,
                total_produtos_quimicos: data.quimicos ? data.quimicos.length : 0,
                total_riscos_identificados: data.riscos ? data.riscos.length : 0
            }
        });

        await conn.commit();
        res.json({ success: true, message: "Levantamento cadastrado com sucesso!" });

    } catch (error) {
        await conn.rollback();
        console.error("Erro ao salvar levantamento:", error);
        res.status(500).json({ success: false, message: "Erro ao salvar no banco de dados." });
    } finally {
        conn.release();
    }
});

// --- 4. VISUALIZAR DETALHES (GET) ---
router.get("/ver/:id", verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const [rows] = await db.query(`
            SELECT l.*, c.nome_empresa, c.cnpj, u.nome_completo as nome_avaliador
            FROM levantamento_perigo l
            JOIN cliente c ON l.id_cliente = c.id_cliente
            JOIN usuario u ON l.id_responsavel_tecnico = u.id_usuario
            WHERE l.id_levantamento = ? AND l.deleted_at IS NULL
        `, [id]);

        if (rows.length === 0) return res.status(404).send("Levantamento não encontrado.");
        const levantamento = rows[0];

        if (!ehAdmin && levantamento.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        const [ges] = await db.query(`
            SELECT setor, cargos, nome_trabalhador_excecao AS excecao, observacoes AS obs 
            FROM levantamento_ges 
            WHERE id_levantamento = ?
            ORDER BY ordem ASC
        `, [id]);

        const [quimicos] = await db.query(`
            SELECT nome_rotulo AS rotulo, estado_fisico AS estado, tipo_exposicao AS exposicao, processo_quantidade AS processo, observacoes AS obs 
            FROM levantamento_quimico 
            WHERE id_levantamento = ?
            ORDER BY ordem ASC
        `, [id]);

        const [riscos] = await db.query(`
            SELECT 
                lri.id_risco_identificado, lri.id_risco, lri.grupo_perigo AS grupo, 
                lri.codigo_perigo AS codigo, lri.descricao_perigo AS nome_risco, 
                lri.fontes_geradoras AS fontes, lri.tipo_tempo_exposicao AS tempo, 
                lri.observacoes AS obs, lri.anexo_imagem AS caminho_imagem,
                t24.codigo AS codigo_esocial
            FROM levantamento_risco_identificado lri
            LEFT JOIN risco r ON lri.id_risco = r.id_risco
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE lri.id_levantamento = ?
            ORDER BY lri.ordem ASC
        `, [id]);

        for (let risco of riscos) {
            const [epis] = await db.query(`
                SELECT e.nome_equipamento, e.ca 
                FROM levantamento_risco_has_epi re
                JOIN epi e ON re.id_epi = e.id_epi
                WHERE re.id_risco_identificado = ?
            `, [risco.id_risco_identificado]);
            risco.epis = epis;

            const [epcs] = await db.query(`
                SELECT ep.nome 
                FROM levantamento_risco_has_epc rec
                JOIN epc ep ON rec.id_epc = ep.id_epc
                WHERE rec.id_risco_identificado = ?
            `, [risco.id_risco_identificado]);
            risco.epcs = epcs;
        }

        res.render("formularios/levantamento-perigo-ver", {
            user: userLogado,
            currentPage: 'levantamento-perigos',
            levantamento: levantamento,
            ges: ges,
            quimicos: quimicos,
            riscos: riscos
        });

    } catch (error) {
        console.error("Erro ao ver levantamento:", error);
        res.status(500).send("Erro interno.");
    }
});

// --- 5. EDITAR FORMULÁRIO (GET) ---
router.get("/editar/:id", verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        // 1. Busca Levantamento
        const [rows] = await db.query(`
            SELECT l.*, c.nome_empresa, c.cnpj, u.nome_completo as nome_avaliador
            FROM levantamento_perigo l
            LEFT JOIN cliente c ON l.id_cliente = c.id_cliente
            LEFT JOIN usuario u ON l.id_responsavel_tecnico = u.id_usuario
            WHERE l.id_levantamento = ? AND l.deleted_at IS NULL
        `, [id]);

        if (rows.length === 0) return res.status(404).send("Levantamento não encontrado.");
        const levantamento = rows[0];

        // Proteção de acesso
        if (!ehAdmin && levantamento.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        // 2. Buscas para os selects
        let queryClientes = "SELECT id_cliente, nome_empresa FROM cliente WHERE deleted_at IS NULL AND ativo = 1";
        let paramsClientes = [];
        if (!ehAdmin) {
            queryClientes += " AND id_unidade = ?";
            paramsClientes.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        queryClientes += " ORDER BY nome_empresa ASC";
        const [clientes] = await db.query(queryClientes, paramsClientes);

        let queryUsers = "SELECT id_usuario, nome_completo FROM usuario WHERE ativo = 1";
        let paramsUsers = [];
        if (!ehAdmin) {
            queryUsers += " AND id_unidade = ?";
            paramsUsers.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        const [usuarios] = await db.query(queryUsers, paramsUsers);

        const [epis] = await db.query("SELECT id_epi, nome_equipamento, ca FROM epi WHERE ativo = 1");
        const [epcs] = await db.query("SELECT id_epc, nome FROM epc WHERE ativo = 1");
        const [todosRiscos] = await db.query(`
            SELECT r.id_risco, r.codigo_interno AS codigo, r.nome_risco AS nome, r.tipo_risco AS grupo, t24.codigo AS esocial
            FROM risco r
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE r.deleted_at IS NULL
        `);

        // 3. Busca nas tabelas filhas (GES, Químicos) 
        const [ges] = await db.query("SELECT * FROM levantamento_ges WHERE id_levantamento = ? ORDER BY ordem ASC", [id]);
        const [quimicos] = await db.query("SELECT * FROM levantamento_quimico WHERE id_levantamento = ? ORDER BY ordem ASC", [id]);

        // ========================================================
        // Buscando os riscos salvos na ORDEM cronológica
        // ========================================================
        const [riscos] = await db.query(`
            SELECT 
                lri.id_risco,
                lri.id_risco_identificado,
                lri.fontes_geradoras AS fontes,
                lri.tipo_tempo_exposicao AS tempo,
                lri.observacoes AS obs,
                COALESCE(r.codigo_interno, lri.codigo_perigo) AS codigo_interno, 
                COALESCE(r.nome_risco, lri.descricao_perigo) AS nome_risco, 
                COALESCE(r.tipo_risco, lri.grupo_perigo) AS tipo_risco,
                t24.codigo AS codigo_esocial
            FROM levantamento_risco_identificado lri
            LEFT JOIN risco r ON lri.id_risco = r.id_risco
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE lri.id_levantamento = ?
            ORDER BY lri.ordem ASC 
        `, [id]);

        // Busca EPIs e EPCs atrelados a cada risco
        for (let risco of riscos) {
            const [episRisco] = await db.query("SELECT id_epi FROM levantamento_risco_has_epi WHERE id_risco_identificado = ?", [risco.id_risco_identificado]);
            risco.epis = episRisco.map(e => e.id_epi);

            const [epcsRisco] = await db.query("SELECT id_epc FROM levantamento_risco_has_epc WHERE id_risco_identificado = ?", [risco.id_risco_identificado]);
            risco.epcs = epcsRisco.map(e => e.id_epc);
        }

        // ========================================================
        // A MÁGICA ESTÁ AQUI: Anexando os riscos DENTRO do levantamento!
        // ========================================================
        levantamento.riscos = riscos;

        res.render("formularios/levantamento-perigo-editar", {
            user: userLogado,
            currentPage: 'levantamento-perigos',
            clientes, usuarios, epis, epcs, todosRiscos,

            // Dados brutos para o HTML/EJS
            levantamento: levantamento, // Agora isso aqui tem os riscos lá dentro!
            ges: ges,
            quimicos: quimicos,
            riscos: riscos,
            riscosJson: JSON.stringify(riscos)
        });

    } catch (error) {
        console.error("Erro ao abrir edição:", error);
        res.status(500).send("Erro interno ao carregar formulário de edição.");
    }
});

// --- 6. ATUALIZAR (POST) ---
router.post("/editar/:id", verificarAutenticacao, upload.any(), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const data = JSON.parse(req.body.dados_json);
        const userLogado = req.session.user;
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;
        const toJson = (obj) => JSON.stringify(obj || {});

        // 1. Busca os dados antigos para fazer o comparativo do Log
        const [rowsAntigo] = await conn.query("SELECT * FROM levantamento_perigo WHERE id_levantamento = ?", [id]);
        if (rowsAntigo.length === 0) throw new Error("Levantamento não encontrado para edição.");
        const dadosAntigos = rowsAntigo[0];

        // 2. Compara os campos principais para o Log de Auditoria
        const camposParaComparar = [
            'id_cliente', 'id_responsavel_tecnico', 'trabalho_externo', 'nome_grupo_ges',
            'area_m2', 'pe_direito_m', 'ausencia_risco_ambiental', 'obs_condicoes_gerais'
        ];

        const alteracoesRealizadas = {};
        camposParaComparar.forEach(campo => {
            let valorAntigo = dadosAntigos[campo] !== null ? dadosAntigos[campo].toString() : null;
            let valorNovo = data[campo] !== undefined && data[campo] !== null ? data[campo].toString() : null;

            if (campo.startsWith('ausencia_') || campo === 'trabalho_externo') {
                valorNovo = data[campo] ? "1" : "0";
            }

            if (valorAntigo !== valorNovo) {
                alteracoesRealizadas[campo] = { de: valorAntigo, para: valorNovo };
            }
        });

        // 3. Atualiza a tabela principal (levantamento_perigo)
        const sqlUpdate = `
            UPDATE levantamento_perigo SET 
                id_cliente = ?, data_levantamento = ?, id_responsavel_tecnico = ?, 
                responsavel_empresa_nome = ?, responsavel_empresa_cargo = ?, trabalho_externo = ?,
                nome_grupo_ges = ?, tipo_construcao = ?, tipo_piso = ?, tipo_paredes = ?, cor_paredes = ?, 
                divisoes_internas_material = ?, tipo_cobertura = ?, tipo_forro = ?, tipo_iluminacao = ?, 
                tipo_ventilacao = ?, possui_climatizacao = ?, escadas_tipo = ?, passarelas_tipo = ?, 
                estruturas_auxiliares = ?, area_m2 = ?, pe_direito_m = ?, largura_m = ?, comprimento_m = ?, 
                obs_condicoes_gerais = ?, ausencia_risco_ambiental = ?, ausencia_risco_ergonomico = ?, 
                ausencia_risco_mecanico = ?, ausencia_risco_quimico = ?, ausencia_risco_biologico = ?
            WHERE id_levantamento = ?
        `;

        await conn.query(sqlUpdate, [
            data.id_cliente, data.data_levantamento, data.id_responsavel_tecnico,
            data.responsavel_empresa_nome, data.responsavel_empresa_cargo, data.trabalho_externo ? 1 : 0,
            data.nome_grupo_ges || null, toJson(data.tipo_construcao), toJson(data.tipo_piso), toJson(data.tipo_paredes), data.cor_paredes,
            toJson(data.divisoes_internas_material), toJson(data.tipo_cobertura), toJson(data.tipo_forro), toJson(data.tipo_iluminacao),
            toJson(data.tipo_ventilacao), data.possui_climatizacao ? 1 : 0, toJson(data.escadas_tipo), toJson(data.passarelas_tipo),
            JSON.stringify(data.estruturas_auxiliares || []), data.area_m2 || 0, data.pe_direito_m || 0, data.largura_m || 0,
            data.comprimento_m || 0, data.obs_condicoes_gerais, data.ausencia_risco_ambiental ? 1 : 0, data.ausencia_risco_ergonomico ? 1 : 0,
            data.ausencia_risco_mecanico ? 1 : 0, data.ausencia_risco_quimico ? 1 : 0, data.ausencia_risco_biologico ? 1 : 0,
            id
        ]);

        if (data.assinatura_avaliador) {
            await conn.query('UPDATE levantamento_perigo SET assinatura_avaliador = ? WHERE id_levantamento = ?', [data.assinatura_avaliador, id]);
        }
        if (data.assinatura_responsavel_empresa) {
            await conn.query('UPDATE levantamento_perigo SET assinatura_responsavel_empresa = ? WHERE id_levantamento = ?', [data.assinatura_responsavel_empresa, id]);
        }

        // 4. Deleção das tabelas filhas (Wipe and Replace)
        await conn.query(`DELETE FROM levantamento_ges WHERE id_levantamento = ?`, [id]);
        await conn.query(`DELETE FROM levantamento_quimico WHERE id_levantamento = ?`, [id]);

        const [riscosAntigos] = await conn.query(`SELECT id_risco_identificado, anexo_imagem FROM levantamento_risco_identificado WHERE id_levantamento = ?`, [id]);
        if (riscosAntigos.length > 0) {
            const idsRiscos = riscosAntigos.map(r => r.id_risco_identificado);
            await conn.query(`DELETE FROM levantamento_risco_has_epi WHERE id_risco_identificado IN (?)`, [idsRiscos]);
            await conn.query(`DELETE FROM levantamento_risco_has_epc WHERE id_risco_identificado IN (?)`, [idsRiscos]);
            await conn.query(`DELETE FROM levantamento_risco_identificado WHERE id_levantamento = ?`, [id]);
        }

        // 5. Reinserção dos dados nas tabelas filhas
        if (data.ges && Array.isArray(data.ges)) {
            for (let i = 0; i < data.ges.length; i++) {
                const g = data.ges[i];
                await conn.query(`
                    INSERT INTO levantamento_ges (id_ges, id_levantamento, setor, cargos, nome_trabalhador_excecao, observacoes, ordem)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id, g.setor, g.cargos, g.excecao, g.obs || null, i]); 
            }
        }

        if (data.quimicos && Array.isArray(data.quimicos)) {
            for (let i = 0; i < data.quimicos.length; i++) {
                const q = data.quimicos[i];
                await conn.query(`
                    INSERT INTO levantamento_quimico (id_quimico, id_levantamento, nome_rotulo, estado_fisico, tipo_exposicao, processo_quantidade, observacoes, ordem)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id, q.rotulo, q.estado, q.exposicao, q.processo, q.obs || null, i]); // <--- TROCADO PARA id
            }
        }

        if (data.riscos && Array.isArray(data.riscos)) {
            for (let i = 0; i < data.riscos.length; i++) {
                const r = data.riscos[i];
                const id_risco_identificado = uuidv4();

                const fileField = 'imagem_' + i;
                const file = req.files ? req.files.find(f => f.fieldname === fileField) : null;

                let anexo_imagem = r.anexo_imagem_atual || null;
                if (file) {
                    anexo_imagem = '/uploads/riscos/' + file.filename;
                } else if (!anexo_imagem && i < riscosAntigos.length) {
                    anexo_imagem = riscosAntigos[i].anexo_imagem;
                }

                // A MÁGICA: Adicionamos a coluna "ordem" recebendo o "i" (0, 1, 2...)
                await conn.query(`
                    INSERT INTO levantamento_risco_identificado (
                        id_risco_identificado, id_levantamento, id_risco, grupo_perigo, codigo_perigo, 
                        descricao_perigo, fontes_geradoras, tipo_tempo_exposicao, observacoes, anexo_imagem, ordem
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_risco_identificado, id, r.id_risco, r.grupo, r.codigo, r.nome, r.fontes, r.tempo, r.obs, anexo_imagem, i
                ]);

                if (r.epis && Array.isArray(r.epis)) {
                    for (const epiId of r.epis) {
                        await conn.query('INSERT INTO levantamento_risco_has_epi (id_risco_identificado, id_epi) VALUES (?, ?)', [id_risco_identificado, epiId]);
                    }
                }

                if (r.epcs && Array.isArray(r.epcs)) {
                    for (const epcId of r.epcs) {
                        await conn.query('INSERT INTO levantamento_risco_has_epc (id_risco_identificado, id_epc) VALUES (?, ?)', [id_risco_identificado, epcId]);
                    }
                }
            }
        }

        // 6. Registro no Log
        const [clienteResult] = await conn.query('SELECT nome_empresa FROM cliente WHERE id_cliente = ?', [data.id_cliente]);
        const nomeEmpresaLog = clienteResult.length > 0 ? clienteResult[0].nome_empresa : 'Cliente Desconhecido';

        await registrarLog({
            id_unidade: id_unidade,
            id_usuario: userLogado.id_usuario,
            acao: 'UPDATE',
            tabela: 'levantamento_perigo',
            id_registro: id,
            dados_novos: {
                mensagem: "Levantamento editado com sucesso.",
                nome_cliente_atual: nomeEmpresaLog,
                alteracoes_principais: alteracoesRealizadas,
                totais_finais: {
                    setores_cadastrados: data.ges ? data.ges.length : 0,
                    produtos_quimicos: data.quimicos ? data.quimicos.length : 0,
                    riscos_identificados: data.riscos ? data.riscos.length : 0
                }
            }
        });

        await conn.commit();
        res.json({ success: true, message: "Levantamento atualizado com sucesso!" });

    } catch (error) {
        await conn.rollback();
        console.error("Erro ao atualizar levantamento:", error);
        res.status(500).json({ success: false, message: "Erro ao atualizar no banco de dados." });
    } finally {
        conn.release();
    }
});

// --- 8. IMPRIMIR PDF ---
router.get("/imprimir/:id", verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        const [rows] = await db.query(`
            SELECT l.*, c.nome_empresa, c.cnpj, u.nome_completo as nome_avaliador
            FROM levantamento_perigo l
            JOIN cliente c ON l.id_cliente = c.id_cliente
            JOIN usuario u ON l.id_responsavel_tecnico = u.id_usuario
            WHERE l.id_levantamento = ? AND l.deleted_at IS NULL
        `, [id]);

        if (rows.length === 0) return res.status(404).send("Levantamento não encontrado.");
        const levantamento = rows[0];

        if (!ehAdmin && levantamento.id_unidade !== (userLogado.id_unidade || userLogado.unidade_id)) {
            return res.status(403).send("Acesso negado.");
        }

        const [ges] = await db.query(`
            SELECT setor, cargos, nome_trabalhador_excecao AS excecao, observacoes AS obs 
            FROM levantamento_ges WHERE id_levantamento = ?
        `, [id]);

        const [quimicos] = await db.query(`
            SELECT nome_rotulo AS rotulo, estado_fisico AS estado, tipo_exposicao AS exposicao, processo_quantidade AS processo, observacoes AS obs 
            FROM levantamento_quimico WHERE id_levantamento = ?
        `, [id]);

        const [riscos] = await db.query(`
            SELECT 
                lri.id_risco_identificado, lri.id_risco, lri.grupo_perigo AS grupo, 
                lri.codigo_perigo AS codigo, lri.descricao_perigo AS nome_risco, 
                lri.fontes_geradoras AS fontes, lri.tipo_tempo_exposicao AS tempo, 
                lri.observacoes AS obs, lri.anexo_imagem AS caminho_imagem,
                t24.codigo AS codigo_esocial
            FROM levantamento_risco_identificado lri
            LEFT JOIN risco r ON lri.id_risco = r.id_risco
            LEFT JOIN tabela_24_esocial t24 ON r.id_tabela_24 = t24.id_tabela_24
            WHERE lri.id_levantamento = ?
        `, [id]);

        for (let risco of riscos) {
            const [epis] = await db.query(`
                SELECT e.nome_equipamento, e.ca 
                FROM levantamento_risco_has_epi re
                JOIN epi e ON re.id_epi = e.id_epi
                WHERE re.id_risco_identificado = ?
            `, [risco.id_risco_identificado]);
            risco.epis = epis;

            const [epcs] = await db.query(`
                SELECT ep.nome 
                FROM levantamento_risco_has_epc rec
                JOIN epc ep ON rec.id_epc = ep.id_epc
                WHERE rec.id_risco_identificado = ?
            `, [risco.id_risco_identificado]);
            risco.epcs = epcs;
        }

        const dataFormatada = new Date(levantamento.data_levantamento).toLocaleDateString('pt-BR');

        const doc = new PDFDocument({ margins: { top: 90, bottom: 40, left: 40, right: 40 }, size: 'A4' });
        const fs = require('fs');
        const path = require('path');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Levantamento_${id}.pdf"`);

        doc.pipe(res);

        let pageCount = 0;

        const drawHeader = () => {
            pageCount++;
            const startX = 40;
            const width = 515;
            const headerY = 30;
            const headerH = 40;

            doc.rect(startX, headerY, width, headerH).fill('#e4e4e7');

            try {
                const logoPath1 = path.join(process.cwd(), 'public', 'images', 'logo', 'sesi.png');
                const logoPath2 = path.join(__dirname, '../public/images/logo/sesi.png');
                const logoPath3 = path.join(__dirname, '../../public/images/logo/sesi.png');

                if (fs.existsSync(logoPath1)) {
                    doc.image(logoPath1, startX - 10, headerY - 32, { height: 110 });
                } else if (fs.existsSync(logoPath2)) {
                    doc.image(logoPath2, startX - 10, headerY - 32, { height: 110 });
                } else if (fs.existsSync(logoPath3)) {
                    doc.image(logoPath3, startX - 10, headerY - 32, { height: 110 });
                }
            } catch (err) { }

            doc.fillColor('black').font('Helvetica-Bold').fontSize(22)
                .text('Levantamento de Perigos', startX, headerY + 10, { width: width, align: 'center' });

            doc.font('Helvetica-Bold').fontSize(10)
                .text(`Pág ${pageCount}`, startX, headerY + 8, { width: width - 10, align: 'right' });
            doc.font('Helvetica').fontSize(9)
                .text(`Versão 6`, startX, headerY + 22, { width: width - 10, align: 'right' });
        };

        drawHeader();
        doc.y = 75;

        doc.on('pageAdded', () => {
            drawHeader();
            doc.y = 75;
        });

        const startX = 40;
        let posY = doc.y;
        const width = 515;
        const rowHeight = 20;

        const formatarCampo = (dado) => {
            if (!dado) return '-';
            let arr = [];
            if (Array.isArray(dado)) arr = dado;
            else if (typeof dado === 'object') arr = Object.values(dado);
            else if (typeof dado === 'string') {
                try {
                    const parsed = JSON.parse(dado);
                    if (Array.isArray(parsed)) arr = parsed;
                    else if (typeof parsed === 'object') arr = Object.values(parsed);
                    else return parsed;
                } catch (e) { return dado; }
            } else return String(dado);
            const limpo = arr.filter(item => item && item.toString().trim() !== '' && item.toString().toLowerCase() !== 'outros');
            return limpo.length > 0 ? limpo.join(', ') : '-';
        };

        let arrEstruturas = [];
        try {
            if (Array.isArray(levantamento.estruturas_auxiliares)) arrEstruturas = levantamento.estruturas_auxiliares;
            else if (typeof levantamento.estruturas_auxiliares === 'string') arrEstruturas = JSON.parse(levantamento.estruturas_auxiliares);
        } catch (e) { }
        if (!Array.isArray(arrEstruturas)) arrEstruturas = [];

        const temMezanino = arrEstruturas.includes('Mezaninos') ? 'Sim' : 'Não';
        const temRampa = arrEstruturas.includes('Rampas') ? 'Sim' : 'Não';
        const textoEstruturasAuxiliares = `Mezaninos: ${temMezanino}   |   Rampas: ${temRampa}`;

        const cobBruta = formatarCampo(levantamento.tipo_cobertura);
        let textoCobertura = cobBruta;
        if (cobBruta !== '-' && cobBruta.includes('-')) {
            const partes = cobBruta.split('-');
            textoCobertura = `Tipo de Estrutura: ${partes[0].trim()}   |   Tipo Telha: ${partes.slice(1).join('-').trim()}`;
        } else if (cobBruta !== '-' && cobBruta.includes(',')) {
            const partes = cobBruta.split(',');
            textoCobertura = `Tipo de Estrutura: ${partes[0].trim()}   |   Tipo Telha: ${partes.slice(1).join(',').trim()}`;
        }

        doc.lineWidth(1);
        doc.fontSize(11);

        // =========================================================
        // Bloco Empresa (CORRIGIDO O BUG DA LARGURA DO PDFKIT)
        // =========================================================
        const textoEmpresa = levantamento.nome_empresa || '-';

        // 1. A Data começa no X 410. Então a Empresa tem até 390 de espaço para não bater nela.
        const larguraMaximaTexto = 390;

        // 2. Calculamos qual seria a altura desse texto se ele precisasse quebrar de linha
        doc.font('Helvetica').fontSize(11);
        const alturaTextoEmpresa = doc.heightOfString('Empresa: ' + textoEmpresa, { width: larguraMaximaTexto });

        // 3. A caixa terá no mínimo 20 (rowHeight padrão), ou mais se o texto for muito grande (+12 de margem pra respirar)
        const alturaCaixaEmpresa = Math.max(rowHeight, alturaTextoEmpresa + 12);

        // 4. Desenha o retângulo com a altura dinâmica
        doc.rect(startX, posY, width, alturaCaixaEmpresa).stroke();

        // 5. Escreve a Data isolada lá no canto (sem interferir na empresa)
        doc.font('Helvetica-Bold').text('Data: ', startX + 410, posY + 6, { continued: true }).font('Helvetica').text(dataFormatada);

        // 6. O GRANDE SEGREDO: O { width } fica na primeira chamada de texto (no 'Empresa:')
        // Assim o PDFKit cria um "bloco invisível" de 390px e obriga o nome a quebrar de linha dentro dele!
        doc.font('Helvetica-Bold').text('Empresa: ', startX + 5, posY + 6, { continued: true, width: larguraMaximaTexto })
            .font('Helvetica').text(textoEmpresa);

        // 7. Atualiza o Y adicionando a altura real da caixa, para a próxima linha nascer no lugar certo
        posY += alturaCaixaEmpresa;

        // =========================================================
        // Restante do Cabeçalho
        // =========================================================
        doc.rect(startX, posY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').text('Responsável pelo levantamento: ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(levantamento.nome_avaliador || '-');
        posY += rowHeight;

        doc.rect(startX, posY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').text('Responsável informações da empresa: ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(levantamento.responsavel_empresa_nome || '-');
        posY += rowHeight;

        doc.rect(startX, posY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').text('Cargo do responsável: ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(levantamento.responsavel_empresa_cargo || '-');
        posY += rowHeight;

        doc.rect(startX, posY, width, rowHeight).stroke();
        const txtExterno = levantamento.trabalho_externo ? '( X ) Sim   (   ) Não' : '(   ) Sim   ( X ) Não';
        doc.font('Helvetica-Bold').text('Existem trabalhadores executando atividades fora da empresa? ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(txtExterno);
        posY += rowHeight + 15;

        const ambienteRows = [
            { label: 'Construção', val: formatarCampo(levantamento.tipo_construcao) },
            { label: 'Revestimento Paredes', val: `${formatarCampo(levantamento.tipo_paredes)}   |   Cor: ${levantamento.cor_paredes || '-'}` },
            { label: 'Divisões internas', val: formatarCampo(levantamento.divisoes_internas_material) },
            { label: 'Piso', val: formatarCampo(levantamento.tipo_piso) },
            { label: 'Cobertura', val: textoCobertura },
            { label: 'Forro', val: formatarCampo(levantamento.tipo_forro) },
            { label: 'Iluminação', val: formatarCampo(levantamento.tipo_iluminacao) },
            { label: 'Ventilação', val: formatarCampo(levantamento.tipo_ventilacao) },
            { label: 'Climatização', val: levantamento.possui_climatizacao ? '( X ) Sim   (   ) Não' : '(   ) Sim   ( X ) Não' },
            { label: 'Escadas (tipo)', val: formatarCampo(levantamento.escadas_tipo) },
            { label: 'Passarelas', val: formatarCampo(levantamento.passarelas_tipo) },
            { label: 'Estruturas Aux.', val: textoEstruturasAuxiliares },
            { label: 'Dimensões Físicas', val: `Área: ${levantamento.area_m2 || '-'} m²   |   Larg.: ${levantamento.largura_m || '-'} m   |   Compr.: ${levantamento.comprimento_m || '-'} m   |   Pé dir.: ${levantamento.pe_direito_m || '-'} m` }
        ];

        const rowEnvHeight = 16;
        ambienteRows.forEach((item) => {
            doc.rect(startX, posY, 140, rowEnvHeight).fillAndStroke('#e4e4e7', 'black');
            doc.fillColor('black').font('Helvetica-Bold').text(item.label, startX + 5, posY + 4, { width: 130, align: 'right' });
            doc.rect(startX + 140, posY, width - 140, rowEnvHeight).stroke();
            doc.font('Helvetica').text(item.val, startX + 145, posY + 4);
            posY += rowEnvHeight;
        });

        doc.rect(startX, posY, width, 40).stroke();
        doc.font('Helvetica-Bold').fontSize(9).text('Observação sobre as condições gerais:', startX + 5, posY + 4);
        doc.font('Helvetica').text(levantamento.obs_condicoes_gerais || '-', startX + 5, posY + 16);

        doc.y = posY + 50;
        doc.moveDown(1);

        // =================================================================
        // BLOCO: GRUPO DE EXPOSIÇÃO SIMILAR (GES)
        // =================================================================
        if (doc.y > 650) doc.addPage();

        doc.rect(startX, doc.y, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Grupo de Exposição Similar (GES)', startX, doc.y + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        const gesCols = [
            { label: "Setor", width: 120 },
            { label: "Cargos", width: 145 },
            { label: "Nome trabalhador\n(exceção)", width: 120 },
            { label: "Observações", width: 130 }
        ];

        let yCabecalhoGes = doc.y;
        const alturaCabecalhoGes = 28;

        doc.rect(startX, yCabecalhoGes, width, alturaCabecalhoGes).fillAndStroke('#e4e4e7', 'black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);

        let currX = startX;
        gesCols.forEach(col => {
            doc.rect(currX, yCabecalhoGes, col.width, alturaCabecalhoGes).stroke();
            doc.text(col.label, currX + 5, yCabecalhoGes + 6, { width: col.width - 10, align: 'center' });
            currX += col.width;
        });
        doc.y = yCabecalhoGes + alturaCabecalhoGes;

        doc.font('Helvetica').fontSize(9);
        const gesRows = ges.length > 0 ? ges : [{ setor: '-', cargos: '-', excecao: '-', obs: '-' }];

        gesRows.forEach(g => {
            const hSetor = doc.heightOfString(g.setor || '-', { width: gesCols[0].width - 10 });
            const hCargos = doc.heightOfString(g.cargos || '-', { width: gesCols[1].width - 10 });
            const hExcecao = doc.heightOfString(g.excecao || '-', { width: gesCols[2].width - 10 });
            const hObs = doc.heightOfString(g.obs || '-', { width: gesCols[3].width - 10 });
            const maxH = Math.max(hSetor, hCargos, hExcecao, hObs, 15) + 10;

            if (doc.y + maxH > 800) doc.addPage();

            let cx = startX;
            let yLinhaGes = doc.y;
            const valores = [g.setor || '-', g.cargos || '-', g.excecao || '-', g.obs || '-'];

            valores.forEach((val, i) => {
                const w = gesCols[i].width;
                doc.rect(cx, yLinhaGes, w, maxH).stroke();
                doc.text(val, cx + 5, yLinhaGes + 5, { width: w - 10, align: 'left' });
                cx += w;
            });
            doc.y = yLinhaGes + maxH;
        });

        // 🔥 RODAPÉ GES (IGUAL À IMAGEM)
        doc.rect(startX, doc.y, width, 18).stroke();
        doc.font('Helvetica').fontSize(10).text('Nome do grupo (GES): ', startX + 5, doc.y + 4, { continued: true }).text(levantamento.nome_grupo_ges || '');
        doc.y += 10;

        // =================================================================
        // BLOCO: INVENTÁRIO DE PRODUTOS QUÍMICOS
        // =================================================================
        if (doc.y > 650) doc.addPage();

        doc.rect(startX, doc.y, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Inventário de Produtos Químicos', startX, doc.y + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        const quimCols = [
            { label: "Nome Rótulo", width: 125 },
            { label: "EF", width: 40 },
            { label: "Tipo Exposição", width: 100 },
            { label: "Processo utilizado/Quantidade", width: 150 },
            { label: "Observações", width: 100 }
        ];

        let yCabecalhoQuim = doc.y;
        doc.rect(startX, yCabecalhoQuim, width, rowHeight).fillAndStroke('#e4e4e7', 'black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);

        currX = startX;
        quimCols.forEach(col => {
            doc.rect(currX, yCabecalhoQuim, col.width, rowHeight).stroke();
            doc.text(col.label, currX + 5, yCabecalhoQuim + 5, { width: col.width - 10, align: 'center' });
            currX += col.width;
        });
        doc.y = yCabecalhoQuim + rowHeight;

        doc.font('Helvetica').fontSize(9);
        const quimRows = quimicos.length > 0 ? quimicos : [{ rotulo: '-', estado: '-', exposicao: '-', processo: '-', obs: '-' }];

        quimRows.forEach(q => {
            const hRotulo = doc.heightOfString(q.rotulo || '-', { width: quimCols[0].width - 10 });
            const hEstado = doc.heightOfString(q.estado || '-', { width: quimCols[1].width - 10 });
            const hExposicao = doc.heightOfString(q.exposicao || '-', { width: quimCols[2].width - 10 });
            const hProcesso = doc.heightOfString(q.processo || '-', { width: quimCols[3].width - 10 });
            const hObs = doc.heightOfString(q.obs || '-', { width: quimCols[4].width - 10 });
            const maxH = Math.max(hRotulo, hEstado, hExposicao, hProcesso, hObs, 10) + 10;

            if (doc.y + maxH > 800) doc.addPage();

            let cx = startX;
            let yLinhaQuim = doc.y;
            const valores = [q.rotulo || '-', q.estado || '-', q.exposicao || '-', q.processo || '-', q.obs || '-'];

            valores.forEach((val, i) => {
                const w = quimCols[i].width;
                doc.rect(cx, yLinhaQuim, w, maxH).stroke();
                doc.text(val, cx + 5, yLinhaQuim + 5, { width: w - 10, align: i === 1 ? 'center' : 'left' });
                cx += w;
            });
            doc.y = yLinhaQuim + maxH;
        });

        // 🔥 RODAPÉ QUÍMICOS (LEGENDA)
        let yRodape = doc.y;
        doc.rect(startX, yRodape, width, 14).stroke();
        doc.font('Helvetica').fontSize(8).text('Legenda: EF - Estado Físico (S - Sólido; L - Líquido; G - Gasoso)', startX + 2, yRodape + 3);

        // Avança EXATAMENTE a altura da legenda (14), sem margens adicionais para colar no próximo bloco!
        doc.y = yRodape + 18;

        // =================================================================
        // BLOCO: OBSERVAÇÕES (CHECKLIST) COLADO NO ANTERIOR
        // =================================================================

        // Só quebra a página se o bloco inteiro de observações (que tem aprox. 90 a 100 de altura) não couber na folha atual
        if (doc.y + 100 > 800) doc.addPage();

        let yObs = doc.y;

        // Título "Observações" (Preto) colado na linha de cima
        doc.rect(startX, yObs, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Observações', startX, yObs + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        // Caixa Cinza do Checklist colada no título preto
        let yChecklist = yObs + 20;
        doc.font('Helvetica').fontSize(9);

        const obs1 = '1    Checar as descrições de atividade encaminhadas pela empresa e anotar as divergências encontradas que possam impactar na exposição.';
        const obs2 = '2    Solicitar as FISPQs dos produtos químicos.';
        const obs3 = '3    Existem outras legislações (legislação estadual / municipal / requisitos clientes) aplicáveis aos riscos da empresa?';
        const obs4 = '4    Verifique os requisitos inerentes à eficácia das medidas de controle';

        const txtOpts = { width: width - 10, align: 'justify' };

        const h1 = doc.heightOfString(obs1, txtOpts);
        const h2 = doc.heightOfString(obs2, txtOpts);
        const h3 = doc.heightOfString(obs3, txtOpts);
        const h4 = doc.heightOfString(obs4, txtOpts);

        const espaco = 6;
        const padding = 5;
        const alturaCaixaCheck = padding * 2 + h1 + h2 + h3 + h4 + (espaco * 3);

        doc.rect(startX, yChecklist, width, alturaCaixaCheck).fillAndStroke('#e4e4e7', 'black');
        doc.fillColor('black');

        let currentY = yChecklist + padding;
        doc.text(obs1, startX + 5, currentY, txtOpts);
        currentY += h1 + espaco;

        doc.text(obs2, startX + 5, currentY, txtOpts);
        currentY += h2 + espaco;

        doc.text(obs3, startX + 5, currentY, txtOpts);
        currentY += h3 + espaco;

        doc.text(obs4, startX + 5, currentY, txtOpts);

        // Atualiza a posição final para o próximo bloco respirar
        doc.y = yChecklist + alturaCaixaCheck;
        doc.moveDown(2);


        // =================================================================
        // BLOCO: DETALHAMENTO DOS PERIGOS 
        // =================================================================
        if (doc.y > 650) doc.addPage();

        doc.rect(startX, doc.y, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Detalhamento dos Perigos', startX, doc.y + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        const ausente = (levantamento.ausencia_risco_ambiental || levantamento.ausencia_risco_ergonomico || levantamento.ausencia_risco_mecanico)
            ? 'Sim ( X )   Não (   )'
            : 'Sim (   )   Não ( X )';

        doc.rect(startX, doc.y, width, 22).stroke();
        doc.font('Helvetica-Bold').fontSize(9).text('Ausência de exposição a riscos ambientais, ergonômicos e mecânicos (acidentes): ', startX + 5, doc.y + 6, { continued: true });
        doc.font('Helvetica').text(ausente);

        const detCols = [
            { label: "GP", width: 25 },
            { label: "Perigo / Número", width: 100 },
            { label: "Fontes geradoras", width: 95 },
            { label: "Tipo e Tempo de Exposição", width: 85 },
            { label: "EPI/CA existente", width: 80 },
            { label: "MA/ EPC existente", width: 70 },
            { label: "Observações", width: 60 }
        ];

        let yCabecalhoDet = doc.y;
        const alturaCabecalhoDet = 28;
        doc.rect(startX, yCabecalhoDet, width, alturaCabecalhoDet).fillAndStroke('#e4e4e7', 'black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(8);

        currX = startX;
        detCols.forEach(col => {
            doc.rect(currX, yCabecalhoDet, col.width, alturaCabecalhoDet).stroke();
            doc.text(col.label, currX + 2, yCabecalhoDet + 6, { width: col.width - 4, align: 'center' });
            currX += col.width;
        });
        doc.y = yCabecalhoDet + alturaCabecalhoDet;

        const getSiglaGP = (grupoBanco) => {
            if (!grupoBanco) return '-';
            const g = grupoBanco.toLowerCase();
            if (g.includes('físico')) return 'F';
            if (g.includes('químico')) return 'Q';
            if (g.includes('biológico')) return 'B';
            if (g.includes('ergonômico')) return 'E';
            if (g.includes('mecânico') || g.includes('acidente')) return 'M';
            return grupoBanco.charAt(0).toUpperCase();
        };

        const getCorGP = (grupoBanco) => {
            if (!grupoBanco) return 'black';
            const g = grupoBanco.toLowerCase();
            if (g.includes('físico')) return '#22c55e';
            if (g.includes('químico')) return '#ef4444';
            if (g.includes('biológico')) return '#ca8a04';
            if (g.includes('ergonômico')) return '#eab308';
            if (g.includes('mecânico') || g.includes('acidente')) return '#0ea5e9';
            if (g.includes('inespecífico')) return '#a855f7';
            return 'black';
        };

        doc.font('Helvetica').fontSize(8);

        if (riscos.length > 0) {
            riscos.forEach(r => {
                let epiStr = '-';
                if (r.epis && r.epis.length > 0) {
                    epiStr = r.epis.map(e => e.ca ? `${e.nome_equipamento} (CA: ${e.ca})` : e.nome_equipamento).join(', ');
                }

                let epcStr = '-';
                if (r.epcs && r.epcs.length > 0) {
                    epcStr = r.epcs.map(e => e.nome).join(', ');
                }

                const gpStr = getSiglaGP(r.grupo);
                const corTextoGP = getCorGP(r.grupo);

                const perigoStr = r.nome_risco || '-';
                const fontesStr = r.fontes || '-';
                const tempoStr = r.tempo || '-';
                const obsStr = r.obs || '-';

                const hGP = doc.heightOfString(gpStr, { width: detCols[0].width - 4 });
                const hPerigo = doc.heightOfString(perigoStr, { width: detCols[1].width - 4 });
                const hFontes = doc.heightOfString(fontesStr, { width: detCols[2].width - 4 });
                const hTempo = doc.heightOfString(tempoStr, { width: detCols[3].width - 4 });
                const hEPI = doc.heightOfString(epiStr, { width: detCols[4].width - 4 });
                const hEPC = doc.heightOfString(epcStr, { width: detCols[5].width - 4 });
                const hObs = doc.heightOfString(obsStr, { width: detCols[6].width - 4 });

                const maxH = Math.max(hGP, hPerigo, hFontes, hTempo, hEPI, hEPC, hObs, 15) + 10;

                if (doc.y + maxH > 800) doc.addPage();

                let cx = startX;
                let yLinhaDet = doc.y;

                const valoresLinha = [
                    { str: gpStr, align: 'center', cor: corTextoGP },
                    { str: perigoStr, align: 'left', cor: 'black' },
                    { str: fontesStr, align: 'left', cor: 'black' },
                    { str: tempoStr, align: 'left', cor: 'black' },
                    { str: epiStr, align: 'left', cor: 'black' },
                    { str: epcStr, align: 'left', cor: 'black' },
                    { str: obsStr, align: 'left', cor: 'black' }
                ];

                valoresLinha.forEach((val, i) => {
                    const w = detCols[i].width;

                    doc.lineWidth(1).strokeColor('black').rect(cx, yLinhaDet, w, maxH).stroke();

                    doc.fillColor(val.cor);

                    if (i === 0) doc.font('Helvetica-Bold');
                    else doc.font('Helvetica');

                    doc.text(val.str, cx + 2, yLinhaDet + 5, { width: w - 4, align: val.align });

                    cx += w;
                });

                doc.y = yLinhaDet + maxH;
            });
        } else {
            doc.rect(startX, doc.y, width, 20).stroke();
            doc.fillColor('black').font('Helvetica-Oblique').fontSize(9).text('Nenhum risco identificado no levantamento.', startX + 5, doc.y + 5);
            doc.y += 20;
        }
        // =================================================================
        // BLOCO: DECLARAÇÃO DE ESCUTA DOS TRABALHADORES
        // =================================================================
        doc.moveDown(2);
        
        // Verifica se cabe na página antes de começar a desenhar
        if (doc.y + 150 > 800) doc.addPage();

        let yDecl = doc.y;

        // Título da Declaração
        doc.rect(startX, yDecl, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Participação dos Trabalhadores', startX, yDecl + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        let yTextoDecl = yDecl + 20;
        doc.font('Helvetica').fontSize(9);

        // Os parágrafos que você enviou
        const p1 = 'Durante as inspeções de campo, os trabalhadores foram ouvidos quanto à sua percepção sobre os riscos ocupacionais em suas atividades e ambientes de trabalho, conforme previsto na NR 01, item 1.5.3.3, alínea b.';
        const p2 = 'Quando constatada a existência de CIPA, as informações foram complementadas pelas manifestações da CIPA.';
        const p3 = 'Neste momento, também foram fornecidas noções básicas sobre o Gerenciamento de Riscos Ocupacionais, reforçando a importância da participação dos trabalhadores na identificação de situações de risco e na construção de um ambiente de trabalho mais seguro.';
        const p4 = 'As contribuições coletadas durante a escuta foram registradas em Folhas de Campo e serão consideradas no processo de identificação de perigos, avaliação preliminar de perigos e riscos e na avaliação do nível de risco, bem como na proposição de medidas de prevenção.';

        const txtDeclOpts = { width: width - 10, align: 'justify' };

        // Calcula a altura de cada parágrafo
        const hp1 = doc.heightOfString(p1, txtDeclOpts);
        const hp2 = doc.heightOfString(p2, txtDeclOpts);
        const hp3 = doc.heightOfString(p3, txtDeclOpts);
        const hp4 = doc.heightOfString(p4, txtDeclOpts);

        const espacoDecl = 10; // Espaço entre parágrafos
        const paddingDecl = 10; // Margem interna da caixa
        const alturaCaixaDecl = paddingDecl * 2 + hp1 + hp2 + hp3 + hp4 + (espacoDecl * 3);

        // Desenha a caixa (fundo branco, borda preta)
        doc.rect(startX, yTextoDecl, width, alturaCaixaDecl).fillAndStroke('white', 'black');
        doc.fillColor('black');

        // Escreve os parágrafos
        let currYDecl = yTextoDecl + paddingDecl;
        
        doc.text(p1, startX + 5, currYDecl, txtDeclOpts);
        currYDecl += hp1 + espacoDecl;

        doc.text(p2, startX + 5, currYDecl, txtDeclOpts);
        currYDecl += hp2 + espacoDecl;

        doc.text(p3, startX + 5, currYDecl, txtDeclOpts);
        currYDecl += hp3 + espacoDecl;

        doc.text(p4, startX + 5, currYDecl, txtDeclOpts);

        // Atualiza a posição 'Y' global para o próximo bloco (Registro Final) não sobrepor
        doc.y = yTextoDecl + alturaCaixaDecl;
        
        // =================================================================
        // ASSINATURAS - REGISTRO FINAL
        // =================================================================
        
        doc.moveDown(2);

        if (doc.y > 650) doc.addPage();

        let yReg = doc.y;

        doc.rect(startX, yReg, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Registro Final', startX, yReg + 5, { width: width, align: 'center' });
        doc.fillColor('black');
        yReg += 20;

        const boxHeight = 110;
        doc.rect(startX, yReg, width, boxHeight).stroke();

        const yLine = yReg + 80;
        const leftCenterX = startX + (width / 4);
        const rightCenterX = startX + (width * 0.75);

        if (levantamento.assinatura_responsavel_empresa && levantamento.assinatura_responsavel_empresa.includes('base64')) {
            const base64DataEmpresa = levantamento.assinatura_responsavel_empresa.split(';base64,').pop();
            const imgBufferEmpresa = Buffer.from(base64DataEmpresa, 'base64');
            doc.image(imgBufferEmpresa, leftCenterX - 75, yLine - 65, { width: 150, align: 'center' });
        }
        doc.font('Helvetica').fontSize(10);
        doc.text('__________________________________________', leftCenterX - 110, yLine, { width: 220, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(9).text(levantamento.responsavel_empresa_nome || 'Resp. da Empresa', leftCenterX - 110, yLine + 12, { width: 220, align: 'center' });
        doc.font('Helvetica').fontSize(8).text('Assinatura do Responsável pelas informações da empresa', leftCenterX - 110, yLine + 22, { width: 220, align: 'center' });

        if (levantamento.assinatura_avaliador && levantamento.assinatura_avaliador.includes('base64')) {
            const base64Data = levantamento.assinatura_avaliador.split(';base64,').pop();
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, rightCenterX - 75, yLine - 65, { width: 150, align: 'center' });
        }
        doc.font('Helvetica').fontSize(10);
        doc.text('__________________________________________', rightCenterX - 110, yLine, { width: 220, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(9).text(levantamento.nome_avaliador || 'Responsável Técnico', rightCenterX - 110, yLine + 12, { width: 220, align: 'center' });
        doc.font('Helvetica').fontSize(8).text('Assinatura do Avaliador', rightCenterX - 110, yLine + 22, { width: 220, align: 'center' });

        doc.end();

    } catch (error) {
        console.error("Erro ao gerar impressão PDFKit:", error);
        res.status(500).send("Erro interno ao gerar o PDF.");
    }
});

module.exports = router;