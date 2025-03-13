const ensureAuthenticated = (req, res, next) => {
  console.log('Verificando autenticação:', req.user); // Verifique o valor de req.user
  if (req.isAuthenticated() && req.user && req.user.id) {
      return next();
  }
  console.log('Usuário não autenticado ou ID não encontrado. Redirecionando para /login');
  res.redirect('/login');
};

module.exports = { ensureAuthenticated };