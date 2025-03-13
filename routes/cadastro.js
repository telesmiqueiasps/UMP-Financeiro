const express = require('express');
const router = express.Router();
const { Usuario, Configuracao, SaldoFinal } = require('../models');
const { ensureAuthenticated } = require('../middleware/auth'); // Middleware de autenticação
const { Op } = require('sequelize');
const flash = require('connect-flash');
const path = require('path');
const fs = require('fs');





router.get('/cadastro', ensureAuthenticated, (req, res) => {
    res.render('cadastro'); // Renderiza a página de cadastro
});

router.post('/cadastro', ensureAuthenticated, async (req, res) => {
    try {
        const { username, senha } = req.body;
        const id_admin = req.user.id; // ID do usuário logado

        // Criar novo usuário
        const novoUsuario = await Usuario.create({
            username,
            senha,
            is_active: 1
        });

        const id_usuario = novoUsuario.id;
        const email = `${username}@ump.com`;

        // Criar configuração inicial
        await Configuracao.create({
            id_usuario,
            admin: id_admin,
            ump_federacao: 'UMP Federação',
            federacao_sinodo: 'Nome do Sinodo',
            ano_vigente: new Date().getFullYear(),
            socios_ativos: 0,
            socios_cooperadores: 0,
            tesoureiro_responsavel: 'Nome do Tesoureiro',
            saldo_inicial: 0.0,
            email
        });

        // Criar saldo inicial para os 12 meses do ano vigente
        const anoAtual = new Date().getFullYear();
        const saldosFinais = Array.from({ length: 12 }, (_, i) => ({
            id_usuario,
            mes: i + 1,
            ano: anoAtual,
            saldo: 0.0
        }));

        await SaldoFinal.bulkCreate(saldosFinais);

        req.flash('success', 'Usuário cadastrado com sucesso!');
        res.redirect('/cadastro');

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        req.flash('error', 'Erro ao cadastrar usuário.');
        res.redirect('/cadastro');
    }
});




async function carregarAdministradores() {
    const registros = await Configuracao.findAll();
    const administradores = {};

    registros.forEach(registro => {
        if (!administradores[registro.admin]) {
            administradores[registro.admin] = [];
        }
        administradores[registro.admin].push({ id_usuario: registro.id_usuario, ump_federacao: registro.ump_federacao });
    });

    return administradores;
}

async function getUsuariosAutorizados(userId) {
    const administradores = await carregarAdministradores();
    return administradores[userId] || [];
}

router.get('/admin_consultar', ensureAuthenticated, async (req, res) => {
    const administradores = await carregarAdministradores();
    
    if (!administradores[req.user.id]) {
        req.flash('danger', 'Você não tem permissão para acessar esta página.');
        return res.redirect('/');
    }

    res.render('admin_consultar', { usuarios_autorizados: administradores[req.user.id] });
});


// Rota GET para exibir a página de busca
router.get('/admin/buscar_relatorio', ensureAuthenticated, async (req, res) => {
    const administradores = await carregarAdministradores();

    // Verificação adicional para garantir que o usuário tenha permissão
    if (!req.user || !administradores[req.user.id]) {
        req.flash('danger', 'Você não tem permissão para acessar esta página.');
        return res.redirect('/');
    }

    const usuariosAutorizadosIds = administradores[req.user.id].map(u => u.id_usuario);
    const usuariosAutorizados = await Configuracao.findAll({
        where: { id_usuario: { [Op.in]: usuariosAutorizadosIds } },
        attributes: ['id_usuario', 'ump_federacao']
    });

    const usuarios = usuariosAutorizados.map(user => ({
        id_usuario: user.id_usuario,
        ump_federacao: user.ump_federacao || 'Nome não disponível'
    }));

    const anoAtual = new Date().getFullYear(); // Ano atual
    const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i); // Lista de anos

    res.render('admin_buscar_relatorio', {
        anos, 
        relatorio_encontrado: null, 
        usuarios_autorizados: usuarios,
        usuarioSelecionado: null,
        ano_atual: anoAtual
    });
});

