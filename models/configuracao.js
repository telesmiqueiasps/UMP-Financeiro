module.exports = (sequelize, DataTypes) => {
  const Configuracao = sequelize.define('Configuracao', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Usuario', key: 'id' },
    },
    admin: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ump_federacao: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    federacao_sinodo: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ano_vigente: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    socios_ativos: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    socios_cooperadores: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tesoureiro_responsavel: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    saldo_inicial: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: 'configuracao',
  });

  return Configuracao;
};