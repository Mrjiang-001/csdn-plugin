/* eslint-disable */
var contentPort = null;

if(!window.contentPort) {
    contentPort = chrome.runtime.connect({
        name: 'content-script'
    })
}

// contentPort.onMessage.addListener(sendMessageToBackend) 
contentPort.onDisconnect.addListener(handleDisconnect)
function handleDisconnect() {
    contentPort.postMessage({
        event: 'shutdown'
    })
}

window.contentPort = contentPort;

// 初始化元素选择器
initBlockElement(window.contentPort)
// 浏览模式功能初始化
initSPM_HTML(window.contentPort)

// window.postMessageToBackend = function(message){
//     contentPort.postMessage({
//         event: message.name,
//         payload: payload
//     }, '*')
// } 
