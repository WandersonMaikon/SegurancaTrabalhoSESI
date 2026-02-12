const db = require('./db'); // <--- CORRIGIDO AQUI (era ./database/db)
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// --- DADOS DA TABELA 24 (COMPLETO) ---
const tabela24Data = [
    // QUÍMICOS (CHEMICAL)
    { codigo: '01.01.2001', grupo: 'Químico', descricao: 'Arsênio e seus compostos' },
    { codigo: '01.02.2001', grupo: 'Químico', descricao: 'Asbestos (ou amianto)' },
    { codigo: '01.03.2001', grupo: 'Químico', descricao: 'Benzeno e seus compostos tóxicos (exceto os abaixo especificados, que constam expressamente no Anexo IV do Decreto 3.048/1999)' },
    { codigo: '01.03.2002', grupo: 'Químico', descricao: 'Estireno (vinilbenzeno)' },
    { codigo: '01.04.2001', grupo: 'Químico', descricao: 'Berílio e seus compostos tóxicos' },
    { codigo: '01.05.2001', grupo: 'Químico', descricao: 'Bromo e seus compostos tóxicos' },
    { codigo: '01.06.2001', grupo: 'Químico', descricao: 'Cádmio e seus compostos tóxicos' },
    { codigo: '01.07.2001', grupo: 'Químico', descricao: 'Carvão mineral e seus derivados' },
    { codigo: '01.08.2001', grupo: 'Químico', descricao: 'Chumbo e seus compostos tóxicos' },
    { codigo: '01.09.2001', grupo: 'Químico', descricao: 'Cloro e seus compostos tóxicos (exceto os abaixo especificados, que constam expressamente no Anexo IV do Decreto 3.048/1999)' },
    { codigo: '01.09.2002', grupo: 'Químico', descricao: "Metileno-ortocloroanilina, MOCA® (4,4'-metileno-bis-(2-cloroanilina), MBOCA®)" },
    { codigo: '01.09.2003', grupo: 'Químico', descricao: 'Bis (cloro metil) éter, clorometileter, (éter bis (clorometílico) ou éter metílico de clorometila), bisclorometil' },
    { codigo: '01.09.2004', grupo: 'Químico', descricao: 'Biscloroetileter (éter dicloroetílico)' },
    { codigo: '01.09.2005', grupo: 'Químico', descricao: 'Clorambucil (cloroambucil)' },
    { codigo: '01.09.2006', grupo: 'Químico', descricao: 'Cloropreno' },
    { codigo: '01.10.2001', grupo: 'Químico', descricao: 'Cromo e seus compostos tóxicos' },
    { codigo: '01.11.2001', grupo: 'Químico', descricao: 'Dissulfeto de carbono' },
    { codigo: '01.12.2001', grupo: 'Químico', descricao: 'Fósforo e seus compostos tóxicos' },
    { codigo: '01.13.001', grupo: 'Químico', descricao: 'Iodo' },
    { codigo: '01.14.001', grupo: 'Químico', descricao: 'Manganês e seus compostos' },
    { codigo: '01.15.001', grupo: 'Químico', descricao: 'Mercúrio e seus compostos' },
    { codigo: '01.16.001', grupo: 'Químico', descricao: 'Níquel e seus compostos tóxicos' },
    { codigo: '01.17.001', grupo: 'Químico', descricao: 'Petróleo, xisto betuminoso, gás natural e seus derivados' },
    { codigo: '01.18.001', grupo: 'Químico', descricao: 'Sílica livre' },
    { codigo: '01.19.001', grupo: 'Químico', descricao: 'Butadieno-estireno' },
    { codigo: '01.19.002', grupo: 'Químico', descricao: 'Acrilonitrila' },
    { codigo: '01.19.003', grupo: 'Químico', descricao: '1-3-butadieno' },
    { codigo: '01.19.004', grupo: 'Químico', descricao: 'Mercaptanos (tióis)' },
    { codigo: '01.19.005', grupo: 'Químico', descricao: 'n-hexano' },
    { codigo: '01.19.006', grupo: 'Químico', descricao: 'Diisocianato de tolueno (TDI)' },
    { codigo: '01.19.007', grupo: 'Químico', descricao: 'Aminas aromáticas' },
    { codigo: '01.19.008', grupo: 'Químico', descricao: 'Aminobifenila (4-aminodifenil)' },
    { codigo: '01.19.009', grupo: 'Químico', descricao: 'Auramina' },
    { codigo: '01.19.010', grupo: 'Químico', descricao: 'Azatioprina' },
    { codigo: '01.19.011', grupo: 'Químico', descricao: '1-4-butanodiol' },
    { codigo: '01.19.012', grupo: 'Químico', descricao: 'Dimetanosulfonato (MIRELAN)' },
    { codigo: '01.19.013', grupo: 'Químico', descricao: 'Ciclofosfamida' },
    { codigo: '01.19.014', grupo: 'Químico', descricao: 'Dietiletil-bestrol' },
    { codigo: '01.19.015', grupo: 'Químico', descricao: 'Acronitrila' },
    { codigo: '01.19.016', grupo: 'Químico', descricao: 'Nitronaftilamina' },
    { codigo: '01.19.017', grupo: 'Químico', descricao: '4-dimetil-aminoazobenzeno' },
    { codigo: '01.19.018', grupo: 'Químico', descricao: 'Benzopireno' },
    { codigo: '01.19.019', grupo: 'Químico', descricao: 'Beta-pbiscloromeropiolactona (beta-propiolactona)' },
    { codigo: '01.19.021', grupo: 'Químico', descricao: 'Dianizidina' },
    { codigo: '01.19.022', grupo: 'Químico', descricao: 'Dietilsulfato' },
    { codigo: '01.19.023', grupo: 'Químico', descricao: 'Dimetilsulfato' },
    { codigo: '01.19.024', grupo: 'Químico', descricao: 'Etilenoamina' },
    { codigo: '01.19.025', grupo: 'Químico', descricao: 'Etilenotiureia' },
    { codigo: '01.19.026', grupo: 'Químico', descricao: 'Fenacetina' },
    { codigo: '01.19.027', grupo: 'Químico', descricao: 'Iodeto de metila' },
    { codigo: '01.19.028', grupo: 'Químico', descricao: 'Etilnitrosureia' },
    { codigo: '01.19.029', grupo: 'Químico', descricao: 'Nitrosamina' },
    { codigo: '01.19.030', grupo: 'Químico', descricao: 'Ortotoluidina' },
    { codigo: '01.19.031', grupo: 'Químico', descricao: 'Oximetalona (oxime-talona)' },
    { codigo: '01.19.032', grupo: 'Químico', descricao: 'Procarbazina' },
    { codigo: '01.19.033', grupo: 'Químico', descricao: 'Propanosultona' },
    { codigo: '01.19.034', grupo: 'Químico', descricao: 'Óxido de etileno' },
    { codigo: '01.19.035', grupo: 'Químico', descricao: 'Estilbenzeno' },
    { codigo: '01.19.036', grupo: 'Químico', descricao: 'Creosoto' },
    { codigo: '01.19.038', grupo: 'Químico', descricao: 'Benzidina' },
    { codigo: '01.19.039', grupo: 'Químico', descricao: 'Betanaftilamina' },
    { codigo: '01.19.040', grupo: 'Químico', descricao: '1-cloro-2,4-nitrodifenil' },
    { codigo: '01.19.041', grupo: 'Químico', descricao: '3-poxipro-pano' },

    // FÍSICOS (PHYSICAL)
    { codigo: '02.01.2001', grupo: 'Físico', descricao: 'Ruído' },
    { codigo: '02.01.2002', grupo: 'Físico', descricao: 'Vibrações localizadas (mão-braço)' },
    { codigo: '02.01.2003', grupo: 'Físico', descricao: 'Vibração de corpo inteiro (aceleração resultante de exposição normalizada - aren)' },
    { codigo: '02.01.2004', grupo: 'Físico', descricao: 'Vibração de corpo inteiro (Valor da Dose de Vibração Resultante - VDVR)' },
    { codigo: '02.01.2005', grupo: 'Físico', descricao: 'Trabalhos com perfuratrizes e marteletes pneumáticos' },
    { codigo: '02.01.2006', grupo: 'Físico', descricao: 'Radiações ionizantes' },
    { codigo: '02.01.2007', grupo: 'Físico', descricao: 'Extração e beneficiamento de minerais radioativos' },
    { codigo: '02.01.2008', grupo: 'Físico', descricao: 'Atividades em minerações com exposição ao radônio' },
    { codigo: '02.01.2009', grupo: 'Físico', descricao: 'Realização de manutenção e supervisão em unidades de extração, tratamento e beneficiamento de minerais radioativos com exposição às radiações ionizantes' },
    { codigo: '02.01.2010', grupo: 'Físico', descricao: 'Operações com reatores nucleares ou com fontes radioativas' },
    { codigo: '02.01.2011', grupo: 'Físico', descricao: 'Trabalhos realizados com exposição aos raios Alfa, Beta, Gama e X, aos nêutrons e às substâncias radioativas para fins industriais, terapêuticos e diagnósticos' },
    { codigo: '02.01.2012', grupo: 'Físico', descricao: 'Fabricação e manipulação de produtos radioativos' },
    { codigo: '02.01.2013', grupo: 'Físico', descricao: 'Pesquisas e estudos com radiações ionizantes em laboratórios' },
    { codigo: '02.01.2014', grupo: 'Físico', descricao: 'Trabalhos com exposição ao calor acima dos limites de tolerância estabelecidos na NR-15, da Portaria 3.214/1978' },
    { codigo: '02.01.2015', grupo: 'Físico', descricao: 'Pressão atmosférica anormal' },
    { codigo: '02.01.2016', grupo: 'Físico', descricao: 'Trabalhos em caixões ou câmaras hiperbáricas' },
    { codigo: '02.01.2017', grupo: 'Físico', descricao: 'Trabalhos em tubulões ou túneis sob ar comprimido' },
    { codigo: '02.01.2018', grupo: 'Físico', descricao: 'Operações de mergulho com o uso de escafandros ou outros equipamentos' },

    // BIOLÓGICOS (BIOLOGICAL)
    { codigo: '03.01.2001', grupo: 'Biológico', descricao: 'Trabalhos em estabelecimentos de saúde com contato com pacientes portadores de doenças infectocontagiosas ou com manuseio de materiais contaminados' },
    { codigo: '03.01.2002', grupo: 'Biológico', descricao: 'Trabalhos com animais infectados para tratamento ou para o preparo de soro, vacinas e outros produtos' },
    { codigo: '03.01.2003', grupo: 'Biológico', descricao: 'Trabalhos em laboratórios de autópsia, de anatomia e anátomo-histologia' },
    { codigo: '03.01.2004', grupo: 'Biológico', descricao: 'Trabalho de exumação de corpos e manipulação de resíduos de animais deteriorados' },
    { codigo: '03.01.2005', grupo: 'Biológico', descricao: 'Trabalhos em galerias, fossas e tranques de esgoto' },
    { codigo: '03.01.2006', grupo: 'Biológico', descricao: 'Esvaziamento de biodigestores' },
    { codigo: '03.01.2007', grupo: 'Biológico', descricao: 'Coleta e industrialização do lixo' },

    // ASSOCIAÇÃO (ASSOCIATED)
    { codigo: '04.01.2001', grupo: 'Associação', descricao: 'Mineração subterrânea cujas atividades sejam exercidas afastadas das frentes de produção' },
    { codigo: '04.01.2002', grupo: 'Associação', descricao: 'Trabalhos em atividades permanentes no subsolo de minerações subterrâneas em frente de produção' },

    // OUTROS (OTHERS)
    { codigo: '05.01.2001', grupo: 'Outros', descricao: 'Agentes nocivos não constantes no Anexo IV do Decreto 3.048/1999 e incluídos por força de decisão judicial ou administrativa' },

    // AUSÊNCIA (ABSENT)
    { codigo: '09.01.2001', grupo: 'Ausência de Risco', descricao: 'Ausência de agente nocivo ou de atividades previstas no Anexo IV do Decreto 3.048/1999' }
];

