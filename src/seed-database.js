const db = require('./database/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // Biblioteca para gerar UUID

async function seedDatabase() {
    console.log("🚀 Iniciando a população do banco de dados...");

    const connection = await db.getConnection(); // Pega uma conexão do pool

    try {
        await connection.beginTransaction(); // Inicia uma transação (tudo ou nada)

        // ---------------------------------------------------------
        // 1. CRIAR UNIDADE (Matriz)
        // ---------------------------------------------------------
        const unidadeId = uuidv4();
        console.log(`🏢 Criando Unidade (ID: ${unidadeId})...`);
        
        await connection.query(`
            INSERT INTO unidade (id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [unidadeId, 'Matriz', 'Minha Empresa LTDA', '00.000.000/0001-00', 'Rondônia', 'RO', true]);

        // ---------------------------------------------------------
        // 2. CRIAR PERFIL (Admin)
        // ---------------------------------------------------------
        const perfilId = uuidv4();
        console.log(`🛡️  Criando Perfil Admin (ID: ${perfilId})...`);

        await connection.query(`
            INSERT INTO perfil (id_perfil, nome_perfil, descricao, ativo)
            VALUES (?, ?, ?, ?)
        `, [perfilId, 'Administrador', 'Acesso total ao sistema', true]);

        // ---------------------------------------------------------
        // 3. CRIAR USUÁRIO (Admin)
        // ---------------------------------------------------------
        const usuarioId = uuidv4();
        const email = "admin@admin.com";
        const senhaPlana = "123456";
        
        // Criptografa a senha
        const salt = bcrypt.genSaltSync(10);
        const senhaHash = bcrypt.hashSync(senhaPlana, salt);

        console.log(`👤 Criando Usuário Admin (ID: ${usuarioId})...`);

        await connection.query(`
            INSERT INTO usuario (
                id_usuario, id_unidade, nome_completo, email, senha_hash, id_perfil, ativo
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [usuarioId, unidadeId, 'Super Admin', email, senhaHash, perfilId, true]);

        // ---------------------------------------------------------
        // FINALIZAÇÃO
        // ---------------------------------------------------------
        await connection.commit(); // Confirma todas as alterações
        console.log("\n✅ SUCESSO TOTAL!");
        console.log("------------------------------------------------");
        console.log(`📧 Login: ${email}`);
        console.log(`🔑 Senha: ${senhaPlana}`);
        console.log("------------------------------------------------");

    } catch (error) {
        await connection.rollback(); // Desfaz tudo se der erro
        
        if (error.code === 'ER_DUP_ENTRY') {
            console.log("\n⚠️  AVISO: Parece que esses dados já existem no banco.");
        } else {
            console.error("\n❌ ERRO CRÍTICO:", error);
        }
    } finally {
        connection.release(); // Libera a conexão
        process.exit();
    }
}

seedDatabase();