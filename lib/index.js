const { Transformer } = require('@parcel/plugin');
const { readFileSync, existsSync } = require('fs');

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
    this.html = this.getVariables(this.html);
    this.html = this.insertBlock();
    this.html = this.checkLoops(this.html);
    this.html = this.checkVariables(this.data, this.html);

    return this.html;
  }

  
  getVariables (html) {
    const regexVars = /{var}(.*?){\/var}/gims;
    let matches;
    while ((matches = regexVars.exec(html)) !== null) {
      const varsArr = matches[1].replace(/[\r\n]*/gims,'').split(";");
      varsArr.forEach(variable => 
        {
          if (variable.length > 1) {
            let [key, value] = variable.split("=");
            value = value.replace(/^[\"\'\s]+/, "").replace(/[\"\'\s]+$/, "");
            this.data.set(key.trim(), value);
          }
        })
      html = html.replace(matches[0],'');
    }

    return html;
  }


  checkVariables (mapObj, html) {
    if (!mapObj || !html) {

      return html;
    }
    const data = new Map(Object.entries(mapObj))
    if (data) {
      data.forEach((value, key) => {
        html = html.replaceAll('{' + key + '}', value);
      });
    }

    return html;
  }
  
  
  checkLoops (html) {
    const regexArr = /{for(.*?)}(.*?){\/for}/gims;
    const condArr = ["==","<=",">=",">","<"]; 

    let matches;
    while ((matches = regexArr.exec(html)) !== null) {
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
      html = html.replace(matches[0],copy(element));  
    }

    return html;
  }


  insertBlock() {
    const regexBlocks = /\[\[(.*?)\]\]/gi;
    
    let matches, path, moduleName, vars, varsJSON, moduleHTML;
    while ((matches = regexBlocks.exec(this.html)) !== null) {
      path = "./src/components/";
      if (matches) {
        [moduleName, varsJSON] = matches[1].split("@");
        if (varsJSON) {
          vars = JSON.parse(varsJSON);
        }
        if (moduleName.indexOf('/') >= 0 ) { // if path return file with path 
          path = moduleName;
        }else{ // else create new path from name
          const blockName = moduleName.toLowerCase();
          path = path + blockName + "/" + blockName + ".html";
          if (!existsSync(path)) {
            path = "./src/components/" +  blockName + "/" + blockName + ".jssx";
          }
        }
        
        if (!existsSync(path)) {
          console.warn("Filed load file " + moduleName);

          return this.html;
        }else{
          moduleHTML = readFileSync(path,{encoding:'utf8', flag:'r'});
        }

        moduleHTML = this.checkLoops(moduleHTML);
        moduleHTML = this.checkVariables(vars, moduleHTML);
        this.html = this.html.replaceAll(matches[0], moduleHTML);
      }
    }
    
      return this.html;
  }
}