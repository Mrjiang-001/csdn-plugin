/* eslint-disable */ 
(function () { 
  var resultMirrorEditor
  var defaults = {
    theme: "default",
    addons: {  
      alwaysFold: false,
      // 考虑后期增加URL点击功能
      // clickableUrls: true, 
      // openLinksInNewWindow: true, 
    },
    structure: {
      readOnly: false,
      autofocus: true,
      lineNumbers: true,
      lineWrapping: true,
      foldGutter: true, 
      tabSize: 2,
      lint: true,
      keyMap: 'sublime',
      scrollbarStyle: "simple",
      styleActiveLine: true,
      indentCStyle: false,
      highlightSelectionMatches: { annotateScrollbar: true }, 
      showArraySize: false,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'CodeMirror-lint-markers'] 
    }
  }
  var elementId = '', pre = null
  const TOKEN = (Math.random() + 1).toString(36).slice(2, 7); 
  const WRAP_START = "<wrap_" + TOKEN + ">";
  const WRAP_END = "</wrap_" + TOKEN + ">";
  const NUM_REGEX = /^-?\d+\.?\d*([eE]\+)?\d*$/g;
  const ESCAPED_REGEX = "(-?\\d+\\.?\\d*([eE]\\+)?\\d*)"
  
  var _fn = {
    normalize (json) {
      return json.replace(/\$/g, '$$$$');
    },
    getJSONText (rawJsonText) {
      try { 
        var options = defaults
        var REPLACE_WRAP_REGEX = new RegExp("\"" + WRAP_START + ESCAPED_REGEX + WRAP_END + "\"", "g"); 
        
        var jsonExtracted = JSONUtils.extractJSON(rawJsonText); 
        var wrappedText = this.wrapNumbers(jsonExtracted);
        var jsonParsed = JSON.parse(wrappedText);  

        var decodedJson = JSON.stringify(jsonParsed);
        decodedJson = decodedJson.replace(REPLACE_WRAP_REGEX, "$1"); 

        var jsonFormatted = this.normalize(JSONUtils.jsonFormater(decodedJson, options.structure));
        return {code: 200, jsonText: this.normalize(rawJsonText).replace(this.normalize(jsonExtracted), jsonFormatted)}
      } catch (e) {  
        // let lintResult = Tarp.require('./jsonlint')(editor.getValue());
        // if (!isNaN(lintResult.line)) {
        //     this.errorPos = '错误位置：' + (lintResult.line + 1) + '行，' + (lintResult.col + 1) + '列；缺少字符或字符不正确';
        //     this.errorJsonCode = lintResult.dom;
        //     this.showTips = true;
        //     this.$nextTick(() => {
        //         let el = document.querySelector('#errorCode .errorEm');
        //         el && el.scrollIntoView();
        //         let scrollEl = document.querySelector('#errorTips');
        //         scrollEl.scrollBy(0, el.offsetTop - scrollEl.scrollTop - 50);
        //     });
        // }
        return {code: 0, jsonText: "解析错误"}
      }  
    },
    getEditorOptions (json) { 
      var theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'okaidia' :'default'
      var obligatory = { 
        theme: theme, 
        // mode: "application/ld+json",
        mode: "application/json",
        indentUnit: 2,
        tabSize: 2
      }      
      let { jsonText, code } = this.getJSONText(json)  
      return {code, options: Object.assign(defaults.structure, obligatory, {value: JSONUtils.removeQuote(jsonText) === '{}' ? '' : jsonText})}; 
    }, 
    wrapNumbers(text) {
      var buffer = "";
      var numberBuffer = "";
      var isInString = false;
      var charIsEscaped = false;
      var isInNumber = false;
      var previous = "";
      var beforePrevious = ""; 
      for (var i = 0, len = text.length; i < len; i++) {
        var char = text[i]; 
        if (char == '"' && !charIsEscaped) {
          isInString = !isInString;
        }  
        if (!isInString && !isInNumber && this.isCharInNumber(char, previous)) {
          isInNumber = true;
        } 
        if (!isInString && isInNumber && this.isCharInString(char, previous)) {
          isInNumber = false; 
          if (numberBuffer.match(NUM_REGEX)) {
            buffer += '"' + WRAP_START + numberBuffer + WRAP_END + '"'; 
          } else {
            buffer += numberBuffer;
          } 
          numberBuffer = "";
        } 
        // this applies to the _next_ character - the one used in the next iteration
        charIsEscaped = (char == '\\') ? !charIsEscaped : false 
        if (isInNumber) {
          numberBuffer += char; 
        } else {
          buffer += char;
          beforePrevious = previous;
          previous = char;
        }
      }
      return buffer;
    }, 
    isCharInNumber(char, previous) {
      return ('0' <= char && char <= '9') ||
            ('0' <= previous && previous <= '9' && (char == 'e' || char == 'E')) ||
            (('e' == previous || 'E' == previous) && char == '+') ||
            char == '.' ||
            char == '-';
    },
    isCharInString(char, previous) {
      return ('0' > char || char > '9') &&
            char != 'e' &&
            char != 'E' &&
            char != '+' &&
            char != '.' &&
            char != '-';
    },  
    getDOMEditor() {
      return document.getElementsByClassName('CodeMirror')[0];
    }, 
    renderPre(json){ 
      pre = document.querySelector('#' + elementId + ' .json-pre')
      if(pre) {
        pre.innerHTML = JSONUtils.removeQuote(json) 
      } else {
        pre = document.createElement("pre")
        pre.className = "json-pre"
        pre.title = "展开/折叠"
        pre.innerHTML = JSONUtils.removeQuote(json)
        pre.hidden = true
        document.getElementById(elementId).appendChild(pre)
      }  
    }, 
    renderExtras() {
      var extras = document.createElement("div");
      extras.className = "extras"; 
      var rawImg = document.createElement('img')
      rawImg.src = '/packages/json-format/icons/json-raw.svg';
      var rawLink = document.createElement("a");
      rawLink.className = "raw-link";
      rawLink.href = "#";
      rawLink.title = "源JSON"; 
      rawLink.appendChild(rawImg)
      rawLink.onclick = function(e) { 
        e.preventDefault(); 
        if (pre.hidden) { 
          _fn.getDOMEditor().hidden = true;
          pre.hidden = false; 
        } else { 
          _fn.getDOMEditor().hidden = false;
          pre.hidden = true; 
        }
      }
      // 格式化
      var formatImg = document.createElement('img')
      formatImg.src = '/packages/json-format/icons/json-format.svg';
      var formatLink = document.createElement("a");
      formatLink.className = "format-link";
      formatLink.href = "#";
      formatLink.title = "格式化"; 
      formatLink.appendChild(formatImg)
      formatLink.onclick = function(e) { 
        e.preventDefault();  
        if(resultMirrorEditor) {
          let rawJson = resultMirrorEditor.getValue()
          let {code, jsonText} =  _fn.getJSONText(rawJson)
          if(code === 200) {
            resultMirrorEditor.setValue(jsonText);      
          }
          _fn.renderPre(rawJson) 
        }
      }
      // 展开/折叠
      var unfoldImg = document.createElement('img')
      unfoldImg.src = '/packages/json-format/icons/json-fold.svg';
      var unfoldLink = document.createElement("a");
      unfoldLink.className = "unfold-link";
      unfoldLink.href = "#";
      unfoldLink.title = "展开/折叠";
      unfoldLink.appendChild(unfoldImg)
      unfoldLink.onclick = function(e) {
        e.preventDefault();
        var value = pre.getAttribute('data-folded') 
        if (value === 'true' || value === true) {
          _fn.unfoldAll();
          pre.setAttribute('data-folded', false) 
        } else {
          _fn.fold();
          pre.setAttribute('data-folded', true)
        }
      }  
      extras.appendChild(formatLink); 
      extras.appendChild(rawLink); 
      extras.appendChild(unfoldLink); 
      pre.setAttribute('data-folded', defaults.addons.alwaysFold)
      document.getElementById(elementId).appendChild(extras);
    }, 
    fold () { 
      var skippedRoot = true;
      var firstLine = resultMirrorEditor.firstLine();
      var lastLine = resultMirrorEditor.lastLine();
  
      for (var line = firstLine; line <= lastLine; line++) {
        if (!skippedRoot) {
          if (/(\[|\{)/.test(resultMirrorEditor.getLine(line).trim())) skippedRoot = true;
        } else {
          resultMirrorEditor.foldCode({line: line, ch: 0}, null, "fold");
        }
      }
      this.isfold = true 
    }, 
    unfoldAll () {
      for (var line = 0; line < resultMirrorEditor.lineCount(); line++) {
        resultMirrorEditor.foldCode({line: line, ch: 0}, null, "unfold");
      }
      this.isfold = false
    },
    bindEvent(){
      if(resultMirrorEditor) { 
        document.getElementById('vomnibar').addEventListener("paste", function(){
          document.getElementsByClassName("format-link")[0].click()
        })
      }
    },
    // setExtraKeys(){
    //   if(!resultMirrorEditor) return
    //   // 判断是否为Mac
    //   var mac = CodeMirror.keyMap.default == CodeMirror.keyMap.macDefault;
    //   var runKey = (mac ? "Cmd" : "Ctrl") + "-S";
    //   var extraKeys = {};
    //   extraKeys[runKey] = function (res) {
    //     console.log(res)
    //   }; 
    // }
  }
  exports = {   
    // 初始化
    init (id, json) {   
      if(!json || !id) return 
      let jsonRes =  _fn.getEditorOptions(json);
      elementId = id 
      if(jsonRes.code === 200) {
        resultMirrorEditor = CodeMirror(document.getElementById(elementId), jsonRes.options);
        _fn.renderPre(json)
        _fn.renderExtras(jsonRes.options) 
        _fn.bindEvent()
        // _fn.setExtraKeys()
      } else {
        resultMirrorEditor = null 
        document.getElementById(elementId).outerHTML = ''
      }
    }
  }
  window.JSONFormat = exports
})()