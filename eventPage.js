var head = document.getElementsByTagName('head')[0];
var script = document.createElement('script');
script.type = 'text/javascript';
script.src = "https://apis.google.com/js/client.js?onload=callbackFunction";
head.appendChild(script);
//oauth2 auth
chrome.identity.getAuthToken(
	{'interactive': true},
	function(){
	  //load Google's javascript client libraries
		//window.gapi_onload = authorize;
		//loadScript('https://apis.google.com/js/client.js');
	}
);
 
/*function loadScript(url){
  var request = new XMLHttpRequest();
 
	request.onreadystatechange = function(){
		if(request.readyState !== 4) {
			return;
		}
 
		if(request.status !== 200){
			return;
		}
 
    eval(request.responseText);
	};
 
	request.open('GET', url);
	request.send();
}*/
 
function authorize(){
  gapi.auth.authorize(
		{
			client_id: '107921446115-71iua4ttnpqf3l2ud11egvrnc6t3od7p.apps.googleusercontent.com',
			immediate: true,
			scope: 'https://www.googleapis.com/auth/gmail.readonly'
		},
		function(){
		  gapi.client.load('gmail', 'v1', gmailAPILoaded);
		}
	);
}
 
function gmailAPILoaded(){
    console.log("gmail api loaded.")
}