module.exports = (sequelize, DataTypes) => {
    const Lancamento = sequelize.define('Lancamento', {
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
      data: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      tipo: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      descricao: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      valor: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      comprovante: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
    }, {
      tableName: 'lancamento',
    });
  
    return Lancamento;
  };