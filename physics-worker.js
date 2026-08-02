// Cannon.js physics running in a Web Worker.
// Receives addCube / step / reset messages from the main thread, posts back
// body states as a single transferable Float32Array per step.

importScripts('https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js');

let world = null;
let cubeMaterial = null;
let cubeContact = null;
const dynamicBodies = [];

function init() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82 * 2, 0);
    world.defaultContactMaterial.friction = 0.3;
    world.defaultContactMaterial.restitution = 0.2;

    // No air: bodies carry zero damping, so sleeping is what brings a pile to
    // rest. See physics.js — the two backends must behave identically.
    world.allowSleep = true;

    // Block-on-block grip, the only friction the slider drives.
    cubeMaterial = new CANNON.Material('cube');
    cubeContact = new CANNON.ContactMaterial(cubeMaterial, cubeMaterial, {
        friction: 0.5,
        restitution: 0.2,
    });
    world.addContactMaterial(cubeContact);

    if (typeof CANNON.SAPBroadphase === 'function') {
        world.broadphase = new CANNON.SAPBroadphase(world);
    }

    setupEnvironment();
}

function setupEnvironment() {
    // Floor — rotate so its normal points +Y (default normal is +Z)
    const floorMaterial = new CANNON.Material('floor');
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({ mass: 0, material: floorMaterial });
    floorBody.addShape(floorShape);
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    floorBody.position.y = -10;
    world.addBody(floorBody);

    // Side / back walls (invisible colliders)
    const wallMaterial = new CANNON.Material('wall');
    const wallThickness = 0.5;

    const left = new CANNON.Body({ mass: 0, material: wallMaterial });
    left.addShape(new CANNON.Box(new CANNON.Vec3(wallThickness, 30, 30)));
    left.position.set(-15, 0, 0);
    world.addBody(left);

    const right = new CANNON.Body({ mass: 0, material: wallMaterial });
    right.addShape(new CANNON.Box(new CANNON.Vec3(wallThickness, 30, 30)));
    right.position.set(15, 0, 0);
    world.addBody(right);

    const back = new CANNON.Body({ mass: 0, material: wallMaterial });
    back.addShape(new CANNON.Box(new CANNON.Vec3(30, 30, wallThickness)));
    back.position.set(0, 0, -15);
    world.addBody(back);

    // Fixed, slider-independent environment contacts.
    world.addContactMaterial(new CANNON.ContactMaterial(
        cubeMaterial, floorMaterial, { friction: 0.4, restitution: 0.2 }));
    world.addContactMaterial(new CANNON.ContactMaterial(
        cubeMaterial, wallMaterial, { friction: 0.4, restitution: 0.2 }));
}

function reset() {
    for (const body of dynamicBodies) {
        world.removeBody(body);
    }
    dynamicBodies.length = 0;
}

function addCube(x, y, z, size, spin = 0) {
    const half = size / 2;
    const shape = new CANNON.Box(new CANNON.Vec3(half, half, half));
    const body = new CANNON.Body({ mass: 1, shape, material: cubeMaterial });
    // Damping is drag against a medium; there is no medium. Contact friction
    // is the only brake.
    body.linearDamping = 0;
    body.angularDamping = 0;
    // Must match physics.js — below ~0.15 a zero-damping pile never settles.
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.25;
    body.sleepTimeLimit = 0.5;
    body.position.set(x, y, z);
    body.velocity.set(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
    );
    // Random angular velocity = imperfect release, so blocks tumble as they fall
    if (spin) {
        body.angularVelocity.set(
            (Math.random() - 0.5) * 2 * spin,
            (Math.random() - 0.5) * 2 * spin,
            (Math.random() - 0.5) * 2 * spin
        );
    }
    world.addBody(body);
    dynamicBodies.push(body);
}

function step() {
    world.step(1 / 60);

    const n = dynamicBodies.length;
    const states = new Float32Array(n * 7);
    let settled = true;
    for (let i = 0; i < n; i++) {
        const b = dynamicBodies[i];
        const base = i * 7;
        states[base + 0] = b.position.x;
        states[base + 1] = b.position.y;
        states[base + 2] = b.position.z;
        states[base + 3] = b.quaternion.x;
        states[base + 4] = b.quaternion.y;
        states[base + 5] = b.quaternion.z;
        states[base + 6] = b.quaternion.w;
        // Sleeping is rest — without this a settled pile never reads as settled.
        const asleep = b.sleepState === CANNON.Body.SLEEPING;
        if (!asleep && (b.velocity.length() > 0.01 || b.angularVelocity.length() > 0.05)) settled = false;
    }
    return { states, settled };
}

self.onmessage = (event) => {
    const msg = event.data;
    switch (msg.type) {
        case 'init':
            init();
            self.postMessage({ type: 'ready' });
            break;
        case 'reset':
            reset();
            self.postMessage({ type: 'resetDone' });
            break;
        case 'addCube':
            addCube(msg.x, msg.y, msg.z, msg.size || 1, msg.spin);
            break;
        case 'setBlockFriction':
            if (cubeContact) cubeContact.friction = msg.friction;
            break;
        case 'step': {
            const result = step();
            // Transfer the typed-array buffer to avoid the structured-clone copy
            self.postMessage(
                { type: 'stepResult', states: result.states, settled: result.settled },
                [result.states.buffer]
            );
            break;
        }
    }
};
