const express = require("express");
const router = express.Router();
const db = require("../database/db");
const bcrypt = require("bcryptjs");

// Importando o middleware para proteger as rotas de primeiro acesso
const verificarAutenticacao = require("../middlewares/auth.middleware");

// =========================================================================
// ROTA RAIZ 
// =========================================================================
router.get("/", (req, res) => {
    // Verifica se existe um usuário logado na sessão
    if (req.session && req.session.user) {
        // Se estiver logado, manda para a rota inicial dele ou para o /inicio
        return res.redirect(req.session.user.rota_inicial || '/inicio');
    }

    // Se não estiver logado, manda direto para a tela de login
    res.redirect("/login");
});

// =========================================================================
// TELA DE LOGIN
// =========================================================================
router.get("/login", (req, res) => {
    const message = req.session.message || "";
    req.session.message = "";
    res.render("auth/auth-login", { message });
});

// =========================================================================
// PROCESSAR LOGIN
// =========================================================================
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Busca usuário E O NOME DO PERFIL no banco
        const [rows] = await db.query(`
            SELECT u.*, p.nome_perfil 
            FROM usuario u 
            LEFT JOIN perfil p ON u.id_perfil = p.id_perfil 
            WHERE u.email = ?
        `, [email]);

        const usuario = rows[0];

        // Verifica se o usuário existe
        if (!usuario) {
            req.session.message = "Usuário não encontrado";
            return res.redirect("/login");
        }

        // Verifica se o usuário está ativo
        if (usuario.ativo === 0) {
            req.session.message = "Usuário inativo. Contate o administrador.";
            return res.redirect("/login");
        }

        // 2. Verifica a senha
        const senhaCorreta = bcrypt.compareSync(password, usuario.senha_hash);

        if (!senhaCorreta) {
            req.session.message = "Senha incorreta";
            return res.redirect("/login");
        }

        // 3. BUSCAR PERMISSÕES DO PERFIL
        const [perms] = await db.query(`
            SELECT m.chave_sistema, pp.pode_ver, pp.pode_criar, pp.pode_editar, pp.pode_inativar, pp.tudo
            FROM perfil_permissao pp
            JOIN modulo_sistema m ON pp.id_modulo = m.id_modulo
            WHERE pp.id_perfil = ?
        `, [usuario.id_perfil]);

        // Transforma o array do banco em um Objeto fácil
        const permissoesObj = {};

        perms.forEach(p => {
            permissoesObj[p.chave_sistema] = {
                ver: p.pode_ver === 1 || p.tudo === 1,
                criar: p.pode_criar === 1 || p.tudo === 1,
                editar: p.pode_editar === 1 || p.tudo === 1,
                inativar: p.pode_inativar === 1 || p.tudo === 1,

                pode_ver: p.pode_ver,
                pode_criar: p.pode_criar,
                pode_editar: p.pode_editar,
                pode_inativar: p.pode_inativar,
                tudo: p.tudo
            };
        });

        // ==========================================================
        // LÓGICA DE ROTA INICIAL BASEADA EM PERMISSÃO
        // ==========================================================
        let rotaInicial = "/dashboard"; // Padrão para Admins ou se nada for achado

        // Verifica se NÃO é o admin master
        if (usuario.email !== 'admin@admin.com' && usuario.nome_perfil !== 'Administrador' && usuario.nome_perfil !== 'Super Admin') {

            // Ordem de prioridade para a tela inicial reduzida apenas ao Dashboard
            const rotasPrioridade = [
                { chave: 'dashboard', url: '/dashboard' }
            ];

            let rotaEncontrada = null;

            for (let rota of rotasPrioridade) {
                if (permissoesObj[rota.chave] && permissoesObj[rota.chave].ver) {
                    rotaEncontrada = rota.url;
                    break;
                }
            }

            rotaInicial = rotaEncontrada || '/inicio';
        }

        // Conversão à prova de balas para pegar o valor do banco (seja 1, "1", ou true)
        const isPrimeiroAcesso = Number(usuario.primeiro_acesso) === 1 || usuario.primeiro_acesso === true;

        // 4. Salva tudo na sessão
        req.session.user = {
            id_usuario: usuario.id_usuario,
            id: usuario.id_usuario,
            nome_completo: usuario.nome_completo,
            nome: usuario.nome_completo,
            email: usuario.email,
            id_unidade: usuario.id_unidade,
            id_perfil: usuario.id_perfil,
            nome_perfil: usuario.nome_perfil,
            permissoes: permissoesObj,

            // Flag de Segurança salva corretamente
            primeiro_acesso: isPrimeiroAcesso,
            rota_inicial: rotaInicial
        };

        // ==========================================================
        // REDIRECIONAMENTO SEGURO
        // ==========================================================
        // Se for primeiro acesso, joga ele DIRETO para a tela de configuração!
        if (isPrimeiroAcesso) {
            return res.redirect('/primeiro-acesso');
        }

        // Se não for o primeiro acesso, segue a vida normal.
        return res.redirect(rotaInicial);

    } catch (error) {
        console.error("Erro no login:", error);
        req.session.message = "Erro no servidor. Tente novamente.";
        return res.redirect("/login");
    }
});

// =========================================================================
// ROTAS DE PRIMEIRO ACESSO (CONFIGURAÇÃO DE CONTA)
// =========================================================================

