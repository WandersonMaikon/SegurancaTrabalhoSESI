const express = require("express");
const router = express.Router();
const db = require("../database/db"); // Sua conexão com o banco
const bcrypt = require("bcryptjs");   // Para verificar senha

// Tela de Login
router.get("/login", (req, res) => {
    const message = req.session.message || "";
    req.session.message = "";
    res.render("auth/auth-login", { message });
});

// Processar Login (POST)
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Busca usuário no banco
        // ATENÇÃO: O nome da tabela é 'usuario' (singular) no seu script SQL
        const [rows] = await db.query("SELECT * FROM usuario WHERE email = ?", [email]);
        const usuario = rows[0];

        // Debug: Se quiser ver o que veio do banco, descomente a linha abaixo
        // console.log("Usuário encontrado:", usuario);

        // 2. Verifica se o usuário existe
        if (!usuario) {
            req.session.message = "Usuário não encontrado";
            return res.redirect("/login");
        }

        // 3. Verifica a senha
        // CORREÇÃO AQUI: No seu banco a coluna é 'senha_hash', não 'senha'
        const senhaCorreta = bcrypt.compareSync(password, usuario.senha_hash);

        if (!senhaCorreta) {
            req.session.message = "Senha incorreta";
            return res.redirect("/login");
        }

        // 4. Login com sucesso
        req.session.user = {
            id: usuario.id_usuario,      // UUID do usuário
            nome: usuario.nome_completo, // Nome completo
            email: usuario.email,
            id_unidade: usuario.id_unidade, // Importante para o sistema multi-unidade
            id_perfil: usuario.id_perfil    // Importante para permissões
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