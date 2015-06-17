window.addEventListener("beforeunload", cleanUp, false);
chrome.runtime.onMessage.addListener(messageHandler(request, sender, sendResponse));
var CONFIGURATION = {
    'pullInterval': 30000, //TODO: make timer configurable via popup.html.
    'monitorLabels': [
        'CATEGORY_PERSONAL',
        'CATEGORY_SOCIAL',
        'CATEGORY_FORUMS',
        'CATEGORY_UPDATES'
        ] //list should be configured via popup.html.
}
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
		function(){
		    authorize();
		}
	);
}
function authorize(){
	gapi.auth.authorize(
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
	);
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
    if (request.action == "setConfig") {
        setConfig(request.config);
        sendResponse({action: request.action, status: "completed"});
    }
    if (request.action == "getLabels") {
        var labelList = setLabels();
        sendResponse({action: request.action, status: "completed", labels: labelList});
    }
    if (request.action == "authenticate") {
        authenticate();
        sendResponse({action: request.action, status: "completed"});
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