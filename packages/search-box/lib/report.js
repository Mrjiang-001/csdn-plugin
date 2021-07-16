/* eslint-disable */
(function ($) {
  var CFG, exports, _fn, REPORT_TYPE, requestDataArr, defaultData, VIEW_STRATEGY, SERVER_URL, utmData, VERSION, CUSTOM_HREF, CUSTOM_HOST;
  requestDataArr = [];
  CFG = {
    DELAY: 500,
    API_VERSION: "0.6.0",
    SERVER_URL: "https://event.csdn.net/"
  }
  COOKIE_KEYS = ['utm_source']
  SERVER_URL = {
    'pv': CFG.SERVER_URL + 'logstores/csdn-pc-tracking-pageview/track_ua.gif?APIVersion=' + CFG.API_VERSION,
    'click': CFG.SERVER_URL + 'logstores/csdn-pc-tracking-page-click/track_ua.gif?APIVersion=' + CFG.API_VERSION,
    'view': CFG.SERVER_URL + 'logstores/csdn-pc-tracking-page-exposure/track'
  }  
  CUSTOM_HREF = window.customReportHref || window.location.href
  CUSTOM_HOST = 'plugin.csdn.net' || window.location.host
  VERSION = chrome.runtime.getManifest().version;

  REPORT_TYPE = {
    PV: "pv",
    VIEW: "view",
    DELAY_VIEW: "delay_view",
    CLICK: "click"
  }
  /**
   * 曝光计数策略: 1,必须再可视区域内  0 已经调过的和可是区域的都算
   * @type {{SKIPPED_AND_VISIBLE: string, VISIBLE: string}}
   */
  VIEW_STRATEGY = {
    SKIPPED_AND_VISIBLE: "0",
    VISIBLE: "1"
  }
  // LogIdCookie 取值
  var LOGID_COOKIE_SUFFIX = 'log_Id_'

  _fn = {  
    /**
     * 
     * @param {String} type 对应REPORT_TYPE
     */
    setLogIdCookie: function(type){
      var logIdType = ['pv', 'click', 'view']
      if(logIdType.indexOf(type) === -1){
        console.log("logidCookie type Error")
        return;
      } 
      var logId_name = LOGID_COOKIE_SUFFIX + type;
      var curVal = _fn.getCookie(logId_name) || 0; 
      try{
        curVal = parseInt(curVal); 
        _fn.setCookie(logId_name, ++curVal, 10 * 365 * 24 * 60 * 60 * 1000);
      }  catch(e) {
        console.log("LogIdCookie type error", curVal, e)
      }
    },
    getRequest: function () {  //获取url的参数
      var theRequest = new Object();
      var url = CUSTOM_HREF.split("?")[1] || '';
      var strs = url.split("&");
      for (var i = 0; i < strs.length; i++) {
        var k = strs[i].split("=")[0];
        var v = strs[i].split("=")[1];
        // console.log('getRequest',k,typeof k,'--->',v,typeof v)
        if (k && v) {
          theRequest[k] = unescape(v);
        }
      }
      return theRequest;
    },
    /**
     * 初始化渠道来源信息
     * 1.utm_* 一致性保证，每次设置utm信息时候，清空之前所有utm信息
     * 2.url中的utm 信息统一存储至cookie中
     */
    initUTM: function () {
      utmData = {}
      var request = _fn.getRequest();
      var utmArray = [];
      // console.log('request',request)
      if (JSON.stringify(request) !== "{}") {


        //如果URL中包含任何utm_* 信息，统一删除cookie中所有utm信息，确保一致性
        var clearAll=false
        // utm复制一份儿到cookie
        for(var i in request) {
          if(i.indexOf('utm_') == 0 && request.hasOwnProperty(i)){
            clearAll=true
            break;
          }
        }
        // 清空所有utm_参数
        if(clearAll){
          var cCookie = _fn.getFuzzyCookie('c_utm_');
          var array=cCookie.split(";")
          for(var i in array) {
            if(array.hasOwnProperty(i)){
              var tmp_k=array[i].split("=")[0]
              if(tmp_k){
                console.log("initUTM():del",tmp_k)
                _fn.setCookie(tmp_k,'',-1)
              }
            }
          }
          console.log("initUTM():del utm_source")
          _fn.setCookie('utm_source','',-1)
        }

        // utm复制一份儿到cookie
        for(var i in request) {
          if(i.indexOf('utm_') == 0 && request.hasOwnProperty(i)){
            console.log("initUTM():set_utm_source",i,request[i])
            _fn.setCookie('c_' + i,request[i], 1 * 60 * 60 * 1000)
          }
        }

        //URL包含渠道来源信息时，初始化ADT_FROM并做持久化
        for (var i in COOKIE_KEYS) {
          if(COOKIE_KEYS.hasOwnProperty(i)){
            var k = COOKIE_KEYS[i],
              v = request[COOKIE_KEYS[i]];
            if (v) {
              _fn.setCookie(k, v, 1 * 60 * 60 * 1000)
              utmData[k] = v
            } else {
              utmData[k] = ""
            }
          }
        }
      } else {
        //URL不包含渠道来源信息时，读取Cookie初始化ADT_FROM
        for (var i in COOKIE_KEYS) {
          if(COOKIE_KEYS.hasOwnProperty(i)){
            var k = COOKIE_KEYS[i],
              v = _fn.getCookie(k);
            //初始化广告追踪来源信息，并做cookie持久化
            utmData[k] = v;
          }
        }
      }
      // console.info('init params: utmData=',utmData)
      return utmData
    },
    /**
     * 初始化设置站内追踪信息
     */
    initTraceInfo: function(){
      // _fn.getCookie('c_page_id')?_fn.setCookie('c_page_id', '', -1):"";
      // 黑名单内域名删除指定key
      var domain_list = ['blog', 'bbs', 'download', 'ask', 'edu', 'biwen'];
      for (var i = 0; i < domain_list.length; i++) {
        if (CUSTOM_HOST.indexOf(domain_list[i] + '.csdn.net') > -1) {
          _fn.setCookie('c_page_id', '', -1);
          _fn.setCookie('c_mod', '', -1);
          // console.warn("trace:initCSDNTraceInfo：删除站内追踪信息")
        }
      }
    },
    /**
     * 持久化存储站内追踪信息
     */
    preserveTraceInfo: function(data){
      // console.warn("trace:preserveTraceInfo",data)
      if(data.mod){
        _fn.setCookie('c_mod', data.mod, 1 * 60 * 60 * 1000);
      }

      if(data.page_id){
        _fn.setCookie('c_page_id', data.page_id, 1 * 60 * 60 * 1000);
      }else{
        // var page_id=$("link[ref='canonical']").attr("href")?$("link[ref='canonical']").attr("href"):CUSTOM_HREF.split("?")[0]
        // console.warn("traceInfo:page,uri as page_id",page_id)
        _fn.setCookie('c_page_id', 'default', 1 * 60 * 60 * 1000);
      }
    },
    getTimestamp: function () {
      return Math.round(new Date() / 1000)
    },
    getXPath: function (element) {
      if (element.id !== "") {
        return '//*[@id=\"' + element.id + '\"]';
      }
      if (element == document.body) {
        return '/html/' + element.tagName.toLowerCase();
      }
      if (!element.parentNode) {
        return ''
      }
      var ix = 1, siblings = element.parentNode.childNodes;

      for (var i = 0, l = siblings.length; i < l; i++) {
        var sibling = siblings[i];
        if (sibling == element) {
          return arguments.callee(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix) + ']';
        } else if (sibling.nodeType == 1 && sibling.tagName == element.tagName) {
          ix++;
        }
      }
    },
    getScreen: function () {
      return window.screen.width + '*' + window.screen.height
    },
    getCookie: function (name) {
      var arr, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
      if (arr = document.cookie.match(reg))
        return unescape(arr[2]);
      else
        return "";
    },
    getFuzzyCookie: function (fuzzyQuery) {
      var result, reg = new RegExp(fuzzyQuery + "[A-Za-z0-9_]+=([^;]*);", "ig");
      if (result = document.cookie.match(reg))
        return result.join('');
      else
        return "";
    },
    checkoutUtm:function(){
      var carray = [];
      var result = [];
      var query = CUSTOM_HREF.split("?")[1] ||  '';
      if(query.length){
        carray = query.split('&');
        for(var i=0;i<carray.length;i++){
          if(carray[i].indexOf('utm_') == 0){
            result.push(carray[i].split('=')[0]);
          }
        }
      }
      return result
    },
    setCookie: function (name, value, expireTime) {
      var exp = new Date();
      exp.setTime(exp.getTime() + expireTime);
      document.cookie = name + "=" + escape(value) + ";expires=" + exp.toGMTString() + ";path=/ ; domain=." + (this.topDomain(CUSTOM_HOST));
    },
    setUtmInfo:function(){

    },
    /**
     * 设置用户分片
     */
    setUserSegment:function(){
      var cidForDid = ((_ref1 = /(; )?(uuid_tt_dd|_javaeye_cookie_id_)=([^;]+)/.exec(window.document.cookie)) != null ? _ref1[3] : void 0) || "";
      var c_segment = cidForDid?cidForDid.substring(cidForDid.length-6)%16:0;
      _fn.setCookie("c_segment",c_segment)
    },

    /**
     * 设置first_info 规则
     * 1.旧版本数据清理，更正站内来源统计时，设置c_first_ref = default，c_first_page 保持不变
     * 2.站外来源访问时(首次访问+非首次访问)，每次更新c_first_ref、c_first_page
     * 3.其它：站内访问来源、直接访问来源（仅首次访问），cookie标记c_first_ref=default、first_page=referrerHost
     */
    setfirstPageInfo : function () {
      // 旧版本数据清理，更正站内来源统计时，设置c_first_ref = default，c_first_page 保持不变
      if(_fn.getCookie("c_first_ref")&&_fn.getCookie("c_first_ref").indexOf(".csdn.net")>-1){
        _fn.setCookie("c_first_ref","default")
        return
      }

      var urlReg = new RegExp(/[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+\.?/)
      var first_ref = window.document.referrer ? window.document.referrer.match(urlReg)[0] : 'default';
      if(first_ref.indexOf('.csdn.net')>-1){
        // 站内渠道来源，设置为default
        first_ref = 'default'
      }

      // 站外来源访问时(首次访问+非首次访问)，每次更新c_first_ref、c_first_page
      if(first_ref!='default'){
        _fn.setCookie("c_first_ref",first_ref);
        _fn.setCookie("c_first_page",CUSTOM_HREF)
        return
      }

      // 其它：站内访问来源、直接访问来源（仅首次访问），cookie标记c_first_ref=default、first_page=来源页host
      if(!_fn.getCookie("c_first_ref")){
        _fn.setCookie("c_first_ref","default")
        _fn.setCookie("c_first_page",CUSTOM_HREF)
        return
      }
    },
    /**
     * 初始化参数
     * @returns {{uid: *|string, ref: string, pid, mod: string, con: string, ck: string, curl, session_id: *}}
     */
    initData: function () {
      _fn.setfirstPageInfo();
      _fn.initTraceInfo();
      _fn.setUserSegment()
      var _ref1, customData, utmData;
      var cidForDid = ((_ref1 = /(; )?(uuid_tt_dd|_javaeye_cookie_id_)=([^;]+)/.exec(window.document.cookie)) != null ? _ref1[3] : void 0) || "";
      var referer = (_fn.urlParamsToObj(location.href.split("?")[1])).referer || ""
       
      defaultData = {
        cid: cidForDid,
        sid: _fn.getCookie("dc_session_id") || "",
        pid: 'chrome-plugin',
        // pid: CUSTOM_HOST.split(".csdn.net")[0],
        uid: _fn.getCookie("UserName"),
        did: _fn.getCookie("X-Device-ID") || cidForDid || "",
        dc_sid : _fn.getCookie("dc_sid"),
        ref:  decodeURIComponent(referer),
        curl: CUSTOM_HREF,
        dest: "",
        cfg: {
          viewStrategy: VIEW_STRATEGY.VISIBLE
        }
      };
      utmData = _fn.initUTM();
      // //console.log("defaultdefaultData:",defaultData);
      if ($("meta[name=report]").attr("content")) {
        customData = JSON.parse($("meta[name=report]").attr("content"));
      } else {
        customData = {};
      }
      defaultData = $.extend({}, defaultData, {
        utm: utmData.utm_source
      }, customData);
      //console.log("defaultData:",defaultData);
      _fn.preserveTraceInfo(defaultData)
      return defaultData;
    },
    /**
     * 上一次访问的页面停留时间
     * @returns {*}
     */
    tos: function () {
      var e, now, ref, t, tos;
      now = +new Date() / 1000 | 0;
      t = (ref = /\bdc_tos=([^;]*)(?:$|;)/.exec(document.cookie)) != null ? ref[1] : void 0;
      try {
        tos = now - parseInt(t, 36);
      } catch (_error) {
        console.warn("tos init error", _error);
        tos = -1;
      }
      document.cookie = "dc_tos=" + (now.toString(36)) + " ; expires=" + (new Date((now + 4 * 60 * 60) * 1000).toGMTString()) + " ; max-age=" + (4 * 60 * 60) + " ; path=/ ; domain=." + (this.topDomain(CUSTOM_HOST));
      return tos;
    },
    /**
     * 顶级域名 如:csdn.net /iteye.com
     * @param d
     * @returns {string}
     */
    topDomain: function (d) {
      return /\.?([a-z0-9\-]+\.[a-z0-9\-]+)(:\d+)?$/.exec(d)[1];
    },
    copyArr: function (arr) {
      var res = []
      for (var i = 0; i < arr.length; i++) {
        res.push(arr[i])
      }
      return res;
    },
    isView: function (node, viewStrategy) {
      var $this = this;
      if (!node) {
        return false
      }
      var nodeTop = this.getElementBottom(node);
      var bottomTop = nodeTop + node.offsetHeight;


      if (VIEW_STRATEGY.VISIBLE == viewStrategy) {
        if ($this.scrollTop() < nodeTop && nodeTop < ($this.scrollTop() + $this.windowHeight())) {
          return true;
        } else if ($this.scrollTop() < bottomTop && bottomTop < ($this.scrollTop() + $this.windowHeight())) {
          return true;
        } else {
          return false;
        }
      } else if (VIEW_STRATEGY.SKIPPED_AND_VISIBLE == viewStrategy) {
        if (nodeTop <= $this.scrollTop() + $this.windowHeight()) {
          return true;
        } else if ($this.scrollTop() < nodeTop && nodeTop < ($this.scrollTop() + $this.windowHeight())) {
          return true;
        } else if ($this.scrollTop() < bottomTop && bottomTop < ($this.scrollTop() + $this.windowHeight())) {
          return true;
        } else {
          return false;
        }
      }



    },
    scrollTop: function () {
      return Math.max(
        //chrome
        document.body.scrollTop,
        //firefox/IE
        document.documentElement.scrollTop);
    },
    //获取页面浏览器视口的高度
    windowHeight: function () {
      //document.compatMode有两个取值。BackCompat：标准兼容模式关闭。CSS1Compat：标准兼容模式开启。
      return (document.compatMode == "CSS1Compat") ?
        document.documentElement.clientHeight :
        document.body.clientHeight;
    },
    //获取ele到document顶部的距离
    getElementTop: function (elem) { 
      if (typeof jQuery !== 'undefined') {
        return $(elem).offset().top;
      } 
      var elemTop = elem.offsetTop;//获得elem元素距相对定位的父元素的top 
      elem = elem.offsetParent;//将elem换成起相对定位的父元素 
      while (elem != null) {//只要还有相对定位的父元素 
        //获得父元素 距他父元素的top值,累加到结果中 
        elemTop += elem.offsetTop; 
        //再次将elem换成他相对定位的父元素上; 
        elem = elem.offsetParent;

      }
      return elemTop;
    },
    getElementBottom: function (elem) {
      if (typeof jQuery !== 'undefined') {
        return $(elem).offset().top + $(elem).height();
      }
      var elemTop = elem.offsetTop;//获得elem元素距相对定位的父元素的top 
      elem = elem.offsetParent;//将elem换成起相对定位的父元素 
      while (elem != null) {//只要还有相对定位的父元素 
        //获得父元素 距他父元素的top值,累加到结果中 
        elemTop += elem.offsetTop; 
        //再次将elem换成他相对定位的父元素上; 
        elem = elem.offsetParent; 
      }
      return elemTop;
    },
    url2Obj: function (url) {
      var obj = {};
      var list = url.split("&");
      for (var i in list) {
        obj.hasOwnProperty(i) && (obj[list[i].split('=')[0]] = decodeURIComponent(list[i].split('=')[1]));
      }
      return obj;
    },
    fixParamConTop: function (data, thisObj) {
      if (data.con.split(",top_") > -1) {
        return data
      }
      data.con = data.con + ',top_' + $(thisObj).offset().top;
      return data
    },
    urlParamsToObj: function (query) {
      if(!query) return {}
      var queryObj = {};
      query.replace(/([^?&=]+)=([^?&=]+)/g, function () {
        queryObj[arguments[1]] = arguments[2];
      });  
      return queryObj;
    },
    objToUrlParams: function (queryObj) {
      var paramStr = ''; 
      $.each(queryObj, function (i) { 
          paramStr += '&' + i + '=' + queryObj[i]; 
      }); 
      return paramStr.substr(1); 
    } 
    
  }

  exports = {
    timer: 0,
    checkTimer: 0, 
    /**
     * 拼接spm值 
     */
    getFullSpm: function (spm) { 
      var len = spm.split('.').length; 
      if(len === 2) {
        var spmEl = document.querySelector('meta[name="report"]'),
            somContent = spmEl && spmEl.getAttribute('content') || '{}',
            spmObj = JSON.parse(somContent);  
        return spmObj.spm ? (spmObj.spm + '.' + spm) : spm
      } 
      return spm 
    },
    /**
     * 数据上报(立即执行:pv/click)
     * @param reportType  PV/click/view
     * @param params
     */
    reportServer: function (reportType, data) {
      // console.log('reportServerInit:',data)
      if (typeof (reportType) != "undefined" && typeof (data) != "undefined") {
        requestDataArr.push(data);
      }
      var tmpArr = _fn.copyArr(requestDataArr);
      if (tmpArr.length == 0) {
        return;
      }
      requestDataArr = [];
      var serverData = {
        "__source__": "csdn",
        "__logs__": tmpArr
      }

      // 增加logid
      _fn.setLogIdCookie(REPORT_TYPE.VIEW)
      if (reportType === REPORT_TYPE.VIEW || reportType === REPORT_TYPE.DELAY_VIEW) {
        var useragent = window.navigator.userAgent;
        serverData["__tags__"] = {
          "useragent": useragent,
          "log_id": _fn.getCookie(LOGID_COOKIE_SUFFIX + REPORT_TYPE.VIEW)
        };
      }
      chrome.runtime.sendMessage({
          handler:  "sendAjaxRequest",
          message: {
              url: SERVER_URL[REPORT_TYPE.VIEW],
              type: 'POST',
              crossDomain: true,
              xhrFields: { withCredentials: false },
              contentType: 'text/plain;charset=UTF-8',
              headers: {      //请求头
                "x-log-apiversion": CFG.API_VERSION,
                "x-log-bodyrawsize": "1234"
                // "x-log-compresstype" : "gzip"
              },
              data: serverData,
          }
      });
    },
    /**
     * 数据上报(延迟合并请求:主要针对曝光统计)
     */
    reportServerDelay: function (reportType, data) {
      requestDataArr.push(data);
      var _this = this;
      if (_this.timer) {
        clearTimeout(_this.timer);
      }
      _this.timer = setTimeout(function () {
        _this.reportServer(REPORT_TYPE.DELAY_VIEW);
      }, CFG.DELAY);
    },
    reportView: function (data, thisObj, delay) {
      if (!data) {
        console.warn('reportView Error:', data)
        return
      }
      var newData = $.extend(true, {}, defaultData, data);
      var cCookie = _fn.getFuzzyCookie('c_');
      newData.t = _fn.getTimestamp() + '';
      newData.eleTop = thisObj ? thisObj.offset().top + '' : '';
      delete newData.cfg;
      cCookie && (newData.cCookie = cCookie);
      newData["__time__"] = _fn.getTimestamp()
      if(!newData.hasOwnProperty('curl')) {
        newData['curl'] = CUSTOM_HREF;  
      }
      // extra如果没有版本，就添加版本
      var extra = Object.assign(JSON.parse(newData.extra || "{}"), {
         "version": VERSION 
      })
      newData.extra = JSON.stringify(extra)
      var reportFunc = function(_data, _newData, _delay, _thisObj) { 
        if (typeof _delay == "undefined") {
          exports.reportServerDelay(REPORT_TYPE.VIEW, _newData);
        } else {
          exports.reportServer(REPORT_TYPE.VIEW, _newData);
        } 
        if (typeof csdn.afterReportView == "function") {
          exports.afterReportView(_thisObj, _data);
        }
      }  
      reportFunc(data, newData, delay, thisObj)  
    },
    /**
     * CLICK上报
     */
    reportClick: function (data, thisObj) {
      var newData = $.extend(true, {}, defaultData, data);
      if(!data.spm){
        newData.spm=''
      }
      newData.spm = this.getFullSpm(newData.spm);  
      newData.t = _fn.getTimestamp();
      newData.elePath = thisObj ? _fn.getXPath(thisObj[0]) + '' : '';
      newData.eleTop = thisObj ? thisObj.offset().top + '' : '';
      if(newData.trace){
        _fn.preserveTraceInfo(newData)
      }
      // 记录以「c_」开头的所有cookie值
      var cCookie = _fn.getFuzzyCookie('c_');
      cCookie && (newData.cCookie = cCookie);
      newData['curl'] = CUSTOM_HREF;
      // VERSION
      var extra = Object.assign(JSON.parse(newData.extra || "{}"), {
          "version": VERSION 
      })
      newData.extra = JSON.stringify(extra)
      
      var reportFunc = function (newData){   
        delete newData.cfg;
        // logid_cookie
        _fn.setLogIdCookie(REPORT_TYPE.CLICK) 
        newData.log_id =  _fn.getCookie(LOGID_COOKIE_SUFFIX + REPORT_TYPE.CLICK); 
    
        chrome.runtime.sendMessage({
            handler:  "sendAjaxRequest",
            message: {
                url: SERVER_URL[REPORT_TYPE.CLICK],
                type: 'get',
                crossDomain: true,
                xhrFields: { withCredentials: false },
                contentType: 'text/plain;charset=UTF-8',
                data: newData,   
            }
        });
      }  
      reportFunc(newData)  
    },
    /**
     * PV上报
     * @param data  自定义参数
     */
    reportPageView: function (data) {
      var newData = $.extend(true, {}, defaultData, data);
      newData.tos = _fn.tos();
      newData.adb = _fn.getCookie("c_adb") || 0;
      newData['curl'] = CUSTOM_HREF;
      // 记录以「c_」开头的所有cookie值
      var cCookie = _fn.getFuzzyCookie('c_');
      cCookie && (newData.cCookie = cCookie);
      newData.t = _fn.getTimestamp();
      newData.screen = _fn.getScreen();
      newData.un = _fn.getCookie("UN") || "";
      newData.extra = `{"version": "${VERSION}"}`
      newData.vType = _fn.getCookie("p_uid") || "";
      delete newData.cfg;
      delete newData.dest;
      // logid_cookie
      _fn.setLogIdCookie(REPORT_TYPE.PV);
      newData.log_id =  _fn.getCookie(LOGID_COOKIE_SUFFIX + REPORT_TYPE.PV);
 
      chrome.runtime.sendMessage({
          handler:  "sendAjaxRequest",
          message: {
              url: SERVER_URL[REPORT_TYPE.PV],
              type: 'get',
              crossDomain: true,
              xhrFields: { withCredentials: false },
              contentType: 'text/plain;charset=UTF-8',
              data: newData,
          }
      });
    },
    viewCheck: function () {
      var _this = this;
      //收集,检查带曝光的节点,曝光后
      clearTimeout(_this.checkTimer);
      _this.checkTimer = setTimeout(function () {
        //查找所有未曝光的节点,加入List,判断:如果在可是区域内,执行曝光
        $("[data-report-view]").each(function () {
          var $this = $(this);
          var itemData=$this.data("reportView");
          var data = $.extend({}, defaultData, itemData);
          if(!itemData.spm){
            data.spm=''
          }
          data.spm = _this.getFullSpm(data.spm);
          data['curl'] = CUSTOM_HREF;
          // $this.addClass("report-ready");
          // console.log("曝光计算:",data,defaultData,$this.data("reportView"));
          if (_fn.isView($this.get(0), data.cfg.viewStrategy)) {
            //console.log("曝光区域",data.mod);
            csdn.report.reportView(data, $this);
            $this.removeData("reportView");
            $this.removeAttr("data-report-view");
            // $this.removeClass("report-ready").addClass("report-finish");
          }
        })
      }, 200);
    },
    isView: function ($obj) {
      return _fn.isView($obj);
    },
    addSpmToHref: function (el) {
      var $this = el;
      var _this = this;
      var query = $this.data("reportQuery") || ""; 
      var href = $this.attr("href");
      var newLink = href;
      var linkObj = {};  
      if (href.indexOf('?') !== -1) { 
        newLink = href.split("?")[0];
        linkObj = _fn.urlParamsToObj(href.split("?")[1]);
      }   
      if (query) { 
        var queryObj = _fn.urlParamsToObj(query);
        if(query.indexOf('spm') > -1 || query.indexOf('SPM') > -1) {
          queryObj.spm = queryObj.spm || queryObj['SPM']
          queryObj.spm = _this.getFullSpm(queryObj.spm); 
        }
        newLink += "?" + _fn.objToUrlParams(Object.assign(linkObj, queryObj))
      }   
      $this.attr('href', newLink) 
    }
  };


  if (window.csdn === undefined) {
    window.csdn = {};
  }
  if (csdn.report) {
    console.warn("上报脚本重复，请检查")
    return
  }

  window.csdn.report = exports;
  defaultData = _fn.initData();
  if (!defaultData.disabled) { 
    csdn.report.reportPageView();
  }

  //console.log("initdefaultData:",defaultData) ;
})(jQuery);
 
$(function () {
var report = csdn.report;
$(document).on("click", "[data-report-click]", function () {
  var data = $(this).data("reportClick");
  //console.log("点击上报",this,data);
  report.reportClick(data, $(this));
}) 
report.viewCheck($("[data-report-view]"));
$(window).on("scroll", function () {
  report.viewCheck($("[data-report-view]"));
}); 
$(document).on("contextmenu", "a[data-report-query]", function () {
  report.addSpmToHref($(this))  
})
$(document).on("click", "a[data-report-query]", function () { 
  report.addSpmToHref($(this)) 
}) 
$(document).on("click", "a[href]", function () {
  function isOutside(url) {
    var isNotCursor = /^https:\/\/|^http:\/\//ig;
    if (!isNotCursor.test(url)){
      return false;
    }
    if (url === '/') {
      return false;
    }
    if (url.indexOf('.csdn.net') > -1) {
      return false;
    }
    if (url.indexOf('.iteye.com') > -1) {
      return false;
    }
    return true;
  }

  var obj = jQuery(this);
  var url = obj.attr('href');
  if (isOutside(url)) {
    var data = {
      "mod": "1583921753_001",
      "dest": url
    }
    report.reportClick(data, obj);
  }
})
})
