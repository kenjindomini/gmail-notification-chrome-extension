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
var subscription;

window.addEventListener("beforeunload", cleanUp, false);
window.gapi_onload = function() {
    init();
};
chrome.runtime.onMessage.addListener(messageHandler);
chrome.storage.onChanged.addListener(storageOnChangeHandler)

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
		        console.log("getAuthToken(interactive: true) successful.");
		        chrome.storage.sync.set({'authenticated': true});
		        sendResponse({action: request.action, status: "completed"});
		        loadApi();
		    }
            else {
                console.log("getAuthToken(interactive: true) not successful.");
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
		        console.log("getAuthToken(interactive: false) successful.");
		        chrome.storage.sync.set({'authenticated': true})
		        loadApi();
		    }
		    else {
		        console.log("getAuthToken(interactive: false) not successful.");
		        chrome.storage.sync.set({'authenticated': false})
		    }
		}
	);
}

function loadApi() {
    gapi.client.load('pubsub', 'v1beta2', function(){
        console.log("Google Cloud PubSub API loaded.");
        gapi.client.load('gmail', 'v1', gmailAPILoaded);
    });
}

function gmailAPILoaded(){
    console.log("gmail api loaded.");
    var watchResponse;
    //get user email address and strip out the '@' to create a unique topic name.
    var userID;
    authorize();
    gapi.client.gmail.users.getProfile({
    	'userId': 'me',
    	'fields': 'emailAddress'
    }).then(function(response){
    	userID = response.userID.replace('@', '');
    	var topicName = "projects/gmail-desktop-notifications/topics/"+userID;
        //Create the topic.
        var topic;
        authorize();
        gapi.client.pubsub.projects.topics.create({
        	'name': topicName
    	    }).then(function(response) {
                topic = response;
    	        //Subscribe to the topic.
                authorize();
                gapi.client.pubsub.projects.subscriptions.create({
        	        'topic': topic.name,
        	        'ackDeadlineSeconds': 300
            }).then(function(response){
        	    chrome.storage.sync.set({'subscription': response});
    	        //Allow Gmail to publish messages to our topic.
    	        authorize();
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
                }).then(function(response){
                    //Tell api to publish notifications of new gmail messages to topic.
                    authorize();
                    gapi.client.gmail.users.watch({
    	                'userId': 'me',
    	                'Request body': {
    		                "topicName": topicName,
    		                "labelIds": CONFIGURATION.monitorLabels
    	                }
                    }).then(function(response){
                        watchResponse = response;
                        //poll topic every 30 seconds.
                        window.setInterval(function(){pullNotifications();}, CONFIGURATION.pullInterval);
                    });
                });
            });
        });
    });

}

function pullNotifications() {
	var notificationOptions = {
	    'type': "basic",
	    'title': "Gmail notification!",
	    'message': "No new gmail messages found.",
	    'contextMessage': "No messages found in monitored labels.",
	    'isClickable': true
	};
	//var newMessages = false;
	gapi.client.pubsub.projects.subscriptions.pull({'subscription': subscription.name,
	    'request body': {
	        'returnImmediately': true
	    }
	}).then(function(response){
	    if (response.data == 'undefined') {
	        console.log("no new messages found.");
	        //for testing remove later:
	        notificationOptions.isClickable = false;
	        chrome.notifications.create("no message", notificationOptions, function(notificationId){
	            
	        });
	        return;
	    }
	    var decodedData = atob(response.data);
	    //get message count if possible and display on badgetext and in notification
	    console.log("decodedData from pull request = " + decodedData);
	    console.log("option attributes from pull request = " + response.attributes);
	    notificationOptions.message = "New gmail messages!";
	    notificationOptions.contextMessage = "New messages found in monitored labels.";
	    var notificationClickedCallback = function(notificationId) {
	        var createProperties = {
	            'url': "https://gmail.com"
	        };
	        chrome.tabs.create(createProperties);
	        chrome.notifications.onClicked.removeListener(notificationClickedCallback);
	    };
	    chrome.notifications.onClicked.addListener(notificationClickedCallback);
	    chrome.notifications.create(response.messageId, notificationOptions, function(notificationId){
	            //DO STUFF
	        });
	});
}

function cleanUp(e) {
	//TODO: Add code to clean up topics,mailbox watch, etc.
	gapi.client.gmail.users.stop({
	    'userId': 'me'
	});
}

function getLabels(request, sendResponse) {
    var labelList;
    gapi.client.gmail.users.labels.list({
        'userId': 'me'
    }).then(function(response){
        labelList = response;
        sendResponse({action: request.action, status: "completed", labels: labelList});
    });
    //return labelList;
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
            getLabels();
            //sendResponse({action: request.action, status: "completed", labels: labelList});
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
        console.log("Updated global variable authenticated to match the one in sync storage.");
        authenticated = changes.authenticated.newValue;
        var badgeText;
        chrome.browserAction.getBadgeText({}, function(result){badgeText=result;});
        if (changes.authenticated.newValue == true && badgeText == '!') {
            chrome.browserAction.setBadgeText('');
        }
    }
    if (typeof changes.CONFIGURATION != 'undefined') {
        console.log("Updated global variable CONFIGURATION to match the one in sync storage.");
        CONFIGURATION = changes.CONFIGURATION.newValue;
    }
    if (typeof changes.subscription != 'undefined') {
        console.log("Updated global variable subscription to match the one in sync storage.");
        subscription = changes.subscription.newValue;
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