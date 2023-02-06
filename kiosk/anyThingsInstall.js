//
//  anyThingsInstall.js
//
//  Created by Alezia Kurdis, February 5th, 2023.
//  Copyright 2023, Overte e.V.
//
//  Installer for the application AnyThings.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
(function() {
    var MAX_CLICKABLE_DISTANCE_M = 5;
    var appScriptUrl = "https://aleziakurdis.github.io/anyThings/app-anyThings.js";
    var confirmationSound = SoundCache.getSound("https://aleziakurdis.github.io/anyThings/sounds/confirmation.mp3");
    // Constructor
    var _this = null;

    function clickableUI() {
        _this = this;
        this.entityID = null;
    }

    function confirmation() { //Play a confirmation sound
        var injector = Audio.playSound(confirmationSound, {
            "volume": 0.3,
            "localOnly": true
        });
    }
    
    // Entity methods
    clickableUI.prototype = {
        preload: function (id) {
            _this.entityID = id;
            HMD.displayModeChanged.connect(this.displayModeChangedCallback);
        },

        displayModeChangedCallback: function() {
            if (_this && _this.entityID) {
                //Nothing
            }
        },

        mousePressOnEntity: function (entityID, event) {
            if (event.isPrimaryButton && 
                Vec3.distance(MyAvatar.position, Entities.getEntityProperties(_this.entityID, ["position"]).position) <= MAX_CLICKABLE_DISTANCE_M) {

                    var running = false;
                    var runningScripts = ScriptDiscoveryService.getRunning();
                    for (var i = 0; i < runningScripts.length; i++) {
                        if (runningScripts[i].url === appScriptUrl) {
                            running = true;
                            break;
                        }
                    }
                    if (!running) {
                        ScriptDiscoveryService.loadScript(appScriptUrl, true, false, false, true, false);
                        Window.displayAnnouncement("'AnyThings' application installed with succes.");
                        confirmation();
                    } else {
                        //print("Already running!");
                    }
            }
        },

        unload: function () {
            HMD.displayModeChanged.disconnect(this.displayModeChangedCallback);
        }
    };

    
    return new clickableUI();

});