async function seedDatabase() {
    console.log("🚀 Iniciando a população do banco de dados...");

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // ---------------------------------------------------------
        // 1. POPULAR TABELA 24 DO ESOCIAL
        // ---------------------------------------------------------
        console.log(`📋 Verificando Tabela 24 do eSocial (${tabela24Data.length} registros)...`);

        for (const item of tabela24Data) {
            const [existe] = await connection.query("SELECT id_tabela_24 FROM tabela_24_esocial WHERE codigo = ?", [item.codigo]);

            if (existe.length === 0) {
                await connection.query(
                    "INSERT INTO tabela_24_esocial (codigo, grupo, descricao) VALUES (?, ?, ?)",
                    [item.codigo, item.grupo, item.descricao]
                );
            }
        }

        // ---------------------------------------------------------
        // 2. CRIAR UNIDADE (Matriz)
        // ---------------------------------------------------------
        const [unidadesExistentes] = await connection.query("SELECT id_unidade FROM unidade WHERE cnpj = '03.783.989/0003-07'");
        let unidadeId;
        if (unidadesExistentes.length > 0) {
            unidadeId = unidadesExistentes[0].id_unidade;
        } else {
            unidadeId = uuidv4();
            await connection.query(`
                INSERT INTO unidade (id_unidade, nome_fantasia, razao_social, cnpj, cidade, estado, ativo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [unidadeId, 'Unidade JP', 'Serviço Social da Indústria', '03.783.989/0003-07', 'Ji-paraná', 'RO', true]);
        }

        // ---------------------------------------------------------
        // 3. CRIAR PERFIL (Admin)
        // ---------------------------------------------------------
        const [perfisExistentes] = await connection.query("SELECT id_perfil FROM perfil WHERE nome_perfil = 'Administrador'");
        let perfilId;
        if (perfisExistentes.length > 0) {
            perfilId = perfisExistentes[0].id_perfil;
        } else {
            perfilId = uuidv4();
            await connection.query(`
                INSERT INTO perfil (id_perfil, nome_perfil, descricao, ativo)
                VALUES (?, ?, ?, ?)
            `, [perfilId, 'Administrador', 'Acesso total ao sistema', true]);
        }

        // ---------------------------------------------------------
        // 3.1. CRIAR MÓDULOS E PERMISSÕES (ATUALIZADO)
        // ---------------------------------------------------------
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
            { nome: 'Gestão de Unidades', chave: 'unidades' },

            // --- NOVO MÓDULO ADICIONADO ABAIXO ---
            { nome: 'Levantamento de Perigos', chave: 'levantamento_perigos' }
        ];

        for (const mod of listaModulos) {
            // 1. Cria ou Busca o Módulo
            const [moduloExistente] = await connection.query("SELECT id_modulo FROM modulo_sistema WHERE chave_sistema = ?", [mod.chave]);
            let moduloId;
            if (moduloExistente.length > 0) {
                moduloId = moduloExistente[0].id_modulo;
            } else {
                moduloId = uuidv4();
                await connection.query(`INSERT INTO modulo_sistema (id_modulo, nome_modulo, chave_sistema) VALUES (?, ?, ?)`, [moduloId, mod.nome, mod.chave]);
                console.log(`+ Módulo criado: ${mod.nome}`);
            }

            // 2. Garante permissão TOTAL para o Administrador neste módulo
            const [permExistente] = await connection.query(`SELECT id_permissao FROM perfil_permissao WHERE id_perfil = ? AND id_modulo = ?`, [perfilId, moduloId]);
            if (permExistente.length === 0) {
                await connection.query(`INSERT INTO perfil_permissao (id_permissao, id_perfil, id_modulo, pode_ver, pode_criar, pode_editar, pode_inativar, tudo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [uuidv4(), perfilId, moduloId, true, true, true, true, true]);
                console.log(`+ Permissão Admin criada para: ${mod.nome}`);
            }
        }

        // ---------------------------------------------------------
        // 4. CRIAR USUÁRIO (Admin)
        // ---------------------------------------------------------
        const email = "admin@admin.com";
        const [usuarioExistente] = await connection.query("SELECT id_usuario FROM usuario WHERE email = ?", [email]);
        if (usuarioExistente.length === 0) {
            const usuarioId = uuidv4();
            const senhaHash = bcrypt.hashSync("123456", 10);
            await connection.query(`
                INSERT INTO usuario (id_usuario, id_unidade, nome_completo, email, senha_hash, id_perfil, ativo) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [usuarioId, unidadeId, 'Super Admin', email, senhaHash, perfilId, true]);
        }

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