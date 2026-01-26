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
        // Busca usuário no banco
        const [rows] = await db.query("SELECT * FROM usuario WHERE email = ?", [email]);
        const usuario = rows[0];

        // Verifica se o usuário existe
        if (!usuario) {
            req.session.message = "Usuário não encontrado";
            return res.redirect("/login");
        }

        // Verifica a senha
        const senhaCorreta = bcrypt.compareSync(password, usuario.senha_hash);

        if (!senhaCorreta) {
            req.session.message = "Senha incorreta";
            return res.redirect("/login");
        }

        // Login com sucesso
        req.session.user = {
            id: usuario.id_usuario,      // UUID do usuário
            nome: usuario.nome_completo, // Nome completo
            email: usuario.email,
            id_unidade: usuario.id_unidade, // multi-unidade
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