// Rota POST para processar a busca do relatório
router.post('/admin/buscar_relatorio', ensureAuthenticated, async (req, res) => {
    const administradores = await carregarAdministradores();

    if (!req.user || !administradores[req.user.id]) {
        req.flash('danger', 'Você não tem permissão para acessar esta página.');
        return res.redirect('/');
    }

    const usuariosAutorizadosIds = administradores[req.user.id].map(u => u.id_usuario);
    const usuariosAutorizados = await Configuracao.findAll({
        where: { id_usuario: { [Op.in]: usuariosAutorizadosIds } },
        attributes: ['id_usuario', 'ump_federacao']
    });

    const usuarios = usuariosAutorizados.map(user => ({
        id_usuario: user.id_usuario,
        ump_federacao: user.ump_federacao || 'Nome não disponível'
    }));

    const { ano, usuario_id } = req.body;

    if (!ano || !usuario_id) {
        req.flash('danger', 'Por favor, selecione um ano e um usuário.');
        return res.redirect('/admin/buscar_relatorio');
    }

    if (!usuariosAutorizadosIds.includes(Number(usuario_id))) {
        req.flash('danger', 'Você não tem permissão para acessar relatórios deste usuário.');
        return res.redirect('/admin/buscar_relatorio');
    }

    const relatorioNome = `relatorio_${ano}_id_usuario_${usuario_id}.pdf`;
    const relatorioPath = path.join(__dirname, '../relatorios', relatorioNome);

    let relatorio_encontrado = null;

    if (fs.existsSync(relatorioPath)) {
        relatorio_encontrado = relatorioNome;
    } else {
        req.flash('warning', `Relatório para o ano ${ano} do usuário ${usuario_id} não encontrado.`);
    }

    // Evitar redundância na lista de anos
    const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    res.render('admin_buscar_relatorio', {
        anos,
        relatorio_encontrado,
        usuarios_autorizados: usuarios,
        usuarioSelecionado: usuario_id,
        ano_atual: new Date().getFullYear()
    });
});



router.get('/admin/visualizar_relatorio/:filename', ensureAuthenticated, async (req, res) => {
    const { filename } = req.params;
    const usuariosAutorizados = await getUsuariosAutorizados(req.user.id);
    
    if (!usuariosAutorizados.length) {
        req.flash('danger', 'Acesso negado.');
        return res.redirect('/consultar');
    }

    const relatoriosDir = path.join(__dirname, '../relatorios');
    const relatorioPath = path.join(relatoriosDir, filename);

    try {
        // Verificando se o filename segue o padrão esperado
        const parts = filename.split('_id_usuario_');
        if (parts.length < 2) {
            req.flash('danger', 'Nome de arquivo inválido.');
            return res.redirect('/admin_consultar');
        }

        const usuarioId = parseInt(parts[1].split('.')[0], 10);
        if (isNaN(usuarioId)) {
            req.flash('danger', 'ID de usuário inválido no nome do arquivo.');
            return res.redirect('/admin_consultar');
        }

        // Verificando se o usuário tem permissão para visualizar o relatório
        if (!usuariosAutorizados.some(u => u.id_usuario === usuarioId)) {
            req.flash('danger', 'Você não tem permissão para visualizar este relatório.');
            return res.redirect('/admin_consultar');
        }
    } catch (error) {
        req.flash('danger', 'Erro ao processar o nome do arquivo.');
        return res.redirect('/admin_consultar');
    }

    // Verificando a existência do relatório
    if (fs.existsSync(relatorioPath)) {
        res.sendFile(relatorioPath);
    } else {
        req.flash('danger', 'Relatório não encontrado.');
        res.redirect('/admin_consultar');
    }
});



// Rota GET para exibir a página de busca
router.get('/admin/buscar_comprovantes', ensureAuthenticated, async (req, res) => {
    const administradores = await carregarAdministradores();

    // Verificação adicional para garantir que o usuário tenha permissão
    if (!req.user || !administradores[req.user.id]) {
        req.flash('danger', 'Você não tem permissão para acessar esta página.');
        return res.redirect('/');
    }

    const usuariosAutorizadosIds = administradores[req.user.id].map(u => u.id_usuario);
    const usuariosAutorizados = await Configuracao.findAll({
        where: { id_usuario: { [Op.in]: usuariosAutorizadosIds } },
        attributes: ['id_usuario', 'ump_federacao']
    });

    const usuarios = usuariosAutorizados.map(user => ({
        id_usuario: user.id_usuario,
        ump_federacao: user.ump_federacao || 'Nome não disponível'
    }));

    const anoAtual = new Date().getFullYear(); // Ano atual
    const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i); // Lista de anos

    res.render('admin_buscar_comprovantes', {
        anos, 
        relatorio_encontrado: null, 
        usuarios_autorizados: usuarios,
        usuarioSelecionado: null,
        ano_atual: anoAtual
    });
});

