const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");

// =========================================================================
// CONFIGURAÇÃO DE UPLOAD DE ARQUIVOS (MULTER)
// =========================================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Define a pasta onde as imagens dos riscos serão salvas
        const dir = 'public/uploads/riscos';
        // Cria a pasta automaticamente se ela não existir
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Cria um nome único para o arquivo para evitar que um sobrescreva o outro
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'risco-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Se você tiver o sistema de logs, mantenha essa linha. Se não, pode comentar.
// const registrarLog = require("../utils/logger"); 

// =========================================================================
// CONSTANTES E UTILITÁRIOS
// =========================================================================

// Função auxiliar Admin
const verificarSeEhAdmin = (user) => {
    if (user.email === 'admin@admin.com') return true;
    if (user.nome_perfil === 'Administrador' || user.nome_perfil === 'Super Admin') return true;
    return false;
};

// =========================================================================
// ROTAS
// =========================================================================

// --- 1. LISTAR LEVANTAMENTOS (GET) ---
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;
        const ehAdmin = verificarSeEhAdmin(userLogado);

        let query = `
            SELECT 
                l.id_levantamento, 
                l.data_levantamento, 
                l.created_at,
                c.nome_empresa, 
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

        const levantamentosFormatados = levantamentos.map(l => ({
            ...l,
            data_formatada: new Date(l.data_levantamento).toLocaleDateString('pt-BR')
        }));

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

        // 1. Buscar Clientes
        let queryClientes = "SELECT id_cliente, nome_empresa FROM cliente WHERE deleted_at IS NULL AND ativo = 1";
        let paramsClientes = [];
        if (!ehAdmin) {
            queryClientes += " AND id_unidade = ?";
            paramsClientes.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        queryClientes += " ORDER BY nome_empresa ASC";
        const [clientes] = await db.query(queryClientes, paramsClientes);

        // 2. Buscar Usuários (Responsável Técnico)
        let queryUsers = "SELECT id_usuario, nome_completo FROM usuario WHERE ativo = 1";
        let paramsUsers = [];
        if (!ehAdmin) {
            queryUsers += " AND id_unidade = ?";
            paramsUsers.push(userLogado.id_unidade || userLogado.unidade_id);
        }
        const [usuarios] = await db.query(queryUsers, paramsUsers);

        // 3. Buscar EPIs e EPCs
        const [epis] = await db.query("SELECT id_epi, nome_equipamento, ca FROM epi WHERE ativo = 1");
        const [epcs] = await db.query("SELECT id_epc, nome FROM epc WHERE ativo = 1");

        // 4. BUSCAR RISCOS 
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

        // 1. INSERIR CABEÇALHO DO LEVANTAMENTO
        const sqlLevantamento = `
            INSERT INTO levantamento_perigo (
                id_levantamento, id_unidade, id_cliente, data_levantamento, 
                id_responsavel_tecnico, responsavel_empresa_nome, responsavel_empresa_cargo, trabalho_externo,
                tipo_construcao, tipo_piso, tipo_paredes, cor_paredes, divisoes_internas_material, 
                tipo_cobertura, tipo_forro, tipo_iluminacao, tipo_ventilacao, possui_climatizacao, 
                escadas_tipo, passarelas_tipo, estruturas_auxiliares,
                area_m2, pe_direito_m, largura_m, comprimento_m, obs_condicoes_gerais,
                ausencia_risco_ambiental, ausencia_risco_ergonomico, ausencia_risco_mecanico,
                ausencia_risco_quimico, ausencia_risco_biologico,
                assinatura_avaliador, assinatura_responsavel_empresa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await conn.query(sqlLevantamento, [
            id_levantamento, id_unidade, data.id_cliente, data.data_levantamento,
            data.id_responsavel_tecnico, data.responsavel_empresa_nome, data.responsavel_empresa_cargo, data.trabalho_externo ? 1 : 0,
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

        // 2. INSERIR GES
        if (data.ges && Array.isArray(data.ges)) {
            for (const g of data.ges) {
                await conn.query(`
                    INSERT INTO levantamento_ges (id_ges, id_levantamento, nome_grupo_ges, setor, cargos, nome_trabalhador_excecao)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id_levantamento, g.nome, g.setor, g.cargos, g.excecao]);
            }
        }

        // 3. INSERIR QUÍMICOS
        if (data.quimicos && Array.isArray(data.quimicos)) {
            for (const q of data.quimicos) {
                await conn.query(`
                    INSERT INTO levantamento_quimico (id_quimico, id_levantamento, nome_rotulo, estado_fisico, tipo_exposicao, processo_quantidade)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id_levantamento, q.rotulo, q.estado, q.exposicao, q.processo]);
            }
        }

        // 4. INSERIR RISCOS
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
                        descricao_perigo, fontes_geradoras, tipo_tempo_exposicao, observacoes, anexo_imagem
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_risco_identificado, id_levantamento,
                    r.id_risco, r.grupo, r.codigo, r.nome, r.fontes, r.tempo, r.obs, anexo_imagem
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
            SELECT nome_grupo_ges AS nome, setor, cargos, nome_trabalhador_excecao AS excecao 
            FROM levantamento_ges 
            WHERE id_levantamento = ?
        `, [id]);

        const [quimicos] = await db.query(`
            SELECT nome_rotulo AS rotulo, estado_fisico AS estado, tipo_exposicao AS exposicao, processo_quantidade AS processo 
            FROM levantamento_quimico 
            WHERE id_levantamento = ?
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

module.exports = router;