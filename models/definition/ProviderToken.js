const pagination = require('sequelize-cursor-paginate')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const _ = require('lodash')

module.exports = (sequelize, DataTypes) => {
  let ProviderToken = sequelize.define('ProviderToken', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    kind: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    tokenSecret: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    schema: 'public',
    tableName: 'user',
    timestamps: true
  });

  ProviderToken.prototype.toJSON = function() {
    const privateAttributes = [
      'accessToken',
      'tokenSecret'
    ];
    
    return _.omit(this.get(), privateAttributes);
  }

  pagination({
    methodName: 'paginate',
    primaryKey: 'id',
  })(ProviderToken);

  return ProviderToken;
};

module.exports.initRelations = () => {
  delete module.exports.initRelations;

  const { User, ProviderToken } = require('../index')

  ProviderToken.belongsTo(User)

};