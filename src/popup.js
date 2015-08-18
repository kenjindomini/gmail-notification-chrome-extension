/*property
    action, addEventListener, appendChild, authStatus, checked, config,
    createElement, find, firstChild, foreach, getElementById, id, labels, log,
    monitorLabels, name, pullInterval, querySelector, removeChild, runtime,
    sendMessage, status, textContent, type, value
*/
/*global
    chrome, window, console
*/
/*jslint
    browser: true
*/
var CONFIGURATION = {
    pullInterval: 30000,
    monitorLabels: [
        'CATEGORY_PERSONAL',
        'CATEGORY_SOCIAL',
        'CATEGORY_FORUMS',
        'CATEGORY_UPDATES'
    ]
};
//actions to be taken as soon as the DOM is loaded.
document.addEventListener('DOMContentLoaded', function() {
    'use strict';
    //when submit is clicked call setConfig()
    document.querySelector('#submitConfig').addEventListener('click',
        setConfig);
    //Call to the eventPage to check if we are authorized
    getAuthStatus().then(function(response) {
        var authStatus = response.authStatus;
        console.log('getAuthStatus returned with ' + authStatus);
        //get the running configuration from the eventPage.
        getConfig().then(function(response) {
            console.log('getConfig() returned with: ');
            console.log(response);
            if (authStatus === true) {
                //get list of all gmail labels from the eventPage.
                getLabels().then(function(response) {
                console.log('getLabels() returned: ');
                console.log(response);
                //pass the list of all labels to generate a list of checkboxes
                createLabelList(response.labelList);
                });
            }
        });
    });
});

function getLabels() {
    'use strict';
    var p = new Promise(function(resolve) {
        chrome.runtime.sendMessage({action: 'getLabels'}, function(response) {
            console.log('chrome.runtime.sendMessage({action: "getLabels"})' +
                ' returned:');
            console.log(response);
            var labelList = response.labels;
            resolve(labelList);
        });
    });
    return p;
}

function authorize() {
    'use strict';
    chrome.runtime.sendMessage({action: 'authenticate'}, function(response) {
        console.log('chrome.runtime.sendMessage({action: "authenticate"})' +
            ' returned:');
        console.log(response);
        if (response.status === 'success') {
            var authorizeDiv = document.getElementById('authorizeDiv');
            while (authorizeDiv.firstChild) {
                authorizeDiv.removeChild(authorizeDiv.firstChild);
            }
            getLabels().then(function(response) {
            console.log('getLabels() returned: ');
            console.log(response);
            createLabelList(response.labelList);
            });
        } else {
            var authorizeText = document.getElementById('authorizeText');
            authorizeText.textContent = 'Authorization was canceled or' +
                ' aborted. Authorization is required for this extension.';
        }
    });
}

function getConfig() {
    'use strict';
    var p = new Promise(function(resolve) {
        chrome.runtime.sendMessage({action: 'getConfig'}, function(response) {
            console.log('chrome.runtime.sendMessage({action: "getConfig"})' +
                ' returned:');
            console.log(response);
            CONFIGURATION = response.config;
            resolve(CONFIGURATION);
        });
        var pullIntervalTextInput = document.getElementById('pullInterval');
        pullIntervalTextInput.value = CONFIGURATION.pullInterval;
    });
    return p;
}

function setConfig() {
    'use strict';
    //to do: collect config values from popup.html.
    chrome.runtime.sendMessage({action: 'setConfig', config: CONFIGURATION},
    function(response) {
        console.log('chrome.runtime.sendMessage({action: "setConfig",' +
            ' config: CONFIGURATION}) returned:');
        console.log(response);
    });
}

function getAuthStatus() {
    'use strict';
    var p = new Promise(function(resolve) {
        chrome.runtime.sendMessage({action: 'getAuthStatus'},
        function(response) {
            console.log('chrome.runtime.sendMessage(' +
                '{action: "getAuthStatus"}) returned:');
            console.log(response);
            if (response.authStatus === false) {
                createAuthorizeButton();
            }
            resolve(response.authStatus);
        });
    });
    return p;
}

function createLabelList(labelList) {
    'use strict';
    var labelListDiv = document.getElementById('labelList');
    labelList.foreach(function(currentValue, index, array) {
        console.log('labelList-foreach index = ' + index + ' array = ');
        console.log(array);
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'Labels';
        checkbox.value = currentValue.name;
        if (CONFIGURATION.monitorLabels.find(currentValue.id) !== 'undefined') {
            checkbox.checked = true;
        }
        labelListDiv.appendChild(checkbox);
    });
}

function createAuthorizeButton() {
    'use strict';
    var authorizeDiv = document.getElementById('authorize');
    var authorizeText = document.createElement('p');
    authorizeText.name = 'authorizeText';
    authorizeText.id = 'authorizeText';
    authorizeText.textContent = 'We are not authorized to poll gmail. Please' +
        ' click \'Authorize\' to use this extension.';
    var authorizeButton = document.createElement('input');
    authorizeButton.id = 'authorizeButton';
    authorizeButton.name = 'authorizeButton';
    authorizeButton.type = 'button';
    authorizeButton.value = 'Authorize';
    authorizeDiv.appendChild(authorizeText);
    authorizeDiv.appendChild(authorizeButton);
    document.querySelector('#authorizeButton').addEventListener('click',
    authorize);
}
