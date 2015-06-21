window.addEventListener("beforeunload", cleanUp, false);
chrome.runtime.onMessage.addListener(messageHandler(request, sender, sendResponse));
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
if (typeof document != 'undefined'){
	var head = document.getElementsByTagName('head')[0];
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = "https://apis.google.com/js/client.js";
	head.appendChild(script);
}

function authenticate() {
    //oauth2 auth
	chrome.identity.getAuthToken(
		{'interactive': true
		},
		function(token){
		    if (typeof token != 'undefined') {
		        authenticated = true;
		        loadApi();
		    }
		}
	);
}

function authorize(){
/*	gapi.auth.authorize(
		{
			client_id: '107921446115-71iua4ttnpqf3l2ud11egvrnc6t3od7p.apps.googleusercontent.com',
			immediate: true,
			scopes: [
      			"https://www.googleapis.com/auth/gmail.readonly",
      			"https://www.googleapis.com/auth/pubsub"
    		]
		},
		function(){
			gapi.client.load('pubsub', 'v1beta2', null);
			gapi.client.load('gmail', 'v1', gmailAPILoaded);
		}
	);*/
	//oauth2 auth
	chrome.identity.getAuthToken(
		{'interactive': false
		},
		function(token){
		    if (typeof token != 'undefined') {
		        authenticated = true;
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
            authenticate();
            if (authenticated == true) {
                sendResponse({action: request.action, status: "completed"});
            }
            else {
                sendResponse({action: request.action, status: "failed"});
            }
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

function setConfig(config) {
    if (typeof config.pullInterval != 'undefined') {
        CONFIGURATION.pullInterval = config.pullInterval;
    }
    if (typeof config.monitorLabels != 'undefined') {
        CONFIGURATION.monitorLabels = config.monitorLabels;
    }
}