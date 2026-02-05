const express = require("express");
const router = express.Router();
const db = require("../database/db"); // Conexão com o banco
const bcrypt = require("bcryptjs");   // Verifica senha

// Tela de Login
router.get("/login", (req, res) => {
    const message = req.session.message || "";
    req.session.message = "";
    res.render("auth/auth-login", { message });
});

// Processar Login 
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Busca usuário E O NOME DO PERFIL no banco
        // (Adicionamos o JOIN e o p.nome_perfil)
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
                // CORREÇÃO AQUI: O banco retorna 'pode_inativar', não 'inativar'
                inativar: p.pode_inativar === 1 || p.tudo === 1, 
                
                // Mantemos as chaves originais também para garantir compatibilidade
                pode_ver: p.pode_ver,
                pode_criar: p.pode_criar,
                pode_editar: p.pode_editar,
                pode_inativar: p.pode_inativar,
                tudo: p.tudo
            };
        });

        // 4. Salva tudo na sessão
        req.session.user = {
            id_usuario: usuario.id_usuario,
            id: usuario.id_usuario,
            nome: usuario.nome_completo,
            email: usuario.email,
            id_unidade: usuario.id_unidade,
            id_perfil: usuario.id_perfil,
            
            // CORREÇÃO CRUCIAL: Salvando o nome do perfil para o Bypass de Admin funcionar
            nome_perfil: usuario.nome_perfil, 

            permissoes: permissoesObj
        };

        return res.redirect("/dashboard");

    } catch (error) {
        console.error("Erro no login:", error);
        req.session.message = "Erro no servidor. Tente novamente.";
        return res.redirect("/login");
    }
});

// Logout
router.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;