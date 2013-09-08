glauca.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-glauca").hidden = gContextMenu.onImage;
};

glauca.overlay={
    urlbarFocusEvent:function(){
        document.getElementById('glauca-urlbar-normal').style.display='none';
        document.getElementById('glauca-urlbar-input').style.display='block';
		glauca.urlbarOrigText=document.getElementById('urlbar').value;
		if(glauca.urlbarText==null)glauca.urlbarText=glauca.urlbarOrigText;
    },
    urlbarBlurEvent:function(){
        document.getElementById('glauca-urlbar-normal').style.display='block';
        document.getElementById('glauca-urlbar-input').style.display='none';
	var urlbar=document.getElementById('urlbar');
	glauca.urlbarText=urlbar.value;
	urlbar.value=glauca.urlbarOrigText?glauca.urlbarOrigText:"";
    },
    keyupEvent:function(e){
      var keyCode = null;
      if (e) {
	keyCode = e.keyCode;
      }
      if (!e || (keyCode != e.DOM_VK_RETURN && keyCode != 27 && keyCode != 117 && keyCode != 76 && keyCode != 68 && keyCode != 17 && keyCode != 18)){
	var status=document.getElementById('urlbar').value;
	if(status&&status.indexOf('--')!=-1){
	  if(status.indexOf('--post')!=-1){
	    var tweet=status.split('--post')[0];
	    glauca.sina.post.postTextTweet(tweet);
	    document.getElementById('urlbar').value='';
	  }
	  if(status.indexOf('--clear')!=-1){
	    document.getElementById('urlbar').value='';
	  }
	  if(status.indexOf('--url')!=-1){
	    var tweet=status.split('--url')[0]+window.top.getBrowser().selectedBrowser.contentWindow.location.href+" ";
	    document.getElementById('urlbar').value=tweet;
	  }
	  if(status.indexOf('--drop')!=-1){
	    document.getElementById('urlbar').value=glauca.urlbarOrigText;
	  }
	}
      }
    },
    postBtnEvent:function(){
        var text=document.getElementById('urlbar').value;
        glauca.sina.post.postTextTweet(text);
    },
    showPopup: function(str) {
        try {
            Components.classes['@mozilla.org/alerts-service;1'].
            getService(Components.interfaces.nsIAlertsService).
            showAlertNotification(null, 'Glauca', str==null?'succeed!':str, false, '', null);
        } catch (e) {
            // prevents runtime error on platforms that don't implement nsIAlertsService
        }
    },
    mouseOnUrlbarEvent:function(event){
        if(event!=null&&event.button==2)return;
        var panel=document.getElementById("glauca-panel");
        var urlbar=document.getElementById("glauca-urlbar-textcontainer");
        glauca.sina.display.fillinPanel(panel);
        panel.openPopup(urlbar,"after_end");
        glauca.sina.display.stopTimer();
        panel.focus();
    },
    panelMouseOutEvent:function(event){
       glauca.sina.display.startTimer();
    },
    mouseScrollEvent:function(event){
        if(event.detail<0)glauca.sina.display.displayPrev();
        else glauca.sina.display.displayNext();
    },
    replyBtnClickEvent:function(){
        glauca.sina.reply.openReplyPanel();
        glauca.cons.mw.window.document.getElementById('glauca-replySendBtn').onclick=glauca.overlay.replaySendBtnEvent;
    },
    replyCancelBtnClickEvent:function(){
        glauca.cons.mw.window.document.getElementById('glauca-replyBox').value='';
        glauca.cons.mw.window.document.getElementById('glauca-replyPanel').style.display="none";
    },
    replaySendBtnEvent:function(){
		glauca.cons.mw.window.document.getElementById('glauca-replyBox').value='';
        glauca.cons.mw.window.document.getElementById('glauca-replyPanel').style.display="none";
        glauca.sina.reply.sendReply();
    },
    emotionsButtonEvent:function(event){
        glauca.sina.emotions.openPanelEvent('glauca-replyBox',event.currentTarget);
    },
    rtBtnClickEvent:function(){
        glauca.sina.reply.openReplyPanel(true);
        glauca.cons.mw.window.document.getElementById('glauca-replySendBtn').onclick=glauca.overlay.rtSendBtnEvent;
    },
	starBtnClickEvent:function(){
	},
    rtSendBtnEvent:function(){
        glauca.sina.reply.sendRt();
    },
    hidePop:function(){
	glauca.cons.mw.window.document.getElementById("glauca-replyPanel").style.display='none';
        glauca.cons.mw.window.document.getElementById('glauca-panel').hidePopup();
	glauca.sina.display.startTimer();
    },
    urlbarSmiley:function(event){
        glauca.sina.emotions.openPanelEvent('urlbar',event.currentTarget);
    },
    tweetImageClickEvent:function(event){
        var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
		glauca.sina.display.displayTweetImage(cTweet.original_pic);
		glauca.overlay.hidePop();
    },
    rtImageClickEvent:function(event){
        var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
		glauca.sina.display.displayTweetImage(cTweet.retweet.original_pic);
		glauca.overlay.hidePop();
    },
    notiClickEvent:function(event){
      event.stopPropagation();
      var panel=document.getElementById('glauca-notificationPanel');
      panel.openPopup(event.target,"after_start");
    },
    urlbarContextEvent:function(event){
        var ttt=document.getElementById('glauca-transformToTiny');
        var ttn=document.getElementById('glauca-transformToNormal');
        if(document.getElementById('glauca-urlbar-normalState').style.display=="none"){
            ttt.hidden=true;
            ttn.hidden=false;
        }
        else{
            ttt.hidden=false;
            ttn.hidden=true;
        }
    },
    tinyMouseEvent:function(event){
        if(event!=null&&event.button==2)return;
        var panel=document.getElementById("glauca-panel");
        var urlbar=document.getElementById("glauca-urlbar-tiny");
        panel.width='350px'
        glauca.sina.display.fillinPanel(panel);
        panel.openPopup(urlbar,"after_start");
        glauca.sina.display.stopTimer();
        panel.focus();
    },
    transformTT:function(){
        var normal=document.getElementById("glauca-urlbar-normalState");
        var tiny=document.getElementById("glauca-urlbar-tiny");
        normal.style.display="none";
        tiny.style.display="block";
    },
    transformTN:function(){
        var normal=document.getElementById("glauca-urlbar-normalState");
        var tiny=document.getElementById("glauca-urlbar-tiny");
        normal.style.display="block";
        tiny.style.display="none";
    }
};
window.addEventListener('load',glauca.init,false);
