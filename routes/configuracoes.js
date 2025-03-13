const express = require('express');
const router = express.Router();
const { Configuracao, SaldoFinal } = require('../models'); // Importa os modelos do banco
const { ensureAuthenticated } = require('../middleware/auth'); // Middleware de autenticação
const { Op } = require('sequelize');

// Função para verificar se o e-mail já está cadastrado
async function verificarEmailExistente(email, idUsuario) {
    const configExistente = await Configuracao.findOne({ where: { email } });
    return configExistente && configExistente.id_usuario !== idUsuario;
}

router.get('/configuracoes', ensureAuthenticated, async (req, res) => {
    try {
        const config = await Configuracao.findOne({ where: { id_usuario: req.user.id } });
        const saldoFormatado = config ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(config.saldo_inicial) : 'R$ 0,00';
        res.render('configuracoes', { config, saldoFormatado });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar configurações');
    }
});

router.post('/configuracoes', ensureAuthenticated, async (req, res) => {
    try {
        let config = await Configuracao.findOne({ where: { id_usuario: req.user.id } });

        if (await verificarEmailExistente(req.body.email, req.user.id)) {
            req.flash('danger', 'Este e-mail já está cadastrado.');
            return res.redirect('/configuracoes');
        }

        if (!config) {
            config = await Configuracao.create({ id_usuario: req.user.id });
        }

        const saldoInicial = parseFloat(req.body.saldo_inicial.replace('.', '').replace(',', '.')) || 0.0;

        await config.update({
            ump_federacao: req.body.ump_federacao,
            federacao_sinodo: req.body.federacao_sinodo,
            ano_vigente: parseInt(req.body.ano_vigente, 10),
            socios_ativos: req.body.socios_ativos,
            socios_cooperadores: req.body.socios_cooperadores,
            tesoureiro_responsavel: req.body.tesoureiro_responsavel,
            email: req.body.email,
            saldo_inicial: saldoInicial,
        });

        await SaldoFinal.update({ ano: config.ano_vigente }, { where: { id_usuario: req.user.id } });

        // Chamar a função de recálculo de saldos finais
        await recalcularSaldosFinais();

        req.flash('success', 'Configurações salvas com sucesso!');
        res.redirect('/configuracoes');
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao salvar configurações');
    }
});

async function recalcularSaldosFinais() {
    // Implementar a lógica de recálculo aqui
    console.log('Recalculando saldos finais...');
}

module.exports = router;
