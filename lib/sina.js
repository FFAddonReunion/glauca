'use strict';

const Request = require('sdk/request').Request;
const sps = require('sdk/simple-prefs');
const {setTimeout, clearTimeout} = require('sdk/timers');
const tabs = require('sdk/tabs');

/**
 *@description:  define a sinaUser object type containing info of a user
 */
function Sina(opts) {
  this.oauthAppKey = '3363969519';
  this.oauthAppSecret = '0d747731255b2cb2ef5eac884ce373a2';
  this.oauthVersion = '2.0';
  this.redirectUri = 'https://api.weibo.com/oauth2/default.html';
  this.oauthUri = 'https://api.weibo.com/oauth2/authorize?';
  this.FUELoauthToken = null;
  this.tweetData = [];//member type:  TweetType
  this.timeDelay = 50;
  this.emotionArray = [];
  this.tweetData = [];
  this.token = opts.token;
  this.opts = opts;
  this.currentTweet = -1;
  this.currentCha = 0;
  this.timer = null;
  this.noti = {};
}

Sina.prototype = {
  start: function() {
    if (this.timer) clearTimeout(this.timer);
    this.getTimeLine();
    this.timer = setTimeout(this.start.bind(this), 60 * 1000 * 5); //query weibo every 5 minutes
  },
  stop: function() {
    if (this.timer) clearTimeout(this.timer);
  },
  percentEncode: function percentEncode(s) {
      if (s == null) {
          return '';
      }
      if (Array.isArray(s)) {
          var e = '';
          for (var i = 0; i < s.length; ++s) {
              if (e !== '') e += '&';
              e += this.percentEncode(s[i]);
          }
          return e;
      }
      s = encodeURIComponent(s);
      // Now replace the values which encodeURIComponent doesn't do
      // encodeURIComponent ignores: - _ . ! ~ * ' ( )
      // OAuth dictates the only ones you can ignore are: - _ . ~
      // Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
      s = s.replace(/\!/g, '%21')
           .replace(/\*/g, '%2A')
           .replace(/\'/g, '%27')
           .replace(/\(/g, '%28')
           .replace(/\)/g, '%29');
      return s;
  },
  generateQueryString: function(params){
    let uParamsArray = [];
    params.map(function(param) {
      uParamsArray.push(param.join('='));
    });
    return uParamsArray.join('&');
  },
  get authorizeURL() {
    let aParams = [];
    aParams.push(['client_id', this.oauthAppKey]);
    aParams.push(['response_type', 'token']);
    aParams.push(['redirect_uri', this.redirectUri]);
    return this.oauthUri + this.generateQueryString(aParams);
  },
  htmlString: function(text){
    var t = text.replace('&', '&amp;');
    t = t.replace('<', '&lt;');
    t = t.replace('>', '&gt;');
    return t;
  },
  getTimeLine: function(sinceId, count) {
    count = (typeof count !== undefined ? count : 20);
    if (!this.token) return;
    var message = {
      method: 'get',
      action: 'https://api.weibo.com/2/statuses/home_timeline.json',
      parameters: []
    };
    //message.parameters.push(['count',count]);
    message.parameters.push(['access_token', this.token.accessToken]);
    if (sinceId) {
      message.parameters.push(['since_id', sinceId]);
    } else {
      if (this.tweetData.length > 0) message.parameters.push(['since_id', this.tweetData[0].id]);
    }
    this.sendOauthInfo(message, function(res) {
      this.addTweetInfoToList(res);
      if (this.opts.onTweetsReceived) this.opts.onTweetsReceived(res);
      this.getAlerts();
    }.bind(this), null);
  },
  sendOauthInfo: function(message, callback, formdata){
    let url = message.action + '?' + this.generateQueryString(message.parameters);
    let self = this;
    let req = Request({
      url: url,
      content: formdata,
      onComplete: function(res) {
        if (res.json) {
          res = res.json;
          if (res.error_code && (res.error_code === 21327 || res.error_code === 21332)) {//token expired
            if (self.opts.onTokenExpired) self.opts.onTokenExpired();
            callback(null);
          } else {
            callback(res);
          }
        }
      }
    });
    req[message.method]();
  },
  getAlerts: function(){
    var message = {
      method: 'get',
      action: 'https://rm.api.weibo.com/2/remind/unread_count.json',
      parameters: []
    };
    message.parameters.push(['source', this.oauthAppKey]);
    message.parameters.push(['uid', this.token.uid]);
    message.parameters.push(['access_token', this.token.accessToken]);
    this.sendOauthInfo(message, function(res) {
     if (res != null){
       let info = {
        comment: res.cmt,
        mention: res.mention_status,
        dm: res.dm
      };
      if (this.opts.onAlertReceived) this.opts.onAlertReceived(info);
      this.noti = info;
     }
    }.bind(this));
  },
  compareTweets: function(a, b) {
    let ad = new Date(a.created_at);
    let bd = new Date(b.created_at);

    if (ad.getTime() > bd.getTime()) return -1;
    else if (ad.getTime() < bd.getTime()) return 1;
    else return 0;
  },
  addTweetInfoToList: function(jsonData) {
    let statuses = jsonData.statuses;
    if (!statuses) return;
    let exlength = this.tweetData.length, self = this;
    //remove tweens already cached
    let ids = this.tweetData.map(function(tweet) {
      return tweet.id;
    });
    statuses = statuses.filter(function(status) {
      return ids.indexOf(status.id) === -1;
    });
    this.tweetData = this.tweetData.concat(statuses.map(function(status) {
      return self.analyzeTweet(status);
    }));
    this.tweetData.sort(this.compareTweets);
    if (this.tweetData.length > exlength){
      this.currentTweet = -1;
      this.currentCha = 0;
    }
  },
  analyzeTweet: function(status){
    status.retweet = (status.retweeted_status ? this.analyzeTweet(status.retweeted_status) : null);
    status.hasVideo = false;
    status.liked = false;
    let prefs = sps.prefs, self = this;
    if (prefs.display_showVideoIcon === true){
      let t = status.text;
      if (status.retweeted_status != null)t += ' ' + status.retweeted_status.text;
      let match = t.match(/(http: \/\/t.cn\/[\w]+)/gi);
      if (match && match.length>0){
        match = match.filter(function(m, index) {
        return match.indexOf(m) === index;
      });
      for (let i = 0; i < Math.ceil(match.length / 20); i++) {
        let newm = match.slice(i * 20, (i + 1) * 20);
        let urlquery = newm.join('&url_short=');
        var message = {
          method: 'get',
          action: 'https://api.weibo.com/2/short_url/info.json',
          parameters: []
        };
        message.parameters.push(['source', self.oauthAppKey]);
        message.parameters.push(['url_short', urlquery ]);
        message.parameters.push(['access_token', self.token.accessToken]);
        self.sendOauthInfo(message, function(res) {
          if (res) {
            res.urls.some(function(url) {
              if (url.type === 0) {
                status.hasVideo = true;
                return true;
              } else {
                return false;
              }
            });
          }
        });
       }
     }
    }
    return status;
  },
  getTweetById: function(id) {
    for(let i = 0, length = this.tweetData.length; i < length; i++) {
      if (this.tweetData[i].id === id) return this.tweetData[i];
    }
    return null;
  },
  comment: function(id, value) {
    let message = {
      method: 'post',
      action: 'https://api.weibo.com/2/comments/create.json',
      parameters: []
    };
    message.parameters.push(['access_token', this.token.accessToken]);
    message.parameters.push(['id', id]);
    value = this.percentEncode(value);
    let fd = 'comment=' + value + '&source=3363969519', self = this;
    this.sendOauthInfo(message, function(res) {
      if (res && !res.error) {
        if (self.opts.onCommentSent) self.opts.onCommentSent();
      }
    }, fd);
  },
  retweet: function(id, value) {
    let message = {
      method: 'post',
      action: 'https://api.weibo.com/2/statuses/repost.json',
      parameters: []
    };
    message.parameters.push(['access_token', this.token.accessToken]);
    message.parameters.push(['id', id]);
    value = this.percentEncode(value);
    let fd = 'status=' + value + '&source=3363969519';
    this.sendOauthInfo(message, function(res) {
      if (res && !res.error) {
        if (self.opts.onRetweetSent) self.opts.onRetweetSent();
      }
    }, fd);
  },
  like: function(id, liked) {
    let url = 'https://api.weibo.com/2/attitudes/' + (liked ? 'create.json' : 'destory.json');
    let message = {
      method: 'post',
      action: url,
      parameters: [
        ['access_token', this.token.accessToken],
        ['id', id]
      ]
    };
    let self = this;
    this.sendOauthInfo(message, function(res) {
      console.log(res);
      if(res && !res.error) self.getTweetById(id).liked = liked;
    }, 'source=3363969519');
  },
  fav: function(id, faved) {
    let url = 'https://api.weibo.com/2/favourites/' + (faved ? 'create.json' : 'destroy.json');
    let message = {
      method: 'post',
      action: url,
      parameters: [
        ['access_token', this.token.accessToken],
        ['id', id]
      ]
    };
    let self = this;
    this.sendOauthInfo(message, function(res) {
      if (res && !res.error) self.getTweetById(id).favourited = faved;
    });
  },
  share: function(title, url) {
    tabs.open('http://service.weibo.com/share/share.php?pic=&appkey=' + this.oauthAppKey + '&title=' + title + '&url=' + url);
  },
  post: function(text) {
    var message = {
      method: 'post',
      action: 'https://api.weibo.com/2/statuses/update.json',
      parameters: []
    };
    message.parameters.push(['access_token', this.token.accessToken]);
    text = this.percentEncode(text);
    let fd = 'status=' + text + '&source=3363969519', self = this;
    this.sendOauthInfo(message, function(res) {
      if (res && !res.error) {
        if (self.opts.onRetweetSent) self.opts.onTweetSent();
      }
    }, fd);
  },
  showWebTweet: function() {
    let tweet = this.tweetData[this.currentTweet];
    tabs.open('http://api.weibo.com/2/statuses/go?access_token=' + this.token.accessToken + '&uid=' + tweet.user.id + '&id=' + tweet.id);
  }
};

module.exports = Sina;
