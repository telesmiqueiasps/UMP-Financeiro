const { Configuracao, SaldoFinal, Lancamento } = require('../models');
const { Op, fn, col, literal, Sequelize } = require('sequelize');
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth'); // Middleware de autenticação
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdf2image = require('pdf2image'); // Para converter PDF em imagem


// Função para obter o saldo inicial do mês
async function obterSaldoInicial(mes, ano, userId) {
    const configuracao = await Configuracao.findOne({ where: { id_usuario: userId } });
    if (!configuracao) return 0;

    const anoVigente = configuracao.ano_vigente;
    if (ano !== anoVigente) ano = anoVigente;

    if (mes === 1) {
        return configuracao.saldo_inicial || 0;
    }

    const saldoAnterior = await SaldoFinal.findOne({
        where: { mes: mes - 1, ano, id_usuario: userId },
        attributes: ['saldo']
    });

    return saldoAnterior ? saldoAnterior.saldo : 0;
}

// Função para calcular o saldo final do mês
async function calcularSaldoFinal(mes, ano, saldoInicial, userId) {
    const entradas = await Lancamento.sum('valor', {
        where: {
            tipo: { [Op.or]: ['Outras Receitas', 'ACI Recebida'] },
            [Op.and]: [
                Sequelize.where(Sequelize.fn('strftime', '%m', Sequelize.col('data')), mes.toString().padStart(2, '0')),
                Sequelize.where(Sequelize.fn('strftime', '%Y', Sequelize.col('data')), ano.toString())
            ],
            id_usuario: userId
        }
    }) || 0;

    const saidas = await Lancamento.sum('valor', {
        where: {
            tipo: { [Op.or]: ['Outras Despesas', 'ACI Enviada'] },
            [Op.and]: [
                Sequelize.where(Sequelize.fn('strftime', '%m', Sequelize.col('data')), mes.toString().padStart(2, '0')),
                Sequelize.where(Sequelize.fn('strftime', '%Y', Sequelize.col('data')), ano.toString())
            ],
            id_usuario: userId
        }
    }) || 0;

    return saldoInicial + entradas - saidas;
}

// Função para salvar o saldo final do mês
async function salvarSaldoFinal(mes, ano, saldoInicial, userId) {
    const saldoFinal = await calcularSaldoFinal(mes, ano, saldoInicial, userId);
    const [saldo, created] = await SaldoFinal.findOrCreate({
        where: { mes, ano, id_usuario: userId },
        defaults: { saldo: saldoFinal }
    });

    if (!created) {
        saldo.saldo = saldoFinal;
        await saldo.save();
    }
}

// Atualizar os saldos iniciais de todos os meses
async function atualizarSaldosIniciais(userId) {
    const configuracao = await Configuracao.findOne({ where: { id_usuario: userId } });
    const saldoInicial = configuracao ? configuracao.saldo_inicial : 0;

    for (let mes = 1; mes <= 12; mes++) {
        await SaldoFinal.findOrCreate({
            where: { mes, id_usuario: userId },
            defaults: { ano: 2025, saldo: saldoInicial }
        });
    }
}

// Recalcular os saldos finais de todos os meses existentes
async function recalcularSaldosFinais(userId) {
    const mesesAnos = await SaldoFinal.findAll({
        where: { id_usuario: userId },
        attributes: [[literal('DISTINCT mes'), 'mes'], [literal('ano'), 'ano']]
    });

    for (const { mes, ano } of mesesAnos) {
        const saldoInicial = await obterSaldoInicial(mes, ano, userId);
        await salvarSaldoFinal(mes, ano, saldoInicial, userId);
    }
}



// Rota para visualizar os lançamentos
router.get('/lancamentos', ensureAuthenticated, async (req, res) => {
    try {
        // Obtém o ano vigente da configuração do usuário logado
        const configuracao = await Configuracao.findOne({ where: { id_usuario: req.user.id } });
        const anoAtual = configuracao ? configuracao.ano_vigente : new Date().getFullYear();

        // Renderiza a página de lançamentos, passando o ano vigente como contexto
        res.render('lancamentos', { ano: anoAtual });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar os lançamentos.');
    }
});

const moment = require('moment');

