// ==UserScript==
// @name         Krunker.io Map Editor Mod
// @description  Krunker.io Map Editor Mod
// @updateURL    https://github.com/Tehchy/Krunker.io-Map-Editor-Mod/raw/master/userscript.user.js
// @downloadURL  https://github.com/Tehchy/Krunker.io-Map-Editor-Mod/raw/master/userscript.user.js
// @version      1.1
// @author       Tehchy
// @match        https://krunker.io/editor.html
// @require      https://github.com/Tehchy/Krunker.io-Map-Editor-Mod/raw/master/prefabs.js
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

window.stop()
document.innerHTML = ""

class Mod {
    constructor() {
        this.hooks = {
            object: null,
            config: null,
            gui: null,
            three: null
        }
        this.settings = {
            degToRad: false /// Change to true JustProb <3
        }
        this.copy = null
        this.group = null
        this.rotation = 0
        this.prefabMenu = null
        this.onLoad()
    }

    objectSelected() {
        let selected = this.hooks.config.transformControl.object
        return selected ? selected : false
    }
    
    jsonInput() {
        let json = prompt("Import Object Json", "");
        if (json != null && json != "" && this.objectSelected()) this.replaceObject(json)
    }

    replaceObject(str) {
        let selected = this.objectSelected()
        if (!selected) {
            //this.hooks.config.addObject(this.hooks.object.defaultFromType("CUBE"))
            //selected = this.objectSelected()
        }
        if (selected) {
            this.hooks.config.removeObject()
            
            let jsp = JSON.parse(str);
            jsp = jsp.objects ? jsp.objects : jsp
            let center = this.findCenter(jsp)
            for (let ob of jsp) {
                if (this.rotation > 0) {
                    ob = this.rotateObject(ob, this.rotation)
                }
                
                ob.p[0] += selected.userData.owner.position.x - center[0]
                ob.p[1] += selected.userData.owner.position.y - (selected.scale.y / 2) - center[1]
                ob.p[2] += selected.userData.owner.position.z - center[2]
                this.hooks.config.addObject(this.hooks.object.deserialize(ob))
            }
            this.rotation = 0
            this.prefabMenu.__controllers[0].setValue(this.rotation)
        } else {
            alert("You must select a object first")
        }
    }
    
    rotateObject(ob, rotation = 90) {
        switch (rotation) {
            case 90: return this.changeAngle(ob)
            case 180: return this.reflectAngle(ob)
            case 270: return this.reflectAngle(this.changeAngle(ob))
            default: return ob
        }
    }
    
    changeAngle(ob){
        //Credit JustProb
        let x = ob.s[0],
            y = ob.s[2]
        ob.s[0] = y
        ob.s[2] = x
        let a = ob.p[0],
            b = ob.p[2]
        ob.p[0] = b
        ob.p[2] = a
        
        return ob
    }

    reflectAngle(ob){
        //Credit JustProb
        ob.p[0] = -1 * ob.p[0]
        ob.p[2] = -1 * ob.p[2]
        
        return ob
    }
    
    findCenter(item) {
        //Credit JustProb
        let min = item[0].p[1],
        xMin = item[0].p[0] - (item[0].s[0] /2),
        xMax = item[0].p[0] + (item[0].s[0] /2),
        yMin = item[0].p[2] - (item[0].s[2] /2),
        yMax = item[0].p[2] + (item[0].s[2] /2)


        for (var index in item) {
            let object = item[index]
            if (object.p[1]  < min) min = object.p[1]
            if (object.p[0] - (object.s[0] /2) < xMin) xMin = object.p[0] - (object.s[0] /2)
            if (object.p[0] + (object.s[0] /2) > xMax) xMax = object.p[0] + (object.s[0] /2)
            if (object.p[2] - (object.s[2] /2) < yMin) yMin = object.p[2] - (object.s[2] /2)
            if (object.p[2] + (object.s[2] /2) > yMax) yMax = object.p[2] + (object.s[2] /2)
        }

        return [(xMin + xMax)/2, min, (yMin + yMax)/2]
    }
    
