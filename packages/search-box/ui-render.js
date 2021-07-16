// Vomnibar.activate();
 
var UIRender = {
  ownerPagePort: null,
  handleMessage: null,

  portOpen (ownerPagePort) {
    this.ownerPagePort = ownerPagePort;
    this.ownerPagePort.onmessage = event => {
      if (this.handleMessage) { return this.handleMessage(event); }
    };
    this.registerIsReady();
  },

  registerHandler (handleMessage) {
    this.handleMessage = handleMessage;
  },

  postMessage (message) {
    if (this.ownerPagePort) { this.ownerPagePort.postMessage(message); }
  },

  hide () { this.postMessage("hide"); },

  // We require both that the DOM is ready and that the port has been opened before the UI component is ready.
  // These events can happen in either order.  We count them, and notify the content script when we've seen
  // both.
  registerIsReady: (function () {
    let uiComponentIsReadyCount;
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", () => UIRender.registerIsReady());
      uiComponentIsReadyCount = 0;
    } else {
      uiComponentIsReadyCount = 1;
    }

    return function () {
      if (++uiComponentIsReadyCount === 2) {
        if (window.frameId != null) { this.postMessage({name: "setIframeFrameId", iframeFrameId: window.frameId}); }
        this.postMessage("uiComponentIsReady");
      }
    };
  })()
};

var registerPort = function (event) {
  chrome.storage.local.get("vimiumSecret", function ({vimiumSecret: secret}) {
    if ((event.source !== window.parent) || (event.data !== secret)) { return; }
    UIRender.portOpen(event.ports[0]);
    window.removeEventListener("message", registerPort);
  });
};

window.addEventListener("message", registerPort);

global.UIRender = UIRender;
