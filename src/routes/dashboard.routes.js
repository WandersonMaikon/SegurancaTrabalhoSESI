const express = require("express");
const router = express.Router();
const db = require("../database/db");
const verificarAutenticacao = require("../middlewares/auth.middleware");

// =========================================================================
// ROTA DO DASHBOARD PRINCIPAL
// =========================================================================
router.get("/", verificarAutenticacao, async (req, res) => {
    try {
        const userLogado = req.session.user;

        // 1. LER AS DATAS DO CALENDÁRIO (Vindas da URL)
        const { start, end } = req.query;

        let filtroDataOS = "";
        let paramsOS = [];
        let filtroDataCliente = "";
        let paramsCliente = [];

        // Se o usuário selecionou uma data, aplicamos no SQL
        if (start && end) {
            filtroDataOS = " AND os.data_abertura BETWEEN ? AND ? ";
            paramsOS.push(`${start} 00:00:00`, `${end} 23:59:59`);

            filtroDataCliente = " AND created_at BETWEEN ? AND ? ";
            paramsCliente.push(`${start} 00:00:00`, `${end} 23:59:59`);
        }

        const [rowClientes] = await db.query(`SELECT COUNT(*) as total FROM cliente WHERE deleted_at IS NULL ${filtroDataCliente}`, paramsCliente);

        let totalFunc = 0;
        try {
            const [rowFunc] = await db.query(`SELECT SUM(num_colaboradores) as total FROM cliente WHERE deleted_at IS NULL ${filtroDataCliente}`, paramsCliente);
            totalFunc = rowFunc[0].total || 0;
        } catch (e) { console.log("Erro num_colaboradores:", e.message); }

        // 2. BUSCA O TOTAL DE OS E A SOMA DO FOMENTO (Ignorando Canceladas)
        const [rowOS] = await db.query(`
            SELECT 
                COUNT(*) as totalQuantidade, 
                SUM(valor_previsto_fomento) as totalFomento 
            FROM ordem_servico os 
            WHERE os.deleted_at IS NULL 
            AND os.status != 'Cancelada' 
            ${filtroDataOS}
        `, paramsOS);

        // 3. BUSCANDO O PERFIL DOS CLIENTES (Pizza)
        const [rowEmpresas] = await db.query(`SELECT COUNT(*) as total FROM cliente WHERE deleted_at IS NULL AND (industria = 0 OR industria IS NULL) ${filtroDataCliente}`, paramsCliente);
        const [rowIndustrias] = await db.query(`SELECT COUNT(*) as total FROM cliente WHERE deleted_at IS NULL AND industria = 1 ${filtroDataCliente}`, paramsCliente);

        // 4. MÁGICA: GRÁFICO DE BARRAS (Faturamento, Ignorando OS Canceladas)
        const [faturamentoRows] = await db.query(`
            SELECT 
                DATE_FORMAT(os.data_abertura, '%m/%Y') as mes,
                SUM(os.valor_total_contrato) as total
            FROM ordem_servico os
            WHERE os.deleted_at IS NULL 
            AND os.status != 'Cancelada' 
            ${filtroDataOS}
            GROUP BY YEAR(os.data_abertura), MONTH(os.data_abertura), DATE_FORMAT(os.data_abertura, '%m/%Y')
            ORDER BY YEAR(os.data_abertura) ASC, MONTH(os.data_abertura) ASC
        `, paramsOS);

        const mesesLabel = faturamentoRows.map(r => r.mes);
        const valoresFaturamento = faturamentoRows.map(r => r.total);

        // 5. BUSCANDO AS ÚLTIMAS 5 OS (Ignorando as Canceladas na Tabela)
        const [ultimasOS] = await db.query(`
            SELECT os.*, c.nome_empresa 
            FROM ordem_servico os 
            JOIN cliente c ON os.id_cliente = c.id_cliente 
            WHERE os.deleted_at IS NULL 
            AND os.status != 'Cancelada' 
            ${filtroDataOS}
            ORDER BY os.data_abertura DESC LIMIT 5
        `, paramsOS);

        // 6. PREPARANDO PACOTE PARA A TELA
        const dash = {
            totalClientes: rowClientes[0].total || 0,
            totalFuncionarios: totalFunc,
            totalContratos: rowOS[0].totalQuantidade || 0,
            totalFomento: rowOS[0].totalFomento || 0,
            qtdEmpresasComuns: rowEmpresas[0].total || 0,
            qtdIndustrias: rowIndustrias[0].total || 0,
            mesesLabel: mesesLabel.length > 0 ? mesesLabel : ['Sem dados'],
            valoresFaturamento: valoresFaturamento.length > 0 ? valoresFaturamento : [0]
        };

        res.render("dashboard/index", {
            user: userLogado,
            currentPage: 'dashboard',
            dash: dash,
            ultimasOS: ultimasOS
        });

    } catch (error) {
        console.error("Erro ao carregar Dashboard:", error);
        res.status(500).send("Erro interno ao carregar o Dashboard.");
    }
});

router.get("/inicio", verificarAutenticacao, (req, res) => {
    res.render("dashboard/inicio", {
        user: req.session.user,
        currentPage: 'inicio'
    });
});

module.exports = router;