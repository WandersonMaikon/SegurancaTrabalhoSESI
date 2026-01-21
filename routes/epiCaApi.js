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

      // 1. Pegamos os dados brutos
      const validadeBruta = primeiroEpi.DataValidade;
      const situacaoBruta = primeiroEpi.Situacao || "";

      // CORREÇÃO AQUI: O nome do campo na API é "NomeEquipamento"
      const equipamentoNome = primeiroEpi.NomeEquipamento || "";

      const aprovadoParaLaudo = primeiroEpi.AprovadoParaLaudo || "";
      const observacaoAnaliseLaudo = primeiroEpi.ObservacaoAnaliseLaudo || "";

      // 2. Tratamento por extenso da Situação
      let situacaoFormatada = "Situação Indisponível";

      if (situacaoBruta.toLowerCase().includes("val")) {
        situacaoFormatada = "Válido";
      } else if (situacaoBruta.toLowerCase().includes("venc")) {
        situacaoFormatada = "Vencido";
      } else {
        situacaoFormatada = situacaoBruta;
      }

      if (validadeBruta) {
        return res.json({
          validade: validadeBruta,
          situacao: situacaoFormatada,
          equipamento: equipamentoNome, // Agora enviará o nome correto
          aprovadoParaLaudo: aprovadoParaLaudo,
          observacaoAnaliseLaudo: observacaoAnaliseLaudo
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