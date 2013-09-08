var glauca={};

glauca={
    init:function(){
		var ls=glauca.cons.loadService;
		ls.loadSubScript("chrome://glauca/content/ff-overlay.js");
        ls.loadSubScript("chrome://glauca/content/sinaOauth.js");
        ls.loadSubScript("chrome://glauca/content/sina.js");
        glauca.sina.init();
		//document.getElementById("contentAreaContextMenu")
        //        .addEventListener("popupshowing", function (e){ glauca.showFirefoxContextMenu(e); }, false);
        glauca.storage.init();
		glauca.initialized = true;
        glauca.overlay.mouseOnUrlbarEvent();
		var mw=glauca.cons.mw;
        mw.window.document.getElementById('glauca-panel').addEventListener('DOMMouseScroll',glauca.overlay.mouseScrollEvent);
		mw.window.document.getElementById('glauca-replyPanel').addEventListener('DOMMouseScroll',function(e){e.stopPropagation();});
        glauca.overlay.hidePop();
        //REF: https://developer.mozilla.org/en/FUEL
		
		mw.window.document.getElementById('urlbar').addEventListener('focus',glauca.overlay.urlbarFocusEvent,false);
        mw.window.document.getElementById('urlbar').addEventListener('blur',glauca.overlay.urlbarBlurEvent,false);
		mw.window.document.getElementById('urlbar').addEventListener('keyup',glauca.overlay.keyupEvent,false);
		mw.window.document.getElementById("urlbar").removeEventListener("load",glauca.init,false);
		
		//preference change
	 
		var myListener = new glauca.utils.PrefListener("extensions.glauca.",
										  function(branch, name) {
											  switch (name) {
												  case "style-nickLength":
												  case "style-statusLength":
												  case "style-rollDuration":
												  case "style-rollDelay":
													  glauca.sina.display.adjustUI();
													  break;
											  }
										  });
		myListener.register(true);
    },
    sina:{},
    overlay:{},
    sinaOauth:{},
    options:{},
    storage:{},
    opentab:function(url){
		glauca.overlay.hidePop();
    	glauca.cons.mw.gBrowser.selectedTab = glauca.cons.mw.gBrowser.addTab(url);
    },
    /**
     *@description called after oauth_token & secret be loaded from local storage(see storage.js)
     */
    onOauthLoaded:function(){
        
    }
};
glauca.cons={
	mw:Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow('navigator:browser'),
	loadService:Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader)
};
glauca.cons.jsonToDom=function(xml, doc, nodes) {
	function namespace(name) {
		var m = /^(?:(.*):)?(.*)$/.exec(name);
		return [glauca.cons.jsonToDom.namespaces[m[1]], m[2]];
	}
 
	function tag(name, attr) {
		if (Array.isArray(name)) {
			var frag = doc.createDocumentFragment();
			Array.forEach(arguments, function (arg) {
				if (!Array.isArray(arg[0]))
					frag.appendChild(tag.apply(null, arg));
				else
					arg.forEach(function (arg) {
						frag.appendChild(tag.apply(null, arg));
					});
			});
			return frag;
		}
 
		var args = Array.slice(arguments, 2);
		var vals = namespace(name);
		if(vals[1]=="textNode"){
			var elem=doc.createTextNode(attr["value"]);
			return elem;
		}
		var elem = doc.createElementNS(vals[0] || glauca.cons.jsonToDom.defaultNamespace,
									   vals[1]);
 
		for (var key in attr) {
			var val = attr[key];
			if (nodes && key == "key")
				nodes[val] = elem;
 
			vals = namespace(key);
			if (typeof val == "function")
				elem.addEventListener(key.replace(/^on/, ""), val, false);
			else
				elem.setAttributeNS(vals[0] || "", vals[1], val);
		}
		args.forEach(function(e) {
			elem.appendChild(typeof e == "object" ? tag.apply(null, e) :
							 e instanceof Node    ? e : doc.createTextNode(e));
		});
		return elem;
	}
	return tag.apply(null, xml);
};
glauca.cons.jsonToDom.namespaces = {
	html: "http://www.w3.org/1999/xhtml",
	xul: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
};
glauca.cons.jsonToDom.defaultNamespace = glauca.cons.jsonToDom.namespaces.html;
//to ensure that the gBrowser variable is available,we need to call it(gBrowser) from the window,
//this is based on https://developer.mozilla.org/en/Code_snippets/Tabbed_browser, the From a Dialog section.
Components.utils.import("resource://gre/modules/Services.jsm",glauca.cons);
Components.utils.import("resource://gre/modules/FileUtils.jsm",glauca.cons);

