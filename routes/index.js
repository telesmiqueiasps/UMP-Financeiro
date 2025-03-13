const express = require('express');
const router = express.Router();
const { Configuracao, Lancamento } = require('../models');
const currency = require('currency.js');
const { ensureAuthenticated } = require('../middleware/auth'); // Importa do novo arquivo

const formatCurrency = (value) => {
  return currency(value, { symbol: 'R$ ', separator: '.', decimal: ',', precision: 2 }).format();
};

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    let config = await Configuracao.findOne({ where: { id_usuario: req.user.id } });
    if (!config) {
      config = await Configuracao.create({
        id_usuario: req.user.id,
        ump_federacao: 'UMP Local',
        federacao_sinodo: 'Sinodal Exemplo',
        ano_vigente: 2025,
        saldo_inicial: 0,
        admin: req.user.id,
        socios_ativos: 0,
        socios_cooperadores: 0,
        tesoureiro_responsavel: '',
        email: `${req.user.username}@example.com`,
      });
    }

    const outrasReceitas = await Lancamento.sum('valor', {
      where: { tipo: 'Outras Receitas', id_usuario: req.user.id },
    }) || 0;
    const aciRecebida = await Lancamento.sum('valor', {
      where: { tipo: 'ACI Recebida', id_usuario: req.user.id },
    }) || 0;
    const outrasDespesas = await Lancamento.sum('valor', {
      where: { tipo: 'Outras Despesas', id_usuario: req.user.id },
    }) || 0;
    const aciEnviada = await Lancamento.sum('valor', {
      where: { tipo: 'ACI Enviada', id_usuario: req.user.id },
    }) || 0;

    const receitas = outrasReceitas + aciRecebida;
    const despesas = outrasDespesas + aciEnviada;
    const saldoFinal = (config.saldo_inicial || 0) + receitas - despesas;

    const saldoFormatado = formatCurrency(config.saldo_inicial || 0);
    const receitasFormatadas = formatCurrency(receitas);
    const despesasFormatadas = formatCurrency(despesas);
    const saldoFinalFormatado = formatCurrency(saldoFinal);
    const outrasReceitasFormatadas = formatCurrency(outrasReceitas);
    const aciRecebidaFormatada = formatCurrency(aciRecebida);
    const outrasDespesasFormatadas = formatCurrency(outrasDespesas);
    const aciEnviadaFormatada = formatCurrency(aciEnviada);

    res.render('index', {
      config,
      saldoFormatado,
      receitas: receitasFormatadas,
      despesas: despesasFormatadas,
      saldoFinalFormatado,
      outrasReceitas: outrasReceitasFormatadas,
      aciRecebida: aciRecebidaFormatada,
      outrasDespesas: outrasDespesasFormatadas,
      aciEnviada: aciEnviadaFormatada,
      ano: config.ano_vigente,
      username: req.user.username,
      messages: req.flash() // Passando mensagens flash
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno no servidor');
  }
});


router.get('/orientacoes', ensureAuthenticated, (req, res) => {
  res.render('orientacoes');
});


module.exports = router;