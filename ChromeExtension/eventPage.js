//Set default values.
var authenticated = false;
var CONFIGURATION = {
    pullInterval: 30000,
    monitorLabels: [
        'CATEGORY_PERSONAL',
        'CATEGORY_SOCIAL',
        'CATEGORY_FORUMS',
        'CATEGORY_UPDATES'
        ]
};

window.addEventListener("beforeunload", cleanUp, false);
chrome.runtime.onMessage.addListener(messageHandler);
chrome.storage.onChanged.addListener(storageOnChangeHandler)
chrome.runtime.onStartup.addListener(function(){
    if (typeof document != 'undefined'){
	var head = document.getElementsByTagName('head')[0];
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = "https://apis.google.com/js/client.js?onload=init()";
	head.appendChild(script);
    }
});

function init() {
    syncStorage();
    //Try to authenticate with a cached token.
    authorize();
    if (authenticated == false) {
        chrome.browserAction.setBadgeText({text: '!'});
    }
}

function syncStorage() {
    chrome.storage.sync.get('CONFIGURATION', function(items) {
        if (typeof items != 'undefined') {
        CONFIGURATION = items.CONFIGURATION;
        }
        else {
            chrome.storage.sync.set({'CONFIGURATION': CONFIGURATION});
        }
    });
}

function authenticate(request, sendResponse) {
    //oauth2 auth
	chrome.identity.getAuthToken(
		{'interactive': true
		},
		function(token){
		    if (typeof token != 'undefined') {
		        chrome.storage.sync.set({'authenticated': true});
		        sendResponse({action: request.action, status: "completed"});
		        loadApi();
		    }
            else {
                sendResponse({action: request.action, status: "failed"});
            }
		}
	);
}

function authorize(){
	//oauth2 auth
	chrome.identity.getAuthToken(
		{'interactive': false
		},
		function(token){
		    if (typeof token != 'undefined') {
		        chrome.storage.sync.set({'authenticated': true})
		        loadApi();
		    }
		}
	);
}

function loadApi() {
    gapi.client.load('pubsub', 'v1beta2', null);
	gapi.client.load('gmail', 'v1', gmailAPILoaded);
}

function gmailAPILoaded(){
    console.log("gmail api loaded.")
    //get user email address and strip out the '@' to create a unique topic name.
    var userID;
    gapi.client.gmail.users.getProfile({
    	'userId': 'me',
    	'fields': 'emailAddress'
    }).then(function(response){
    	userID = userID.replace('@', '');
    });
    var topicName = "projects/gmail-desktop-notifications/topics/"+userID;
    //Create the topic.
    var topic;
    gapi.client.pubsub.projects.topics.create({
    	'name': topicName
    	}).then(function(response) {
    	  topic = response;  
    	});
    //Subscribe to the topic.
    var subscription;
    gapi.client.pubsub.projects.subscriptions.create({
    	'topic': topic.name,
    	'ackDeadlineSeconds': 300
    }).then(function(response){
    	subscription = response;
    });
    //Allow Gmail to publish messages to our topic.
    gapi.client.pubsub.projects.topics.setIamPolicy({
    	'resource': topicName,
    	'Request body': {
    		'policy': {
    			'bindings': [{
    				'role': "roles/pubsub.publisher",
    				'members': ["serviceAccount:gmail-api-push@system.gserviceaccount.com"]
    			}]
    		}
    	}
    });
    //Tell api to publish notifications of new gmail messages to topic.
    var watchResponse;
    gapi.client.gmail.users.watch({
    	'userId': 'me',
    	'Request body': {
    		"topicName": topicName,
    		"labelIds": CONFIGURATION.monitorLabels
    	}
    }).then(function(response){
        watchResponse = response;
    });
    //poll topic every 30 seconds.
    window.setInterval(function(){pullNotifications();}, CONFIGURATION.pullInterval);
}

function pullNotifications() {
	//TODO: add polling code
}

function cleanUp(e) {
	//TODO: Add code to clean up topics,mailbox watch, etc.
	gapi.client.gmail.users.stop({
	    'userId': 'me'
	})
}

function getLabels() {
    var labelList;
    gapi.client.gmail.users.labels.list({
        'userId': 'me'
    }).then(function(response){
        labelList = response;
    });
    return labelList;
}

function messageHandler(request, sender, sendResponse) {
    var action = request.action;
    switch (action) {
        case "setConfig":
            setConfig(request.config);
            sendResponse({action: request.action, status: "completed"});
            break;
        case "getConfig":
            sendResponse({action: request.action, status: "completed", config: CONFIGURATION});
            break;
        case "getLabels":
            var labelList = getLabels();
            sendResponse({action: request.action, status: "completed", labels: labelList});
            break;
        case "authenticate":
            authenticate(request, sendResponse);
            break;
        case "getAuthStatus":
            sendResponse({action: request.action, status: "completed", authStatus: authenticated});
            break;
        default:
            sendResponse({action: request.action, status: "Invalid request"});
            console.log("Unknown request <" + action + ">");
            break;
    }
}

function storageOnChangeHandler(changes, areaName) {
    if (areaName != "sync") {
        return;
    }
    if (typeof changes.authenticated != 'undefined') {
        authenticated = changes.authenticated.newValue;
        var badgeText;
        chrome.browserAction.getBadgeText({}, function(result){badgeText=result;});
        if (changes.authenticated.newValue == true && badgeText == '!') {
            chrome.browserAction.setBadgeText('');
        }
    }
    if (typeof changes.CONFIGURATION != 'undefined') {
        CONFIGURATION = changes.CONFIGURATION.newValue;
    }
}

function setConfig(config) {
    if (typeof config.pullInterval != 'undefined') {
        chrome.storage.sync.set({'CONFIGURATION.pullInterval': config.pullInterval});
    }
    if (typeof config.monitorLabels != 'undefined') {
        chrome.storage.sync.set({'CONFIGURATION.monitorLabels': config.monitorLabels});
    }
}