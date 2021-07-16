/* eslint-disable no-useless-escape */ 
// eslint-disable-next-line no-global-assign
if (typeof (global) === "undefined") { global = window; }
if (!global.JSONUtils) global.JSONUtils = {}

var _jsonUtils = {
  extractJSON: function (rawJson) {
    return rawJson
      .replace(/\s*while\((1|true)\)\s*;?/, '')
      .replace(/\s*for\(;;\)\s*;?/, '')
      .replace(/^[^{\[].+\(\s*?{/, '{')
      .replace(/}\s*?\);?\s*$/, '}');
  },
  removeQuote: function (json) {
    return json.replace(/\s+/g, "").replace(/<\/?.+?>/g, "").replace(/[\r\n]/g, "")
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

Object.assign(global.JSONUtils, _jsonUtils);
