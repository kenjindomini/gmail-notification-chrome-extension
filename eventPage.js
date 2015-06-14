if (typeof document != 'undefined'){
	var head = document.getElementsByTagName('head')[0];
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = "https://apis.google.com/js/client.js";
	head.appendChild(script);
	//oauth2 auth
	chrome.identity.getAuthToken(
		{'interactive': true},
		function(){
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
    	});
    //Subscribe to the topic.
    var subscription;
    gapi.client.pubsub.projects.subscriptions.create({
    	'topic': topic.name,
    	'ackDeadlineSeconds': 300
    }).then(function(response){
    	subscription = response;
    });
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
    gapi.client.gmail.users.watch({
    	'userId': 'me',
    	'Request body': {
    		"topicName": topicName
    	}
    });
}