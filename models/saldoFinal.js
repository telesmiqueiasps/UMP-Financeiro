module.exports = (sequelize, DataTypes) => {
    const SaldoFinal = sequelize.define('SaldoFinal', {
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
      mes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ano: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      saldo: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    }, {
      tableName: 'saldo_final',
    });
  
    return SaldoFinal;
  };