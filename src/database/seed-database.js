const db = require('./db'); // <--- CORRIGIDO AQUI (era ./database/db)
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- DADOS DA TABELA 24 (EXTRAÍDOS DIRETAMENTE DA SUA PLANILHA) ---
const tabela24Data = [
    { codigo: '01.19.019', grupo: 'Químicos', descricao: 'Beta-pbiscloromeropiolactona (beta-propiolactona)' },
    { codigo: '01.09.001', grupo: 'Químicos', descricao: 'Cloro e seus compostos tóxicos (exceto os abaixo especificados, que constam expressamente no Anexo IV do Decreto 3.048/1999)' },
    { codigo: '01.05.001', grupo: 'Químicos', descricao: 'Bromo e seus compostos tóxicos' },
    { codigo: '01.19.003', grupo: 'Químicos', descricao: '1-3-butadieno' },
    { codigo: '01.19.011', grupo: 'Químicos', descricao: '1-4-butanodiol' },
    { codigo: '01.19.004', grupo: 'Químicos', descricao: 'Mercaptanos (tióis)' },
    { codigo: '01.19.040', grupo: 'Químicos', descricao: '1-cloro-2,4-nitrodifenil' },
    { codigo: '01.14.001', grupo: 'Químicos', descricao: 'Manganês e seus compostos' },
    { codigo: '01.19.041', grupo: 'Químicos', descricao: '3-poxipro-pano' },
    { codigo: '01.09.002', grupo: 'Químicos', descricao: 'Metileno-ortocloroanilina, MOCA (4,4-metileno-bis-(2-cloroanilina), MBOCA)' },
    { codigo: '01.19.008', grupo: 'Químicos', descricao: 'Aminobifenila (4-aminodifenil)' },
    { codigo: '01.19.017', grupo: 'Químicos', descricao: '4-dimetil-aminoazobenzeno' },
    { codigo: '01.10.001', grupo: 'Químicos', descricao: 'Cromo e seus compostos tóxicos' },
    { codigo: '01.12.001', grupo: 'Químicos', descricao: 'Fósforo e seus compostos tóxicos' },
    { codigo: '01.19.002', grupo: 'Químicos', descricao: 'Acrilonitrila' },
    { codigo: '01.07.001', grupo: 'Químicos', descricao: 'Carvão mineral e seus derivados' },
    { codigo: '01.17.001', grupo: 'Químicos', descricao: 'Petróleo, xisto betuminoso, gás natural e seus derivados' },
    { codigo: '01.19.007', grupo: 'Químicos', descricao: 'Aminas aromáticas' },
    { codigo: '01.01.001', grupo: 'Químicos', descricao: 'Arsênio e seus compostos' },
    { codigo: '01.06.001', grupo: 'Químicos', descricao: 'Cádmio e seus compostos tóxicos' },
    { codigo: '01.02.001', grupo: 'Químicos', descricao: 'Asbestos (ou amianto)' },
    { codigo: '01.19.009', grupo: 'Químicos', descricao: 'Auramina' },
    { codigo: '09.01.001', grupo: 'Inespecífico', descricao: 'Ausência de agente nocivo ou de atividades previstas no Anexo IV do Decreto 3.048/1999' },
    { codigo: '01.19.010', grupo: 'Químicos', descricao: 'Azatioprina' },
    { codigo: '01.08.001', grupo: 'Químicos', descricao: 'Chumbo e seus compostos tóxicos' },
    { codigo: '01.03.001', grupo: 'Químicos', descricao: 'Benzeno e seus compostos tóxicos (exceto os abaixo especificados, que constam expressamente no Anexo IV do Decreto 3.048/1999)' },
    { codigo: '01.19.038', grupo: 'Químicos', descricao: 'Benzidina' },
    { codigo: '01.19.018', grupo: 'Químicos', descricao: 'Benzopireno' },
    { codigo: '01.04.001', grupo: 'Químicos', descricao: 'Berílio e seus compostos tóxicos' },
    { codigo: '03.01.007', grupo: 'Biológicos', descricao: 'Coleta e industrialização do lixo' },
    { codigo: '03.01.006', grupo: 'Biológicos', descricao: 'Esvaziamento de biodigestores' },
    { codigo: '03.01.004', grupo: 'Biológicos', descricao: 'Trabalho de exumação de corpos e manipulação de resíduos de animais deteriorados' },
    { codigo: '03.01.002', grupo: 'Biológicos', descricao: 'Trabalhos com animais infectados para tratamento ou para o preparo de soro, vacinas e outros produtos' },
    { codigo: '03.01.001', grupo: 'Biológicos', descricao: 'Trabalhos em estabelecimentos de saúde com contato com pacientes portadores de doenças infectocontagiosas ou com manuseio de materiais contaminados' },
    { codigo: '03.01.005', grupo: 'Biológicos', descricao: 'Trabalhos em galerias, fossas e tranques de esgoto' },
    { codigo: '03.01.003', grupo: 'Biológicos', descricao: 'Trabalhos em laboratórios de autópsia, de anatomia e anátomo-histologia' },
    { codigo: '01.09.004', grupo: 'Químicos', descricao: 'Biscloroetileter (éter dicloroetílico)' },
    { codigo: '01.19.012', grupo: 'Químicos', descricao: 'Dimetanosulfonato (MIRELAN)' },
    { codigo: '01.19.001', grupo: 'Químicos', descricao: 'Butadieno-estireno' },
    { codigo: '01.19.013', grupo: 'Químicos', descricao: 'Ciclofosfamida' },
    { codigo: '01.09.005', grupo: 'Químicos', descricao: 'Clorambucil (cloroambucil)' },
    { codigo: '01.15.001', grupo: 'Químicos', descricao: 'Mercúrio e seus compostos' },
    { codigo: '01.09.006', grupo: 'Químicos', descricao: 'Cloropreno' },
    { codigo: '01.19.036', grupo: 'Químicos', descricao: 'Creosoto' },
    { codigo: '01.19.021', grupo: 'Químicos', descricao: 'Dianizidina' },
    { codigo: '01.19.024', grupo: 'Químicos', descricao: 'Etilenoamina' },
    { codigo: '01.19.014', grupo: 'Químicos', descricao: 'Dietiletil-bestrol' },
    { codigo: '01.19.022', grupo: 'Químicos', descricao: 'Dietilsulfato' },
    { codigo: '01.19.006', grupo: 'Químicos', descricao: 'Diisocianato de tolueno (TDI)' },
    { codigo: '01.11.001', grupo: 'Químicos', descricao: 'Dissulfeto de carbono' },
    { codigo: '01.03.002', grupo: 'Químicos', descricao: 'Estireno (vinilbenzeno)' },
    { codigo: '01.09.003', grupo: 'Químicos', descricao: 'Bis (cloro metil) éter, clorometileter, (éter bis (clorometílico) ou éter metílico de clorometila), bisclorometil' },
    { codigo: '01.19.035', grupo: 'Químicos', descricao: 'Estilbenzeno' },
    { codigo: '01.19.025', grupo: 'Químicos', descricao: 'Etilenotiureia' },
    { codigo: '01.19.028', grupo: 'Químicos', descricao: 'Etilnitrosureia' },
    { codigo: '01.19.026', grupo: 'Químicos', descricao: 'Fenacetina' },
    { codigo: '01.19.027', grupo: 'Químicos', descricao: 'Iodeto de metila' },
    { codigo: '01.13.001', grupo: 'Químicos', descricao: 'Iodo' },
    { codigo: '04.01.001', grupo: 'Químicos', descricao: 'Mineração subterrânea cujas atividades sejam exercidas afastadas das frentes de produção' },
    { codigo: '01.19.005', grupo: 'Químicos', descricao: 'n-hexano' },
    { codigo: '01.16.001', grupo: 'Químicos', descricao: 'Níquel e seus compostos tóxicos' },
    { codigo: '01.19.016', grupo: 'Químicos', descricao: 'Nitronaftilamina' },
    { codigo: '01.19.029', grupo: 'Químicos', descricao: 'Nitrosamina' },
    { codigo: '01.19.030', grupo: 'Químicos', descricao: 'Ortotoluidina' },
    { codigo: '05.01.001', grupo: 'Inespecífico', descricao: 'Agentes nocivos não constantes no Anexo IV do Decreto 3.048/1999 e incluídos por força de decisão judicial ou administrativa' },
    { codigo: '01.19.034', grupo: 'Químicos', descricao: 'Óxido de etileno' },
    { codigo: '01.19.031', grupo: 'Químicos', descricao: 'Oximetalona (oxime-talona)' },
    { codigo: '02.01.015', grupo: 'Físicos', descricao: 'Pressão atmosférica anormal' },
    { codigo: '02.01.018', grupo: 'Físicos', descricao: 'Operações de mergulho com o uso de escafandros ou outros equipamentos' },
    { codigo: '02.01.016', grupo: 'Físicos', descricao: 'Trabalhos em caixões ou câmaras hiperbáricas' },
    { codigo: '02.01.017', grupo: 'Físicos', descricao: 'Trabalhos em tubulões ou túneis sob ar comprimido' },
    { codigo: '01.19.032', grupo: 'Químicos', descricao: 'Procarbazina' },
    { codigo: '01.19.033', grupo: 'Químicos', descricao: 'Propanosultona' },
    { codigo: '02.01.006', grupo: 'Físicos', descricao: 'Radiações ionizantes' },
    { codigo: '02.01.008', grupo: 'Físicos', descricao: 'Atividades em minerações com exposição ao radônio' },
    { codigo: '02.01.011', grupo: 'Físicos', descricao: 'Trabalhos realizados com exposição aos raios Alfa, Beta, Gama e X, aos nêutrons e às substâncias radioativas para fins industriais, terapêuticos e diagnósticos' },
    { codigo: '02.01.007', grupo: 'Físicos', descricao: 'Extração e beneficiamento de minerais radioativos' },
    { codigo: '02.01.012', পঞ্চাশ: 'Físicos', descricao: 'Fabricação e manipulação de produtos radioativos' },
    { codigo: '02.01.010', grupo: 'Físicos', descricao: 'Operações com reatores nucleares ou com fontes radioativas' },
    { codigo: '02.01.013', grupo: 'Físicos', descricao: 'Pesquisas e estudos com radiações ionizantes em laboratórios' },
    { codigo: '02.01.009', grupo: 'Físicos', descricao: 'Realização de manutenção e supervisão em unidades de extração, tratamento e beneficiamento de minerais radioativos com exposição às radiações ionizantes' },
    { codigo: '02.01.001', grupo: 'Físicos', descricao: 'Ruído' },
    { codigo: '01.18.001', grupo: 'Químicos', descricao: 'Sílica livre' },
    { codigo: '01.19.023', grupo: 'Químicos', descricao: 'Dimetilsulfato' },
    { codigo: '01.19.039', grupo: 'Químicos', descricao: 'Betanaftilamina' },
    { codigo: '02.01.014', grupo: 'Físicos', descricao: 'Trabalhos com exposição ao calor acima dos limites de tolerância estabelecidos na NR-15, da Portaria 3.214/1978' },
    { codigo: '04.01.002', grupo: 'Químicos', descricao: 'Trabalhos em atividades permanentes no subsolo de minerações subterrâneas em frente de produção' },
    { codigo: '02.01.005', grupo: 'Físicos', descricao: 'Trabalhos com perfuratrizes e marteletes pneumáticos' },
    { codigo: '02.01.003', grupo: 'Físicos', descricao: 'Vibração de corpo inteiro (aceleração resultante de exposição normalizada - aren)' },
    { codigo: '02.01.004', grupo: 'Físicos', descricao: 'Vibração de corpo inteiro (Valor da Dose de Vibração Resultante - VDVR)' },
    { codigo: '02.01.002', grupo: 'Físicos', descricao: 'Vibrações localizadas (mão-braço)' }
];

