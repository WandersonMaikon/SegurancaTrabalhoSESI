const db = require("../database/db");

/**
 * Registra uma atividade na tabela de logs
 * * @param {Object} params
 * @param {string} params.id_unidade - UUID da unidade
 * @param {string} params.id_usuario - UUID do usuário que fez a ação
 * @param {string} params.acao - 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'INATIVAR'
 * @param {string} params.tabela - Nome da tabela (ex: 'cliente', 'ordem_servico')
 * @param {string} params.id_registro - UUID ou ID do item afetado
 * @param {Object} [params.dados_anteriores] - JSON com dados antes da mudança (opcional)
 * @param {Object} [params.dados_novos] - JSON com os dados novos (opcional)
 */
async function registrarLog({ id_unidade, id_usuario, acao, tabela, id_registro, dados_anteriores = null, dados_novos = null }) {
    try {
        const sql = `
            INSERT INTO log_atividade 
            (id_unidade, id_usuario, acao, tabela_afetada, id_registro_afetado, dados_anteriores, dados_novos)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        // Converte objetos JS para string JSON para salvar no banco
        const jsonAnterior = dados_anteriores ? JSON.stringify(dados_anteriores) : null;
        const jsonNovo = dados_novos ? JSON.stringify(dados_novos) : null;

        await db.query(sql, [
            id_unidade,
            id_usuario,
            acao,
            tabela,
            id_registro,
            jsonAnterior,
            jsonNovo
        ]);

        console.log(`[LOG] Ação ${acao} em ${tabela} registrada.`);
    } catch (error) {
        // Não queremos parar o sistema se o log falhar, apenas avisar no console
        console.error("Erro ao registrar log:", error);
    }
}

module.exports = registrarLog;