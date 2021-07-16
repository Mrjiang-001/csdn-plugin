/* eslint-disable */
if (typeof (global) === "undefined") { global = window; }
if (!global.JSONUtils) global.JSONUtils = {}

function repeat (s, count) {
  return new Array(count + 1).join(s);
}
// 根据 [ 出现的索引寻找下一个 ] 字符， 返回数组的长度 
function getSizeOfArray (jsonString, startingPosition) {
  // 从 【 的后一个索引开始找
  var currentPosition = startingPosition + 1;
  // 当前是否在进行字符串拼接的处理，如果是则找到 下一个 “ 为止
  var inString = false;
  // 得找多少个 ] 才终止, 0时终止
  var numOpened = 1;
  try {
    while (numOpened > 0 && currentPosition < jsonString.length) {
      // 当前字符
      var currentChar = jsonString.charAt(currentPosition)
      switch (currentChar) {
        case '[':
          if (!inString) {
            numOpened++;
          }
          break;
        case ']':
          if (!inString) {
            numOpened--;
          }
          break;
        case '"':
          inString = !inString;
          break;
      }
      currentPosition++;
    }
    return JSON.parse(jsonString.substring(startingPosition, currentPosition)).length;
  } catch (err) {
    return null;
  }
}
/**
   * 
   * @param {*} json 
   * @param {*} options 配置项
   * {
   *    tabSize: 2, // 缩进
   *    indentCStyle: false, // 
   *    showArraySize: false, // 是否显示数组大小 
   * }
   */
function formatJson (json, options) {
  // console.log("formatJson", json, options)
  options = options || {};
  var tabSize = options.tabSize || 2;
  var indentCStyle = options.indentCStyle || false;
  var showArraySize = (typeof options.showArraySize !== "undefined" ? Boolean(options.showArraySize) : false);
  var tab = "";
  for (var ts = 0; ts < tabSize; ts++) {
    tab += " ";
  }

  var i = 0,
    il = 0,
    newJson = "",
    indentLevel = 0,
    inString = false,
    currentChar = null;
  for (i = 0, il = json.length; i < il; i += 1) {
    currentChar = json.charAt(i);

    switch (currentChar) {
      case '{':
      case '[':
        // 判断是不是当前开始了字符串的处理
        if (!inString) {
          // 如果换行 生成换行 + 空格*层级
          if (indentCStyle) newJson += "\n" + repeat(tab, indentLevel);
          // 如果是数组并且开启显示数组length
          if (currentChar === "[") {
            if (showArraySize) {
              var arraySize = getSizeOfArray(json, i);
              if (arraySize !== null) {
                newJson += "Array[" + arraySize + "]";
              }
            }
          }
          newJson += currentChar;

          newJson += "\n" + repeat(tab, indentLevel + 1);
          indentLevel += 1;
        } else {
          newJson += currentChar;
        }
        break;
      case '}':
      case ']':
        if (!inString) {
          indentLevel -= 1;
          // 回退一个缩进
          newJson += "\n" + repeat(tab, indentLevel) + currentChar;
        } else {
          newJson += currentChar;
        }
        break;
      case ',':
        if (!inString) {
          // 当前字符时逗号，换行处理
          newJson += ",\n" + repeat(tab, indentLevel);
        } else {
          newJson += currentChar;
        }
        break;
      case ':':
        if (!inString) {
          // 冒号加个空格
          newJson += ": ";
        } else {
          newJson += currentChar;
        }
        break;
      case ' ':
      case "\n":
      case "\t":
        if (inString) {
          newJson += currentChar;
        }
        break;
      case '"':
        if (i === 0) {
          inString = true;          
        } else if (json.charAt(i - 1) !== '\\' || (json.charAt(i - 1) == '\\' && json.charAt(i - 2) == '\\')) {
          // '\" asd' || '\\"asdasd'
          inString = !inString;
        }
        newJson += currentChar;
        break;
      default:
        newJson += currentChar;
        break;
    }
  }

  return newJson;
}

global.JSONUtils.jsonFormater = formatJson
