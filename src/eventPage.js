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
chrome.runtime.onMessage.addListener(messageHandler);
chrome.storage.onChanged.addListener(storageOnChangeHandler);
window.gapi_onload = function() {
    init();
};

function init() {
    syncStorage();
    //Try to authenticate with a cached token.
    authorize();

}

function syncStorage() {
    console.log("syncing storage...");
    chrome.storage.local.set({authenticated: authenticated,
        subscription: subscription
    });
    console.log("globar var CONFIGURATION = ");
    console.log(CONFIGURATION);
    chrome.storage.sync.get('CONFIGURATION', function(items) {
        console.log("chrome.storage.sync.get returned: ");
        console.log(items);
        if (typeof items != 'undefined') {
            console.log("Assiging sync CONFIGURATION to global var.")
            CONFIGURATION = items.CONFIGURATION;
        }
        else {
            console.log("Assiging global var to sync CONFIGURATION.")
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
		        chrome.storage.local.set({'authenticated': true});
		        sendResponse({action: request.action, status: "completed"});
		        gapi.auth.setToken({
		            'access_token': token
                });
		    }
            else {
                console.log("getAuthToken(interactive: true) not successful.");
                sendResponse({action: request.action, status: "failed"});
                chrome.browserAction.setBadgeText({text: '!'});
            }
		}
	);
}

function authorize(){
	//oauth2 auth
	chrome.identity.getAuthToken(
		{'interactive': false
		}, function(token){
		    if (typeof token != 'undefined') {
		        console.log("getAuthToken(interactive: false) successful.");
		        chrome.storage.local.set({'authenticated': true});
		        gapi.auth.setToken({
		            'access_token': token
                });
		    }
		    else {
		        console.log("getAuthToken(interactive: false) not successful.");
		        chrome.storage.local.set({'authenticated': false});
		        chrome.browserAction.setBadgeText({text: '!'});
		    }
		}
	);
}

function loadApi() {
    gapi.client.load('pubsub', 'v1', function(){
        console.log("Google Cloud PubSub API loaded.");
        gapi.client.load('gmail', 'v1', gmailAPILoaded);
    });
}

function gmailAPILoaded(){
    console.log("gmail api loaded.");
    authorize();
    gapi.client.gmail.users.getProfile({
    	'userId': 'me',
    	'fields': 'emailAddress'
    }).then(cb_getUsersProfile_Success, cb_getUsersProfile_Error);
}

function cb_getUsersProfile_Success(response) {
    console.log("gapi.client.gmail.users.getProfile returned: ");
    console.log(response);
    var userID = response.result.emailAddress.replace('@', '');
    var topicName = "projects/gmail-desktop-notifications/topics/"+userID;
    authorize();
    gapi.client.pubsub.projects.topics.create({
    	'name': topicName
    }).then(cb_pubsubCreateTopic_Success, cb_pubsubCreateTopic_Error);
}

function cb_getUsersProfile_Error(response) {
    console.log("gapi.client.gmail.users.getProfile returned an error.");
    console.log(response);
    throw "gapi error in gapi.client.gmail.users.getProfile";
}

function cb_pubsubCreateTopic_Success(response) {
    console.log("gapi.client.pubsub.projects.topics.create returned: ");
    console.log(response);
    var topic = response.result;
    chrome.storage.local.set({'topic': topic});
    //Subscribe to the topic.
    authorize();
    var subname = topic.name.replace("/topics/", "/subscriptions/");
    gapi.client.pubsub.projects.subscriptions.create({
        'name': subname,
	    'topic': topic.name,
	    'ackDeadlineSeconds': 300
    }).then(cb_pubsubCreateSubscription_Success, cb_pubsubCreateSubscription_Error);
}

function cb_pubsubCreateTopic_Error(response) {
    console.log("gapi.client.pubsub.projects.topics.create returned an error.");
    console.log(response);
    throw "gapi error in gapi.client.pubsub.projects.topics.create";
}

function cb_pubsubCreateSubscription_Success(response) {
    console.log("gapi.client.pubsub.projects.subscriptions.create returned: ");
    console.log(response);
    chrome.storage.local.set({'subscription': response.result});
    var topicName = response.result.topic;
    //Allow Gmail to publish messages to our topic.
    authorize();
    gapi.client.pubsub.projects.topics.setIamPolicy({
        'resource': topicName,
        'policy': {
            'bindings': [{
                'role': "roles/pubsub.publisher",
                'members': ["serviceAccount:gmail-api-push@system.gserviceaccount.com"]
         }]
        }
    }).then(cb_pubsubTopicsSetIamPolicy_Success, cb_pubsubTopicsSetIamPolicy_Error);
}

