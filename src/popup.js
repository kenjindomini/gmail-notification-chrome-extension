var CONFIGURATION = {
    pullInterval: 30000,
    monitorLabels: [
        'CATEGORY_PERSONAL',
        'CATEGORY_SOCIAL',
        'CATEGORY_FORUMS',
        'CATEGORY_UPDATES'
        ]
};
var labelList;

document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('#submitConfig').addEventListener('click', setConfig);
    var authStatus = getAuthStatus();
    getConfig();
    if(authStatus == true) {
    getLabels();
    createLabelList();
    }
});

function getLabels() {
    chrome.runtime.sendMessage({action: "getLabels"}, function(response){
        console.log('chrome.runtime.sendMessage({action: "getLabels"}) returned:');
        console.log(response);
        labelList = response.labels;
    });
}

function authorize() {
    chrome.runtime.sendMessage({action: "authenticate"}, function(response){
        console.log('chrome.runtime.sendMessage({action: "authenticate"}) returned:');
        console.log(response);
        if (response.status == "success") {
            var authorizeDiv = document.getElementById("authorizeDiv");
            while (authorizeDiv.firstChild) {
                authorizeDiv.removeChild(authorizeDiv.firstChild);
            }
            getLabels();
            createLabelList();
        } 
        else {
            var authorizeText = document.getElementById("authorizeText");
            authorizeText.textContent = "Authorization was canceled or aborted. Authorization is required for this extension.";
        }
    });
}

function getConfig() {
    chrome.runtime.sendMessage({action: "getConfig"}, function(response){
        console.log('chrome.runtime.sendMessage({action: "getConfig"}) returned:');
        console.log(response);
        CONFIGURATION = response.config;
    });
    var pullIntervalTextInput = document.getElementById("pullInterval");
    pullIntervalTextInput.value = CONFIGURATION.pullInterval;
}

function setConfig() {
    //TODO collect config values from popup.html.
    chrome.runtime.sendMessage({action: "setConfig", config: CONFIGURATION}, function(response){
        console.log('chrome.runtime.sendMessage({action: "setConfig", config: CONFIGURATION}) returned:');
        console.log(response);
    });
}

function getAuthStatus() {
    chrome.runtime.sendMessage({action: "getAuthStatus"}, function(response){
        console.log('chrome.runtime.sendMessage({action: "getAuthStatus"}) returned:');
        console.log(response);
        if(response.authStatus == false) {
            createAuthorizeButton();
        }
        return response.authStatus;
    });
}

function createLabelList() {
    var labelListDiv = document.getElementById("labelList");
    labelList.foreach(function(currentValue, index, array){
       var checkbox = document.createElement("input");
       checkbox.type = "checkbox";
       checkbox.name = "Labels";
       checkbox.value = currentValue.name;
       if (CONFIGURATION.monitorLabels.find(currentValue.id) != 'undefined'){
           checkbox.checked = true;
       }
       labelListDiv.appendChild(checkbox);
    });
}

function createAuthorizeButton() {
    var authorizeDiv = document.getElementById("authorize");
    var authorizeText = document.createElement("p");
    authorizeText.name = "authorizeText";
    authorizeText.id = "authorizeText";
    authorizeText.textContent = "We are not authorized to poll gmail. Please click 'Authorize' to use this extension.";
    var authorizeButton = document.createElement("input");
    authorizeButton.id = "authorizeButton";
    authorizeButton.name = "authorizeButton";
    authorizeButton.type = "button";
    authorizeButton.value = "Authorize";
    authorizeDiv.appendChild(authorizeText);
    authorizeDiv.appendChild(authorizeButton);
    document.querySelector('#authorizeButton').addEventListener('click', authorize);
}