// --- FUNÇÃO AUXILIAR PARA LER O CSV CORRETAMENTE ---
function parseCsvLine(text) {
    const delimiter = text.includes(';') ? ';' : ',';
    let ret = [''], i = 0, s = true;
    for (let l = text.length; i < l; i++) {
        let c = text[i];
        if (c === '"') {
            s = !s;
            if (c === '"' && i < l - 1 && text[i + 1] === '"') {
                ret[ret.length - 1] += '"';
                i++;
            }
        } else if (c === delimiter && s) {
            ret.push('');
        } else {
            ret[ret.length - 1] += c;
        }
    }
    return ret.map(val => val.trim().replace(/^"|"$/g, ''));
}

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
        // 3.1. CRIAR MÓDULOS E PERMISSÕES
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
            { nome: 'Levantamento de Perigos', chave: 'levantamento_perigos' }
        ];

        for (const mod of listaModulos) {
            const [moduloExistente] = await connection.query("SELECT id_modulo FROM modulo_sistema WHERE chave_sistema = ?", [mod.chave]);
            let moduloId;
            if (moduloExistente.length > 0) {
                moduloId = moduloExistente[0].id_modulo;
            } else {
                moduloId = uuidv4();
                await connection.query(`INSERT INTO modulo_sistema (id_modulo, nome_modulo, chave_sistema) VALUES (?, ?, ?)`, [moduloId, mod.nome, mod.chave]);
                console.log(`+ Módulo criado: ${mod.nome}`);
            }

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

        // ---------------------------------------------------------
        // 5. IMPORTAR RISCOS DA PLANILHA CSV 
        // ---------------------------------------------------------
        console.log("\n🧪 Iniciando importação de Riscos do CSV...");

        const csvFilename = 'Agentes Nocivos - risco.csv';
        const csvPath = path.join(__dirname, csvFilename);

        if (fs.existsSync(csvPath)) {
            const [t24Rows] = await connection.query("SELECT id_tabela_24, codigo FROM tabela_24_esocial");
            const mapaTabela24 = new Map();
            t24Rows.forEach(row => mapaTabela24.set(row.codigo, row.id_tabela_24));

            const fileStream = fs.createReadStream(csvPath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let isFirstLine = true;
            let riscosInseridos = 0;

            for await (const line of rl) {
                if (isFirstLine) {
                    isFirstLine = false;
                    continue;
                }

                const colunas = parseCsvLine(line);

                if (colunas.length < 4) continue;

                const codigo_interno = colunas[0];
                const nome_risco = colunas[1];
                const tipo_risco = colunas[2];
                const agenteNocivoEsocial = colunas[3];

                let idTabela24 = null;

                if (agenteNocivoEsocial && agenteNocivoEsocial !== '-') {
                    const codigoEsocialLimpo = agenteNocivoEsocial.split(' - ')[0].trim();

                    if (mapaTabela24.has(codigoEsocialLimpo)) {
                        idTabela24 = mapaTabela24.get(codigoEsocialLimpo);
                    }
                }

                const [existeRisco] = await connection.query("SELECT id_risco FROM risco WHERE codigo_interno = ?", [codigo_interno]);

                if (existeRisco.length === 0) {
                    await connection.query(
                        "INSERT INTO risco (id_tabela_24, codigo_interno, nome_risco, tipo_risco) VALUES (?, ?, ?, ?)",
                        [idTabela24, codigo_interno, nome_risco, tipo_risco]
                    );
                    riscosInseridos++;
                }
            }
            console.log(`+ ${riscosInseridos} novos Riscos (Tabela Agentes Nocivos) importados e vinculados!`);
        } else {
            console.log(`⚠️ ATENÇÃO: O arquivo CSV não foi encontrado no caminho: ${csvPath}`);
            console.log("   Coloque o arquivo na mesma pasta do 'seed-database.js' para importar os riscos automaticamente.");
        }

        // ---------------------------------------------------------
        // 6. POPULAR EPCs (Equipamentos de Proteção Coletiva)
        // ---------------------------------------------------------
        console.log("\n🧰 Iniciando inserção dos EPCs...");
        const listaEPCs = [
            "Autoclave",
            "Banqueta isolante",
            "Barreiras contra fogo e respingos",
            "Barreiras de proteção contra luminosidade",
            "Cabines para Pintura",
            "Caixa de Perfurocortante",
            "Capela Química",
            "Chuveiro de emergência",
            "Cone de sinalização",
            "Corrimão de escada",
            "Cortina anti-chama",
            "Detectores de fumaça e sprinkle",
            "Enclausuramento",
            "Exaustores",
            "Exaustores para gases, névoas e vapores",
            "Filtros",
            "Fita de sinalização",
            "Grade metálica",
            "Guarda-corpos",
            "Hidrantes e mangueiras",
            "Isolamento de áreas de risco",
            "Kit de primeiros socorros",
            "Kit para limpeza em caso de derramamento",
            "Lava – olhos de emergência",
            "Manta isolante",
            "Proteção de partes móveis de máquina",
            "Proteção de partes móveis de máquinas e equipamentos",
            "Redes de proteção",
            "Sensores de máquinas",
            "Sinalização de Segurança",
            "Sinalização sonora",
            "Sistema de combate a incêndio"
        ];

        let epcsInseridos = 0;

        for (const nomeEpc of listaEPCs) {
            // Nota: Se a sua tabela utiliza 'nome' ao invés de 'nome_epc', basta alterar na linha abaixo:
            const [existeEpc] = await connection.query("SELECT id_epc FROM epc WHERE nome = ?", [nomeEpc]);

            if (existeEpc.length === 0) {
                // Inserindo como registro global (id_unidade = NULL), assim como os riscos
                await connection.query(
                    "INSERT INTO epc (nome, id_unidade) VALUES (?, ?)",
                    [nomeEpc, null]
                );
                epcsInseridos++;
            }
        }
        console.log(`+ ${epcsInseridos} novos EPCs inseridos com sucesso!`);


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