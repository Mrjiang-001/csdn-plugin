
if (typeof (global) === "undefined") { global = window; }

var _jsonUtils = {
  extractJSON: function (rawJson) {
    return rawJson
      .replace(/\s*while\((1|true)\)\s*;?/, '')
      .replace(/\s*for\(;;\)\s*;?/, '')
      .replace(/^[^{\[].+\(\s*?{/, '{')
      .replace(/}\s*?\);?\s*$/, '}');
  }, 
  exposeJson: function (text, outsideViewer) { 
    console.log(`%c CSDN_Plugin %c JSON已赋值到 window.json %c `,
      'background: #35495e ; padding: 1px; border-radius: 3px 0 0 3px;  color: #fff',
      `background: #e33e33 ; padding: 1px; border-radius: 0 3px 3px 0;  color: #fff`,
      'background: transparent')
    if (outsideViewer) {
      window.json = JSON.parse(text); 
    } else {
      var script = document.createElement("script");
      script.innerHTML = 'window.json = ' + text + ';';
      document.head.appendChild(script);
    }
  },
  isJSON: function (jsonStr) {
    var str = jsonStr;
    if (!str || str.length === 0) {
      return false
    } 
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '')
    return (/^[\],:{}\s]*$/).test(str)
  },
  isJSONP: function (jsonStr) {
    return this.isJSON(this.extractJSON(jsonStr));
  }
}
Object.assign(global, { JSONUtils: _jsonUtils });
