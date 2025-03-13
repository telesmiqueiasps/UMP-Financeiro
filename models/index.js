const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../instance/database.db'),
});


// Importação dos modelos
const Configuracao = require('./configuracao')(sequelize, DataTypes);
const Financeiro = require('./financeiro')(sequelize, DataTypes);
const Lancamento = require('./lancamento')(sequelize, DataTypes);
const SaldoFinal = require('./saldoFinal')(sequelize, DataTypes);
const Usuario = require('./usuario')(sequelize, DataTypes);

// Relacionamentos
Usuario.hasMany(Configuracao, { foreignKey: 'id_usuario' });
Configuracao.belongsTo(Usuario, { foreignKey: 'id_usuario' });

Usuario.hasMany(Lancamento, { foreignKey: 'id_usuario' });
Lancamento.belongsTo(Usuario, { foreignKey: 'id_usuario' });

Usuario.hasMany(SaldoFinal, { foreignKey: 'id_usuario' });
SaldoFinal.belongsTo(Usuario, { foreignKey: 'id_usuario' });

// Sincronizar o banco de dados (sem force para preservar dados existentes)
sequelize.sync().then(() => {
  console.log('Banco de dados sincronizado');
});

module.exports = {
  sequelize,
  Configuracao,
  Financeiro,
  Lancamento,
  SaldoFinal,
  Usuario,
};