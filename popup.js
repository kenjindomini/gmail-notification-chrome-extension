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

function getLabels() {
    chrome.runtime.sendMessage({action: "getLabels"}, function(response){
        labelList = response.labels;
    });
}

function authorize() {
    
}

function getConfig() {
    
}

function setConfig() {
    
}

function createLabelList() {
    
}