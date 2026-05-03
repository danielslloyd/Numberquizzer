// Physics Engine for Math Visualizer using Cannon-es

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
        this.constraints = [];
        this.staticBodies = [];

        this.setupEnvironment();

        console.log('%c[Physics] Engine info', 'font-weight: bold; color: #d62828');
        console.log('  Engine     : Cannon.js (single-threaded JavaScript on the CPU)');
        console.log(`  Broadphase : ${this.broadphaseName}`);
        console.log('  Note: there is no GPU physics fallback in this stack. To move physics off');
        console.log('  the render thread you would need a Web Worker port of Cannon.');
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

        // Walls (invisible, just for physics)
        const wallMaterial = new CANNON.Material('wall');
        const wallThickness = 0.5;

        // Left wall
        const leftWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness, 30, 30));
        const leftWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
        leftWallBody.addShape(leftWallShape);
        leftWallBody.position.set(-15, 0, 0);
        this.world.addBody(leftWallBody);
        this.staticBodies.push(leftWallBody);

        // Right wall
        const rightWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness, 30, 30));
        const rightWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
        rightWallBody.addShape(rightWallShape);
        rightWallBody.position.set(15, 0, 0);
        this.world.addBody(rightWallBody);
        this.staticBodies.push(rightWallBody);

        // Back wall
        const backWallShape = new CANNON.Box(new CANNON.Vec3(30, 30, wallThickness));
        const backWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
        backWallBody.addShape(backWallShape);
        backWallBody.position.set(0, 0, -15);
        this.world.addBody(backWallBody);
        this.staticBodies.push(backWallBody);
    }

    createCube(x, y, z, size = 1, color = 0xff0000) {
        const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
        const body = new CANNON.Body({ mass: 1, shape });
        body.linearDamping = 0.3;
        body.angularDamping = 0.3;
        body.position.set(x, y, z);

        // Add small random velocity to make falling more natural
        body.velocity.set(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
        );

        this.world.addBody(body);
        this.bodies.push({ body, color, size });

        return body;
    }

    step(dt = 1 / 60) {
        this.world.step(1 / 60, dt, 3);
    }

    getBodyState(body) {
        return {
            position: {
                x: body.position.x,
                y: body.position.y,
                z: body.position.z
            },
            quaternion: {
                x: body.quaternion.x,
                y: body.quaternion.y,
                z: body.quaternion.z,
                w: body.quaternion.w
            }
        };
    }

    hasSettled(threshold = 0.01) {
        // Check if all bodies have mostly stopped moving
        for (const { body } of this.bodies) {
            const speed = body.velocity.length();
            if (speed > threshold) return false;
        }
        return true;
    }

    clear() {
        for (const { body } of this.bodies) {
            this.world.removeBody(body);
        }
        this.bodies = [];
    }
}
