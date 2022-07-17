const { Transformer } = require('@parcel/plugin');

module.exports = new Transformer({

  async transform({ asset }) {
    const source = await asset.getCode();        
    const tmpl = new TemplateJSSX(source);
    asset.type = 'html';
    asset.setCode(tmpl.compile()); // string result

    return [asset];
  },
});

class TemplateJSSX {
  constructor( html = '') {
    this.html = html;
    this.data = new Map();
  }

  compile() {
    this.getVariables();
    this.checkVariables();
    this.checkLoops();
    this.insertBlock();

    return this.html;
  }

  
  getVariables () {
    const regexVars = /{var}(.*?){\/var}/gims;
    let matches;
    while ((matches = regexVars.exec(this.html)) !== null) {
      const varsArr = matches[1].replace(/[\r\n]*/gims,'').split(";");
      varsArr.forEach(variable => 
        {
          if (variable.length > 1) {
            let [key, value] = variable.split("=");
            value = value.replace(/^[\"\'\s]+/, "").replace(/[\"\'\s]+$/, "");
            this.data.set(key.trim(), value);
          }
        })
      this.html = this.html.replace(matches[0],'');
    }
  }


  checkVariables () {
    if (this.data) {
      this.data.forEach((value, key) => {
        this.html = this.html.replaceAll('{' + key + '}', value);
      });
    }
  }
  
  
  checkLoops () {
    const regexArr = /{for(.*?)}(.*?){\/for}/gims;
    const condArr = ["==","<=",">=",">","<"]; 

    let matches;
    while ((matches = regexArr.exec(this.html)) !== null) {
      const operatorArr = matches[1].replaceAll(" ","").split(";");
      const element = matches[2].trim();
      const variableArr = operatorArr[0].split('='); // variableArr[0] <- name variableArr[1] <- value
      const conditionArr = operatorArr[1];
      const iterration = operatorArr[2];
      let sign;

      condArr.forEach( el => {
        if (conditionArr.match(el) ) {
          sign = el;
        }
      });

      let conditionLimit = parseInt(conditionArr.split(sign)[1]);
      if (variableArr[0] != conditionArr.split(sign)[0]) {
        console.warn('В шаблоне счетчик должен использоваться в условии выхода');
      }

      const funcStr = `let result = '';
        for (i = ${variableArr[1]}; i ${sign} ${conditionLimit}; ${iterration}) {
        result = result + params.replaceAll("{${variableArr[0]}}", i);
      }
      return result;`
      const copy = new Function('params', funcStr);        
      this.html = this.html.replace(matches[0],copy(element));
      
    }
    return this.html;
  }


  insertBlock() {
    const regexBlocks = /\[\[(.*?)\]\]/gi;
    
    let matches, path = "./src/components/";
    while ((matches = regexBlocks.exec(this.html)) !== null) {    
      if (matches) {
        if (matches[1].indexOf('/') >= 0 ) { // if path return file with path 
          path = matches[1];
        }else{ // else create new path from name
          const blockName = matches[1].toLowerCase();
          path = path + blockName + "/" + blockName + ".html";  
        }
        let block = '<include src="' + path + '"></include>';
        this.html = this.html.replaceAll(matches[0], block);
      }
    }
  }
}