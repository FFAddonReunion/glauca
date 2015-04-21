'use strict';

const { Cc, Ci } = require('chrome');
const data = require('sdk/self').data;
const Panel = require('sdk/panel').Panel;
const utils = require('sdk/window/utils');
const browserWindow = utils.getMostRecentBrowserWindow();
const document = browserWindow.document;
const sPrefs = require('sdk/simple-prefs');
const tabs = require('sdk/tabs');
const Sina = require('./sina');
const ss = require('sdk/simple-storage');
const {setTimeout, clearTimeout} = require('sdk/timers');
const URL = require('sdk/url').URL;
const _ = require('sdk/l10n').get;
const notification = require('sdk/notifications');

function Glauca() {
  //initialize the panel
  this.mainTweetPanel = Panel({
    contentURL: data.url('weibo_layout.html'),
    contentScriptFile: data.url('weibo_layout.js'),
    contentStyleFile: [URL('chrome://glauca/skin/fontello.css'), URL('chrome://glauca/skin/weibo_layout.css')],
    width: 400,
    onShow: this.pauseLoopWeibo.bind(this),
    onHide: this.loopWeibo.bind(this)
  });
  this.notiPanel = Panel({
    contentURL: data.url('noti_layout.html'),
    contentScriptFile: data.url('noti_layout.js'),
    width: 80,
    height: 80,
    onHide: this.clearNoti.bind(this)
  });
  this.mainTweetPanel.port.on('post', this.handlePanelPostMessage.bind(this));
  this.mainTweetPanel.port.on('show', this.handlePanelShowMessage.bind(this));
  let token = ss.storage.token;
  this.sina = new Sina({
    token: token,
    onTweetsReceived: this.loopWeibo.bind(this),
    onCommentSent: this.notify.bind(this, _('weibo_comment_successfully_sent')),
    onRetweetSent: this.notify.bind(this, _('weibo_retweet_successfully_sent')),
    onTweetSent: this.notify.bind(this, _('weibo_tweet_successfully_send')),
    onAlertReceived: this.showAlert.bind(this)
  });
  if (!token) {
    this.authorizeUser();
  } else {
    this.start();
  }
  sPrefs.on('authorize', this.authorizeUser.bind(this));
}

Glauca.prototype = {
  start: function() {
    this.sina.start();
    this.loopWeibo();
  },
  pauseLoopWeibo: function() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },
  mouseOnUrlbarEvent: function(e){
    if (e && e.button === 2) return;
    var panel = this.mainTweetPanel;
    var urlbar = document.getElementById('glauca-urlbar');
    panel.port.emit('show', this.sina.tweetData[this.sina.currentTweet], {
      index: this.sina.currentTweet,
      total: this.sina.tweetData.length
    });
    panel.show({}, urlbar);
  },
  notiClickEvent: function() {
    let panel = this.notiPanel;
    panel.port.emit('show', this.sina.noti);
    panel.show({}, document.getElementById('glauca-urlbar-noti'));
  },
  clearNoti: function() {
    this.showAlert({});
  },
  authorizeUser: function() {
    let url = this.sina.authorizeURL, self = this;
    function getURLParameter(uri, name) {
      return decodeURIComponent((new RegExp('[#|?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(uri) || [null, ''])[1].replace(/\+/g, '%20'))||null;
    }
    tabs.open({
      url: url,
      inBackground: false,
      onReady: function(tab) {
        if (!tab.url.startsWith(self.sina.redirectUri)) {
          return;
        } else {
          let atk = getURLParameter(tab.url, 'access_token');
          if (atk != null && atk !== '' && atk.charAt(1) === '.'){
            //a real access token
            let res = {};
            res.accessToken = atk;
            res.uid = getURLParameter(tab.url, 'uid');
            res.expiresIn = getURLParameter(tab.url, 'expires_in');
            ss.storage.token = res;
          }
          tab.close();
          self.start();
        }
      }
    });
  },
  /** Fill status in urlbar **/
  fillinUrlbar: function(index) {
    let status = this.sina.tweetData[index];
    if (!status) return;
    document.getElementById('glauca-urlbar-author').value = status.user.screen_name;
    let videoIcon = document.getElementById('glauca-urlbar-videoIcon');
    if (sPrefs.prefs.display_showVideoIcon && status.hasVideo) videoIcon.style.display = 'block';
    else videoIcon.style.display = 'none';
    let imageIcon = document.getElementById('glauca-urlbar-imageIcon');
    if (sPrefs.prefs.display_showPicIcon && status.thumbnail_pic != null) imageIcon.style.display = 'block';
    else imageIcon.style.display = 'none';
    if (status.user.verified) document.getElementById('glauca-urlbar-authorVicon').style.display = 'block';
    else document.getElementById('glauca-urlbar-authorVicon').style.display = 'none';
    let textLabel = document.getElementById('glauca-urlbar-text');
    let container = document.getElementById('glauca-urlbar-textcontainer');
    textLabel.value = status.text;
    let textLength = this.getTextLength(status.text);
    let availableLength = sPrefs.prefs.display_weiboLength;
    let autofit = sPrefs.prefs.display_autofit;
    let hasAsia = (textLength !== status.text.length);
    if (hasAsia) textLength /= 2;
    else availableLength *= 2;
    if (autofit) container.style.width = (Math.min(textLength, availableLength) + 0.5) + 'em';
  },
  loopWeibo: function() {
    if (this.timer) clearTimeout(this.timer);
    if (this.sina && this.sina.tweetData.length > 0) {
      this.sina.currentTweet++;
      this.fillinUrlbar(this.sina.currentTweet);
      if (this.sina.currentTweet >= this.sina.tweetData.length) {
        this.sina.currentTweet = 0;
      }
    }
    this.timer = setTimeout(this.loopWeibo.bind(this), 5000);
  },
  getTextLength: function(text) {
    let length = 0;
    for (let i = 0; i < text.length; i++) {
      length += (text.charCodeAt(i) > 255 ? 2 : 1);
    }
    return length;
  },
  handlePanelPostMessage: function(d) {
    this.sina[d.type](d.id, d.value);
  },
  handlePanelShowMessage: function(type) {
    if (type === 'next') {
      this.loopWeibo();
      this.mouseOnUrlbarEvent();
    } else if (type === 'prev') {
      this.sina.currentTweet -= 2;
      this.loopWeibo();
      this.mouseOnUrlbarEvent();
    } else if (type === 'web') {
      this.sina.showWebTweet();
    }
  },
  notify: function(text) {
    notification.notify({
      title: text,
      iconURL: data.url('icon.png')
    });
  },
  showAlert: function(info) {
    let total = 0;
    for (let key in info) { total += (info[key] || 0); }
    let notiNode = document.getElementById('glauca-urlbar-noti');
    if (total === 0) {
      notiNode.style.display = 'none';
    } else {
      notiNode.value = total;
      notiNode.style.display = 'block';
    }
  }
};

module.exports = Glauca;