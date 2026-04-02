const express = require("express");
const axios = require("axios");
const router = express.Router();

// Apontamento direto para o endereço IP do seu servidor Ubuntu
const API_DOCKER_URL = "http://10.67.127.183:5200";

// Caminho da rota ajustado para ficar idêntico ao que a interface visual pede
router.get("/epi/consulta-ca/:ca", async (req, res) => {
  const ca = req.params.ca.replace(/\D/g, "");

  try {
    const response = await axios.get(`${API_DOCKER_URL}/retornarTodasAtualizacoes/${ca}`, {
      timeout: 5000
    });

    const listaEpi = response.data;

    if (Array.isArray(listaEpi) && listaEpi.length > 0) {
      const primeiroEpi = listaEpi[0];

      const validadeBruta = primeiroEpi.DataValidade;
      const situacaoBruta = primeiroEpi.Situacao || "";
      const equipamentoNome = primeiroEpi.NomeEquipamento || "";
      const aprovadoParaLaudo = primeiroEpi.AprovadoParaLaudo || "";
      const observacaoAnaliseLaudo = primeiroEpi.ObservacaoAnaliseLaudo || "";

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
          equipamento: equipamentoNome,
          aprovadoParaLaudo: aprovadoParaLaudo,
          observacaoAnaliseLaudo: observacaoAnaliseLaudo
        });
      }
    }

    return res.status(404).json({ error: "CA não encontrado ou sem informações." });

  } catch (err) {
    console.error("Erro ao conectar com a API externa:", err.message);
    return res.status(500).json({ error: "API de consulta offline ou erro na busca." });
  }
});

module.exports = router;