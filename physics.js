// Physics backends for the Math Visualizer.
// Two implementations share an async API the animator consumes:
//
//   await backend.waitReady()
//   backend.addCube(x, y, z, size)
//   backend.reset()
//   const { states, settled } = await backend.stepAndGetStates()
//   backend.dispose()
//
// `states` is a Float32Array of length n*7: [x, y, z, qx, qy, qz, qw, ...]
// per body, in insertion order.

class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82 * 2, 0);
        this.world.defaultContactMaterial.friction = 0.3;
        this.world.defaultContactMaterial.restitution = 0.2;

        // SAPBroadphase (sweep-and-prune) is much faster than the default
        // NaiveBroadphase (O(n²)) once we have more than a few dozen bodies.
        if (typeof CANNON.SAPBroadphase === 'function') {
            this.world.broadphase = new CANNON.SAPBroadphase(this.world);
            this.broadphaseName = 'SAPBroadphase (sweep-and-prune)';
        } else {
            this.broadphaseName = 'NaiveBroadphase (O(n²) — fallback, SAP not available)';
        }

        this.bodies = [];
        this.staticBodies = [];

        this.setupEnvironment();

        console.log('%c[Physics] Backend: inline (main thread)', 'font-weight: bold; color: #d62828');
        console.log('  Engine     : Cannon.js (single-threaded JavaScript on the CPU)');
        console.log(`  Broadphase : ${this.broadphaseName}`);
        console.log('  Physics step blocks the main thread on every frame.');
    }

    setupEnvironment() {
        // Floor — rotate plane so its normal points +Y (default normal is +Z)
        const floorMaterial = new CANNON.Material('floor');
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, material: floorMaterial });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        floorBody.position.y = -10;
        this.world.addBody(floorBody);
        this.staticBodies.push(floorBody);

        const wallMaterial = new CANNON.Material('wall');
        const wallThickness = 0.5;

        const left = new CANNON.Body({ mass: 0, material: wallMaterial });
        left.addShape(new CANNON.Box(new CANNON.Vec3(wallThickness, 30, 30)));
        left.position.set(-15, 0, 0);
        this.world.addBody(left);
        this.staticBodies.push(left);

        const right = new CANNON.Body({ mass: 0, material: wallMaterial });
        right.addShape(new CANNON.Box(new CANNON.Vec3(wallThickness, 30, 30)));
        right.position.set(15, 0, 0);
        this.world.addBody(right);
        this.staticBodies.push(right);

        const back = new CANNON.Body({ mass: 0, material: wallMaterial });
        back.addShape(new CANNON.Box(new CANNON.Vec3(30, 30, wallThickness)));
        back.position.set(0, 0, -15);
        this.world.addBody(back);
        this.staticBodies.push(back);
    }

    waitReady() {
        return Promise.resolve();
    }

    addCube(x, y, z, size = 1, linearDamping = 0.3, angularDamping = 0.3, spin = 0) {
        const half = size / 2;
        const shape = new CANNON.Box(new CANNON.Vec3(half, half, half));
        const body = new CANNON.Body({ mass: 1, shape });
        body.linearDamping = linearDamping;
        body.angularDamping = angularDamping;
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
        this.world.addBody(body);
        this.bodies.push(body);
    }

    reset() {
        for (const body of this.bodies) {
            this.world.removeBody(body);
        }
        this.bodies = [];
    }

    async stepAndGetStates() {
        this.world.step(1 / 60);

        const n = this.bodies.length;
        const states = new Float32Array(n * 7);
        let settled = true;
        for (let i = 0; i < n; i++) {
            const b = this.bodies[i];
            const base = i * 7;
            states[base + 0] = b.position.x;
            states[base + 1] = b.position.y;
            states[base + 2] = b.position.z;
            states[base + 3] = b.quaternion.x;
            states[base + 4] = b.quaternion.y;
            states[base + 5] = b.quaternion.z;
            states[base + 6] = b.quaternion.w;
            if (b.velocity.length() > 0.01 || b.angularVelocity.length() > 0.05) settled = false;
        }
        return { states, settled };
    }

    // Synchronous shortcut — used to clear when switching backends
    clear() {
        this.reset();
    }

    dispose() {
        // Nothing to release — the cannon world is just JS objects, GC will
        // pick it up once the reference is dropped.
    }
}

