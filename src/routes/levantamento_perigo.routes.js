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

        if (data.ges && Array.isArray(data.ges)) {
            for (const g of data.ges) {
                await conn.query(`
                    INSERT INTO levantamento_ges (id_ges, id_levantamento, nome_grupo_ges, setor, cargos, nome_trabalhador_excecao, observacoes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id_levantamento, g.nome, g.setor, g.cargos, g.excecao, g.obs || null]); // <-- ADICIONADO
            }
        }

        if (data.quimicos && Array.isArray(data.quimicos)) {
            for (const q of data.quimicos) {
                await conn.query(`
                    INSERT INTO levantamento_quimico (id_quimico, id_levantamento, nome_rotulo, estado_fisico, tipo_exposicao, processo_quantidade, observacoes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [uuidv4(), id_levantamento, q.rotulo, q.estado, q.exposicao, q.processo, q.obs || null]); // <-- ADICIONADO
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
            SELECT nome_grupo_ges AS nome, setor, cargos, nome_trabalhador_excecao AS excecao, observacoes AS obs 
            FROM levantamento_ges 
            WHERE id_levantamento = ?
        `, [id]);

        const [quimicos] = await db.query(`
            SELECT nome_rotulo AS rotulo, estado_fisico AS estado, tipo_exposicao AS exposicao, processo_quantidade AS processo, observacoes AS obs 
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


// --- 5. IMPRIMIR PDF (GET) --- MÁGICA NOVA DO PDFKIT-TABLE
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
            SELECT nome_grupo_ges AS nome, setor, cargos, nome_trabalhador_excecao AS excecao, observacoes AS obs 
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

        // INICIA O ARQUIVO PDF (Note a margem top de 90 para o cabeçalho respirar)
        const doc = new PDFDocument({ margins: { top: 110, bottom: 40, left: 40, right: 40 }, size: 'A4' });
        const fs = require('fs');
        const path = require('path');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Levantamento_${id}.pdf"`);

        doc.pipe(res);

        // =================================================================
        // FUNÇÃO DO CABEÇALHO PADRÃO OURO (BARRA CINZA COM LOGO E PAGINAÇÃO)
        // =================================================================
        let pageCount = 0;
        
        const drawHeader = () => {
            pageCount++;
            const startX = 40;
            const width = 515;
            const headerY = 30; // Posição fixa no topo absoluto da página
            const headerH = 45; // Altura da barra cinza

            // 1. Desenha o Fundo Cinza
            doc.rect(startX, headerY, width, headerH).fill('#e4e4e7');

            // 2. Tenta carregar a Imagem (Múltiplas tentativas de rota)
            try {
                // Tentativa 1: Partindo da raiz do projeto (Certeiro 99% das vezes)
                const logoPath1 = path.join(process.cwd(), 'public', 'images', 'logo', 'sesi.png');
                // Tentativa 2: Partindo da pasta atual do arquivo da rota
                const logoPath2 = path.join(__dirname, '../public/images/logo/sesi.png');
                const logoPath3 = path.join(__dirname, '../../public/images/logo/sesi.png');

                if (fs.existsSync(logoPath1)) {
                    doc.image(logoPath1, startX - 10, headerY - 32, { height: 110 });
                } else if (fs.existsSync(logoPath2)) {
                    doc.image(logoPath2, startX - 10, headerY - 32, { height: 110 });
                } else if (fs.existsSync(logoPath3)) {
                    doc.image(logoPath3, startX - 10, headerY - 32, { height: 110 });
                } else {
                    console.error("🚨 AVISO: Nenhuma das rotas de imagem funcionou!");
                }
            } catch (err) {
                console.error("Aviso: Falha ao desenhar imagem.", err);
            }

            // 3. Título Centralizado
            doc.fillColor('black').font('Helvetica-Bold').fontSize(22)
               .text('Levantamento de Perigos', startX, headerY + 12, { width: width, align: 'center' });

            // 4. Paginação e Versão (Lado Direito, dentro da caixa)
            doc.font('Helvetica-Bold').fontSize(11)
               .text(`Pág ${pageCount}`, startX, headerY + 20, { width: width - 10, align: 'right' });
        };

        // Desenha na Primeira Página
        drawHeader();
        doc.y = 90;

        // Faz o PDFKit desenhar automaticamente nas próximas páginas
        doc.on('pageAdded', () => {
            drawHeader();
            doc.y = 90;
        });

        // =================================================================
        // CORPO DO DOCUMENTO (INTACTO DA VERSÃO ANTERIOR)
        // =================================================================

        const startX = 40;
        let posY = doc.y; // Como a margem top é 90, ele começa perfeitamente embaixo do cabeçalho
        const width = 515;
        const rowHeight = 20;

        // --- FUNÇÃO DE FORMATAÇÃO BLINDADA ---
        const formatarCampo = (dado) => {
            if (!dado) return '-';
            let arr = [];

            if (Array.isArray(dado)) {
                arr = dado;
            } else if (typeof dado === 'object') {
                arr = Object.values(dado);
            } else if (typeof dado === 'string') {
                try {
                    const parsed = JSON.parse(dado);
                    if (Array.isArray(parsed)) arr = parsed;
                    else if (typeof parsed === 'object') arr = Object.values(parsed);
                    else return parsed;
                } catch (e) { return dado; }
            } else {
                return String(dado);
            }

            const limpo = arr.filter(item => {
                if (!item) return false;
                const str = item.toString().trim();
                if (str === '') return false;
                if (str.toLowerCase() === 'outros') return false;
                return true;
            });

            return limpo.length > 0 ? limpo.join(', ') : '-';
        };

        // --- LÓGICA ESTRUTURAS AUXILIARES ---
        let arrEstruturas = [];
        try {
            if (Array.isArray(levantamento.estruturas_auxiliares)) {
                arrEstruturas = levantamento.estruturas_auxiliares;
            } else if (typeof levantamento.estruturas_auxiliares === 'string') {
                arrEstruturas = JSON.parse(levantamento.estruturas_auxiliares);
            }
        } catch (e) { arrEstruturas = []; }
        if (!Array.isArray(arrEstruturas)) arrEstruturas = [];

        const temMezanino = arrEstruturas.includes('Mezaninos') ? 'Sim' : 'Não';
        const temRampa = arrEstruturas.includes('Rampas') ? 'Sim' : 'Não';
        const textoEstruturasAuxiliares = `Mezaninos: ${temMezanino}   |   Rampas: ${temRampa}`;

        // --- LÓGICA COBERTURA ---
        const cobBruta = formatarCampo(levantamento.tipo_cobertura);
        let textoCobertura = cobBruta;
        if (cobBruta !== '-') {
            if (cobBruta.includes('-')) {
                const partes = cobBruta.split('-');
                textoCobertura = `Tipo de Estrutura: ${partes[0].trim()}   |   Tipo Telha: ${partes.slice(1).join('-').trim()}`;
            }
            else if (cobBruta.includes(',')) {
                const partes = cobBruta.split(',');
                textoCobertura = `Tipo de Estrutura: ${partes[0].trim()}   |   Tipo Telha: ${partes.slice(1).join(',').trim()}`;
            }
        }

        doc.lineWidth(1);
        doc.fontSize(11);

        // CABEÇALHO DO LEVANTAMENTO (DE VOLTA AO ORIGINAL!)
        doc.rect(startX, posY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').text('Empresa: ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(levantamento.nome_empresa || '-');
        doc.font('Helvetica-Bold').text('Data: ', startX + 410, posY + 6, { continued: true }).font('Helvetica').text(dataFormatada);
        posY += rowHeight;

        doc.rect(startX, posY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').text('Responsável pelo levantamento: ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(levantamento.nome_avaliador || '-');
        posY += rowHeight;

        doc.rect(startX, posY, width, rowHeight).stroke();
        doc.font('Helvetica-Bold').text('Responsável informações da empresa: ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(levantamento.responsavel_empresa_nome || '-');
        doc.font('Helvetica-Bold').text('Cargo: ', startX + 350, posY + 6, { continued: true }).font('Helvetica').text(levantamento.responsavel_empresa_cargo || '-');
        posY += rowHeight;

        doc.rect(startX, posY, width, rowHeight).stroke();
        const txtExterno = levantamento.trabalho_externo ? '( X ) Sim   (   ) Não' : '(   ) Sim   ( X ) Não';
        doc.font('Helvetica-Bold').text('Existem trabalhadores executando atividades fora da empresa? ', startX + 5, posY + 6, { continued: true }).font('Helvetica').text(txtExterno);
        posY += rowHeight + 15;

        // CARACTERIZAÇÃO AMBIENTE
        doc.rect(startX, posY, width, rowHeight).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Caracterização do Ambiente de Trabalho', startX, posY + 5, { width: width, align: 'center' });
        doc.fillColor('black').fontSize(10);
        posY += rowHeight;

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

        // OBSERVAÇÕES GERAIS
        doc.rect(startX, posY, width, 40).stroke();
        doc.font('Helvetica-Bold').fontSize(9).text('Observação sobre as condições gerais:', startX + 5, posY + 4);
        doc.font('Helvetica').text(levantamento.obs_condicoes_gerais || '-', startX + 5, posY + 16);

        doc.y = posY + 60;
        doc.moveDown(1);

        // =================================================================
        // BLOCO: GRUPO DE EXPOSIÇÃO SIMILAR (GES)
        // =================================================================
        if (doc.y > 650) doc.addPage();

        doc.rect(startX, doc.y, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Grupo de Exposição Similar (GES)', startX, doc.y + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        const gesCols = [
            { label: "Nome do Grupo (GES)", width: 95 },
            { label: "Setor", width: 90 },
            { label: "Cargos", width: 130 },
            { label: "Trabalhador (exceção)", width: 100 },
            { label: "Observações", width: 100 } 
        ];

        let yCabecalhoGes = doc.y;
        const alturaCabecalhoGes = 28; // 🔥 Altura maior para caber as duas linhas

        doc.rect(startX, yCabecalhoGes, width, alturaCabecalhoGes).fillAndStroke('#e4e4e7', 'black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);

        let currX = startX;
        gesCols.forEach(col => {
            doc.rect(currX, yCabecalhoGes, col.width, alturaCabecalhoGes).stroke();
            // yCabecalhoGes + 4 centraliza bem o texto nessas duas linhas
            doc.text(col.label, currX + 5, yCabecalhoGes + 4, { width: col.width - 10, align: 'center' });
            currX += col.width;
        });
        doc.y = yCabecalhoGes + alturaCabecalhoGes;

        doc.font('Helvetica').fontSize(9);
        const gesRows = ges.length > 0 ? ges : [{ nome: '-', setor: 'Nenhum GES cadastrado', cargos: '-', excecao: '-', obs: '-' }];

        gesRows.forEach(g => {
            const hNome = doc.heightOfString(g.nome || '-', { width: gesCols[0].width - 10 });
            const hSetor = doc.heightOfString(g.setor || '-', { width: gesCols[1].width - 10 });
            const hCargos = doc.heightOfString(g.cargos || '-', { width: gesCols[2].width - 10 });
            const hExcecao = doc.heightOfString(g.excecao || '-', { width: gesCols[3].width - 10 });
            const hObs = doc.heightOfString(g.obs || '-', { width: gesCols[4].width - 10 });
            const maxH = Math.max(hNome, hSetor, hCargos, hExcecao, hObs, 10) + 10;

            if (doc.y + maxH > 800) doc.addPage();

            let cx = startX;
            let yLinhaGes = doc.y;
            const valores = [g.nome || '-', g.setor || '-', g.cargos || '-', g.excecao || '-', g.obs || '-']; // <-- ADICIONADO g.obs

            valores.forEach((val, i) => {
                const w = gesCols[i].width;
                doc.rect(cx, yLinhaGes, w, maxH).stroke();
                doc.text(val, cx + 5, yLinhaGes + 5, { width: w - 10, align: 'left' });
                cx += w;
            });
            doc.y = yLinhaGes + maxH;
        });

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
            { label: "Observações", width: 100 } // <-- NOVA COLUNA
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
        const quimRows = quimicos.length > 0 ? quimicos : [{ rotulo: '-', estado: '-', exposicao: 'Nenhum produto', processo: '-', obs: '-' }];

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
            const valores = [q.rotulo || '-', q.estado || '-', q.exposicao || '-', q.processo || '-', q.obs || '-']; // <-- ADICIONADO q.obs

            valores.forEach((val, i) => {
                const w = quimCols[i].width;
                doc.rect(cx, yLinhaQuim, w, maxH).stroke();
                doc.text(val, cx + 5, yLinhaQuim + 5, { width: w - 10, align: i === 1 ? 'center' : 'left' });
                cx += w;
            });
            doc.y = yLinhaQuim + maxH;
        });

        // =================================================================
        // BLOCO: OBSERVAÇÕES (CHECKLIST)
        // =================================================================
        if (doc.y > 650) doc.addPage();

        let yObs = doc.y;
        doc.rect(startX, yObs, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Observações', startX, yObs + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        let yChecklist = doc.y;
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

        doc.y = yChecklist + alturaCaixaCheck;
        doc.moveDown(2);


        // =================================================================
        // BLOCO: DETALHAMENTO DOS PERIGOS (TABELA COMPLETA COM 7 COLUNAS GRUDADAS)
        // =================================================================
        if (doc.y > 650) doc.addPage();

        // 1. Título Principal (Preto)
        doc.rect(startX, doc.y, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Detalhamento dos Perigos', startX, doc.y + 5, { width: width, align: 'center' });
        doc.fillColor('black');

        // 2. Linha de Ausência de Riscos (Abaixo do Título Preto, grudado!)
        const ausente = (levantamento.ausencia_risco_ambiental && levantamento.ausencia_risco_ergonomico && levantamento.ausencia_risco_mecanico)
            ? 'Sim ( X )   Não (   )'
            : 'Sim (   )   Não ( X )';

        doc.rect(startX, doc.y, width, 22).stroke();
        doc.font('Helvetica-Bold').fontSize(9).text('Ausência de exposição a riscos ambientais, ergonômicos e mecânicos (acidentes): ', startX + 5, doc.y + 6, { continued: true });
        doc.font('Helvetica').text(ausente);

        // 3. Cabeçalho da Tabela (Cinza)
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

        // Função para descobrir a sigla do Grupo de Perigo (GP)
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

        // 4. Linhas de Dados
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
                    { str: gpStr, align: 'center' },
                    { str: perigoStr, align: 'left' },
                    { str: fontesStr, align: 'left' },
                    { str: tempoStr, align: 'left' },
                    { str: epiStr, align: 'left' },
                    { str: epcStr, align: 'left' },
                    { str: obsStr, align: 'left' }
                ];

                valoresLinha.forEach((val, i) => {
                    const w = detCols[i].width;
                    doc.rect(cx, yLinhaDet, w, maxH).stroke();
                    doc.text(val.str, cx + 2, yLinhaDet + 5, { width: w - 4, align: val.align });
                    cx += w;
                });

                doc.y = yLinhaDet + maxH;
            });
        } else {
            doc.rect(startX, doc.y, width, 20).stroke();
            doc.font('Helvetica-Oblique').fontSize(9).text('Nenhum risco identificado no levantamento.', startX + 5, doc.y + 5);
            doc.y += 20;
        }

        // =================================================================
        // ASSINATURAS - REGISTRO FINAL
        // =================================================================
        doc.moveDown(2);

        if (doc.y > 650) doc.addPage();

        let yReg = doc.y;

        // Título "Registro Final" (Preto)
        doc.rect(startX, yReg, width, 20).fillAndStroke('black', 'black');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('Registro Final', startX, yReg + 5, { width: width, align: 'center' });
        doc.fillColor('black');
        yReg += 20;

        // Caixa branca das assinaturas
        const boxHeight = 110;
        doc.rect(startX, yReg, width, boxHeight).stroke();

        const yLine = yReg + 80;
        const leftCenterX = startX + (width / 4);
        const rightCenterX = startX + (width * 0.75);

        // --- LADO ESQUERDO: RESPONSÁVEL DA EMPRESA ---
        if (levantamento.assinatura_responsavel_empresa && levantamento.assinatura_responsavel_empresa.includes('base64')) {
            const base64DataEmpresa = levantamento.assinatura_responsavel_empresa.split(';base64,').pop();
            const imgBufferEmpresa = Buffer.from(base64DataEmpresa, 'base64');
            doc.image(imgBufferEmpresa, leftCenterX - 75, yLine - 65, { width: 150, align: 'center' });
        }
        doc.font('Helvetica').fontSize(10);
        doc.text('__________________________________________', leftCenterX - 110, yLine, { width: 220, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(9).text(levantamento.responsavel_empresa_nome || 'Resp. da Empresa', leftCenterX - 110, yLine + 12, { width: 220, align: 'center' });
        doc.font('Helvetica').fontSize(8).text('Assinatura do Responsável pelas informações da empresa', leftCenterX - 110, yLine + 22, { width: 220, align: 'center' });

        // --- LADO DIREITO: AVALIADOR ---
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