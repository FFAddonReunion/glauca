/**
 *@description: define a sinaUser object type containing info of a user
 */
glauca.sina={
    FUELoauthToken:null,
    tweetData:[],//member type: TweetType
    timeDelay:50,
    emotionArray:[],
	htmlString:function(text){
		var t=text.replace('&','&amp;');
		t=t.replace('<','&lt;')
		t=t.replace('>','&gt;');
		return t;
	},
    init:function(){
        Application.storage.events.addListener('change',this.timeline.onOauthTokenChanged,false);
		this.display.init();
		
		//observe change of rollTimeDelay pref
		//more info: https://developer.mozilla.org/en/Code_snippets/Preferences#Using_preference_observers
		var rollTweetTimeObserver = {
			register: function() {
			glauca.options.prefs.QueryInterface(Components.interfaces.nsIPrefBranch);
			glauca.options.prefs.addObserver('', this, false);
			},
			unregister: function() {
			if (!this._branch) return;
			this._branch.removeObserver("", this);
			},

			observe: function(aSubject, aTopic, aData) {
			if (aTopic != "nsPref:changed") return;
			// aSubject is the nsIPrefBranch we're observing (after appropriate QI)
			// aData is the name of the pref that's been changed (relative to aSubject)
			switch (aData) {
			case "rollTimeDelay":
				glauca.sina.timeDelay=glauca.options.prefs.getIntPref('rollTimeDelay');
				glauca.sina.display.adjustTimer();
				// extensions.myextension.pref1 was changed
				break;
			}
			}
		}
		rollTweetTimeObserver.register();
    },
	
    timeline: {
		tweetData:[],
		getTimeLine: function(since_id,count) {
			//Ref: http://stackoverflow.com/questions/894860/how-do-i-make-a-default-value-for-a-parameter-to-a-javascript-function
			count = typeof(count) !== undefined ? count : 20;
			if (glauca.sina.FUELoauthToken == null || glauca.sina.FUELoauthToken.access_token == '' ) return;
			var message = {
			method: 'GET',
			action: 'https://api.weibo.com/2/statuses/friends_timeline.json',
			parameters: []
			};
			//message.parameters.push(['count',count]);
			message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
			if(since_id)message.parameters.push(['since_id', since_id]);
			else{
				if(glauca.sina.tweetData.length!=0)message.parameters.push(['since_id', glauca.sina.tweetData[0].id]);
			}
			glauca.sinaOauth.sendOauthInfo(message, function(req) {
				if(req!=null)glauca.sina.timeline.addTweetInfoToList(JSON.parse(req.responseText) );
			},null);
			glauca.sina.timeline.getAlerts();
		},
		getAlerts:function(){
			var message = {
			method: 'GET',
			action: 'https://rm.api.weibo.com/2/remind/unread_count.json',
			parameters: []
			};
			message.parameters.push(['source', glauca.sinaOauth.oauthAppKey]);
			message.parameters.push(['uid', glauca.sina.FUELoauthToken.uid]);
			message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
			glauca.sinaOauth.sendOauthInfo(message, function(req) {
				if(req!=null){
					var rJson=JSON.parse(req.responseText);
					var info={comments:'',mention:'',dm:'',fans:''};
					info.comments=rJson['cmt'];
					info.mention=rJson['mention_status'];
					info.dm=rJson['dm'];
					info.fans=rJson['follower'];
					glauca.sina.display.updateNoti(info);
				}
			});
		},
		onOauthTokenChanged: function() {
			if(glauca.sina.FUELoauthToken!=null&&glauca.sina.FUELoauthToken.access_token==Application.storage.get('glauca_oauth_token_data', {
				access_token:'',
				uid:'',
				expires_in:''
			}).access_token)return;
			glauca.sina.FUELoauthToken = Application.storage.get('glauca_oauth_token_data', {
				access_token:'',
				uid:'',
				expires_in:''
			});
			
			glauca.sina.tweetData=[];
			glauca.sina.timeline.getTimeLine();
			glauca.sina.emotions.init();
			//do something: immediately update informations
		},
		/**
		 *@description analyze a tweet xml element
		 *@returns TweetType object
		 */
		pushTweetToList: function(status) {
			if(glauca.sina.tweetData==null)return;
			for(var i in glauca.sina.tweetData){
				if(glauca.sina.tweetData[i]["id"]==status["id"])return;
			}
			glauca.sina.tweetData.push(glauca.sina.timeline.analyzeTweet(status));
		},
		analyzeTweet:function(status){
			status["retweet"] = status['retweeted_status']?glauca.sina.timeline.analyzeTweet(status['retweeted_status']):null;
			glauca.sina.image.getImage(status.thumbnail_pic,function(src){status['thumbnail_pic_url']=src});
			glauca.sina.image.getImage(status.user.profile_image_url,function(src){status.user['profile_image_url']=src;});
			status.hasVideo=false;
			
			var prefs = Components.classes["@mozilla.org/preferences-service;1"]
								  .getService(Components.interfaces.nsIPrefService).getBranch("extensions.glauca.");
			if(prefs.getBoolPref("display-showVideoIcon")==true){
				var t=status["text"];
				if(status.retweeted_status !=null)t+=" "+status.retweeted_status.text;
				var urlMatch=/(http:\/\/t.cn\/[\w]+)/g.exec(t);
				if(typeof(urlMatch)!=undefined&&urlMatch!=null&&urlMatch.length>0){
					var urls=[];
					for(var i=0;i<urlMatch.length;i++){
						var s=urlMatch[i].trim();
						if(urls.indexOf(s)==-1)urls.push(s);
					}
					for(var i=0;i<urls.length;i++){
						var message = {
							method: 'GET',
							action: 'https://api.weibo.com/2/short_url/info.json',
							parameters: []
						};
						message.parameters.push(['source', glauca.sinaOauth.oauthAppKey]);
						message.parameters.push(['url_short', urls[i] ]);
						message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
						glauca.sinaOauth.sendOauthInfo(message, function(req) {
							if(req!=null){
								var obj=JSON.parse(req.response);
								if(obj.urls[0].type==1){
									status.hasVideo=true;
								}
							}
						});
					}
				}
			}
			
			return status;
	    },
		/**
		 *@description: handle data in a tweet xml and add them into the list
		 */
		addTweetInfoToList: function(jsonData) {
			var statuses = jsonData['statuses'];
			var exlength=glauca.sina.tweetData.length;
			for (var i = 0; i < statuses.length; i++) {
				var status = statuses[i];
				this.pushTweetToList(status);
			}
			var sortfn=function(a,b){
			    var ad=new Date(a.created_at);
			    var bd=new Date(b.created_at);
			    
			    if(ad.getTime()>bd.getTime())return -1;
			    else if(ad.getTime()<bd.getTime())return 1;
			    else return 0;
			}
			glauca.sina.tweetData.sort(sortfn);
			if(glauca.sina.tweetData.length>exlength){
				glauca.sina.display.currentTweet=0;
				glauca.sina.display.currentCha=0;
		    }
		}
    },
    display:{
		currentTweet:0,//current tweet in timeLine
		currentCha:0,//current character in a tweet
		timer:null,
		tWidth:300,
		tSpeed:-2,
		updateCounter:0,
		aw:0,
		event: {
			observe: function(subject, topic, data) {
			if (glauca.sina.tweetData.length == 0) return;
			var t = glauca.sina.display;
			if (t.currentTweet >= glauca.sina.tweetData.length) {
				t.currentTweet -= glauca.sina.tweetData.length;
			} else {
				t.urlText();
			}
			}
		},
		/**
		 *@description add a timer to roll the tweets,
		 *more info on: https://developer.mozilla.org/en/nsITimer
		 */
		init: function() {
			glauca.sina.display.adjustUI();
			glauca.sina.display.timer= Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			glauca.sina.display.startTimer();
		},
		adjustUI:function(){
			
			var prefs = Components.classes["@mozilla.org/preferences-service;1"]
								  .getService(Components.interfaces.nsIPrefService).getBranch("extensions.glauca.");
			//adjust the author name length
			var nickLength=prefs.getIntPref("style-nickLength");
			var nickPanel=glauca.cons.mw.window.document.getElementById("glauca-urlbar-author");
			if(parseInt(nickPanel.style.width)>nickLength){
				nickPanel.style.width=nickLength+"em";
				//glauca.cons.mw.window.document.getElementById("glauca-urlbar-author").style.width=nickLength+2+"em";
			}
			nickPanel.style.maxWidth=nickLength+"em";
			//adjust the status length
			//remember that this only gives a max length of the status bar,the real length will also be affected by the autoWidth pref
			var statusLength=prefs.getIntPref("style-statusLength");
			var autoWidth=prefs.getBoolPref("display-autoWidth");
			var statusPanel=glauca.cons.mw.window.document.getElementById("glauca-urlbar-textcontainer");
			statusPanel.style.maxWidth=statusLength+"em";
			if((!autoWidth)||parseInt(statusPanel.style.width)>statusLength)statusPanel.style.width=statusLength+"em";
			
			//we need to set the roll speed
			/*
			var delay=prefs.getIntPref("style-rollDelay");
			var speed=prefs.getIntPref("style-rollSpeed");
			var label=glauca.cons.mw.window.document.getElementById("glauca-urlbar-text");
			var duration=(parseInt(glauca.cons.mw.window.document.getElementById("glauca-urlbar-textcontainer").style.width)-label.aw)/speed*2;
			
			label.style.MozTransition="none";
			label.style.marginLeft=0;
			if(typeof(label.aw)==undefined||label.aw==null)label.aw=glauca.utils.CHlength(label.value)/2;
			label.style.MozTransition ="margin-left "+duration+"s "+delay+"s";
			label.style.marginLeft=parseInt(glauca.cons.mw.window.document.getElementById("glauca-urlbar-textcontainer").style.width)-label.aw+"em";
			*/
		},
		adjustTimer:function(value){
			glauca.sina.display.timer.delay=glauca.sina.timeDelay;
		},
		fillinPanel:function(panel,ifNew){
			var _new;
			if(typeof ifNew==="boolean")_new=ifNew;
			else _new=true;
			
			var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
			if(cTweet==null||typeof(cTweet)==undefined)return;
			var mw=glauca.cons.mw;
			if(panel==null)panel=mw.window.document.getElementById('glauca-panel');
			var urlbar=mw.window.document.getElementById("glauca-urlbar-normal");
			var avatar=mw.window.document.getElementById('glauca-panel-authorImage');
			var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
			var des=mw.window.document.getElementById('glauca-tweetText');
			var rt=mw.window.document.getElementById('glauca-retweetBody');
			
			if(_new){//only if the panel is newly shown we need to update the panel style
				var width=400;
				mw.window.document.getElementById("glauca-replyPanel").style.display="none";
				mw.window.document.getElementById("glauca-replyBox").value="";
				mw.window.document.getElementById("glauca-panel-body").style.width=width-10+"px";
				if(parseInt(panel.clientWidth)==0)return;
				
				des.style.width=width-50+'px';
				mw.window.document.getElementById('glauca-retweetText').style.width="330px";
			}
			
			if(cTweet.user.profile_image_url!=null){
				avatar.src=cTweet.user.profile_image_url;
				avatar.onclick=function(){glauca.opentab("http://weibo.com/n/"+cTweet.user.screen_name);};
			}
			if(cTweet.thumbnail_pic_url!=null){
				mw.window.document.getElementById('glauca-tweetImage').src=cTweet.thumbnail_pic_url;
				mw.window.document.getElementById('glauca-tweetImage').style.display="block";
			}
			else mw.window.document.getElementById('glauca-tweetImage').style.display="none";
			
			
			glauca.sina.display.generateRichText(cTweet.text,'glauca-tweetText',cTweet.text.length<=60?true:false);
			mw.window.document.getElementById("glauca-author-name").value=cTweet.user.screen_name;
			mw.window.document.getElementById("glauca-author-name").onclick=function(){glauca.opentab("http://api.weibo.com/2/statuses/go?access_token="+glauca.sina.FUELoauthToken.access_token+"&uid="+cTweet.user.id+"&id="+cTweet.id);};
			
			if(cTweet.retweet!=null){
				glauca.sina.display.generateRichText(cTweet.retweet.text,'glauca-retweetText');
				
				mw.window.document.getElementById('glauca-panel-retweetAuthorName').value=cTweet.retweet.user.screen_name;
				mw.window.document.getElementById('glauca-panel-retweetAuthorName').onclick=function(){glauca.opentab("http://api.weibo.com/2/statuses/go?access_token="+glauca.sina.FUELoauthToken.access_token+"&uid="+cTweet.retweet.user.id+"&id="+cTweet.retweet.id);};
				if(cTweet.retweet.user.profile_image_url!=null){
					mw.window.document.getElementById('glauca-panel-retweetAuthorImage').src=cTweet.retweet.user.profile_image_url;
					mw.window.document.getElementById('glauca-panel-retweetAuthorImage').onclick=function(){glauca.opentab("http://weibo.com/n/"+cTweet.retweet.user.screen_name);};
				}
				if(cTweet.retweet.thumbnail_pic_url!=null){
					mw.window.document.getElementById('glauca-retweetImage').src=cTweet.retweet.thumbnail_pic_url;
					mw.window.document.getElementById('glauca-retweetImage').style.display="block";
				}
				else mw.window.document.getElementById('glauca-retweetImage').style.display="none";
				rt.style.display="block";
			}
			else rt.style.display="none";
			var source=cTweet.source;
			if(source!=null&&source!=''){
				//source=source.replace("<a href", "<html:a href");
				var dp=new DOMParser();
				var element=mw.window.document.getElementById('glauca-tweetInfo-postedFrom');
				while(element.lastChild)element.removeChild(element.lastChild);
				element.appendChild(dp.parseFromString(source, "text/xml").documentElement);
			}
			
			//alert(cTweet["created_at"]);
			var timestamp=cTweet.created_at;
			var date=new Date(timestamp);
			var currentDate=new Date();
			var timeLabel=mw.window.document.getElementById('glauca-tweetInfo-timestamp');
			var sb=document.getElementById("glauca-strings");
			
			if(Date.now()-date.getTime()<60000){//in a minute
				timeLabel.value=parseInt( (Date.now()-date.getTime())/1000)+sb.getString("glaucaPanel.time.second");
			}
			else if(Date.now()-date.getTime()<3600000){//in 1 hour
				timeLabel.value=parseInt( (Date.now()-date.getTime())/60000)+sb.getString("glaucaPanel.time.minute");
			}
			else if(Date.now()-date.getTime()<10800000){//in 3 hours
				timeLabel.value=parseInt( (Date.now()-date.getTime())/3600000)+sb.getString("glaucaPanel.time.hour");
			}
			else if(currentDate.getMonth()==date.getMonth()&&currentDate.getYear()==date.getYear()&&currentDate.getDate()-date.getDate()<3){
				var day='';
				var ex=currentDate.getDate()-date.getDate();
				if(ex==0)day=sb.getString("glaucaPanel.time.today");
				else if (ex==1)day=sb.getString("glaucaPanel.time.yesterday");
				else if (ex==2)day=sb.getString("glaucaPanel.time.twodays");
				timeLabel.value=day+" "+date.toLocaleTimeString();
			}
			else timeLabel.value=date.toLocaleDateString();
			mw.window.document.getElementById('glauca-tweetInfo-index').value=glauca.sina.display.currentTweet+1+"/"+glauca.sina.tweetData.length;
			
		},
		/**
		 *@param {String}text the entire text to show
		 *@param {String}eId ID of the DOM element to show the text
		 *@description analyze a tweet text and transfrom @ and ## and urls to links.
		 *Then add the html element to the eId DOM element
		 */
		generateRichText: function(text,eId,flag) {
			function HtmlEncode(s)
			{
			  var el = document.createElement("div");
			  el.innerText = el.textContent = s;
			  s = el.innerHTML;
			  return s;
			};
			//we need this lib to handle & in a text, more info on:
			//https://developer.mozilla.org/en/MozITXTToHTMLConv
			var ios = Components.classes["@mozilla.org/txttohtmlconv;1"]
						.getService(Components.interfaces.mozITXTToHTMLConv);
			var p = 0,length = text.length;
			text=text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
			var container = glauca.cons.mw.window.document.getElementById(eId);
			while (container.hasChildNodes()) {
			container.removeChild(container.firstChild);
			}
			var doc = glauca.cons.mw.window.document;
			
			var result=["p",{style:'text-shadow: 1px 1px 1px gray;font-family:"Microsoft YaHei";'},[]];
			function generateJson(arr,t){
				if(t=="")return;
				var nameMatch=/(\#[^\#|.]+\#)/g.exec(t);
				if(typeof(nameMatch)!=undefined&&nameMatch!=null&&nameMatch.length>0){
					generateJson(arr,t.substring(0,nameMatch.index));
					var tmp=["a",{style:'cursor:pointer;color:green;',onclick:function(){glauca.opentab("http://weibo.com/k/"+nameMatch[0].replace(/\#/g,""))}},[]];
					var textNode=["textNode",{value:glauca.sina.htmlString(nameMatch[0])}];
					tmp[2].push(textNode);
					arr[2].push(tmp);
					generateJson(arr,t.substring(nameMatch.index+nameMatch[0].length,t.length));
				}
				else{
					var atMatch=/(\@[\u4e00-\u9fa5A-Za-z0-9_]+)/g.exec(t);
					if(typeof(atMatch)!=undefined&&atMatch!=null&&atMatch.length>0){
						generateJson(arr,t.substring(0,atMatch.index));
						var tmp=["a",{style:'cursor:pointer;color:green;',onclick:function(){glauca.opentab("http://weibo.com/n/"+atMatch[0].replace(/\@/g,""));}},[]];
						var textNode=["textNode",{value:glauca.sina.htmlString(atMatch[0])}];
						tmp[2].push(textNode);
						arr[2].push(tmp);
						generateJson(arr,t.substring(atMatch.index+atMatch[0].length,t.length));
					}
					else{
						var urlMatch=/(http:\/\/t.cn\/[\w]+)/g.exec(t);
						if(typeof(urlMatch)!=undefined&&urlMatch!=null&&urlMatch.length>0){
							generateJson(arr,t.substring(0,urlMatch.index));
							var tmp=["a",{style:'cursor:pointer;color:green;',onclick:function(){glauca.opentab(urlMatch[0]);}},[]];
							var textNode=["textNode",{value:glauca.sina.htmlString(urlMatch[0])}];
							tmp[2].push(textNode);
							arr[2].push(tmp);
							generateJson(arr,t.substring(urlMatch.index+urlMatch[0].length,t.length));
						}
						else{
							//all match failed
							var emoMatch=/(\[.+?\])/ig.exec(t);
							if(emoMatch!=null){
								for(var i in emoMatch){
									var s=emoMatch[i];
									var index=glauca.sina.emotions.emotionBase.tags.indexOf(s);
									var tIndex=t.indexOf(s);
									Components.utils.reportError("Glauca:get Emotion "+s+" at index "+tIndex+" str length: "+s.length);
									if(index!=-1){
										arr[2].push(["textNode",{value:t.substring(0,tIndex)}]);
										arr[2].push(["img",{src:glauca.sina.emotions.emotionBase.urls[index],width:"20px",height:"20px"}]);
										t=t.substring(tIndex+s.length,t.length);
									}
								}
							}
							arr[2].push(["textNode",{value:t}]);
						}
					}
				}
			}
			if(flag)text+="                                                           ";
			generateJson(result,text);
			container.appendChild(glauca.cons.jsonToDom(result,doc,{}));
			//var dp=new DOMParser();
			//container.appendChild(dp.parseFromString(text, "text/xml").documentElement);
		},
		stopTimer:function(){
			glauca.sina.display.timer.cancel();
		},
		startTimer:function(){
			const TYPE_REPEATING_PRECISE = Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE;
			glauca.sina.display.timer.init(glauca.sina.display.event, glauca.sina.timeDelay, TYPE_REPEATING_PRECISE);
		},
		syncUI:function(style){
			glauca.sina.display.currentCha=0;
			glauca.sina.display.urlText(style);
			glauca.cons.mw.window.document.getElementById('glauca-replyBox').value='';
			glauca.cons.mw.window.document.getElementById('glauca-replyPanel').style.display="none";
			glauca.sina.display.fillinPanel(null,false);
		},
		displayNext:function(){
			glauca.sina.display.currentTweet++;
			if(glauca.sina.display.currentTweet>=glauca.sina.tweetData.length)glauca.sina.display.currentTweet=0;
			glauca.sina.display.syncUI("next");
		},
		displayPrev:function(){
			glauca.sina.display.currentTweet--;
			if(glauca.sina.display.currentTweet<0)glauca.sina.display.currentTweet=glauca.sina.tweetData.length-1;
			glauca.sina.display.syncUI("prev");
		},
		urlText: function(style) {
			var mw=glauca.cons.mw;
			var t=glauca.sina.display;
			var cTweet = glauca.sina.tweetData[t.currentTweet];
			var mq = mw.window.document.getElementById('glauca-urlbar-text');
			var te = mw.window.document.getElementById('glauca-urlbar-text');
			var prefs = Components.classes["@mozilla.org/preferences-service;1"]
								  .getService(Components.interfaces.nsIPrefService).getBranch("extensions.glauca.");
			var showMine=prefs.getBoolPref("filter-showMine");
			var autoWidth=prefs.getBoolPref("display-autoWidth");
			var showThisFlag=true;
			if(showMine==false){
				while(cTweet.user.id==glauca.sina.FUELoauthToken.uid){
					if(style=="next")t.currentTweet++;
					else t.currentTweet--;
					cTweet = glauca.sina.tweetData[t.currentTweet];
				}
			}
			if (t.currentCha == 0) {
				//read preferences
				var ifShowImageIcon=prefs.getBoolPref("display-showPicIcon");
				var ifShowVideoIcon=prefs.getBoolPref("display-showVideoIcon");
				
				var nickpanel=mw.window.document.getElementById('glauca-urlbar-author');
				var statuspanel=mw.window.document.getElementById("glauca-urlbar-textcontainer");
				var imageIcon=mw.window.document.getElementById("glauca-urlbar-imageIcon");
				var videoIcon=mw.window.document.getElementById("glauca-urlbar-videoIcon");
				nickpanel.value = cTweet.user.screen_name;
				var ss = cTweet.text;
				//check if we need to change ss(when the tweet is an rt)
				if(cTweet.retweet!=null){
					var showrt=prefs.getCharPref("filter-rt");
					if(showrt=="showNone")ss=ss.split("//@")[0];
					else if(showrt=="showOne"){
						var arr=ss.split("//@");
						if(arr.length>1)ss=arr[0]+"//@"+arr[arr.length-1];
					}
				}
				var nicklength=glauca.utils.CHlength(nickpanel.value);
				//if(nicklength*2==nickpanel.value.length)nicklength*=2;
				var statusLength=glauca.utils.CHlength(ss);
				//if(statusLength*2==ss.length)statusLength*=2;
				if(autoWidth&& (parseInt(statuspanel.style.width)>statusLength||statusLength<parseInt(statuspanel.style.maxWidth)))statuspanel.style.width=statusLength+"em";
				else statuspanel.style.width=statuspanel.style.maxWidth;
				if( nicklength<parseInt(nickpanel.style.maxWidth))nickpanel.style.width=nicklength+"em";
				else nickpanel.style.width=nickpanel.style.maxWidth;
				//check the verified state
				if (cTweet.user.verified) mw.window.document.getElementById('glauca-urlbar-authorVicon').style.display = 'block';
				else mw.window.document.getElementById('glauca-urlbar-authorVicon').style.display = 'none';
				t.currentCha++;
				var label=te;
				label.style.MozTransition="none";
				label.style.marginLeft = "0px";
				
				//check if need to show iamge and video icon
				
				
				//we need to set the roll speed
				/*
				var delay=prefs.getIntPref("style-rollDelay");
				var speed=prefs.getIntPref("style-rollSpeed");
				
				var duration=(parseInt(mw.window.document.getElementById("glauca-urlbar-textcontainer").style.width)-label.aw)/speed*2;
				label.aw=statusLength;
				label.style.MozTransition ="margin-left "+duration+"s "+delay+"s";
				label.style.marginLeft=parseInt(mw.window.document.getElementById("glauca-urlbar-textcontainer").style.width)-label.aw+"em";
				*/
				te.value = ss;
				//a label's width is its preferred width instead of actual width. What's more , it's zero in this situation
				//more info: http://stackoverflow.com/questions/1997419/how-do-i-retreive-an-xul-elements-actual-width-and-height
				t.aw = parseInt(te.getBoundingClientRect().width);
				if(ifShowImageIcon&&(cTweet.thumbnail_pic!=null||(cTweet.retweet!=null&&cTweet.retweet.thumbnail_pic!=null)))imageIcon.style.display="block";
				else imageIcon.style.display="none";
				if(ifShowVideoIcon&&cTweet.hasVideo)videoIcon.style.display="block";
				else videoIcon.style.display="none";
			}
			if (t.currentCha > 80) {
				mq.style.marginLeft = (parseInt(mq.style.marginLeft) > (t.tWidth - t.aw)) ? mq.style.marginLeft = parseInt(mq.style.marginLeft) + t.tSpeed + 'px' : mq.style.marginLeft;
			}
			if (t.currentCha < 240) t.currentCha++;
			else {
				t.currentTweet++;
				t.updateCounter++;
				t.currentCha = 0;
			}
			if (t.updateCounter == 7) {
			t.updateCounter = 0;
			var id = glauca.sina.tweetData[0].id;
			glauca.sina.timeline.getTimeLine(id);
			}
		},
		updateNoti:function(obj){
			var panel=document.getElementById('glauca-notificationPanel');
			panel.comment=obj.comments;
			panel.mention=obj.mention;
			panel.dm=obj.dm;
			panel.fans=obj.fans;
			var noti=document.getElementById('glauca-urlbar-noti');
			noti.value=parseInt(obj.comments)+parseInt(obj.mention)+parseInt(obj.dm)+parseInt(obj.fans);
			if(noti.value==0)noti.style.display="none";
			else noti.style.display="block";
		},
		displayTweetImage:function(imgUrl){
			function openAndReuseOneTabPerAttribute(attrName, url) {
				  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									 .getService(Components.interfaces.nsIWindowMediator);
				  for (var found = false, index = 0, tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
					   index < tabbrowser.tabContainer.childNodes.length && !found;
					   index++) {
				 
					// Get the next tab
					var currentTab = tabbrowser.tabContainer.childNodes[index];
				   
					// Does this tab contain our custom attribute?
					if (currentTab.hasAttribute(attrName)) {
				 
					  // Yes--select and focus it.
					  tabbrowser.selectedTab = currentTab;
				 
					  // Focus *this* browser window in case another one is currently focused
					  tabbrowser.ownerDocument.defaultView.focus();
					  found = true;
					  gBrowser.contentDocument.getElementById('glauca-ori-image').src="resource://glaucares/ajax-loader.gif";
					  glauca.sina.image.getImage(imgUrl,function(src){
							gBrowser.contentDocument.getElementById('glauca-ori-image').src=src;
						});
					}
				  }
				 
				  if (!found) {
					// Our tab isn't open. Open it now.
					var browserEnumerator = wm.getEnumerator("navigator:browser");
					var tabbrowser = browserEnumerator.getNext().gBrowser;
				   
					// Create tab
					var newTab = tabbrowser.addTab(url);
					newTab.setAttribute(attrName, "xyz");
				   
					// Focus tab
					tabbrowser.selectedTab = newTab;
					 
					// Focus *this* browser window in case another one is currently focused
					tabbrowser.ownerDocument.defaultView.focus();
					tabbrowser.getBrowserForTab(newTab).addEventListener("DOMContentLoaded",function(){
						var doc=gBrowser.contentDocument;
						var div=doc.getElementById("glauca-backDiv");
						var image=doc.getElementById("glauca-ori-image");
						var mouseWheelEvent=function(e){
							if(image.rate==null)image.rate=1;
							var rt=image.rate;
							if(e.detail<0)rt+=0.03;
							else if(e.detail>0)rt-=0.03;
							if(rt>3)rt=3;
							if(rt<0.1)rt=0.1;
							image.style.MozTransform="scale("+rt+")";
							image.rate=rt;
						};
						doc.addEventListener("DOMMouseScroll",mouseWheelEvent,false);
						div.onclick=function(){
							doc.removeEventListener("DOMMouseScroll",mouseWheelEvent);
							gBrowser.removeCurrentTab();
						}
						image.onclick=function(e){e.stopPropagation();};
						image.src=imgUrl;
						image.style.top="50px";
						image.style.left="0px";
						//bind load event to set pic position
						image.addEventListener("load",function(){
							var maxWidth=div.offsetWidth;
							var rate=1,widthRate=1;
							if(image.width>maxWidth-50)widthRate=(maxWidth-50)/image.width;
							rate=Math.min(1,widthRate);
							image.rate=rate;
							image.style.MozTransform="scale("+rate+")";
						});
						//bind mouse down &move to drag
						function mouseDownEvent(e){
							image.mousedown=true;
							image.startX=e.clientX;
							image.startY=e.clientY;
							image.onmousemove=mousemoveEvent;
						}
						function mousemoveEvent(e){
							if(image.mousedown){
								image.style.top=parseInt(image.style.top)+e.clientY-image.startY+"px";
								image.style.left=parseInt(image.style.left)+e.clientX-image.startX+"px";
								image.startX=e.clientX;
								image.startY=e.clientY;
							}
						}
						function mouseUpEvent(e){
							image.onmousemove=null;
							image.mousedown=false;
						}
						image.onmousedown=mouseDownEvent;
						image.onmouseup=mouseUpEvent;
					},true);
				  }
			}
			openAndReuseOneTabPerAttribute("glauca-imageTab","chrome://glauca/content/imageTab.xul");
			
		}
    },
    post:{
	postTextTweet:function(text){
	    var message = {
		method: 'POST',
		action: 'https://api.weibo.com/2/statuses/update.json',
		parameters: []
	    };
	    message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
	    text=glauca.sinaOauth.percentEncode(text);
	    var fd="status="+text+"&source=3363969519";
		
	    glauca.sinaOauth.sendOauthInfo(message, function(req) {
		//ref: https://developer.mozilla.org/en/Code_snippets/Alerts_and_Notifications
			if(req!=null)glauca.overlay.showPopup("发送成功");
				else glauca.overlay.showPopup("网络问题导致发送失败");
	    },fd);
	}
    },
    image: {
	//this piece of code from:
	//http://jsperf.com/encoding-xhr-image-data/5
	arrayBufferDataUri: function(raw) {
	    var base64 = ''
	    var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

	    var bytes = new Uint8Array(raw)
	    var byteLength = bytes.byteLength
	    var byteRemainder = byteLength % 3
	    var mainLength = byteLength - byteRemainder

	    var a, b, c, d
	    var chunk

	    // Main loop deals with bytes in chunks of 3
	    for (var i = 0; i < mainLength; i = i + 3) {
		// Combine the three bytes into a single integer
		chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

		// Use bitmasks to extract 6-bit segments from the triplet
		a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
		b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
		c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
		d = chunk & 63 // 63       = 2^6 - 1
		// Convert the raw binary segments to the appropriate ASCII encoding
		base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
	    }

	    // Deal with the remaining bytes and padding
	    if (byteRemainder == 1) {
		chunk = bytes[mainLength]

		a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2
		// Set the 4 least significant bits to zero
		b = (chunk & 3) << 4 // 3   = 2^2 - 1
		base64 += encodings[a] + encodings[b] + '=='
	    } else if (byteRemainder == 2) {
		chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

		a = (chunk & 16128) >> 8 // 16128 = (2^6 - 1) << 8
		b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4
		// Set the 2 least significant bits to zero
		c = (chunk & 15) << 2 // 15    = 2^4 - 1
		base64 += encodings[a] + encodings[b] + encodings[c] + '='
	    }

	    return "data:image/jpeg;base64," + base64
	},
	//https://developer.mozilla.org/en/Code_snippets/Downloading_Files#Downloading_Images
	getImage: function(url, callback, name) {
		if(url==null){
			callback(null,url,name);
			return;
		}
	    var request = new XMLHttpRequest();
	    request.open("GET", url, true);
	    request.responseType = "arraybuffer";
	    request.onreadystatechange = function() {
		if(request.readyState==4 || request.readyState=="complete"){
		    var src = glauca.sina.image.arrayBufferDataUri(request.response);
		    callback(src,url,name);
		}
	    };
	    request.send();
	}
    },
    reply:{
		openReplyPanel:function(ifRt){
			glauca.cons.mw.window.document.getElementById('glauca-replyPanel').style.display='block';
			var rbox=glauca.cons.mw.window.document.getElementById('glauca-replyBox');
			rbox.style.width=document.getElementById("glauca-tweetText").style.width;
			var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
			if(ifRt&&(cTweet.retweet!=null)){
				rbox.value="//@"+cTweet.user.screen_name+":"+cTweet.text
			}
		},
		sendReply:function(comment_ori){
			//get the basic info
			var text=glauca.cons.mw.window.document.getElementById('glauca-replyBox').value;
			var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
			var id=cTweet.retweet==null?cTweet.id:cTweet.retweet.id;
			var message = {
			method: 'POST',
			action: 'https://api.weibo.com/2/comments/create.json',
			parameters: []
			};
			
			message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
			message.parameters.push(['id', id]);
			
			text=glauca.sinaOauth.percentEncode(text);
			var fd="comment="+text+"&source=3363969519";
			//var fd=new FormData();
			//fd.append('status',text);
			//fd.append('source','3363969519');
			glauca.sinaOauth.sendOauthInfo(message, function(req) {
			//ref: https://developer.mozilla.org/en/Code_snippets/Alerts_and_Notifications
				if(req!=null)glauca.overlay.showPopup("评论发送成功");
				else glauca.overlay.showPopup("网络问题导致评论失败");
			},fd);
		},
		sendRt:function(){
			//get the basic info
			var text=glauca.cons.mw.window.document.getElementById('glauca-replyBox').value;
			var cTweet=glauca.sina.tweetData[glauca.sina.display.currentTweet];
			var id=cTweet.id;
			var message = {
			method: 'POST',
			action: 'https://api.weibo.com/2/statuses/repost.json',
			parameters: []
			};
			message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
			message.parameters.push(['id',id]);
			text=glauca.sinaOauth.percentEncode(text);
			var fd="status="+text+"&source=3363969519";
			glauca.sinaOauth.sendOauthInfo(message, function(req) {
				//ref: https://developer.mozilla.org/en/Code_snippets/Alerts_and_Notifications
				if(req!=null)glauca.overlay.showPopup("转发成功");
				else glauca.overlay.showPopup("网络问题导致转发失败");
			},fd);
		}
    },
    emotions:{
	currentInput:null,
	emotionBase:{
	    tags:[],
	    urls:[]
	},
	init:function(){
	    var container=document.getElementById('glauca-emotionsPanel');
	    container.registerCallback(glauca.sina.emotions.onEmotionClick);
	    glauca.sina.emotions.getEmotions();
	},
	addEmotion:function(obj){
	    var container=document.getElementById('glauca-emotionsPanel');
	    var typeObj=container.getTypeObjByName(obj.category);
	    if(typeObj==null)typeObj=container.addType(obj.category);
	    container.addEmotionToType(typeObj,obj.tag,obj.url);
	    glauca.sina.emotions.emotionBase.tags.push(obj.tag);
	    glauca.sina.emotions.emotionBase.urls.push(obj.url);
	    //image.setAttribute("class","glauca-emotion-selector");
	},
	onEmotionClick:function(tag){
	    if(glauca.sina.emotions.currentInput!=null){
			glauca.sina.emotions.currentInput.value+=tag;
	    }
	    glauca.cons.mw.window.document.getElementById('glauca-emotionsPanel').hidden=true;
	    glauca.cons.mw.window.document.getElementById('glauca-emotionsPanel').hidePopup();
	    glauca.sina.emotions.currentInput=null;
	},
	getEmotions:function(){
	    var message = {
		method: 'GET',
		action: 'https://api.weibo.com/2/emotions.json',
		parameters: []
	    };
	    
	    message.parameters.push(['access_token', glauca.sina.FUELoauthToken.access_token]);
	    var fd="source=3363969519";
	    glauca.sinaOauth.sendOauthInfo(message, function(req) {
			if(req){
				var ems=JSON.parse(req.responseText);
				for(var i=0,length=ems.length;i<length;++i){
					var em=ems[i];
					glauca.sina.emotions.addEmotion({
						tag:em.phrase,
						url:em.url,
						category:em.category
						});
				}
			}
			else glauca.sina.emotions.getEmotions();//try another time.
	    },fd);
	},
	openPanelEvent:function(id, target){
	    glauca.sina.emotions.currentInput=glauca.cons.mw.window.document.getElementById(id);
	    document.getElementById("glauca-emotionsPanel").hidden=false;
	    document.getElementById("glauca-emotionsPanel").openPopup(target,"after_end",0,0,false,false);
	}
    }
};