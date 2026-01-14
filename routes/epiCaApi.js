const express = require("express");
const axios = require("axios");
const router = express.Router();

// URL correta da sua API Docker
const API_DOCKER_URL = "http://localhost:5200";

router.get("/api/epi/ca/:ca", async (req, res) => {
  const ca = req.params.ca.replace(/\D/g, "");

  try {
    // Chamada para a API Docker
    const response = await axios.get(`${API_DOCKER_URL}/retornarTodasAtualizacoes/${ca}`, {
      timeout: 5000
    });

    const listaEpi = response.data;

    if (Array.isArray(listaEpi) && listaEpi.length > 0) {
      const primeiroEpi = listaEpi[0];

      // 1. Pegamos a data e a situação bruta
      const validadeBruta = primeiroEpi.DataValidade;
      let situacaoBruta = primeiroEpi.Situacao || "";

      // 2. Tratamento por extenso da Situação
      // Aqui garantimos que se vier "V", vira "Válido", se vier "A", "Ativo", etc.
      let situacaoFormatada = "Situação Indisponível";

      if (situacaoBruta.toLowerCase().includes("val")) {
        situacaoFormatada = "Válido";
      } else if (situacaoBruta.toLowerCase().includes("venc")) {
        situacaoFormatada = "Vencido";
      } else {
        situacaoFormatada = situacaoBruta; // Mantém o que veio se não identificar
      }

      if (validadeBruta) {
        return res.json({
          validade: validadeBruta,
          situacao: situacaoFormatada
        });
      }
    }

    return res.status(404).json({ error: "CA não encontrado ou sem informações." });

  } catch (err) {
    console.error("Erro ao conectar com a API Docker:", err.message);
    return res.status(500).json({ error: "API do Docker offline ou erro na busca." });
  }
});

module.exports = router;