    copyObjects(cut = false, group = false) {
        let selected = this.objectSelected()
        let pos = {
            minX: selected.position.x - (selected.scale.x / 2), 
            minY: selected.position.y, 
            minZ: selected.position.z - (selected.scale.z / 2),  
            maxX: selected.position.x + (selected.scale.x / 2), 
            maxY: selected.position.y + selected.scale.y, 
            maxZ: selected.position.z + (selected.scale.z / 2), 
        }
        let intersect = []
        let obbys = []
        for (var i = 0; i < this.hooks.config.objInstances.length; i++) {
            if (this.hooks.config.objInstances[i].boundingMesh.uuid == selected.uuid) continue
            let ob = this.hooks.config.objInstances[i].boundingMesh
            if (this.intersect({
                    minX: ob.position.x - (ob.scale.x / 2), 
                    minY: ob.position.y, 
                    minZ: ob.position.z - (ob.scale.z / 2), 
                    maxX: ob.position.x + (ob.scale.x / 2), 
                    maxY: ob.position.y + ob.scale.y, 
                    maxZ: ob.position.z + (ob.scale.z / 2)
                }, pos)) {
                if (!group) obbys.push(this.hooks.config.objInstances[i])
                intersect.push(group ? this.hooks.config.objInstances[i].boundingMesh.uuid : this.hooks.config.objInstances[i].serialize())
            }
        }
        
        if (!group) {
            if (cut && obbys.length && !group) {
                for (var i = 0; i < obbys.length; i++) {
                    this.hooks.config.removeObject(obbys[i])
                }
            }
            this.copy = JSON.stringify(intersect)
        } else {
            this.group = {owner: selected, pos: {x: selected.position.x, y: selected.position.y, z: selected.position.z}, objects: intersect}
        }
    }
    
    checkGroup() {
        if (!this.group) return
        
        let currPos = this.group.owner.position
        let oldPos = this.group.pos
        let diff = [0, 0, 0]
        if (currPos.x != oldPos.x) diff[0] = currPos.x - oldPos.x
        if (currPos.y != oldPos.y) diff[1] = currPos.y - oldPos.y
        if (currPos.z != oldPos.z) diff[2] = currPos.z - oldPos.z
        
        for (var i = 0; i < this.hooks.config.objInstances.length; i++) {
            if (!this.group.objects.includes(this.hooks.config.objInstances[i].boundingMesh.uuid)) continue
            this.hooks.config.objInstances[i].boundingMesh.position.x += diff[0]
            this.hooks.config.objInstances[i].boundingMesh.position.y += diff[1]
            this.hooks.config.objInstances[i].boundingMesh.position.z += diff[2]            
        }
        this.group.pos = {x: currPos.x, y: currPos.y, z: currPos.z}
    }
    
    stopGrouping() {
        let uuid = this.group.owner.uuid
        this.group = null
        
        for (var i = 0; i < this.hooks.config.objInstances.length; i++)
            if (this.hooks.config.objInstances[i].boundingMesh.uuid == uuid)
                return this.hooks.config.removeObject(this.hooks.config.objInstances[i])
    }
    
    spawnPlaceholder() {
        let pos = this.hooks.config.camera.getWorldPosition()
        let obph = {p: [], s: [10, 10, 10], e: 16777215, o: 0.3, c: 0}
        obph.p[0] = pos.x
        obph.p[1] = pos.y - 10
        obph.p[2] = pos.z
        this.hooks.config.addObject(this.hooks.object.deserialize(obph))
    }
        
    intersect(a, b) {
        return (a.minX <= b.maxX && a.maxX >= b.minX) &&
            (a.minY <= b.maxY && a.maxY >= b.minY) &&
            (a.minZ <= b.maxZ && a.maxZ >= b.minZ);
    }

    addButtons() {
        document.getElementById("bottomBar").insertAdjacentHTML('beforeend', '<div class="bottomPanel"><div id="copyObjects" class="bottomButton">Copy Objects</div><div id="cutObjects" class="bottomButton">Cut Objects</div><div id="pasteObjects" class="bottomButton">Paste Objects</div><div id="saveObjects" class="bottomButton">Save Objects</div><div id="groupObjects" class="bottomButton">Group Objects</div><div id="stopGrouping" class="bottomButton">Stop Grouping</div></div><div class="bottomPanel"><div id="spawnPlaceholder" class="bottomButton">Spawn Placeholder</div></div>');
        document.getElementById("copyObjects").addEventListener("click", t => {  
            let selected = this.objectSelected()
            if (!selected){
                return alert('Stretch a cube over your objects then click copy')
            }
            this.copyObjects()
        })
        
        document.getElementById("cutObjects").addEventListener("click", t => {  
            let selected = this.objectSelected()
            if (!selected){
                return alert('Stretch a cube over your objects then click cut')
            }
            this.copyObjects(true)
        })
        
        document.getElementById("pasteObjects").addEventListener("click", t => {  
            let selected = this.objectSelected()
            if (!selected){
                return alert('Select a object you would like to replace with your copied objects')
            }
            if (!this.copy) {
                return alert('Please copy objects first')
            }
            this.replaceObject(this.copy)
        })
        
        document.getElementById("saveObjects").addEventListener("click", t => {  
            if (!this.copy) {
                return alert('Please copy objects first')
            }
            let nme = prompt("Name your prefab", "");
            if (nme == null) {
                return alert('Please name your prefab')
            }
            this.download(this.copy, 'prefab_' + nme.replace(/ /g,"_") + '.txt', 'text/plain');
        })
        
        document.getElementById("groupObjects").addEventListener("click", t => {  
            let selected = this.objectSelected()
            if (!selected){
                return alert('Stretch a cube over your objects then click group')
            }
            this.copyObjects(false, true)
        })
        
        
        document.getElementById("stopGrouping").addEventListener("click", t => {  
            if (!this.group){
                return alert('You cant stop a group that doesnt exist')
            }
            this.stopGrouping()
        })
        
        document.getElementById("spawnPlaceholder").addEventListener("click", t => {  
            this.spawnPlaceholder()
        })
    }

