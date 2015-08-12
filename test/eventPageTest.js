//var vm = require("vm");
var fs = require("fs");
var chrome = require("sinon-chrome");
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
    
    //test '!' is removed after interactive auth
    
    //test pullNotifications responds as expected to no new messages
    
    //test pullNotifications responds as expected with new messages
    
    //TODO: figure out how to test message handler
    ////will involve testing setConfig and getLabels
    
    //stub and test gapi calls.
});