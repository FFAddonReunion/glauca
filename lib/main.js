'use strict';

const { Cc, Cu, Ci } = require('chrome');
const utils = require('sdk/window/utils');
const browserWindow = utils.getMostRecentBrowserWindow();
const XUL = require('./xul').Xul;
const Glauca = require('./glauca');
const gURLBar = browserWindow.gURLBar;
const tabs = require('sdk/tabs');

Cu.import('resource://gre/modules/Services.jsm');
let sheets = ['chrome://glauca/skin/fontello.css', 'chrome://glauca/skin/toolbar.css'];
let sss = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
let ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
let glauca;

function handleInput() {
  let value = gURLBar.value;
  let match = value.match(/\-\-(post|url|drop|clear)$/);
  if (!match) return;
  match = match[1];

  if (match === 'clear') gURLBar.value = '';
  else if (match === 'drop') gURLBar.value = tabs.activeTab.url;
  else if (match === 'url') glauca.sina.share(value === '--url' ? tabs.activeTab.title : value.replace('--url', ''), tabs.activeTab.url);
  else if (match === 'post') {
    glauca.sina.post(value.replace('--post', ''));
    gURLBar.value = tabs.activeTab.url;
  }

}

function handleFocus() {
  if (!glauca) return;
  let doc = browserWindow.document;
  doc.getElementById('glauca-urlbar-normal').style.display = 'none';
}

function handleBlur() {
  let doc = browserWindow.document;
  doc.getElementById('glauca-urlbar-normal').style.display = 'block';
}
exports.main = function(options) {
  function injectUI() {
    let doc = browserWindow.document;
    let urlbar = doc.getElementById('urlbar');
    let box =
    XUL.HBOX({id: 'glauca-urlbar'},
      XUL.LABEL({id: 'glauca-urlbar-noti', value: '0', style: 'display: none;'}),
      XUL.HBOX({id: 'glauca-urlbar-normal'},
        XUL.HBOX({id: 'glauca-urlbar-normalState'},
          XUL.LABEL({id: 'glauca-urlbar-author', crop: 'right'}),
          XUL.LABEL({id: 'glauca-urlbar-authorVicon', 'class': 'glauca-icon'}),
          XUL.LABEL({value: ': '}),
          XUL.LABEL({id: 'glauca-urlbar-videoIcon', 'class': 'glauca-icon'}),
          XUL.LABEL({id: 'glauca-urlbar-imageIcon', 'class': 'glauca-icon'}),
          XUL.STACK({id: 'glauca-urlbar-textcontainer'},
            XUL.LABEL({id: 'glauca-urlbar-text', value: 'Glauca 读取中...', position: 'relative'})))/*,
        XUL.IMAGE({src: 'chrome://glauca/skin/color.png', id: 'glauca-urlbar-tiny', style: 'display: none;'})),
      XUL.HBOX({id: 'glauca-urlbar-input'},
        XUL.LABEL({id: 'glauca-urlbar-smiley', 'class': 'glauca-icon', tooltip: '选择表情'}),
        XUL.LABEL({id: 'glauca-urlbar-postBtn', 'class': 'glauca-icon', tooltip: '发送微博'}))*/));
    box.build(urlbar);

    for (let i = 0, len = sheets.length; i < len; i++) {
        sss.loadAndRegisterSheet(ios.newURI(sheets[i], null, null), sss.AUTHOR_SHEET);
    }
    glauca = new Glauca();

    doc.getElementById('glauca-urlbar-normalState').addEventListener('click', glauca.mouseOnUrlbarEvent.bind(glauca));
    doc.getElementById('glauca-urlbar-noti').addEventListener('click', glauca.notiClickEvent.bind(glauca));
    // doc.getElementById('glauca-urlbar-smiley').addEventListener('click', glauca.urlbarSmiley.bind(glauca));
    // doc.getElementById('glauca-urlbar-postBtn').addEventListener('click', glauca.postBtnEvent.bind(glauca));

    //listen to awesomebar
    gURLBar.addEventListener('input', handleInput);
    gURLBar.addEventListener('focus', handleFocus);
    gURLBar.addEventListener('blur', handleBlur);
  }
  if (options.loadReason === 'install' || options.loadReason === 'startup') injectUI();
  if (options.loadReason === 'install') {
    tabs.open('http://ffaddonreunion.github.io/glauca/');
  }
};