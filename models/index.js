const path = require('path');
const fs = require('fs');
const modelPath = path.join(__dirname, 'definition');

/* eslint global-require: "off" */
var Models = (function () {

  this.models = [];
  
  this.init = sequelize => {
    this.Sequelize = sequelize;
    let files = fs.readdirSync(modelPath);

    files.forEach(file => {
        let model = sequelize.import(path.join(modelPath, file));
        this[model.name] = model;
        this.models.push(model);
    })

    files.forEach(file => {
        let mPath = path.join(modelPath, file);
        let model = require(mPath);

        if (model.initRelations) model.initRelations();
        if (model.initMethods) model.initMethods();
    })
  }

  return this;

})();

module.exports = Models;