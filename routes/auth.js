const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { ensureAuthenticated } = require('../middleware/auth');
const { Usuario } = require('../models'); // Deve importar corretamente agora

// Rota de login (GET e POST)
router.route('/login')
  .get((req, res) => {
    res.render('login', { layout: false });
  })
  .post(passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: 'Credenciais inválidas'
  }));

// Rota de logout
router.get('/logout', ensureAuthenticated, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// Rota de alteração de senha (GET e POST)
router.route('/alterar_senha')
  .get(ensureAuthenticated, (req, res) => {
    res.render('alterar_senha');
  })
  .post(ensureAuthenticated, async (req, res) => {
    const { senha_atual, nova_senha, confirmar_senha } = req.body;

    try {
      const usuario = await Usuario.findByPk(req.user.id); // Linha 33

      if (usuario.senha !== senha_atual) {
        req.flash('danger', 'Senha atual incorreta!');
        return res.redirect('/alterar_senha');
      }

      if (nova_senha !== confirmar_senha) {
        req.flash('danger', 'As novas senhas não coincidem!');
        return res.redirect('/alterar_senha');
      }

      if (nova_senha.length > 256) {
        req.flash('danger', 'A nova senha deve ter no máximo 256 caracteres!');
        return res.redirect('/alterar_senha');
      }

      usuario.senha = nova_senha;
      await usuario.save();

      req.flash('success', 'Senha alterada com sucesso!');
      return res.redirect('/alterar_senha');
    } catch (err) {
      console.error(err);
      req.flash('danger', 'Erro ao alterar a senha!');
      return res.redirect('/alterar_senha');
    }
  });

module.exports = router;