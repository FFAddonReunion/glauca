const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutGlauca() { }
AboutGlauca.prototype = {
  classDescription: "about:Glauca",
  contractID: "@mozilla.org/network/protocol/about;1?what=Glauca",
  classID: Components.ID("{2b453020-c42a-11e0-962b-0800200c9a66}"),
//Note: classID here should be exactly the same as CID in chrome.manifest
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
  
  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },
  
  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let channel = ios.newChannel("chrome://glauca/content/options.xul",
                                 null, null);
//Note:?"chrome://CHROMEDIR" is like chrome://extension/content/aboutGlauca.html Read more about chrome registration: https://developer.mozilla.org/en/Chrome_Registration
  channel.originalURI = aURI;
    return channel;
  }
};
const NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutGlauca]);