function cb_pubsubCreateSubscription_Error(response) {
    console.log("gapi.client.pubsub.projects.subscriptions.create returned an error.");
    console.log(response);
    throw "gapi error in gapi.client.pubsub.projects.subscriptions.create";
}

function cb_pubsubTopicsSetIamPolicy_Success(response) {
    console.log("gapi.client.pubsub.projects.topics.setIamPolicy returned: ");
    console.log(response);
    var config;
    chrome.storage.sync.get('CONFIGURATION', function(syncStorage){
    	config = syncStorage.CONFIGURATION;
    	chrome.storage.local.get('topic', function(result){
        	var topicName = result.topic.name;
        	//Tell api to publish notifications of new gmail messages to topic.
        	authorize();
        	gapi.client.gmail.users.watch({
        	    'userId': 'me',
        	    "topicName": topicName,
        	    "labelIds": config.monitorLabels
        	}).then(cb_gmailWatch_Success, cb_gmailWatch_Error);
    	});
	});
}

function cb_pubsubTopicsSetIamPolicy_Error(response) {
    console.log("gapi.client.pubsub.projects.topics.setIamPolicy returned an error.");
    console.log(response);
    throw "gapi error in gapi.client.pubsub.projects.topics.setIamPolicy";
}

function cb_gmailWatch_Success(response) {
    console.log("gapi.client.gmail.users.watch returned: ");
    console.log(response);
    //poll topic every 30 seconds.
    window.setInterval(function(){pullNotifications();}, CONFIGURATION.pullInterval);
}

function cb_gmailWatch_Error(response) {
    console.log("gapi.client.gmail.users.watch returned an error.");
    console.log(response);
    throw "gapi error in gapi.client.gmail.users.watch";
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
	authorize();
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
	    console.log("option attributes from pull request = ");
	    console.log(response.attributes);
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
	authorize();
	gapi.client.gmail.users.stop({
	    'userId': 'me'
	}).then(function(response) {
	    console.log("gapi.client.gmail.users.stop returned:");
	    console.log(response);
	    chrome.storage.local.get('topic', function(topic){
	        var topicName = topic.name;
	        authorize();
    	    gapi.client.pubsub.projects.topics.delete({
            	'topic': topicName
        	}).then(function(response){
        	    console.log("gapi.client.pubsub.projects.topics.delete returned:");
	            console.log(response);
        	});
            authorize();
            gapi.client.pubsub.projects.subscriptions.delete({
                'subscription': subscription
            }).then(function(response){
        	    console.log("gapi.client.pubsub.projects.subscriptions.delete returned:");
	            console.log(response);
        	});
	    });
	});
}

function getLabels(request, sendResponse) {
    var labelList;
    authorize();
    gapi.client.gmail.users.labels.list({
        'userId': 'me'
    }).then(function(response){
        console.log("gapi.client.gmail.users.labels.list returned:");
        console.log(response);
        labelList = response.result.labels; //this may need to be parsed further.
        sendResponse({action: request.action, status: "completed", labels: labelList});
    });
    //return labelList;
}

function messageHandler(request, sender, sendResponse) {
    console.log("messageHandler received request:");
    console.log(request);
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
            getLabels(request, sendResponse);
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
    console.log("storageOnChangeHandler called: areaname= " + areaName + " ,changes= ");
    console.log(changes);
    if (typeof changes.authenticated != 'undefined') {
        console.log("Updated global variable authenticated to match the one in local storage.");
        console.log(authenticated);
        authenticated = changes.authenticated.newValue;
        var badgeText;
        chrome.browserAction.getBadgeText({}, function(result){badgeText=result;});
        console.log("getBadgeText() returned:");
        console.log(badgeText);
        if (changes.authenticated.newValue == true && badgeText == '!') {
            chrome.browserAction.setBadgeText('');
        }
        if (changes.authenticated.oldValue == false && changes.authenticated.newValue == true) {
            loadApi();
        }
    }
    if (typeof changes.CONFIGURATION != 'undefined') {
        console.log("Updated global variable CONFIGURATION to match the one in sync storage.");
        console.log(CONFIGURATION);
        CONFIGURATION = changes.CONFIGURATION.newValue;
    }
    if (typeof changes.subscription != 'undefined') {
        console.log("Updated global variable subscription to match the one in local storage.");
        console.log(subscription);
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