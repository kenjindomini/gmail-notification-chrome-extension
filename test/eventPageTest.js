/*global
    describe, it, page, CONFIGURATION
*/
var fs = require("fs");
var chrome = require("sinon-chrome");
var sinon = require("sinon");
var expect = require('chai').expect;

describe('event page', function() {
    this.timeout(4000);
    
    it('should sync cloud CONFIGURATION to global var CONFIGURATION, if exists', function(done){
        page.open('empty.html', function() {
            var config;
            page.evalulate(function(cloudStorage) {
                config = JSON.parse(cloudStorage);
                chrome.storage.sync.get.withArgs('CONFIGURATION').yields(config);
            }, fs.read('data/chrome.storage.sync.get-CONFIGURATION_good.json'));
            page.injectJs('../src/eventPage.js');
            page.evalulate(function() {
                expect(CONFIGURATION).to.equal(config);
            });
        });
        done();
    });
    it('should sync global var CONFIGURATION to cloud CONFIGURATION, if it does not exist', function(done){
        page.open('empty.html', function() {
            page.evalulate(function(cloudStorage) {
                chrome.storage.sync.get.withArgs('CONFIGURATION').yields(JSON.parse(cloudStorage));
                chrome.storage.onChanged.trigger({});
            }, fs.read('data/chrome.storage.sync.get-CONFIGURATION_bad.json'));
            page.injectJs('../src/eventPage.js');
            page.evalulate(function() {
                sinon.assert.calledWithMatch(chrome.storage.sync.set, {'CONFIGURATION': {
                    pullInterval: 30000,
                    monitorLabels: [
                        'CATEGORY_PERSONAL',
                        'CATEGORY_SOCIAL',
                        'CATEGORY_FORUMS',
                        'CATEGORY_UPDATES'
                    ]
                }});
            });
        });
        done();
    });
    
    //test failed authentication causes '!' badgeText
    it("should set badgeText to '!' if authentication failed", function(done) {
        page.open('empty.html', function() {
            page.evalulate(function(auth) {
                chrome.identity.getAuthToken.yields(JSON.parse(auth));
            }, fs.read('data/chrome.identity.getAuthToken_bad.json'));
            page.injectJs('../src/eventPage.js');
            page.evalulate(function() {
                sinon.assert.calledWithMatch(chrome.browserAction.setBadgeText,
                {text: '!'});
            });
        });
        done();
    });
    //test '!' is removed after interactive auth
    it("should set badgeText to '' if authentication succeeds", function(done) {
        page.open('empty.html', function() {
            page.evalulate(function(auth) {
                chrome.identity.getAuthToken.yields(JSON.parse(auth));
                chrome.browserAction.getBadgeText.yields('!');
            }, fs.read('data/chrome.identity.getAuthToken_good.json'));
            page.injectJs('../src/eventPage.js');
            page.evalulate(function() {
                sinon.assert.calledWithMatch(chrome.browserAction.setBadgeText,
                {text: ''});
            });
        });
        done();
    });
    
    //TODO: figure out how to test message handler
    ////will involve testing setConfig and getLabels
    
    //stub and test gapi calls.
    
    //test pullNotifications responds as expected to no new messages
    /*it("should log 'no new messages' when there are no messages in the" +
    " subscription", function(done) {
        var subscriptionPull = sinon.stub(gapi.client.pubsub.projects.subscriptions, "pull");
        sinon.spy(console, "log");
        page.open('empty.html', function() {
            page.evalulate(function(pull) {
                subscriptionPull.yields(JSON.parse(pull));
            }, fs.read('data/gapi.client.pubsub.projects.subscriptions.pull_noMessages.json'));
            page.evalulate(function(storageGet){
                chrome.storage.sync.get.withArgs(['subscription',
                'mailboxHistoryId']).yields(storageGet);
            }, fs.read('data/chrome.storage.sync.get-pull_noNew.json'));
            page.injectJs('../src/eventPage.js');
            page.evalulate(function() {
                pullNotifications();
                sinon.assert.calledWithMatch(console.log, 'no new messages found.');
            });
        });
        done();
    });*/
    
    //test pullNotifications responds as expected with new messages
});