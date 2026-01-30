const db = require('./db'); // CAMINHO CORRIGIDO (mesma pasta)
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seedDatabase() {
    console.log("🚀 Iniciando a população do banco de dados...");

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

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
        // 2.1. CRIAR MÓDULOS E DAR PERMISSÕES AO ADMIN
        // ---------------------------------------------------------
        console.log(`📦 Cadastrando Módulos e Permissões...`);

        // ATENÇÃO: Estas chaves DEVEM ser iguais às usadas no sidebar.ejs
        const listaModulos = [
            { nome: 'Dashboard', chave: 'dashboard' },
            { nome: 'Gestão de Clientes', chave: 'clientes' },
            { nome: 'Gestão de Serviços', chave: 'servicos' },
            { nome: 'Ordens de Serviço', chave: 'ordens_servico' },
            { nome: 'Relatórios', chave: 'relatorios' },
            { nome: 'Scrum Board', chave: 'scrum' },
            { nome: 'Gestão de Usuários', chave: 'usuarios' }, // Engloba lista, logs e perfis no menu
            { nome: 'Riscos', chave: 'riscos' },
            { nome: 'EPIs', chave: 'epis' },
            { nome: 'EPCs', chave: 'epcs' },
            { nome: 'Gestão de Unidades', chave: 'unidades' }
        ];

        for (const mod of listaModulos) {
            const moduloId = uuidv4();

            // A. Insere o Módulo
            await connection.query(`
                INSERT INTO modulo_sistema (id_modulo, nome_modulo, chave_sistema)
                VALUES (?, ?, ?)
            `, [moduloId, mod.nome, mod.chave]);

            // B. Cria a Permissão TOTAL para o Admin neste módulo
            const permissaoId = uuidv4();
            await connection.query(`
                INSERT INTO perfil_permissao (
                    id_permissao, id_perfil, id_modulo, 
                    pode_ver, pode_criar, pode_editar, pode_excluir, tudo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [permissaoId, perfilId, moduloId, true, true, true, true, true]);
        }

        // ---------------------------------------------------------
        // 3. CRIAR USUÁRIO (Admin)
        // ---------------------------------------------------------
        const usuarioId = uuidv4();
        const email = "admin@admin.com";
        const senhaPlana = "123456";

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
        await connection.commit();
        console.log("\n✅ SUCESSO TOTAL!");
        console.log("------------------------------------------------");
        console.log(`📧 Login: ${email}`);
        console.log(`🔑 Senha: ${senhaPlana}`);
        console.log("------------------------------------------------");

    } catch (error) {
        await connection.rollback();

        if (error.code === 'ER_DUP_ENTRY') {
            console.log("\n⚠️  AVISO: Dados duplicados. Limpe o banco se quiser recriar do zero.");
        } else {
            console.error("\n❌ ERRO CRÍTICO:", error);
        }
    } finally {
        connection.release();
        process.exit();
    }
}

seedDatabase();