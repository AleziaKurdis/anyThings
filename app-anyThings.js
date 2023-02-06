//
//  app-anyThings.js
//
//  Created by Alezia Kurdis, January 28th, 2023.
//  Copyright 2023 Overte e.V.
//
//  Application to share content that can be directly used.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//    
(function() {
    var ROOT = Script.resolvePath('').split("app-anyThings.js")[0];
    var DEV_PARAMETER = Script.resolvePath('').split("?")[1];
    var APP_NAME = "ANYTHINGS";
    var APP_URL = ROOT + "anyThings.html";
    var APP_ICON_INACTIVE = ROOT + "appicon_i.png";
    var APP_ICON_ACTIVE = ROOT + "appicon_a.png";
    var appStatus = false;
    var lastProcessing = {
            "action": "",
            "url": ""
        };

    var channel = "overte.application.ak.anyThings";
    var timestamp = 0;
    var INTERCALL_DELAY = 200; //0.3 sec
    var INSUFFICIENT_PERMISSIONS_IMPORT_ERROR_MSG = "You do not have the necessary permissions to place items on this domain.";

    var confirmationSound = SoundCache.getSound(ROOT + "sounds/confirmation.mp3");
    var rejectionSound = SoundCache.getSound(ROOT + "sounds/rejection.mp3");

    var tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
    tablet.screenChanged.connect(onScreenChanged);
    var button = tablet.addButton({
        text: APP_NAME,
        icon: APP_ICON_INACTIVE,
        activeIcon: APP_ICON_ACTIVE
    });
    
    function clicked() {
        if (appStatus) {
            tablet.webEventReceived.disconnect(onAppWebEventReceived);
            tablet.gotoHomeScreen();
            appStatus = false;
        } else {
            tablet.gotoWebScreen(APP_URL);
            tablet.webEventReceived.connect(onAppWebEventReceived);
            appStatus = true;
        }
        button.editProperties({
            isActive: appStatus
        });
    }

    button.clicked.connect(clicked);

    function sendRunningScriptList() {
        var currentlyRunningScripts = ScriptDiscoveryService.getRunning();
        var newMessage = "RSL4ANYTHINGS:";
        var runningScriptJson;
        for (var j = 0; j < currentlyRunningScripts.length; j++) {
            runningScriptJson = currentlyRunningScripts[j].url;
            newMessage += "_" + runningScriptJson;
        }
        tablet.emitScriptEvent(newMessage);
    }

    function onAppWebEventReceived(message) {       
        if (typeof message === "string") {
            var d = new Date();
            var n = d.getTime();
            var instruction = JSON.parse(message);
            if (instruction.channel === channel) {
                if (instruction.action === "installScript") {
                    if (lastProcessing.action !== instruction.action || lastProcessing.url !== instruction.url) {
                        ScriptDiscoveryService.loadScript(instruction.url, true, false, false, true, false); // Force reload the script, do not use cache.
                        lastProcessing.action = instruction.action;
                        lastProcessing.url = instruction.url;
                        Script.setTimeout(function() {
                            sendRunningScriptList(); 
                        }, 1500);
                    }
                }

                if (instruction.action === "uninstallScript") {
                    if (lastProcessing.action !== instruction.action || lastProcessing.url !== instruction.url) {
                        ScriptDiscoveryService.stopScript(instruction.url, false);
                        lastProcessing.action = instruction.action;
                        lastProcessing.url = instruction.url;
                        Script.setTimeout(function() {
                            sendRunningScriptList(); 
                        }, 1500);
                    }
                }

                if (instruction.action === "selfUninstall" && (n - timestamp) > INTERCALL_DELAY) {
                    d = new Date();
                    timestamp = d.getTime();
                    ScriptDiscoveryService.stopScript(Script.resolvePath(''), false);
                }

                if (instruction.action === "wearAvatar" && (n - timestamp) > INTERCALL_DELAY) {
                    d = new Date();
                    timestamp = d.getTime();
                    MyAvatar.useFullAvatarURL(instruction.url);
                }

                if (instruction.action === "createMaterialFromJson" && (n - timestamp) > INTERCALL_DELAY) {
                    d = new Date();
                    timestamp = d.getTime();
                    createMaterial(instruction.url);
                }

                if (instruction.action === "importEntitiesJson" && (n - timestamp) > INTERCALL_DELAY) {
                    d = new Date();
                    timestamp = d.getTime();
                    importEntitiesFromJson(instruction.url);
                }

                if (instruction.action === "createModel" && (n - timestamp) > INTERCALL_DELAY) {
                    d = new Date();
                    timestamp = d.getTime();
                    createModel(instruction.url);
                }

                if (instruction.action === "navigateToUrl" && (n - timestamp) > INTERCALL_DELAY) {
                    d = new Date();
                    timestamp = d.getTime();
                    Window.location = instruction.url;
                }

                if (instruction.action === "requestRunningScriptData") {
                    sendRunningScriptList();
                }
            }
        }
    }

    function getFileNameFromUrl(url) {
        var parts = url.split("/");
        return parts[parts.length - 1];
        
    }

    function createModel(modelUrl) {
        if (!Entities.canRez() && !Entities.canRezTmp()) {
            rejection();
            Window.displayAnnouncement(INSUFFICIENT_PERMISSIONS_IMPORT_ERROR_MSG);
            return;
        } else {
            var id = Entities.addEntity({
                    "name": getFileNameFromUrl(modelUrl),
                    "type": "Model",
                    "modelURL": modelUrl,
                    "shapeType": "static-mesh",
                    "position": Vec3.sum(MyAvatar.position, Vec3.multiplyQbyV(MyAvatar.orientation, { x: 0, y: 0, z: -4 })),
                    "grab": {
                        "grabbable": false
                    },
                    "useOriginalPivot": true
            }, "domain");
            confirmation();
        }        
    }

    function createMaterial(materialUrl) {
        if (!Entities.canRez() && !Entities.canRezTmp()) {
            rejection();
            Window.displayAnnouncement(INSUFFICIENT_PERMISSIONS_IMPORT_ERROR_MSG);
            return;
        } else {
            var id = Entities.addEntity({
                    "name": getFileNameFromUrl(materialUrl),
                    "type": "Material",
                    "materialURL": materialUrl,
                    "position": Vec3.sum(MyAvatar.position, Vec3.multiplyQbyV(MyAvatar.orientation, { x: 0, y: 0, z: -3 })),
                    "grab": {
                        "grabbable": true
                    }
            }, "domain");
            confirmation();
        }        
    }

    //IMPORT ENTITIES FROM JSON #################################
    var HALF_TREE_SCALE = 16384;

    function importEntitiesFromJson(importURL) {
        if (!Entities.canRez() && !Entities.canRezTmp()) {
            rejection();
            Window.displayAnnouncement(INSUFFICIENT_PERMISSIONS_IMPORT_ERROR_MSG);
            return;
        }

        var success = Clipboard.importEntities(importURL);

        if (success) {
            var VERY_LARGE = 10000;
            var isLargeImport = Clipboard.getClipboardContentsLargestDimension() >= VERY_LARGE;
            var position = Vec3.ZERO;
            if (!isLargeImport) {
                position = getPositionToCreateEntity(Clipboard.getClipboardContentsLargestDimension() / 2);
            }
            if (position !== null && position !== undefined) {
                var pastedEntityIDs = Clipboard.pasteEntities(position);
                if (!isLargeImport) {
                    // The first entity in Clipboard gets the specified position with the rest being relative to it. Therefore, move
                    // entities after they're imported so that they're all the correct distance in front of and with geometric mean
                    // centered on the avatar/camera direction.
                    var deltaPosition = Vec3.ZERO;
                    var entityPositions = [];
                    var entityParentIDs = [];

                    var propType = Entities.getEntityProperties(pastedEntityIDs[0], ["type"]).type;
                    var NO_ADJUST_ENTITY_TYPES = ["Zone", "Light", "ParticleEffect"];
                    if (NO_ADJUST_ENTITY_TYPES.indexOf(propType) === -1) {
                        var targetDirection;
                        if (Camera.mode === "entity" || Camera.mode === "independent") {
                            targetDirection = Camera.orientation;
                        } else {
                            targetDirection = MyAvatar.orientation;
                        }
                        targetDirection = Vec3.multiplyQbyV(targetDirection, Vec3.UNIT_Z);

                        var targetPosition = getPositionToCreateEntity();
                        var deltaParallel = HALF_TREE_SCALE;  // Distance to move entities parallel to targetDirection.
                        var deltaPerpendicular = Vec3.ZERO;  // Distance to move entities perpendicular to targetDirection.
                        for (var i = 0, length = pastedEntityIDs.length; i < length; i++) {
                            var curLoopEntityProps = Entities.getEntityProperties(pastedEntityIDs[i], ["position", "dimensions",
                                "registrationPoint", "rotation", "parentID"]);
                            var adjustedPosition = adjustPositionPerBoundingBox(targetPosition, targetDirection,
                                curLoopEntityProps.registrationPoint, curLoopEntityProps.dimensions, curLoopEntityProps.rotation);
                            var delta = Vec3.subtract(adjustedPosition, curLoopEntityProps.position);
                            var distance = Vec3.dot(delta, targetDirection);
                            deltaParallel = Math.min(distance, deltaParallel);
                            deltaPerpendicular = Vec3.sum(Vec3.subtract(delta, Vec3.multiply(distance, targetDirection)),
                                deltaPerpendicular);
                            entityPositions[i] = curLoopEntityProps.position;
                            entityParentIDs[i] = curLoopEntityProps.parentID;
                        }
                        deltaPerpendicular = Vec3.multiply(1 / pastedEntityIDs.length, deltaPerpendicular);
                        deltaPosition = Vec3.sum(Vec3.multiply(deltaParallel, targetDirection), deltaPerpendicular);
                    }

                    if (!Vec3.equal(deltaPosition, Vec3.ZERO)) {
                        for (var editEntityIndex = 0, numEntities = pastedEntityIDs.length; editEntityIndex < numEntities; editEntityIndex++) {
                            if (Uuid.isNull(entityParentIDs[editEntityIndex])) {
                                Entities.editEntity(pastedEntityIDs[editEntityIndex], {
                                    position: Vec3.sum(deltaPosition, entityPositions[editEntityIndex])
                                });
                            }
                        }
                    }
                }
                confirmation();
            } else {
                rejection();
                Window.displayAnnouncement("Can't import entities: entities would be out of bounds.");
            }
        } else {
            rejection();
            Window.displayAnnouncement("There was an error importing the entity file.");
        }
    }

    function getPositionToCreateEntity(extra) {
        var CREATE_DISTANCE = 2;
        var position;
        var delta = extra !== undefined ? extra : 0;
        if (Camera.mode === "entity" || Camera.mode === "independent") {
            position = Vec3.sum(Camera.position, Vec3.multiply(Quat.getForward(Camera.orientation), CREATE_DISTANCE + delta));
        } else {
            position = Vec3.sum(MyAvatar.position, Vec3.multiply(Quat.getForward(MyAvatar.orientation), CREATE_DISTANCE + delta));
        }

        if (position.x > HALF_TREE_SCALE || position.y > HALF_TREE_SCALE || position.z > HALF_TREE_SCALE) {
            return null;
        }
        return position;
    }

    function adjustPositionPerBoundingBox(position, direction, registration, dimensions, orientation) {
        // Adjust the position such that the bounding box (registration, dimensions and orientation) lies behind the original
        // position in the given direction.
        var CORNERS = [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 1, z: 1 },
            { x: 1, y: 0, z: 0 },
            { x: 1, y: 0, z: 1 },
            { x: 1, y: 1, z: 0 },
            { x: 1, y: 1, z: 1 },
        ];

        // Go through all corners and find least (most negative) distance in front of position.
        var distance = 0;
        for (var i = 0, length = CORNERS.length; i < length; i++) {
            var cornerVector =
                Vec3.multiplyQbyV(orientation, Vec3.multiplyVbyV(Vec3.subtract(CORNERS[i], registration), dimensions));
            var cornerDistance = Vec3.dot(cornerVector, direction);
            distance = Math.min(cornerDistance, distance);
        }
        position = Vec3.sum(Vec3.multiply(distance, direction), position);
        return position;
    }

    //########################## END IMPORT ENTITIES FROM JSON

    function confirmation() { //Play a confirmation sound
        var injector = Audio.playSound(confirmationSound, {
            "volume": 0.3,
            "localOnly": true
        });
    }

    function rejection() { //Play a rejection sound
        var injector = Audio.playSound(rejectionSound, {
            "volume": 0.3,
            "localOnly": true
        });
    }

    function onScreenChanged(type, url) {
        if (type === "Web" && url.indexOf(APP_URL) !== -1) {
            appStatus = true;
        } else {
            appStatus = false;
        }       
        button.editProperties({
            isActive: appStatus
        });
    }

    function cleanup() {
        if (appStatus) {
            tablet.gotoHomeScreen();
            tablet.webEventReceived.disconnect(onAppWebEventReceived);
        }
        tablet.screenChanged.disconnect(onScreenChanged);
        tablet.removeButton(button);
    }

    Script.scriptEnding.connect(cleanup);
}());
