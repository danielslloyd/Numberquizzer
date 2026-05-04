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

    addCube(x, y, z, size = 1) {
        const half = size / 2;
        const shape = new CANNON.Box(new CANNON.Vec3(half, half, half));
        const body = new CANNON.Body({ mass: 1, shape });
        body.linearDamping = 0.3;
        body.angularDamping = 0.3;
        body.position.set(x, y, z);
        body.velocity.set(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
        );
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
            if (b.velocity.length() > 0.01) settled = false;
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

// Cannon.js running on a separate Web Worker thread.
// Same API as PhysicsWorld; messages are batched per `addCube` and one
// `step` round-trip per frame returns a transferable Float32Array.
class PhysicsWorldWorker {
    constructor(workerUrl) {
        this.worker = new Worker(workerUrl);
        this.pendingStep = null;
        this.pendingReset = null;

        this._readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        this.worker.addEventListener('message', (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'ready':
                    this._resolveReady();
                    break;
                case 'stepResult':
                    if (this.pendingStep) {
                        const p = this.pendingStep;
                        this.pendingStep = null;
                        p.resolve({ states: msg.states, settled: msg.settled });
                    }
                    break;
                case 'resetDone':
                    if (this.pendingReset) {
                        const p = this.pendingReset;
                        this.pendingReset = null;
                        p.resolve();
                    }
                    break;
            }
        });
        this.worker.addEventListener('error', (e) => {
            console.error('[Physics] Worker error:', e.message, e);
        });

        this.worker.postMessage({ type: 'init' });

        console.log('%c[Physics] Backend: Web Worker (off main thread)', 'font-weight: bold; color: #2a9d3f');
        console.log('  Engine    : Cannon.js (still CPU, but on its own thread)');
        console.log('  Transport : Float32Array states transferred (no clone) per step');
    }

    waitReady() {
        return this._readyPromise;
    }

    addCube(x, y, z, size = 1) {
        this.worker.postMessage({ type: 'addCube', x, y, z, size });
    }

    reset() {
        // Fire-and-forget reset; subsequent addCube/step messages are
        // queued and processed in order on the worker.
        this.worker.postMessage({ type: 'reset' });
    }

    stepAndGetStates() {
        // If a previous step is still in flight (e.g. user did RESET → DROP
        // before the worker replied), settle the stale awaiter so it can
        // unblock and check its own dropAborted flag.
        if (this.pendingStep) {
            const stale = this.pendingStep;
            this.pendingStep = null;
            stale.resolve({ states: new Float32Array(0), settled: true, stale: true });
        }
        return new Promise((resolve) => {
            this.pendingStep = { resolve };
            this.worker.postMessage({ type: 'step' });
        });
    }

    clear() {
        this.reset();
    }

    dispose() {
        this.worker.terminate();
        this.worker = null;
    }
}