router.get('/mes/:mes/:ano', ensureAuthenticated, async (req, res) => {
    const { mes, ano } = req.params;
    const userId = req.user.id;

    const meses = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    try {
        const configuracao = await Configuracao.findOne({ where: { id_usuario: userId } });
        const anoVigente = configuracao ? configuracao.ano_vigente : new Date().getFullYear();
        const anoUsado = anoVigente;

        const saldoInicial = await obterSaldoInicial(parseInt(mes), anoUsado, userId);

        const lancamentos = await Lancamento.findAll({
            where: {
                id_usuario: userId,
                [Op.and]: [
                    Sequelize.where(Sequelize.fn('strftime', '%m', Sequelize.col('data')), mes.padStart(2, '0')),
                    Sequelize.where(Sequelize.fn('strftime', '%Y', Sequelize.col('data')), anoUsado.toString())
                ]
            },
            raw: true
        });

        // ✅ **Formatar data e valor antes de enviar para o EJS**
        lancamentos.forEach(l => {
            l.data = moment(l.data).format('DD/MM/YYYY'); // Data em DD/MM/YYYY
            l.valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(l.valor); // Valor contábil
        });

        const entradas = lancamentos
            .filter(l => l.tipo === 'Outras Receitas' || l.tipo === 'ACI Recebida')
            .reduce((acc, l) => acc + parseFloat(l.valor.replace(/\D/g, '')) / 100, 0);

        const saidas = lancamentos
            .filter(l => l.tipo === 'Outras Despesas' || l.tipo === 'ACI Enviada')
            .reduce((acc, l) => acc + parseFloat(l.valor.replace(/\D/g, '')) / 100, 0);

        const saldo = saldoInicial + entradas - saidas;

        const formatarMoeda = valor => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

        await recalcularSaldosFinais(userId);

        res.render('mes', {
            mes: String(mes).padStart(2, '0'),
            ano: anoUsado,
            saldoInicial: formatarMoeda(saldoInicial),
            entradas: formatarMoeda(entradas),
            saidas: formatarMoeda(saidas),
            saldo: formatarMoeda(saldo),
            lancamentos,
            anoVigente,
            meses
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar os dados do mês.');
    }
});



// Rota para servir arquivos da pasta "uploads"
router.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename; // Obtém o nome do arquivo da URL
    const uploadsFolder = path.join(__dirname, 'uploads'); // Caminho absoluto da pasta "uploads"

    // Envia o arquivo solicitado
    res.sendFile(path.join(uploadsFolder, filename), (err) => {
        if (err) {
            // Se o arquivo não for encontrado, retorna um erro 404
            res.status(404).send('Arquivo não encontrado.');
        }
    });
});