// GET: Renderiza a tela
router.get("/primeiro-acesso", verificarAutenticacao, (req, res) => {
    const user = req.session.user;

    // Se não for o primeiro acesso, manda pra rota ideal dele
    if (!user.primeiro_acesso) {
        return res.redirect(user.rota_inicial || '/dashboard');
    }

    res.render("auth/primeiro-acesso", {
        layout: false,
        user: user
    });
});

// =========================================================================
// RECUPERAÇÃO DE SENHA (ETAPA 1: VALIDAÇÃO)
// =========================================================================

router.get("/esqueci-senha", (req, res) => {
    const message = req.session.message || "";
    req.session.message = "";
    res.render("auth/esqueci-senha", { layout: false, message });
});

router.post("/esqueci-senha", async (req, res) => {
    const { email, cpf, data_nascimento } = req.body;

    try {
        if (!email || !cpf || !data_nascimento) {
            req.session.message = "Preencha todos os campos obrigatórios.";
            return res.redirect("/esqueci-senha");
        }

        const [rows] = await db.query(
            "SELECT id_usuario, cpf, data_nascimento, ativo FROM usuario WHERE email = ?",
            [email]
        );

        const usuario = rows[0];

        if (!usuario || usuario.ativo === 0 || !usuario.cpf || !usuario.data_nascimento) {
            req.session.message = "Os dados informados não correspondem ou a conta está inativa/sem configuração.";
            return res.redirect("/esqueci-senha");
        }

        const dataBancoFormatada = new Date(usuario.data_nascimento).toISOString().split('T')[0];

        if (usuario.cpf !== cpf || dataBancoFormatada !== data_nascimento) {
            req.session.message = "Os dados informados não correspondem aos nossos registros.";
            return res.redirect("/esqueci-senha");
        }

        // MÁGICA AQUI: Se tudo estiver certo, criamos um "token" temporário na sessão
        // indicando qual usuário tem permissão para trocar a senha neste exato momento
        req.session.reset_id_usuario = usuario.id_usuario;

        // E mandamos ele para a tela da Etapa 2!
        return res.redirect("/resetar-senha");

    } catch (error) {
        console.error("Erro na validação de dados:", error);
        req.session.message = "Ocorreu um erro interno. Tente novamente mais tarde.";
        return res.redirect("/esqueci-senha");
    }
});

// =========================================================================
// RECUPERAÇÃO DE SENHA (ETAPA 2: NOVA SENHA)
// =========================================================================

router.get("/resetar-senha", (req, res) => {
    // PROTEÇÃO: Se não tiver o token na sessão (ou seja, não passou pela etapa 1), chuta de volta
    if (!req.session.reset_id_usuario) {
        return res.redirect("/esqueci-senha");
    }

    const message = req.session.message || "";
    req.session.message = "";
    res.render("auth/resetar-senha", { layout: false, message });
});

router.post("/resetar-senha", async (req, res) => {
    const { nova_senha, confirma_senha } = req.body;
    const idUsuario = req.session.reset_id_usuario;

    // Se a sessão expirou ou ele tentou burlar
    if (!idUsuario) {
        return res.redirect("/esqueci-senha");
    }

    try {
        if (!nova_senha || nova_senha !== confirma_senha) {
            req.session.message = "As senhas não conferem ou estão em branco.";
            return res.redirect("/resetar-senha");
        }

        // Atualizamos a senha no banco
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(nova_senha, salt);

        await db.query(
            "UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?",
            [senhaHash, idUsuario]
        );

        // Limpamos o token da sessão para não deixar a porta aberta
        delete req.session.reset_id_usuario;

        req.session.message = "✅ Senha redefinida com sucesso! Você já pode fazer login.";
        return res.redirect("/login");

    } catch (error) {
        console.error("Erro ao resetar senha:", error);
        req.session.message = "Erro ao salvar nova senha.";
        return res.redirect("/resetar-senha");
    }
});

// POST: Salvar a nova senha e os dados
router.post("/primeiro-acesso", verificarAutenticacao, async (req, res) => {
    try {
        const { cpf, telefone, data_nascimento, nova_senha } = req.body;
        const idUsuario = req.session.user.id_usuario;

        if (!cpf || !telefone || !data_nascimento || !nova_senha) {
            return res.status(400).json({ success: false, message: "Preencha todos os campos." });
        }

        if (nova_senha === 'mudar123') {
            return res.status(400).json({ success: false, message: "Você precisa escolher uma senha diferente da padrão." });
        }

        // Gera o hash da nova senha usando bcryptjs
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(nova_senha, salt);

        // Atualiza no banco
        await db.query(`
            UPDATE usuario 
            SET cpf = ?, telefone = ?, data_nascimento = ?, senha_hash = ?, primeiro_acesso = FALSE 
            WHERE id_usuario = ?
        `, [cpf, telefone, data_nascimento, senhaHash, idUsuario]);

        // Atualiza a sessão atual para liberar o acesso
        req.session.user.primeiro_acesso = false;
        req.session.user.cpf = cpf;
        req.session.user.telefone = telefone;
        req.session.user.data_nascimento = data_nascimento;

        // Puxa a rota ideal que calculamos no login
        const urlDestino = req.session.user.rota_inicial || '/inicio';

        res.json({
            success: true,
            message: "Conta configurada com sucesso!",
            redirectUrl: urlDestino
        });

    } catch (error) {
        console.error("Erro no primeiro acesso:", error);
        res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

// =========================================================================
// LOGOUT
// =========================================================================
router.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;