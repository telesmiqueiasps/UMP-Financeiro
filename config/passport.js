const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { Usuario } = require('../models');

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const usuario = await Usuario.findOne({ where: { username } });
      if (!usuario) {
        return done(null, false, { message: 'Credenciais inválidas' });
      }
      if (usuario.senha !== password) { // Substitua por hash em produção
        return done(null, false, { message: 'Credenciais inválidas' });
      }
      return done(null, usuario);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialização do usuário (equivalente a load_user)
passport.serializeUser((usuario, done) => {
  done(null, usuario.id);
});

// Desserialização do usuário
passport.deserializeUser(async (id, done) => {
  try {
    const usuario = await Usuario.findByPk(id);
    done(null, usuario);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;