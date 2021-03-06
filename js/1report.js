/* eslint-disable */
!function (e) {
    var t, o, r, n, i, c, a, s, d;
    if (i = [], t = {
        DELAY: 500,
        API_VERSION: "0.6.0",
        SERVER_URL: "https://event.csdn.net/"
    }, COOKIE_KEYS = ["utm_source"], s = {
        pv: t.SERVER_URL + "logstores/csdn-pc-tracking-pageview/track_ua.gif?APIVersion=" + t.API_VERSION,
        click: t.SERVER_URL + "logstores/csdn-pc-tracking-page-click/track_ua.gif?APIVersion=" + t.API_VERSION,
        view: t.SERVER_URL + "logstores/csdn-pc-tracking-page-exposure/track"
    }, n = {PV: "pv", VIEW: "view", DELAY_VIEW: "delay_view", CLICK: "click"}, a = {
        SKIPPED_AND_VISIBLE: "0",
        VISIBLE: "1"
    }, r = {
        getRequest: function () {
            for (var e = new Object, t = window.location.href.split("?")[1] || "", o = t.split("&"), r = 0; r < o.length; r++) {
                var n = o[r].split("=")[0], i = o[r].split("=")[1];
                n && i && (e[n] = unescape(i))
            }
            return e
        }, initUTM: function () {
            d = {};
            var e = r.getRequest();
            if ("{}" !== JSON.stringify(e)) {
                var t = !1;
                for (var o in e) if (0 == o.indexOf("utm_") && e.hasOwnProperty(o)) {
                    t = !0;
                    break
                }
                if (t) {
                    var n = r.getFuzzyCookie("c_utm_"), i = n.split(";");
                    for (var o in i) if (i.hasOwnProperty(o)) {
                        var c = i[o].split("=")[0];
                        c && (console.log("initUTM():del", c), r.setCookie(c, "", -1))
                    }
                    console.log("initUTM():del utm_source"), r.setCookie("utm_source", "", -1)
                }
                for (var o in e) 0 == o.indexOf("utm_") && e.hasOwnProperty(o) && (console.log("initUTM():set_utm_source", o, e[o]), r.setCookie("c_" + o, e[o]));
                for (var o in COOKIE_KEYS) if (COOKIE_KEYS.hasOwnProperty(o)) {
                    var a = COOKIE_KEYS[o], s = e[COOKIE_KEYS[o]];
                    s ? (r.setCookie(a, s, 36e5), d[a] = s) : d[a] = ""
                }
            } else for (var o in COOKIE_KEYS) if (COOKIE_KEYS.hasOwnProperty(o)) {
                var a = COOKIE_KEYS[o], s = r.getCookie(a);
                d[a] = s
            }
            return d
        }, initTraceInfo: function () {
            for (var e = ["blog", "bbs", "download", "ask", "edu", "biwen"], t = 0; t < e.length; t++) window.location.host.indexOf(e[t] + ".csdn.net") > -1 && (r.setCookie("c_page_id", "", -1), r.setCookie("c_mod", "", -1))
        }, preserveTraceInfo: function (e) {
            e.mod && r.setCookie("c_mod", e.mod, 36e5), e.page_id ? r.setCookie("c_page_id", e.page_id, 36e5) : r.setCookie("c_page_id", "default", 36e5)
        }, getTimestamp: function () {
            return Math.round(new Date / 1e3)
        }, getXPath: function (e) {
            if ("" !== e.id) return '//*[@id="' + e.id + '"]';
            if (e == document.body) return "/html/" + e.tagName.toLowerCase();
            if (!e.parentNode) return "";
            for (var t = 1, o = e.parentNode.childNodes, r = 0, n = o.length; r < n; r++) {
                var i = o[r];
                if (i == e) return arguments.callee(e.parentNode) + "/" + e.tagName.toLowerCase() + "[" + t + "]";
                1 == i.nodeType && i.tagName == e.tagName && t++
            }
        }, getScreen: function () {
            return window.screen.width + "*" + window.screen.height
        }, getCookie: function (e) {
            var t, o = new RegExp("(^| )" + e + "=([^;]*)(;|$)");
            return (t = document.cookie.match(o)) ? unescape(t[2]) : ""
        }, getFuzzyCookie: function (e) {
            var t, o = new RegExp(e + "[A-Za-z0-9_]+=([^;]*);", "ig");
            return (t = document.cookie.match(o)) ? t.join("") : ""
        }, checkoutUtm: function () {
            var e = [], t = [], o = window.location.href.split("?")[1] || "";
            if (o.length) {
                e = o.split("&");
                for (var r = 0; r < e.length; r++) 0 == e[r].indexOf("utm_") && t.push(e[r].split("=")[0])
            }
            return t
        }, setCookie: function (e, t, o) {
            var r = new Date;
            r.setTime(r.getTime() + o), document.cookie = e + "=" + escape(t) + ";expires=" + r.toGMTString() + ";path=/ ; domain=." + this.topDomain("chrome.csdn.nte")
        }, setUtmInfo: function () {
        }, setUserSegment: function () {
            var e = (null != (_ref1 = /(; )?(uuid_tt_dd|_javaeye_cookie_id_)=([^;]+)/.exec(window.document.cookie)) ? _ref1[3] : void 0) || "",
                t = e ? e.substring(e.length - 6) % 16 : 0;
            r.setCookie("c_segment", t)
        }, setfirstPageInfo: function () {
            if (r.getCookie("c_first_ref") && r.getCookie("c_first_ref").indexOf(".csdn.net") > -1) return void r.setCookie("c_first_ref", "default");
            var e = new RegExp(/[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+\.?/),
                t = window.document.referrer ? window.document.referrer.match(e)[0] : "default";
            return t.indexOf(".csdn.net") > -1 && (t = "default"), "default" != t ? (r.setCookie("c_first_ref", t), void r.setCookie("c_first_page", window.location.href)) : r.getCookie("c_first_ref") ? void 0 : (r.setCookie("c_first_ref", "default"), void r.setCookie("c_first_page", window.location.href))
        }, initData: function () {
            r.setfirstPageInfo(), r.initTraceInfo(), r.setUserSegment();
            var t, o, n,
                i = (null != (t = /(; )?(uuid_tt_dd|_javaeye_cookie_id_)=([^;]+)/.exec(window.document.cookie)) ? t[3] : void 0) || "";
            return c = {
                cid: i,
                sid: r.getCookie("dc_session_id") || "",
                pid: window.location.host.split(".csdn.net")[0],
                uid: r.getCookie("UserName"),
                did: r.getCookie("X-Device-ID") || i || "",
                dc_sid: r.getCookie("dc_sid"),
                ref: window.document.referrer,
                curl: window.location.href,
                dest: "",
                cfg: {viewStrategy: a.VISIBLE}
            }, n = r.initUTM(), o = e("meta[name=report]").attr("content") ? JSON.parse(e("meta[name=report]").attr("content")) : {}, c = e.extend({}, c, {utm: n.utm_source}, o), r.preserveTraceInfo(c), c
        }, tos: function () {
            var e, t, o, r;
            e = +new Date / 1e3 | 0, o = null != (t = /\bdc_tos=([^;]*)(?:$|;)/.exec(document.cookie)) ? t[1] : void 0;
            try {
                r = e - parseInt(o, 36)
            } catch (e) {
                console.warn("tos init error", e), r = -1
            }
            return document.cookie = "dc_tos=" + e.toString(36) + " ; expires=" + new Date(1e3 * (e + 14400)).toGMTString() + " ; max-age=14400 ; path=/ ; domain=." + this.topDomain("chrome.csdn.nte"), r
        }, topDomain: function (e) {
            return /\.?([a-z0-9\-]+\.[a-z0-9\-]+)(:\d+)?$/.exec(e)[1]
        }, copyArr: function (e) {
            for (var t = [], o = 0; o < e.length; o++) t.push(e[o]);
            return t
        }, isView: function (e, t) {
            var o = this;
            if (!e) return !1;
            var r = this.getElementBottom(e), n = r + e.offsetHeight;
            return a.VISIBLE == t ? o.scrollTop() < r && r < o.scrollTop() + o.windowHeight() || o.scrollTop() < n && n < o.scrollTop() + o.windowHeight() : a.SKIPPED_AND_VISIBLE == t ? r <= o.scrollTop() + o.windowHeight() || (o.scrollTop() < r && r < o.scrollTop() + o.windowHeight() || o.scrollTop() < n && n < o.scrollTop() + o.windowHeight()) : void 0
        }, scrollTop: function () {
            return Math.max(document.body.scrollTop, document.documentElement.scrollTop)
        }, windowHeight: function () {
            return "CSS1Compat" == document.compatMode ? document.documentElement.clientHeight : document.body.clientHeight
        }, getElementTop: function (t) {
            if ("undefined" != typeof jQuery) return e(t).offset().top;
            var o = t.offsetTop;
            for (t = t.offsetParent; null != t;) o += t.offsetTop, t = t.offsetParent;
            return o
        }, getElementBottom: function (t) {
            if ("undefined" != typeof jQuery) return e(t).offset().top + e(t).height();
            var o = t.offsetTop;
            for (t = t.offsetParent; null != t;) o += t.offsetTop, t = t.offsetParent;
            return o
        }, url2Obj: function (e) {
            var t = {}, o = e.split("&");
            for (var r in o) t.hasOwnProperty(r) && (t[o[r].split("=")[0]] = decodeURIComponent(o[r].split("=")[1]));
            return t
        }, fixParamConTop: function (t, o) {
            return t.con.split(",top_") > -1 ? t : (t.con = t.con + ",top_" + e(o).offset().top, t)
        }, getFullSpm: function (e) {
            if (2 === e.split(".").length) {
                var t = document.querySelector('meta[name="report"]'), o = t && t.getAttribute("content") || "{}";
                return JSON.parse(o).spm + "." + e
            }
            return e
        }
    }, o = {
        timer: 0, checkTimer: 0, reportServer: function (o, c) {
            void 0 !== o && void 0 !== c && i.push(c);
            var a = r.copyArr(i);
            if (0 != a.length) {
                i = [];
                var d = {__source__: "csdn", __logs__: a};
                if (o === n.VIEW || o === n.DELAY_VIEW) {
                    var u = window.navigator.userAgent;
                    d.__tags__ = {useragent: u}
                }
                e.ajax({
                    url: s[n.VIEW],
                    type: "POST",
                    crossDomain: !0,
                    xhrFields: {withCredentials: !1},
                    contentType: "text/plain;charset=UTF-8",
                    headers: {"x-log-apiversion": t.API_VERSION, "x-log-bodyrawsize": "1234"},
                    data: JSON.stringify(d),
                    success: function () {
                    },
                    error: function () {
                        console.error("csdn.report.reportServer()", arguments)
                    }
                })
            }
        }, reportServerDelay: function (e, o) {
            i.push(o);
            var r = this;
            r.timer && clearTimeout(r.timer), r.timer = setTimeout(function () {
                r.reportServer(n.DELAY_VIEW)
            }, t.DELAY)
        }, reportView: function (t, o, i) {
            if (!t) return void console.warn("reportView Error:", t);
            var a = e.extend(!0, {}, c, t), s = r.getFuzzyCookie("c_");
            a.t = r.getTimestamp() + "", a.eleTop = o ? o.offset().top + "" : "", delete a.cfg, s && (a.cCookie = s), a.__time__ = r.getTimestamp(), a.curl = window.location.href, void 0 === i ? this.reportServerDelay(n.VIEW, a) : this.reportServer(n.VIEW, a), "function" == typeof csdn.afterReportView && csdn.afterReportView(o, t)
        }, reportClick: function (t, o) {
            var i = e.extend(!0, {}, c, t);
            t.spm || (i.spm = ""), i.spm = r.getFullSpm(i.spm), i.t = r.getTimestamp(), i.elePath = o ? r.getXPath(o[0]) + "" : "", i.eleTop = o ? o.offset().top + "" : "", i.trace && r.preserveTraceInfo(i);
            var a = r.getFuzzyCookie("c_");
            a && (i.cCookie = a), i.curl = window.location.href, delete i.cfg, e.ajax({
                url: s[n.CLICK],
                type: "get",
                crossDomain: !0,
                xhrFields: {withCredentials: !1},
                contentType: "text/plain;charset=UTF-8",
                data: i,
                success: function () {
                },
                error: function () {
                    console.error("csdn.report.reportServer()", arguments)
                }
            })
        }, reportPageView: function (t) {
            var o = e.extend(!0, {}, c, t);
            o.tos = r.tos(), o.adb = r.getCookie("c_adb") || 0, o.curl = window.location.href;
            var i = r.getFuzzyCookie("c_");
            i && (o.cCookie = i), o.t = r.getTimestamp(), o.screen = r.getScreen(), o.un = r.getCookie("UN") || "", o.vType = r.getCookie("p_uid") || "", delete o.cfg, delete o.dest, e.ajax({
                url: s[n.PV],
                type: "get",
                crossDomain: !0,
                xhrFields: {withCredentials: !1},
                contentType: "text/plain;charset=UTF-8",
                data: o,
                success: function () {
                },
                error: function () {
                    console.error("csdn.report.reportServer()", arguments)
                }
            })
        }, viewCheck: function () {
            var t = this;
            clearTimeout(t.checkTimer), t.checkTimer = setTimeout(function () {
                e("[data-report-view]").each(function () {
                    var t = e(this), o = t.data("reportView"), n = e.extend({}, c, o);
                    o.spm || (n.spm = ""), n.spm = r.getFullSpm(n.spm), n.curl = window.location.href, r.isView(t.get(0), n.cfg.viewStrategy) && (csdn.report.reportView(n, t), t.removeData("reportView"), t.removeAttr("data-report-view"))
                })
            }, 200)
        }, isView: function (e) {
            return r.isView(e)
        }
    }, void 0 === window.csdn && (window.csdn = {}), csdn.report) return void console.warn("??????????????????????????????");
    window.csdn.report = o, c = r.initData(), c.disabled || csdn.report.reportPageView()
}(jQuery), jQuery(function () {
    var e = csdn.report;
    jQuery(document).on("click", "[data-report-click]", function () {
        var t = jQuery(this).data("reportClick");
        e.reportClick(t, jQuery(this))
    }), e.viewCheck(jQuery("[data-report-view]")), jQuery(window).on("scroll", function () {
        e.viewCheck(jQuery("[data-report-view]"))
    }), jQuery(document).on("click", "a[data-report-query]", function () {
        var e = jQuery(this), t = e.data("reportQuery") || "", o = e.attr("target"), r = e.attr("href"), n = r, i = "?";
        return -1 !== r.indexOf("?") && (i = "&"), t && (n += i + t), "_blank" === o ? window.open(n) : window.location.href = n, !1
    }), jQuery(document).on("click", "a[href]", function () {
        var t = jQuery(this), o = t.attr("href");
        if (function (e) {
            return !(!/^https:\/\/|^http:\/\//gi.test(e) || "/" === e || e.indexOf(".csdn.net") > -1 || e.indexOf(".iteye.com") > -1)
        }(o)) {
            var r = {mod: "1583921753_001", dest: o};
            e.reportClick(r, t)
        }
    })
});
