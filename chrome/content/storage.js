Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");
glauca.storage={
    fileHandler:null,
    loadState:0,
    oauth_token:'',
    oauth_token_secret:'',
    init:function(){
        this.startConnection();
        this.getOauthInfo(function(token,token_secret){
            this.oauth_token=token;
            this.oauth_token_secret=token_secret;
            loadState=1;
            glauca.onOauthLoaded();
            //call something
        });
    },
    startConnection:function(){
        var file=FileUtils.getFile("ProfD",["glauca.sqlite"]);
        this.fileHandler=Services.storage.openDatabase(file);
        window.alert("starting");
        //init
        if(!this.fileHandler.tableExists("oauth")){
            this.fileHandler.createTable("oauth","oauth_token STRING, oauth_token_secret STRING");
        }
    },
    getOauthInfo:function(callback){
        var results=this.fileHandler.createStatement("SELECT * from oauth");
        //From https://developer.mozilla.org/en/Storage
        if(results==null)window.alert("null");
        results.executeAsync({
            handleResult:function(aResultSet){
                var row=aResultSet.getNextRow();
                callback(row.getResultByName("oauth_token"),row.getResultByName("oauth_token_secret"));
            },
            handleError: function(aError){
                alert("Error: " + aError.message);
            },
            
            handleCompletion: function(aReason){
                if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) 
                    alert("Query canceled or aborted!");
            }
        });
    }
};
glauca.storage.init();