// Configuração do multer para upload de arquivos
const upload = multer({
    dest: path.join(__dirname, '../uploads'), // Pasta de uploads
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido.'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});


router.get('/adicionar_lancamento/:mes', ensureAuthenticated, async (req, res) => {
    const { mes } = req.params;
    const userId = req.user.id;

    try {
        // Obtém o ano vigente do usuário
        const configuracao = await Configuracao.findOne({ where: { id_usuario: userId } });
        const anoAtual = configuracao ? configuracao.ano_vigente : new Date().getFullYear();

        res.render('adicionar_lancamento', { mes, anoAtual });
    } catch (error) {
        console.error(error);
        req.flash('danger', 'Erro ao carregar o formulário.');
        res.redirect(`/mes/${mes}/${new Date().getFullYear()}`);
    }
});


// Rota para processar o formulário de adicionar lançamento
router.post('/adicionar_lancamento/:mes', ensureAuthenticated, upload.single('comprovante'), async (req, res) => {
    const { mes } = req.params;
    const { data, tipo, descricao, valor } = req.body;
    const moment = require('moment');

    if (!req.user) {
        req.flash('danger', 'Erro: Usuário não autenticado.');
        return res.redirect('/login');
    }
    const userId = req.user.id;

    try {
        // Validação dos campos
        if (!data || !tipo || !descricao || !valor) {
            req.flash('danger', 'Erro: Todos os campos devem ser preenchidos.');
            return res.redirect(`/adicionar_lancamento/${mes}`);
        }

        // Conversão correta da data para DD/MM/YYYY
        const dataFormatada = moment(data, 'YYYY-MM-DD').format('DD/MM/YYYY');
        const valorFloat = parseFloat(valor);

        if (isNaN(valorFloat)) {
            req.flash('danger', 'Erro: Valor inválido.');
            return res.redirect(`/adicionar_lancamento/${mes}`);
        }

        // Obtém o ano vigente
        const configuracao = await Configuracao.findOne({ where: { id_usuario: userId } });
        const ano = configuracao ? configuracao.ano_vigente : new Date().getFullYear();

        // Processamento do comprovante (se houver)
        let comprovantePath = null;
        if (req.file) {
            const file = req.file;
            const fileExtension = path.extname(file.originalname).toLowerCase();
            const newFilename = `${uuidv4()}${fileExtension}`;
            const uploadDir = path.join(__dirname, '../uploads'); // Diretório correto
            const newFilePath = path.join(uploadDir, newFilename);

            // Move o arquivo para a pasta de uploads
            fs.renameSync(file.path, newFilePath);

            // Se for PDF, converte para imagem
            if (fileExtension === '.pdf') {
                const images = await pdf2image.convert(newFilePath, {
                    format: 'jpg',
                    outputFolder: uploadDir,
                    outputFile: newFilename.replace('.pdf', ''),
                });

                if (images.length > 0 && images[0].path) {
                    fs.unlinkSync(newFilePath); // Remove o PDF original
                    comprovantePath = path.basename(images[0].path); // Apenas o nome do arquivo
                }
            } else {
                comprovantePath = `uploads/${newFilename}`; // Apenas o nome do arquivo
            }
        }


        // Cria o lançamento no banco de dados
        const lancamento = await Lancamento.create({
            data: dataFormatada, // Agora está no formato DD/MM/YYYY
            tipo,
            descricao,
            valor: valorFloat,
            comprovante: comprovantePath,
            id_usuario: userId,
        });

        // Obtém o saldo inicial
        const saldoInicial = await obterSaldoInicial(mes, ano, userId);

        // Salva o saldo final após o lançamento
        await salvarSaldoFinal(mes, ano, saldoInicial, userId);

        // Recalcula todos os saldos finais
        await recalcularSaldosFinais(userId);


        // Redireciona para a página do mês
        res.redirect(`/mes/${moment(data, 'YYYY-MM-DD').month() + 1}/${moment(data, 'YYYY-MM-DD').year()}`);
        
    } catch (error) {
        console.error(error);
        req.flash('danger', 'Erro ao adicionar o lançamento.');
        res.redirect(`/adicionar_lancamento/${mes}`);
    }
});


// Rota para excluir um lançamento
router.post('/excluir_lancamento/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { mes, ano } = req.body;
    const userId = req.user.id;

    if (!mes || !ano) {
        req.flash('danger', 'Erro: Mês ou ano não informado.');
        return res.redirect('/mes/1/2025');
    }

    try {
        // Busca o lançamento apenas se pertencer ao usuário logado
        const lancamento = await Lancamento.findOne({
            where: { id, id_usuario: userId }
        });

        if (!lancamento) {
            req.flash('danger', 'Lançamento não encontrado ou sem permissão para excluí-lo!');
            return res.redirect(`/mes/${mes}/${ano}`);
        }

        // Verifica se o lançamento tem um comprovante e tenta excluir o arquivo
        if (lancamento.comprovante) {
            const comprovantePath = path.join(__dirname, '../', lancamento.comprovante);
            
            if (fs.existsSync(comprovantePath)) {
                fs.unlinkSync(comprovantePath);
                console.log(`Comprovante excluído: ${comprovantePath}`);
            } else {
                console.log(`Arquivo não encontrado: ${comprovantePath}`);
            }
        }

        // Remove o lançamento do banco de dados
        await Lancamento.destroy({ where: { id, id_usuario: userId } });

        // Atualiza os saldos
        const saldoInicial = await obterSaldoInicial(mes, ano, userId);
        await salvarSaldoFinal(mes, ano, saldoInicial, userId);
        await recalcularSaldosFinais(userId);

        req.flash('success', 'Lançamento excluído com sucesso!');
    } catch (error) {
        console.error(error);
        req.flash('danger', 'Erro ao excluir o lançamento.');
    }

    res.redirect(`/mes/${mes}/${ano}`);
});



// Rota para editar o lançamento
router.get('/editar_lancamento/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { mes, ano } = req.query;

    // Verifica se o mês e ano estão presentes
    if (!mes || !ano) {
        return res.redirect(`/mes/${mes}/${ano}`);  // Redireciona para a página do mês padrão
    }

    try {
        const lancamento = await Lancamento.findOne({
            where: {
                id,
                id_usuario: req.user.id, // Verifica se o lançamento pertence ao usuário logado
            }
        });

        if (!lancamento) {
            req.flash('danger', 'Lançamento não encontrado ou você não tem permissão para editá-lo!');
            return res.redirect('/lancamentos');
        }

        // Renderiza o formulário de edição do lançamento
        return res.render('editar_lancamento', {
            lancamento,
            mes,
            ano
        });

    } catch (error) {
        console.error(error);
        req.flash('danger', 'Erro ao carregar o lançamento!');
        return res.redirect('/lancamentos');
    }
});

