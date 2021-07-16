/* eslint-disable */ 
(function () { 
    function urlParamsToObj(query) {
        var queryObj = {};
        query.replace(/([^?&=]+)=([^?&=]+)/g, function () {
            queryObj[arguments[1]] = arguments[2];
        });  
        return queryObj;
    } 
    function objToUrlParams(queryObj) {
        var paramStr = ''; 
        $.each(queryObj, function (i) { 
            paramStr += '&' + i + '=' + queryObj[i]; 
        }); 
        return paramStr.substr(1); 
    }
    $(document).on("click", "a", function () {
        var $this = $(this); 
        var query = "__mode__=frame"; 
        var href = $this.attr("href");
        var newLink = href;
        var linkObj = {};  
        if (href.indexOf('?') !== -1) { 
            newLink = href.split("?")[0];
            linkObj =  urlParamsToObj(href.split("?")[1]);
        }   
        if (query) { 
            var queryObj = urlParamsToObj(query); 
            newLink += "?" +  objToUrlParams(Object.assign(linkObj, queryObj))
        }   
        $this.attr('href', newLink) 
        $this.attr('target', '_self')  
    }) 
})()