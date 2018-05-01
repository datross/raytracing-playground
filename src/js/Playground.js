var renderer, composer, scene;

// grouping all the playground specific objects and functions
var PLAYGROUND = {

    // Any object visible in the scene (mesh, camera, light...)
    SceneObject: function(geometry, solidColor, wireColor) {
        if (geometry === undefined) throw "'geometry' not provided.";

        this.solidMaterial = new THREE.MeshBasicMaterial({
            color: solidColor ? solidColor : 0x009999
        });
        this.wireMaterial = new THREE.LineBasicMaterial({
            color: wireColor ? wireColor : 0x000000,
            linewidth: 1.5
        });
        this.mesh = new THREE.Mesh(geometry, this.solidMaterial);
        this.wire = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), this.wireMaterial);

        // parent of every other THREE objects.
        this.root = new THREE.Object3D();
        // the name is important to know this object is the root
        // of a SceneObject
        this.root.name = "playground-root";
        this.root.add(this.mesh);
        this.root.add(this.wire);
    },

    Scene: function() {
        this.generalProperties = {
            // TODO these properties probably need setters to update correctly the scene
            backgroundColor: 0x909090
        };

        // THREE JS Scene
        this.scene = new THREE.Scene();

        // Selection
        this.selection = {
            scene: this.scene,
            // list of SceneObject
            objects: [],

            // THREE JS Group, in order to easily manipulate every objects at once
            group: new THREE.Group(),

            contains: function(object) {
                return this.objects.indexOf(object) != -1;
            },

            add: function(object) {
                // check if it's already in selection
                if (!this.contains(object)) {
                    this.objects.push(object);
                    THREE.SceneUtils.attach(object.root, this.scene, this.group);
                }
                // update everything
                this.updateDisplay();
            },

            remove: function(object) {
                // see if it's in the selection
                if(this.contains(object)) {
                    let index = this.objects.indexOf(object);
                    this.objects.splice(index);
                    THREE.SceneUtils.detach(object.root, this.group, this.scene);
                }
                // update everything
                this.updateDisplay();
            },

            // if object is in the selection, then it is removed,
            // otherwise it is added
            toggle: function(object) {
                if(!this.contains(object)) {
                    this.add(object);
                } else {
                    this.remove(object);
                }
            },

            clear: function() {
                let n = this.objects.length;
                for (let i = 0; i < n; i++) {
                    this.remove(this.objects[0]);
                    // console.log(this.group.children.length);
                }
            },

            empty: function() {
                return this.objects.length == 0;
            },

            // update center and visibility
            updateDisplay: function() {
                this.group.visible = this.empty() ? false : true;

                // update group position

                // store group center
                let center = Object3DCenter(this.group);
                // detach everything
                for(let i = 0; i < this.objects.length; i++) {
                    THREE.SceneUtils.detach(this.objects[i].root, this.group, this.scene);
                }
                // change position
                this.group.position.copy(center);
                // reattach everything
                for(let i = 0; i < this.objects.length; i++) {
                    THREE.SceneUtils.attach(this.objects[i].root, this.group, this.scene);
                }
            }
        };

        // 3d grid
        this.gridHelper = new THREE.GridHelper(5, 10);
        this.scene.add(this.gridHelper);

        // add selection 'group' object to the THREE JS scene
        this.scene.add(this.selection.group);

        // update selection to init visibility of transform widget
        this.selection.updateDisplay();

        // Objects contained in the scene (raytracing scene)
        this.objects = [];

        // Raycaster to know on which object the user click
        this.raycaster = new THREE.Raycaster();

        ///////////////////////
        //// ** METHODS ** ////
        ///////////////////////


        // animate function
        this.update = function() {
            this.selection.update();
        };

        // add an object to the scene
        this.add = function(object) {
            this.objects.push(object);
            this.scene.add(object.root);
        };

        // remove object from the scene
        this.remove = function(object) {
            // remove it from selection if it's selected
            this.selection.remove(object);
            // remove from THREE JS scene
            this.remove(object.root);
            // remove from objects if it's in
            let index = this.objects.indexOf(object);
            if (index != -1) {
                this.objects.splice(index);
            }
        };

        // remove every objects in the scene
        this.clear = function() {
            this.selection.clear();
            this.objects = [];
        };

        this.raycastSceneObject = function(origin, direction) {
            this.raycaster.set(origin, direction);
            // get all the intersection with THREE JS objects
            let intersects = this.raycaster.intersectObjects(this.scene.children, true);
            // keep the closest intersection which corresponds to SceneObject.
            // intersection are sorted by distance so we only need a simple loop and take the first SceneObject
            for (let i = 0; i < intersects.length; i++) {
                let object = intersects[i].object;
                let root = findParent(object, "playground-root");
                // if it is a SceneObject
                if(root !== undefined) {
                    // search for the object in the SceneObject of the scene
                    let sceneObject = this.objects.find(function(element) {
                        return element.root == root;
                    });
                    // normally we can find it,
                    // but we never know...
                    if (sceneObject !== undefined) {
                        return sceneObject;
                    }
                }
            }
            // here no object has been found, so we just return no object
            return undefined;
        };
    },

    Viewport: function(scene) {
        // Playground scene
        this.scene = scene;

        // dimensions in pixels of the scene viewport
        this.width = null;
        this.height = null;

        // THREE JS Renderer
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setClearColor(this.scene.generalProperties.backgroundColor);

        // THREE JS Camera
        // TODO check the near/far, maybe relative to the scene dimension?
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 0, 20);
        this.camera.lookAt(0, 0, 0);
        this.camera.position.z = 5;

        // Raycaster to computes selection rays to send to the scene
        this.raycaster = new THREE.Raycaster();

        // Only one Orbit Control of the scene.
        this.orbitControls = new THREE.OrbitControls(this.camera);
        this.orbitControls.update(); // TODO do we need this?

        // post processing for outline selected objects
        this.composer = new THREE.EffectComposer(this.renderer);
        this.renderPass = new THREE.RenderPass(this.scene.scene, this.camera);
        this.outlinePass = new THREE.OutlinePass(new THREE.Vector2(this.width, this.height), this.scene.scene, this.camera);
        let copyPass = new THREE.ShaderPass(THREE.CopyShader);
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.outlinePass);
        this.composer.addPass(copyPass);
        // configure passes
        this.outlinePass.visibleEdgeColor.set(0xff0000);
        this.outlinePass.hiddenEdgeColor.set(0xff0000);
        this.outlinePass.edgeThickness = 2;
        this.outlinePass.edgeStrength = 10;
        copyPass.renderToScreen = true;

        // Selection transform widget
        this.selectionTransformWidget = new THREE.TransformControls(this.camera, this.renderer.domElement);
        this.scene.scene.add(this.selectionTransformWidget);

        this.updateTransformWidget = function() {
            this.selectionTransformWidget.visible = this.scene.selection.group.visible;
            // console.log(this.scene.selection.group.position);
            // console.log(this.scene.selection.objects);
            if(this.scene.selection.empty()) {
                this.selectionTransformWidget.detach();
            } else {
                this.selectionTransformWidget.attach(this.scene.selection.group);
            }
        };


        ///////////////////////
        //// ** METHODS ** ////
        ///////////////////////

        // attach the renderer to a new dom element
        this.attachToDOM = function(domElement) {
            // TODO check how to detach before attach
            domElement.appendChild(this.renderer.domElement);
        };

        // Update every object which relies on viewport ratio
        this.resize = function(width, height) {
            this.width = width;
            this.height = height;
;

            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix(); // TODO check if needed
            this.outlinePass.setSize(this.width, this.height); // TODO check if needed
            this.renderer.setSize(this.width, this.height);
            this.composer.setSize(this.width, this.height);
        };

        // update outline pass relatively to selected objects
        this.updateOutlinePass = function() {
            this.outlinePass.selectedObjects = this.scene.selection.group.children;
        };

        this.animate = function() {
            requestAnimationFrame(this.animate.bind(this));

            this.orbitControls.update();
            this.selectionTransformWidget.update();
            // this.scene.update();
            this.updateOutlinePass();
            this.composer.render();
        };

        // handles user click and returns either null or the selected object
        this.selectSceneObject = function(clickEvent) {
            let mouse = new THREE.Vector2(-1 + 2 * clickEvent.clientX / this.width, 1 - 2 * clickEvent.clientY / this.height);
            this.raycaster.setFromCamera(mouse, this.camera);
            let sceneObject = this.scene.raycastSceneObject(this.raycaster.ray.origin,
                this.raycaster.ray.direction);
            // is there is a returned sceneObject
            if (sceneObject !== undefined) {
                // TODO modify this
                // console.log(sceneObject);
                // if(clickEvent.shiftKey) {
                //     this.scene.selection.toggle(sceneObject);
                // } else {
                    this.scene.selection.clear();
                    this.scene.selection.add(sceneObject);
                console.log(this.scene.selection.group.position);
                // }
            } else {
                // console.log("No object.");
                // console.log(this.scene.selection.group.children.length);
                this.scene.selection.clear();
                // console.log(this.scene.selection.group.children.length);
            }
        };

        this.callbackClick = function(clickEvent) {
            this.selectSceneObject(clickEvent);
            this.updateTransformWidget();
        };
    }
};

window.onload = function() {
    var playgroundScene = new PLAYGROUND.Scene();
    var playgroundViewport = new PLAYGROUND.Viewport(playgroundScene);

    let resizePlaygroundViewport = function() {
        playgroundViewport.resize(window.innerWidth, window.innerHeight);
    };

    playgroundViewport.attachToDOM(document.body);
    resizePlaygroundViewport();
    playgroundViewport.animate();

    window.addEventListener('resize', resizePlaygroundViewport, false);
    window.addEventListener('mousedown', playgroundViewport.callbackClick.bind(playgroundViewport), false);

    // fill scene with a cube
    let cube = new PLAYGROUND.SceneObject(new THREE.BoxGeometry(1, 1, 1));
    let cube2 = new PLAYGROUND.SceneObject(new THREE.BoxGeometry(1, 1, 1));
    cube2.root.position.x = 1;
    playgroundScene.add(cube);
    playgroundScene.add(cube2);
};
