function Object3DCenter(object) {
    let center = new THREE.Vector3(0, 0, 0);
    for(let i = 0; i < object.children.length; i++) {
        center.add(object.children[i].position);
    }
    let n = object.children.length;
    if(n == 0) {
        return center;
    } else {
        return center.divideScalar(n);
    }
};

// return the first parent with the given name.
// return undefuned is none is found.
function findParent(object, name) {
    if(object) {
        if(object.name === name) {
            return object;
        } else {
            return findParent(object.parent, name);
        }
    } else {
        return undefined;
    }
}
