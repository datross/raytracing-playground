function Object3DCenter(object) {
    let center = new THREE.Vector3(0, 0, 0);
    for(let i = 0; i < object.children.length; i++) {
        center += object.children[i].position;
    }
    return center / object.children.length;
};
