module.exports = (sequelize, DataTypes) => {
    const Financeiro = sequelize.define('Financeiro', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      data: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tipo: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      valor: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    }, {
      tableName: 'financeiro',
    });
  
    return Financeiro;
  };