router.post('/editar_lancamento/:id', ensureAuthenticated, upload.single('comprovante'), async (req, res) => {
    const { id } = req.params;
    const { mes, ano } = req.query;

    if (!mes || !ano) {
        req.flash('danger', 'Erro: Mês ou ano não informado.');
        return res.redirect(`/mes/${mes}/${ano}`);
    }

    try {
        const lancamento = await Lancamento.findOne({
            where: {
                id,
                id_usuario: req.user.id, // Verifica se o lançamento pertence ao usuário logado
            }
        });

        if (!lancamento) {
            req.flash('danger', 'Lançamento não encontrado ou você não tem permissão para editá-lo!');
            return res.redirect('/lancamentos');
        }

        // Atualiza os dados do lançamento
        lancamento.data = req.body.data;  // Data recebida no formato 'YYYY-MM-DD'
        lancamento.tipo = req.body.tipo;
        lancamento.descricao = req.body.descricao;
        lancamento.valor = parseFloat(req.body.valor);  // Converte valor para float

        // Verifica e salva o comprovante, se enviado
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.pdf'].includes(fileExtension)) {
                const filename = `uploads/${req.file.filename}`;
                lancamento.comprovante = filename;
            }
        }

        await lancamento.save();  // Salva as alterações no banco de dados

        // Após editar o lançamento, recalcula os saldos finais
        recalcularSaldosFinais(req.user.id);

        req.flash('success', 'Lançamento atualizado com sucesso!');
        return res.redirect(`/mes/${mes}/${ano}`);

    } catch (error) {
        console.error(error);
        req.flash('danger', 'Erro ao editar o lançamento!');
        return res.redirect(`/mes/${mes}/${ano}`);
    }
});


// Rota GET para renderizar a página de exclusão
router.get('/excluir_todos_lancamentos', ensureAuthenticated, async (req, res) => {
    res.render('excluir_lancamentos', { user: req.user });
});

// Rota POST para excluir todos os lançamentos
router.post('/excluir_todos_lancamentos', ensureAuthenticated, async (req, res) => {
    try {
        console.log('ID do usuário:', req.user.id); // Verifique se o ID está correto
    const lancamentos = await Lancamento.findAll({ where: { id_usuario: req.user.id } });

        if (lancamentos.length === 0) {
            req.flash('warning', 'Nenhum lançamento encontrado para exclusão.');
            return res.redirect('/excluir_todos_lancamentos');
        }

        // Excluir os comprovantes associados
        for (const lancamento of lancamentos) {
            if (lancamento.comprovante) {
                const comprovantePath = path.join(__dirname, '..', lancamento.comprovante);
                if (fs.existsSync(comprovantePath)) {
                    fs.unlinkSync(comprovantePath);
                    console.log(`Comprovante excluído: ${comprovantePath}`);
                } else {
                    console.log(`Arquivo não encontrado: ${comprovantePath}`);
                }
            }

            // Remover cada lançamento do banco de dados
            await lancamento.destroy();
        }

        // Obter o ano vigente do usuário
        const configuracao = await Configuracao.findOne({ where: { id_usuario: req.user.id } });
        const anoVigente = configuracao ? configuracao.ano_vigente : new Date().getFullYear();

        // Recalcular saldos finais para todos os meses do ano vigente
        for (let mes = 1; mes <= 12; mes++) {
            const saldoInicial = await obterSaldoInicial(mes, anoVigente);
            await salvarSaldoFinal(mes, anoVigente, saldoInicial);
        }

        // Recalcular novamente para garantir atualização correta
        await recalcularSaldosFinais();

        req.flash('success', 'Todos os lançamentos e comprovantes foram excluídos com sucesso!');
        res.redirect('/excluir_todos_lancamentos');
    } catch (error) {
        console.error('Erro ao excluir lançamentos:', error);
        req.flash('error', 'Erro ao excluir lançamentos. Tente novamente.');
        res.redirect('/excluir_todos_lancamentos');
    }
});


module.exports = router;