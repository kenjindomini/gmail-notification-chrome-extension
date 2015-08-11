var vm = require("vm");
var fs = require("fs");
var chrome = require("sinon-chrome");

describe('event page', function() {
    this.timeout(4000);
    
/*    it('should sync cloud CONFIGURATION to global var CONFIGURATION, if exists', function(done){
        page.open('empty.html', function() {
            page.evalulate(function(localStorage) {
                chrome.storage.sync.get.withArgs('CONFIGURATION').yields(JSON.parse(localStorage));
            }, fs.read('data/chrome.storage.sync.get-CONFIGURATION_good.json'));
            page.injectJs('../src/eventPage.js');
            page.evalulate(function() {
                
            });
        });
        done();
    });*/
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
});