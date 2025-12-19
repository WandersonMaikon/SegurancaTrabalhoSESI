// server.js
const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Parsers (forms + json) ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---- Views (EJS) ----
// Como você quer algo simples: vamos usar UMA pasta de views.
// Coloque o login em: ./views/login.ejs
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---- Static files ----
// Tudo que estiver em /public vira acessível via: /css, /js, /vendor, /images, etc.
app.use(express.static(path.join(__dirname, "public")));

// ---- Session ----
const PROD = process.env.NODE_ENV === "production";
app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev_secret_change_me",
        name: "sid",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: PROD, // true somente se HTTPS estiver terminando no Node
            maxAge: 1000 * 60 * 60 * 6, // 6h
        },
    })
);

// ---- Locals (opcional) ----
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ---- Routes ----
// Simples, do jeito que você descreveu: 1 arquivo auth.js com rotas /admin/...
const authRoutes = require("./routes/auth");
app.use(authRoutes);

// ---- Home (opcional) ----
// Se quiser, você pode mandar / cair no login direto:
app.get("/", (req, res) => {
    return res.redirect("/login");
});

// ---- 404 ----
app.use((req, res) => {
    // se você tiver views/404.ejs, renderiza. se não, manda texto.
    try {
        return res.status(404).render("404", { url: req.url });
    } catch (e) {
        return res.status(404).send("404 - Not Found");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});