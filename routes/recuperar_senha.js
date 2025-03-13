const express = require('express');
const router = express.Router();
const { Usuario, Configuracao } = require('../models');
const enviarEmailSendinblue = require('../config/email');

// Função para gerar uma senha aleatória numérica de 6 dígitos
function gerarSenhaAleatoria() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Rota GET para exibir o formulário de recuperação de senha
router.get('/recuperar_senha', (req, res) => {
    res.render('recuperar_senha', { messages: {}, email: '', layout: false });
});

// Rota POST para processar a recuperação de senha
router.post('/recuperar_senha', async (req, res) => {
    const { email } = req.body;
    console.log('Iniciando processo de recuperação de senha para:', email);

    try {
        // Verifica se o e-mail existe na tabela Configuracao
        const configuracao = await Configuracao.findOne({ where: { email } });
        if (!configuracao) {
            console.warn('E-mail não encontrado:', email);
            return res.render('recuperar_senha', {
                messages: { error: 'E-mail não encontrado.' },
                email,
                layout: false,
            });
        }

        // Gerar a nova senha
        const novaSenha = gerarSenhaAleatoria();

        // Atualizar a senha no banco de dados sem criptografia
        const usuario = await Usuario.findByPk(configuracao.id_usuario);
        if (!usuario) {
            console.warn('Usuário não encontrado para o ID:', configuracao.id_usuario);
            return res.render('recuperar_senha', {
                messages: { error: 'Usuário associado ao e-mail não encontrado.' },
                email,
                layout: false,
            });
        }
        usuario.senha = novaSenha;
        await usuario.save();
        console.log('Senha redefinida com sucesso para o usuário:', usuario.id);

        // Enviar a nova senha por e-mail
        await enviarEmailSendinblue(email, novaSenha);
        console.log('E-mail enviado com sucesso para:', email);
        return res.render('recuperar_senha', {
            messages: { success: 'E-mail enviado com sucesso!' },
            email,
            layout: false,
        });
    } catch (error) {
        console.error('Erro no processo de recuperação de senha:', error);
        return res.render('recuperar_senha', {
            messages: { error: `Erro ao enviar o e-mail: ${error.message}` },
            email,
            layout: false,
        });
    }
});

module.exports = router;