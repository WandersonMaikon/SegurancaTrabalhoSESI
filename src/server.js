const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Parsers (Para ler dados de formulários e JSON) ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---- Views (EJS) ----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// ---- (CSS, JS, Imagens) ----
app.use(express.static(path.join(__dirname, "../public")));

// ---- Session (Configuração da Sessão de Login) ----
const PROD = process.env.NODE_ENV === "production";
app.use(
    session({
        secret: process.env.SESSION_SECRET || "segredo_super_secreto",
        name: "sid",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: PROD, // true apenas se estiver usando HTTPS
            maxAge: 1000 * 60 * 60 * 6, // Sessão dura 6 horas
        },
    })
);

// ---- Middleware Global ----
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ============================================================
// ---- ROTAS DO SISTEMA ----
// ============================================================
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const clientesRoutes = require('./routes/clientes.routes');
const servicosRoutes = require('./routes/servicos.routes');
const osRoutes = require('./routes/os.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const atividadesRoutes = require('./routes/atividades.routes');
const perfilRoutes = require('./routes/perfil.routes');
const riscoRoutes = require('./routes/risco.routes');
const epiRoutes = require('./routes/epi.routes');
const epcRoutes = require('./routes/epc.routes');
const unidadeRoutes = require('./routes/unidade.routes');
const verificarAutenticacao = require("./middlewares/auth.middleware");

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/clientes', clientesRoutes);
app.use('/servicos', servicosRoutes);
app.use('/ordem-servico', osRoutes); 
app.use('/usuario', usuariosRoutes);
app.use('/atividades', atividadesRoutes);
app.use('/perfil', perfilRoutes);
app.use('/risco', riscoRoutes);
app.use('/epi', epiRoutes);
app.use('/epc', epcRoutes);
app.use('/unidade', unidadeRoutes);

app.get("/relatorio", verificarAutenticacao, (req, res) => {
    res.render("relatorio", { currentPage: 'relatorio' });
});

app.get("/scrum-board", verificarAutenticacao, (req, res) => {
    res.render("scrum-board", { currentPage: 'scrum-board' });
});


// ============================================================
// ---- TRATAMENTO DE ERROS (404) ----
// ============================================================

app.use((req, res) => {
    // Tenta renderizar a página 404 personalizada
    try {
        res.status(404).render("auth/auth-404");
    } catch (e) {
        res.status(404).send("Página não encontrada (404)");
    }
});

// ---- INICIALIZAÇÃO DO SERVIDOR ----
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});