    setupMenu() {
        this.prefabMenu = this.hooks.gui.addFolder("Prefabs");
        let createObjects = {
            rotation: 0
        }
        let prefabs = localStorage.getItem('krunk_prefabs') ? JSON.parse(localStorage.getItem('krunk_prefabs')) : {}
        
        createObjects['json'] = (() => this.jsonInput())
        this.prefabMenu.add(createObjects, "json").name("Replace Object (w/ json)")
        this.prefabMenu.add(createObjects, "rotation", 0, 270, 90).name("Rotation").onChange(t => {this.rotation = t})          
        for (let cat in prefabs) {
            let category = this.prefabMenu.addFolder(cat)
            for (let ob in prefabs[cat]) {
                createObjects[ob] = (() => this.replaceObject(JSON.stringify(prefabs[cat][ob])))
                category.add(createObjects, ob).name(ob)
            }
        }
    }
    
    download(content, fileName, contentType) {
        //Credit to - https://stackoverflow.com/a/34156339
        let a = document.createElement("a");
        let file = new Blob([content], {type: contentType});
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }
    
    degToRad(r) {
        if (!this.settings.degToRad) return r
        return [
            this.hooks.three.Math.degToRad(r[0]),
            this.hooks.three.Math.degToRad(r[1]),
            this.hooks.three.Math.degToRad(r[2]),
        ]
    }
    
    loop() {
        this.checkGroup()
    }

    onLoad() {
        this.addButtons()
    }
}

GM_xmlhttpRequest({
    method: "GET",
    url: "https://krunker.io/js/editor.js",
    onload: res => {
        let code = res.responseText
        code = code.replace(/String\.prototype\.escape=function\(\){(.*)\)},(Number\.)/, "$2")
            .replace('("Sky Color").listen().onChange', '("Sky Color").onChange')
            .replace('("Ambient Light").listen().onChange', '("Ambient Color").onChange')
            .replace('("Light Color").listen().onChange', '("Light Color").onChange')
            .replace('("Fog Color").listen().onChange', '("Fog Color").onChange')
            .replace(/(\w+).boundingNoncollidableBoxMaterial=new (.*)}\);const/, '$1.boundingNoncollidableBoxMaterial = new $2 });window.mod.hooks.object = $1;const')
            //.replace(/(\w+).init\(document.getElementById\("container"\)\)/, '$1.init(document.getElementById("container")), window.mod.hooks.config = $1')
            .replace(/this\.transformControl\.update\(\)/, 'this.transformControl.update(),window.mod.hooks.config = this,window.mod.loop()')
            .replace(/\[\],(\w+).open\(\),/, '[],$1.open(),window.mod.hooks.gui=$1,window.mod.setupMenu(),')
            .replace(/initScene\(\){this\.scene=new (\w+).Scene,/, 'initScene(){this.scene=new $1.Scene,window.mod.hooks.three = $1,')
            .replace(/{(\w+)\[(\w+)\]\=(\w+)}\);this\.objConfigOptions/, '{$1[$2]=$2 == "rot" ? window.mod.degToRad($3) : $3});this.objConfigOptions')

        GM_xmlhttpRequest({
            method: "GET",
            url: "https://krunker.io/editor.html",
            onload: res => {
                let html = res.responseText
                html = html.replace(' src="js/editor.js">', `>${Mod.toString()}\nwindow.mod = new Mod();\n${code.toString()}`)
                document.open()
                document.write(html)
                document.close()
            }
        })
    }
})
