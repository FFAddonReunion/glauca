glauca.sinaOauth={
	oauthAppKey:"3363969519",
	errorHandlerFlag:"free",
	oauthAppSecret:"0d747731255b2cb2ef5eac884ce373a2",
	oauthVersion:"2.0",
	getAuthorizationHeader: function getAuthorizationHeader(realm, parameters) {
        var header = 'OAuth2 ';
        var list = parameters;
        for (var p = 0; p < list.length; ++p) {
            var parameter = list[p];
            var name = parameter[0];
            if (name.indexOf("oauth_") == 0) {
				if(p !=0 )header+=',';
                header += glauca.sinaOauth.percentEncode(name) + '="' + glauca.sinaOauth.percentEncode(parameter[1]) + '"';
            }
        }
        return header;
    },
	percentEncode: function percentEncode(s) {
        if (s == null) {
            return "";
        }
        if (s instanceof Array) {
            var e = "";
            for (var i = 0; i < s.length; ++s) {
                if (e != "") e += '&';
                e += glauca.sinaOauth.percentEncode(s[i]);
            }
            return e;
        }
        s = encodeURIComponent(s);
        // Now replace the values which encodeURIComponent doesn't do
        // encodeURIComponent ignores: - _ . ! ~ * ' ( )
        // OAuth dictates the only ones you can ignore are: - _ . ~
        // Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
        s = s.replace(/\!/g, "%21");
        s = s.replace(/\*/g, "%2A");
        s = s.replace(/\'/g, "%27");
        s = s.replace(/\(/g, "%28");
        s = s.replace(/\)/g, "%29");
        return s;
    },
	sendOauthInfo:function(message,callback,formdata){
		var req= new XMLHttpRequest();
		var url=message.action+"?"+glauca.sinaOauth.generateURLString(message.parameters);
		req.open(message.method,url,true);
		glauca.cons.loadService.loadSubScript("chrome://glauca/content/lib/cookiemonster.js",glauca.sinaOauth);
		new glauca.sinaOauth.CookieMonster(req);
		var header=glauca.sinaOauth.getAuthorizationHeader('',message.parameters);
		req.setRequestHeader("Authorization",header);
		req.onreadystatechange= function(aEvt){
			if (req.readyState==4 || req.readyState=="complete"){
				if(this.status==200){
					if(req.responseText.indexOf("error_code")!=-1){
						if(glauca.sinaOauth.errorHandlerFlag=='busy'){
							return;
						}
						else glauca.sinaOauth.errorHandlerFlag="busy";
						var reqJson=JSON.parse(req.responseText);
						if(reqJson.error_code&&(reqJson.error_code==21327||reqJson.error_code==21332)){//token expired
							glauca.options.prefs.setBoolPref('oauthAuthorized',false);
							glauca.options.openWindow(2);
						}
					}
					else {
						glauca.sinaOauth.errorHandlerFlag='free';
						callback(req);
					}
				}
				else callback(null);
			}
		};
        if(formdata)req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
		req.send(formdata);
        
	},
	
	generateURLString:function(params){
		var uParams='',uParamsArray=[];
		for(var i in params){
			var item=params[i];
			uParamsArray.push(item[0]+'='+item[1]);
		}
		uParams=uParamsArray.join('&');
		return uParams;
	},
	getAccessToken:function(oauthPage){
		var aParams=[];
		aParams.push(["client_id",glauca.sinaOauth.oauthAppKey]);
		aParams.push(["response_type","token"]);
		aParams.push(["redirect_uri","https://api.weibo.com/oauth2/default.html"]);
		oauthPage.loadURI("https://api.weibo.com/oauth2/authorize?"+glauca.sinaOauth.generateURLString(aParams));
		
		//from: http://stackoverflow.com/questions/1403888/get-url-parameter-with-jquery?lq=1
		function getURLParameter(uri,name) {
			return decodeURIComponent((new RegExp('[#|?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(uri)||[,""])[1].replace(/\+/g, '%20'))||null;
		}

		//add listener to this browser element
		//ref:
		//https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIWebProgressListener
		//https://developer.mozilla.org/en-US/docs/Code_snippets/Progress_Listeners
		
		var pageLoaded=function(aEvent){
				var uri=aEvent.originalTarget.currentURI.spec;
				var atk=getURLParameter(uri,'access_token');
				if(atk!=null && atk!='' && atk.charAt(1)=='.'){
					//a real access token
					
					var res=[];
					res["access_token"]=atk;
					res["uid"]=getURLParameter(uri,'uid');
					res['expires_in']=getURLParameter(uri,'expires_in');
					oauthPage.removeEventListener("load",pageLoaded,false);
					glauca.storage.updateToken(res);
				}
		};
		oauthPage.addEventListener("load",pageLoaded);
	}
};