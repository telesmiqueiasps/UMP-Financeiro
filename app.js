const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const path = require('path');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const configuracoesRoutes = require('./routes/configuracoes');
const lancamentosRoutes = require('./routes/lancamentos');
const recuperar_senhaRoutes = require('./routes/recuperar_senha');
const cadastroRoutes = require('./routes/cadastro');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts); // Adiciona suporte a layouts
app.set('layout', 'base'); // Define base.ejs como layout padrão
app.use(session({
  secret: 'chave_secreta_ump_financeiro',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/', configuracoesRoutes);
app.use('/', lancamentosRoutes);
app.use('/', recuperar_senhaRoutes);
app.use('/', cadastroRoutes);


sequelize.sync().then(() => {
  app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
});

