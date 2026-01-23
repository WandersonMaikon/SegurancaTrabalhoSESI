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
        const [rows] = await db.query("SELECT * FROM usuarios WHERE email = ?", [email]);
        const usuario = rows[0];

        // 2. Verifica se existe e se a senha bate
        // OBS: Se suas senhas no banco NÃO são criptografadas (texto puro), use: 
        // if (!usuario || usuario.senha !== password) {
        if (!usuario || !bcrypt.compareSync(password, usuario.senha)) {
            req.session.message = "Usuário ou senha inválidos";
            return res.redirect("/login");
        }

        // 3. Login com sucesso
        req.session.user = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
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