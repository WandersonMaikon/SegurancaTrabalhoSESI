const db = require('./db'); 
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
     
        const [unidadesExistentes] = await connection.query("SELECT id_unidade FROM unidade WHERE cnpj = '00.000.000/0001-00'");

        let unidadeId;
        if (unidadesExistentes.length > 0) {
            unidadeId = unidadesExistentes[0].id_unidade;
            console.log(`🏢 Unidade Matriz já existe (ID: ${unidadeId}). Pulando criação.`);
        } else {
            unidadeId = uuidv4();
            console.log(`🏢 Criando Unidade (ID: ${unidadeId})...`);
            await connection.query(`
                INSERT INTO unidade (id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, ativo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [unidadeId, 'Unidade JP', 'Serviço Social da Indústria', '03.783.989/0003-07', 'Ji-paraná', 'RO', true]);
        }

        // ---------------------------------------------------------
        // 2. CRIAR PERFIL (Admin)
        // ---------------------------------------------------------
        const [perfisExistentes] = await connection.query("SELECT id_perfil FROM perfil WHERE nome_perfil = 'Administrador'");

        let perfilId;
        if (perfisExistentes.length > 0) {
            perfilId = perfisExistentes[0].id_perfil;
            console.log(`🛡️  Perfil Admin já existe. Usando ID existente.`);
        } else {
            perfilId = uuidv4();
            console.log(`🛡️  Criando Perfil Admin (ID: ${perfilId})...`);
            await connection.query(`
                INSERT INTO perfil (id_perfil, nome_perfil, descricao, ativo)
                VALUES (?, ?, ?, ?)
            `, [perfilId, 'Administrador', 'Acesso total ao sistema', true]);
        }

        // ---------------------------------------------------------
        // 2.1. CRIAR MÓDULOS E DAR PERMISSÕES AO ADMIN
        // ---------------------------------------------------------
        console.log(`📦 Verificando e Cadastrando Módulos...`);

        // LISTA ATUALIZADA COM TODOS OS MÓDULOS DO SIDEBAR + PERFIS
        const listaModulos = [
            { nome: 'Dashboard', chave: 'dashboard' },
            { nome: 'Gestão de Clientes', chave: 'clientes' },
            { nome: 'Gestão de Serviços', chave: 'servicos' },
            { nome: 'Ordens de Serviço', chave: 'ordens_servico' },
            { nome: 'Relatórios', chave: 'relatorios' },
            { nome: 'Scrum Board', chave: 'scrum' },
            { nome: 'Gestão de Usuários', chave: 'usuarios' },
            { nome: 'Gestão de Perfis', chave: 'perfis' },
            { nome: 'Riscos', chave: 'riscos' },
            { nome: 'EPIs', chave: 'epis' },
            { nome: 'EPCs', chave: 'epcs' },
            { nome: 'Gestão de Unidades', chave: 'unidades' }
        ];

        for (const mod of listaModulos) {
            // Verifica se o módulo já existe pela chave
            const [moduloExistente] = await connection.query("SELECT id_modulo FROM modulo_sistema WHERE chave_sistema = ?", [mod.chave]);

            let moduloId;

            if (moduloExistente.length > 0) {
                moduloId = moduloExistente[0].id_modulo;
                // console.log(`   -> Módulo ${mod.chave} já existe.`);
            } else {
                moduloId = uuidv4();
                console.log(`   -> Criando módulo: ${mod.nome} (${mod.chave})`);
                await connection.query(`
                    INSERT INTO modulo_sistema (id_modulo, nome_modulo, chave_sistema)
                    VALUES (?, ?, ?)
                `, [moduloId, mod.nome, mod.chave]);
            }

            // Garante que o Admin tenha permissão neste módulo
            // Primeiro checa se já tem permissão
            const [permExistente] = await connection.query(`
                SELECT id_permissao FROM perfil_permissao 
                WHERE id_perfil = ? AND id_modulo = ?
            `, [perfilId, moduloId]);

            if (permExistente.length === 0) {
                // Se não tem permissão, cria FULL ACCESS
                const permissaoId = uuidv4();
                await connection.query(`
                    INSERT INTO perfil_permissao (
                        id_permissao, id_perfil, id_modulo, 
                        pode_ver, pode_criar, pode_editar, pode_inativar, tudo
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [permissaoId, perfilId, moduloId, true, true, true, true, true]);
            }
        }

        // ---------------------------------------------------------
        // 3. CRIAR USUÁRIO (Admin)
        // ---------------------------------------------------------
        const email = "admin@admin.com";
        const [usuarioExistente] = await connection.query("SELECT id_usuario FROM usuario WHERE email = ?", [email]);

        if (usuarioExistente.length === 0) {
            const usuarioId = uuidv4();
            const senhaPlana = "123456";
            const salt = bcrypt.genSaltSync(10);
            const senhaHash = bcrypt.hashSync(senhaPlana, salt);

            console.log(`👤 Criando Usuário Admin (ID: ${usuarioId})...`);

            await connection.query(`
                INSERT INTO usuario (
                    id_usuario, id_unidade, nome_completo, email, senha_hash, id_perfil, ativo
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [usuarioId, unidadeId, 'Super Admin', email, senhaHash, perfilId, true]);

            console.log("------------------------------------------------");
            console.log(`📧 Login: ${email}`);
            console.log(`🔑 Senha: ${senhaPlana}`);
            console.log("------------------------------------------------");
        } else {
            console.log(`👤 Usuário Admin já existe.`);
        }

        // ---------------------------------------------------------
        // FINALIZAÇÃO
        // ---------------------------------------------------------
        await connection.commit();
        console.log("\n✅ BANCO DE DADOS SINCRONIZADO COM SUCESSO!");

    } catch (error) {
        await connection.rollback();
        console.error("\n❌ ERRO CRÍTICO:", error);
    } finally {
        connection.release();
        process.exit();
    }
}

seedDatabase();