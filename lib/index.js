const { Transformer } = require('@parcel/plugin');

module.exports = new Transformer({

  async transform({ asset, resolve}) {
    const source = await asset.getCode();    
    let data = new Map();
    data.set("cats", "12 котов"); 
    data.set("dogs", "12 псов"); 
    
    const tmpl = new TemplateJSSX(data, source);
    asset.type = 'html';
    asset.importer = [{}, resolvePathImporter({resolve})];
    asset.setCode(tmpl.compile()); // string result


    resolvePathImporter({resolve});


    for (let el in asset) {
      console.log(await el);
    }
    return [asset];
  },
});

class TemplateJSSX {
  constructor(data = new Map(), html = '') {
    this.html = html;
    this.data = data;
  }

  compile() {
    this.checkVariables();
    this.checkLoops();
    this.insertBlock();

    return this.html;

  }
  
    /* check variable */
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
    
    let matches;
    while ((matches = regexBlocks.exec(this.html)) !== null) {    
      if (matches) {      
        let ssstr = '<include src="/src/components/button/button.jssx"></include>';
        this.html = this.html.replaceAll('[[Button]]', ssstr);
        console.log(this.html, matches[0], ssstr);
      }
    }
    console.log(this.html);
  }
}

function resolvePathImporter({resolve}) {
  return function(rawUrl, prev, done) {
    let url = rawUrl.replace(/^file:\/\//, '');

    if (WEBPACK_ALIAS_RE.test(url)) {
      const correctPath = url.replace(/^~/, '');
      const error = new Error(
        `The @import path "${url}" is using webpack specific syntax, which isn't supported by Parcel.\n\nTo @import files from node_modules, use "${correctPath}"`,
      );
      done(error);
      return;
    }

    resolve(prev, url)
      .then(resolvedPath => {
        done({file: resolvedPath});
      })
      .catch(() => {
        /*
         We return `null` instead of an error so that Sass' resolution algorithm can continue.
         Imports are resolved by trying, in order:
           * Loading a file relative to the file in which the `@import` appeared.
           * Each custom importer.
           * Loading a file relative to the current working directory.
           * Each load path in `includePaths`
           * Each load path specified in the `SASS_PATH` environment variable, which should be semicolon-separated on Windows and colon-separated elsewhere.
         See: https://sass-lang.com/documentation/js-api#importer
        */
        done(null);
      });
  };
}