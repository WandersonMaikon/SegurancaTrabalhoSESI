const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { v4: uuidv4 } = require('uuid');
const verificarAutenticacao = require("../middlewares/auth.middleware");

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

// Lista de Riscos para o Formulário (Baseado no PDF)
const RISCOS_PADRAO = {
    "Acidentes / Mecânicos": [
        { codigo: "11", nome: "Corte/Cisalhamento/Perfuração" },
        { codigo: "12", nome: "Deficiência de oxigênio" },
        { codigo: "13", nome: "Disparo acidental de projétil" },
        { codigo: "14", nome: "Engolfamento" },
        { codigo: "15", nome: "Esmagamento/Prensamento" },
        { codigo: "16", nome: "Explosão" },
        { codigo: "17", nome: "Fricção ou Abrasão" },
        { codigo: "18", nome: "Golpeamento" },
        { codigo: "19", nome: "Incêndio" },
        { codigo: "20", nome: "Intempéries" },
        { codigo: "21", nome: "Manuseio/contato com plantas perigosas" },
        { codigo: "22", nome: "Perfuração por objetos perfurocortantes" },
        { codigo: "23", nome: "Picada de animais peçonhentos" },
        { codigo: "24", nome: "Projeção de partículas ou objetos" },
        { codigo: "25", nome: "Queda de objetos e/ou materiais" },
        { codigo: "26", nome: "Queda nível inferior (< 2m) / mesmo nível" },
        { codigo: "27", nome: "Queda nível inferior (> 2m)" },
        { codigo: "28", nome: "Respingos de produtos perigosos" },
        { codigo: "29", nome: "Soterramento / Desmoronamento" },
        { codigo: "30", nome: "Tombamento de máquinas" },
        { codigo: "31", nome: "Vazamento/derramamento de produtos" }
    ],
    "Ergonômicos": [
        { codigo: "01", nome: "Esforço físico intenso" },
        { codigo: "02", nome: "Levantamento e transporte manual de peso" },
        { codigo: "03", nome: "Exigência de postura inadequada" },
        { codigo: "04", nome: "Controle rígido de produtividade" },
        { codigo: "05", nome: "Imposição de ritmos excessivos" },
        { codigo: "06", nome: "Trabalho em turno e noturno" },
        { codigo: "07", nome: "Jornadas de trabalho prolongadas" },
        { codigo: "08", nome: "Monotonia e repetitividade" },
        { codigo: "27", nome: "Situações de estresse organizacional" },
        { codigo: "28", nome: "Sobrecarga de trabalho mental" }
    ],
    "Físicos": [
        { codigo: "F1", nome: "Ruído" },
        { codigo: "F2", nome: "Calor" },
        { codigo: "F3", nome: "Radiações Ionizantes" },
        { codigo: "F4", nome: "Vibração" },
        { codigo: "F5", nome: "Umidade" }
    ],
    "Químicos": [
        { codigo: "Q1", nome: "Poeiras" },
        { codigo: "Q2", nome: "Fumos" },
        { codigo: "Q3", nome: "Névoas" },
        { codigo: "Q4", nome: "Gases e Vapores" }
    ],
    "Biológicos": [
        { codigo: "B1", nome: "Vírus" },
        { codigo: "B2", nome: "Bactérias" },
        { codigo: "B3", nome: "Fungos" }
    ]
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

        // ATENÇÃO: Verifique se o nome do arquivo na pasta views é com hifen ou underline
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

        res.render("formularios/levantamento-perigo-form", {
            user: userLogado,
            currentPage: 'levantamento-perigos',
            clientes,
            usuarios,
            epis,
            epcs,
            riscosPadrao: RISCOS_PADRAO
        });

    } catch (error) {
        console.error("Erro ao abrir formulário novo:", error);
        res.redirect("/formularios/levantamento-perigos"); // Ajuste conforme sua rota base
    }
});

// --- 3. SALVAR (POST) ---
router.post("/salvar", verificarAutenticacao, async (req, res) => {
    const conn = await db.getConnection(); 
    try {
        await conn.beginTransaction();

        const data = req.body;
        const userLogado = req.session.user;
        const id_levantamento = uuidv4();
        const id_unidade = userLogado.id_unidade || userLogado.unidade_id;

        // Helper para garantir JSON válido ou null
        const toJson = (obj) => JSON.stringify(obj || {});

        // 1. INSERIR CABEÇALHO
        const sqlLevantamento = `
            INSERT INTO levantamento_perigo (
                id_levantamento, id_unidade, id_cliente, data_levantamento, 
                id_responsavel_tecnico, responsavel_empresa_nome, trabalho_externo,
                tipo_construcao, tipo_piso, tipo_paredes, tipo_cobertura, 
                tipo_iluminacao, tipo_ventilacao, possui_climatizacao, estruturas_auxiliares,
                area_m2, pe_direito_m, largura_m, comprimento_m, obs_condicoes_gerais,
                ausencia_risco_ambiental, ausencia_risco_ergonomico, ausencia_risco_mecanico
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await conn.query(sqlLevantamento, [
            id_levantamento, id_unidade, data.id_cliente, data.data_levantamento,
            data.id_responsavel_tecnico, data.responsavel_empresa_nome, data.trabalho_externo ? 1 : 0,
            toJson(data.tipo_construcao), toJson(data.tipo_piso), toJson(data.tipo_paredes),
            toJson(data.tipo_cobertura), toJson(data.tipo_iluminacao), toJson(data.tipo_ventilacao),
            data.possui_climatizacao ? 1 : 0, JSON.stringify(data.estruturas_auxiliares || []),
            data.area_m2 || 0, data.pe_direito_m || 0, data.largura_m || 0, data.comprimento_m || 0,
            data.obs_condicoes_gerais,
            data.ausencia_risco_ambiental ? 1 : 0, data.ausencia_risco_ergonomico ? 1 : 0, data.ausencia_risco_mecanico ? 1 : 0
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
            for (const r of data.riscos) {
                const id_risco = uuidv4();
                
                await conn.query(`
                    INSERT INTO levantamento_risco_identificado (
                        id_risco_identificado, id_levantamento, grupo_perigo, codigo_perigo, 
                        descricao_perigo, fontes_geradoras, tipo_tempo_exposicao, observacoes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [id_risco, id_levantamento, r.grupo, r.codigo, r.nome, r.fontes, r.tempo, r.obs]);

                if (r.epis && Array.isArray(r.epis)) {
                    for (const epiId of r.epis) {
                        await conn.query('INSERT INTO levantamento_risco_has_epi (id_risco_identificado, id_epi) VALUES (?, ?)', [id_risco, epiId]);
                    }
                }

                if (r.epcs && Array.isArray(r.epcs)) {
                    for (const epcId of r.epcs) {
                        await conn.query('INSERT INTO levantamento_risco_has_epc (id_risco_identificado, id_epc) VALUES (?, ?)', [id_risco, epcId]);
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
            SELECT l.*, c.nome_empresa, c.cnpj, u.nome_completo as nome_responsavel_tecnico
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

        const [ges] = await db.query("SELECT * FROM levantamento_ges WHERE id_levantamento = ?", [id]);
        const [quimicos] = await db.query("SELECT * FROM levantamento_quimico WHERE id_levantamento = ?", [id]);
        const [riscos] = await db.query("SELECT * FROM levantamento_risco_identificado WHERE id_levantamento = ?", [id]);

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