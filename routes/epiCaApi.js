const express = require("express");
const axios = require("axios");
const router = express.Router();

// URL correta da sua API Docker
const API_DOCKER_URL = "http://localhost:5200";

router.get("/api/epi/ca/:ca", async (req, res) => {
  const ca = req.params.ca.replace(/\D/g, "");

  try {
    // Chamada usando a rota que você testou e funcionou
    const response = await axios.get(`${API_DOCKER_URL}/retornarTodasAtualizacoes/${ca}`, {
      timeout: 5000
    });

    const listaEpi = response.data;

    // Como a API retorna uma lista [ {...}, {...} ], pegamos o primeiro item
    if (Array.isArray(listaEpi) && listaEpi.length > 0) {
      const primeiroEpi = listaEpi[0];

      // Pegamos o campo exato: DataValidade
      const validadeEncontrada = primeiroEpi.DataValidade;

      if (validadeEncontrada) {
        return res.json({ validade: validadeEncontrada });
      }
    }

    return res.status(404).json({ error: "CA não encontrado ou sem data de validade." });

  } catch (err) {
    console.error("Erro ao conectar com a API Docker:", err.message);
    return res.status(500).json({ error: "API do Docker offline ou erro na busca." });
  }
});

module.exports = router;