// Rota POST para processar a busca do relatório
router.post('/admin/buscar_comprovantes', ensureAuthenticated, async (req, res) => {
    const administradores = await carregarAdministradores();

    if (!req.user || !administradores[req.user.id]) {
        req.flash('danger', 'Você não tem permissão para acessar esta página.');
        return res.redirect('/');
    }

    const usuariosAutorizadosIds = administradores[req.user.id].map(u => u.id_usuario);
    const usuariosAutorizados = await Configuracao.findAll({
        where: { id_usuario: { [Op.in]: usuariosAutorizadosIds } },
        attributes: ['id_usuario', 'ump_federacao']
    });

    const usuarios = usuariosAutorizados.map(user => ({
        id_usuario: user.id_usuario,
        ump_federacao: user.ump_federacao || 'Nome não disponível'
    }));

    const { ano, usuario_id } = req.body;

    if (!ano || !usuario_id) {
        req.flash('danger', 'Por favor, selecione um ano e um usuário.');
        return res.redirect('/admin/buscar_comprovantes');
    }

    if (!usuariosAutorizadosIds.includes(Number(usuario_id))) {
        req.flash('danger', 'Você não tem permissão para acessar relatórios deste usuário.');
        return res.redirect('/admin/buscar_comprovantes');
    }

    const relatorioNome = `comprovantes_${ano}_id_usuario_${usuario_id}.pdf`;
    const relatorioPath = path.join(__dirname, '../relatorios', relatorioNome);

    let relatorio_encontrado = null;

    if (fs.existsSync(relatorioPath)) {
        relatorio_encontrado = relatorioNome;
    } else {
        req.flash('warning', `Comprovantes para o ano ${ano} do usuário ${usuario_id} não encontrado.`);
    }

    // Evitar redundância na lista de anos
    const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    res.render('admin_buscar_comprovantes', {
        anos,
        relatorio_encontrado,
        usuarios_autorizados: usuarios,
        usuarioSelecionado: usuario_id,
        ano_atual: new Date().getFullYear()
    });
});



router.get('/admin/visualizar_comprovantes/:filename', ensureAuthenticated, async (req, res) => {
    const { filename } = req.params;
    const usuariosAutorizados = await getUsuariosAutorizados(req.user.id);
    
    if (!usuariosAutorizados.length) {
        req.flash('danger', 'Acesso negado.');
        return res.redirect('/consultar');
    }

    const relatoriosDir = path.join(__dirname, '../relatorios');
    const relatorioPath = path.join(relatoriosDir, filename);

    try {
        // Verificando se o filename segue o padrão esperado
        const parts = filename.split('_id_usuario_');
        if (parts.length < 2) {
            req.flash('danger', 'Nome de arquivo inválido.');
            return res.redirect('/admin_consultar');
        }

        const usuarioId = parseInt(parts[1].split('.')[0], 10);
        if (isNaN(usuarioId)) {
            req.flash('danger', 'ID de usuário inválido no nome do arquivo.');
            return res.redirect('/admin_consultar');
        }

        // Verificando se o usuário tem permissão para visualizar o relatório
        if (!usuariosAutorizados.some(u => u.id_usuario === usuarioId)) {
            req.flash('danger', 'Você não tem permissão para visualizar este relatório.');
            return res.redirect('/admin_consultar');
        }
    } catch (error) {
        req.flash('danger', 'Erro ao processar o nome do arquivo.');
        return res.redirect('/admin_consultar');
    }

    // Verificando a existência do relatório
    if (fs.existsSync(relatorioPath)) {
        res.sendFile(relatorioPath);
    } else {
        req.flash('danger', 'Relatório não encontrado.');
        res.redirect('/admin_consultar');
    }
});

module.exports = router;