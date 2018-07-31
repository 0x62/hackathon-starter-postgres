const pagination = require('sequelize-cursor-paginate')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const _ = require('lodash')

module.exports = (sequelize, DataTypes) => {
  let User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.TEXT,
      unique: true,
      allowNull: false
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    passwordResetToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Social auth
    facebook: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    twitter: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    google: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    linkedin: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    steam: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // user profile
    profileName: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profileGender: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profileLocation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profileWebsite: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profilePicture: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    schema: 'public',
    timestamps: true
  });

  // Hash password hook
  User.hook('beforeSave', (user, options) => {
    // Only hash if updated
    if (!user.changed('password')) return;
    return new Promise((r, j) => {
      bcrypt.hash(user.password, 10, (err, hash) => {
        if (err) return j(err);
        user.password = hash;
        r();
      })
    })
  })


  User.prototype.comparePassword = function(password) {
    return new Promise((r, j) => {
      bcrypt.compare(password, this.password, (err, match) => {
        if (err) return j(err);
        return r(match);
      })
    })
  }

  User.prototype.gravatar = function(size = 200) {
    if (!this.email) {
      return `https://gravatar.com/avatar/?s=${size}&d=retro`;
    }

    const md5 = crypto.createHash('md5').update(this.email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
  }

  User.prototype.toJSON = function() {
    const privateAttributes = [
      'password',
      'passwordResetToken',
      'passwordResetExpires'
    ];
    
    return _.omit(this.get(), privateAttributes);
  }

  pagination({
    methodName: 'paginate',
    primaryKey: 'id',
  })(User);

  return User;
};

module.exports.initRelations = () => {
  delete module.exports.initRelations;

  const { User, ProviderToken } = require('../index')

  User.hasMany(ProviderToken)

};