glauca.options={
    prefs:Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService).getBranch("extensions.glauca."),
	openWindow:function(index){
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								 .getService(Components.interfaces.nsIWindowMediator);
		var tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
		var tab=gBrowser.addTab("about:glauca");
		tabbrowser.getBrowserForTab(tab).addEventListener("DOMContentLoaded",function(){
			tabbrowser.selectedTab=tab;
			glauca.options.eventHandlers.switchDeck(index,true);
		});
	},
    onLoad:function(){
        glauca.cons.loadService.loadSubScript("chrome://glauca/content/sinaOauth.js");
        
		
		//init some elements
		var showrt=glauca.options.prefs.getCharPref("filter-rt");
		var rg=document.getElementById("glauca-options-filterGroup");
		if(showrt=="showAll")rg.selectedIndex=0;
		else if(showrt=="showNone")rg.selectedIndex=1;
		else if(showrt=="showOne")rg.selectedIndex=2;
		rg.addEventListener("RadioStateChange",function(e){
			var index=rg.selectedIndex;
			if(index==0)glauca.options.prefs.setCharPref("filter-rt","showAll");
			else if(index==1)glauca.options.prefs.setCharPref("filter-rt","showNone");
			else glauca.options.prefs.setCharPref("filter-rt","showOne");
		});
    },
    eventHandlers:{
		switchDeck:function(index,fromChromeFlag){
			var deck,tabs;
			if(fromChromeFlag){
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
											.getService(Components.interfaces.nsIWindowMediator);
				var tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
				deck=tabbrowser.selectedBrowser.contentDocument.getElementById("glauca-options-deck");
				tabs=tabbrowser.selectedBrowser.contentDocument.getElementById("glauca-options-tabs");
			}
			else{
				deck=document.getElementById("glauca-options-deck");
				tabs=document.getElementById("glauca-options-tabs");
			}
			tabs.selectedIndex=index;
			deck.selectedIndex=index;
			if(index==2){
				var ifOauthAuthorized=glauca.options.prefs.getBoolPref("oauthAuthorized");
				glauca.options.eventHandlers.updateOauthPanel(ifOauthAuthorized);
			}
		},
        onOauthFinished:function(ifSuccess){
            glauca.options.prefs.setBoolPref('oauthAuthorized',ifSuccess);
            glauca.options.eventHandlers.updateOauthPanel(ifSuccess);
        },
        updateOauthPanel:function(state){
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
											.getService(Components.interfaces.nsIWindowMediator);
			var	tb = wm.getEnumerator('navigator:browser').getNext().gBrowser;
			function $(elem){
				var e=document.getElementById(elem);
				if(e)return e;
				else return tb.selectedBrowser.contentDocument.getElementById(elem);
			}
            var wid=$("glauca-option-authorization-after");
            if(!state){
                wid.style.display='none';
                var optionBox=$("glauca-option-authorizePage");
				var eBrowser=$("glauca-option-authorization-authorizePage");
				if(eBrowser!=null){
					if(eBrowser.style.display=='none'){
						eBrowser.style.display='block';
						glauca.sinaOauth.getAccessToken(eBrowser);
					}
					return;
				}
				else{
					eBrowser=document.createElement("browser");
					eBrowser.setAttribute("id","glauca-option-authorization-authorizePage");
					eBrowser.setAttribute("type","content");
					eBrowser.setAttribute("flex","1");
					eBrowser.setAttribute("disablehistory","true");
					optionBox.appendChild(eBrowser);
					//adjust browser width
					var totalWidth=$("glauca-options-pane").clientWidth;
					var radioWidth=$("glauca-options-radioBox").clientWidth;
					eBrowser.style.width=totalWidth-radioWidth-10+"px";
					glauca.sinaOauth.getAccessToken(eBrowser);
					//glauca.options.eventHandlers.onAuthorizeBtnClick();
				}
            }
			else{
				var eBrowser=$("glauca-option-authorization-authorizePage");
				if(eBrowser!=null){
					//eBrowser.parentNode.removeChild(eBrowser);
					eBrowser.style.display='none';
					wid.style.display='block';
				}
			}
        },
		reOauth:function(){
			glauca.options.prefs.setBoolPref('oauthAuthorized',false);
			glauca.options.eventHandlers.updateOauthPanel(false);
		}
    }
};
glauca.storage={
    fileHandler:null,
    loadState:0,
    init:function(){
        this.startConnection();
        this.getOauthInfo(function(access_token, uid,expires_in){
            //window.alert('getOauthInfo');
			access_token=access_token.replace(/^\s+|\s+$/g, '');
            Application.storage.set('glauca_oauth_token_data',{access_token:access_token,uid:uid,expires_in:expires_in});
            glauca.options.prefs.setBoolPref('oauthAuthorized',(access_token!='')&&(access_token!=null));
            //loadState=1;
            glauca.onOauthLoaded();
            //call something
        });
    },
    startConnection:function(){
        var file=glauca.cons.FileUtils.getFile("ProfD",["glauca.sqlite"]);
        this.fileHandler=glauca.cons.Services.storage.openDatabase(file);
        //init
        if(!this.fileHandler.tableExists("oauth")){
            this.fileHandler.createTable("oauth","id,access_token STRING, uid STRING, expires_in STRING");
            this.fileHandler.executeSimpleSQL('INSERT INTO oauth(id,access_token,uid,expires_in) values("0","","","")');
        }
    },
    getOauthInfo:function(callback){
        var results=this.fileHandler.createStatement("SELECT * FROM oauth");
        //From https://developer.mozilla.org/en/Storage
        results.executeAsync({
            handleResult:function(aResultSet){
                var row=aResultSet.getNextRow();
                callback(row.getResultByName("access_token"),row.getResultByName("uid"),row.getResultByName("expires_in"));
            },
            handleError: function(aError){
                alert("Error: " + aError.message);
            },
            
            handleCompletion: function(aReason){
                if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) 
                    alert("Query canceled or aborted!");
            }
        });
    },
    updateToken:function(res){
        if(this.fileHandler==null)this.startConnection();//in occasion that this method is directly called (without calling init first)
        var sql=this.fileHandler.createStatement('UPDATE oauth SET access_token=:acc_token,uid=:uid,expires_in=:expires_in WHERE id="0"');
		sql.params.acc_token=res.access_token;
		sql.params.uid=res.uid;
		sql.params.expires_in=res.expires_in;
		sql.executeAsync({
            handleError: function(aError){
                alert("Glauca Error: " + aError.message);
            },
            
            handleCompletion: function(aReason){
                if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
                    alert("Query canceled or aborted!");
				}
				else{
					Application.storage.set('glauca_oauth_token_data',{access_token:res.access_token, uid:res.uid, expires_in:res.expires_in});
					glauca.options.prefs.setBoolPref('oauthAuthorized',(res.access_token!='')&&(res.access_token!=null));
					//Ref: https://developer.mozilla.org/en/working_with_windows_in_chrome_code#Passing_data_between_windows
					glauca.options.eventHandlers.onOauthFinished(true);
				}
			}
        });
    }
};
glauca.utils={


//截取字符串（从start字节到end字节）
	subCHString :function(s,start, end){
		function strlen(str){
			var len = 0;
			for (var i = 0; i < str.length; i++) {
				if (str.charCodeAt(i) > 255 || str.charCodeAt(i) < 0) len += 2; else len ++;
			}
			return len;
		}
		function isCHS(str,i){
		if (str.charCodeAt(i) > 255 || str.charCodeAt(i) < 0)
			return true;
		else
			return false;
		}
		function strToChars(str){
			var chars = new Array();
			for (var i = 0; i < str.length; i++){
			 chars[i] = [str.substr(i, 1), isCHS(str,i)];
			}
			return chars;
		}
		var len = 0;
		var str = '';
		var chs=strToChars(s);
		for (var i = 0; i < s.length; i++) {
			if(chs[i][1])
				len += 2;
			else
				len++;
			if (end < len)
				break;
			else if (start < len)
				str += chs[i][0];
		}
		while(strlen(str)<end-start)str+=' ';
		return str;
	},
	//截取字符串（从start字节截取length个字节）
	subCHStr : function(str,start, length){
		return subCHString(str,start, start + length);
	},
	//判断长度
	CHlength:function(str){
		//var arr = str.match(/[^\x00-\xff]/ig);  
		return str.length;
	},
	/**
	 * @constructor
	 *
	 * @param {string} branch_name
	 * @param {Function} callback must have the following arguments:
	 *   branch, pref_leaf_name
	 */
	PrefListener:function(branch_name, callback) {
	  // Keeping a reference to the observed preference branch or it will get
	  // garbage collected.
	  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService);
	  this._branch = prefService.getBranch(branch_name);
	  this._branch.QueryInterface(Components.interfaces.nsIPrefBranch);
	  this._callback = callback;
	  /**
		 * @param {boolean=} trigger if true triggers the registered function
		 *   on registration, that is, when this method is called.
		 */
		var self=this;
		this.register =function(trigger) {
		  self._branch.addObserver('', self, false);
		  if (trigger) {
			let that = self;
			self._branch.getChildList('', {}).
			  forEach(function (pref_leaf_name)
				{ that._callback(that._branch, pref_leaf_name); });
		  }
		};
		this.observe = function(subject, topic, data) {
		  if (topic == 'nsPref:changed')
			self._callback(self._branch, data);
		};
		this.unregister = function() {
		  if (self._branch)
			self._branch.removeObserver('', self);
		};
	}
	
};
