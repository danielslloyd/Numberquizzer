// Three.js Animator for Math Visualizer

class MathAnimator {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        // Ensure container has proper dimensions
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            container.style.width = '100%';
            container.style.height = '100%';
        }

        this.camera = new THREE.PerspectiveCamera(
            45,
            Math.max(container.clientWidth, window.innerWidth) / Math.max(container.clientHeight, window.innerHeight),
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(
            container.clientWidth || window.innerWidth,
            container.clientHeight || window.innerHeight
        );
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        // Clear container and add canvas
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        this.setupLighting();
        this.setupEnvironment();

        this.cubes = [];
        this.labels = [];
        this.physics = new PhysicsWorld();
        this.isAnimating = false;
        this.animationFrameId = null;
        this.disposed = false;
        this.spacing = 2;
        this.hasFilled = false;
        this.preDropState = null;
        this.dropAborted = false;

        this.resizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        this.scene.add(directionalLight);
    }

    setupEnvironment() {
        // Floor plane (visible reference)
        const floorGeometry = new THREE.PlaneGeometry(60, 60);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0f0f0,
            metalness: 0.1,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -10;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.setupAxisLabels();
    }

    setupAxisLabels() {
        // Axis origin tucked into the bottom-left-front corner so it's
        // always visible and never collides with the cube grid.
        const origin = new THREE.Vector3(-12, -9.5, 6);
        const axisLength = 4;

        const axes = new THREE.AxesHelper(axisLength);
        axes.position.copy(origin);
        // Make the helper render on top of the floor
        axes.material.depthTest = false;
        axes.renderOrder = 999;
        this.scene.add(axes);

        const makeLabel = (text, color) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 128, 128);
            ctx.fillStyle = color;
            ctx.font = 'bold 96px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearFilter;
            const material = new THREE.SpriteMaterial({
                map: texture,
                depthTest: false,
                transparent: true
            });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(1.6, 1.6, 1);
            sprite.renderOrder = 1000;
            return sprite;
        };

        const offset = axisLength + 0.6;
        const xLabel = makeLabel('X', '#d62828');
        xLabel.position.set(origin.x + offset, origin.y, origin.z);
        this.scene.add(xLabel);

        const yLabel = makeLabel('Y', '#2a9d3f');
        yLabel.position.set(origin.x, origin.y + offset, origin.z);
        this.scene.add(yLabel);

        const zLabel = makeLabel('Z', '#1d4ed8');
        zLabel.position.set(origin.x, origin.y, origin.z + offset);
        this.scene.add(zLabel);
    }

    createCube(x, y, z, size = 1, color = 0xff0000) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.3,
            roughness: 0.6
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.cubes.push({ mesh, size, color });
        return mesh;
    }

    createLabel(text, x, y, z, size = 1) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 120px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: false
        });
        const geometry = new THREE.PlaneGeometry(8, 4);
        const label = new THREE.Mesh(geometry, material);
        label.position.set(x, y, z);
        label.renderOrder = 10;
        this.scene.add(label);
        this.labels.push(label);
        return label;
    }

    async animateMultiplication(a, b, c = null) {
        this.isAnimating = true;
        this.clear();

        const layers = c || 1;
        const colors = this.generateColors(1);
        const cubeColor = colors[0];
        const result = c ? a * b * c : a * b;

        // Frame the camera for this stack before any cubes appear
        this.setupCameraForBox(a, b, layers);

        try {
            // Place every cube at its final position; fade them all in over 2s
            await this.fillBox(a, b, layers, cubeColor);

            // Show label above the stack
            const topY = 1 + (layers - 1) * this.spacing;
            const expr = c ? `${a} × ${b} × ${c}` : `${a} × ${b}`;
            this.createLabel(`${expr} = ${result}`, 0, topY + 4, 0);

            // Stay in formation; user must click DROP to start physics
            this.hasFilled = true;
            this.isAnimating = false;
        } catch (e) {
            console.error('Animation error:', e);
            this.isAnimating = false;
        }
    }

    async animateAddition(groups) {
        this.isAnimating = true;
        this.clear();

        const s = this.spacing;

        try {
            const renderedGroups = [];
            let totalResult = 0;
            let expressionStr = '';
            const colors = this.generateColors(Math.max(groups.length, 2));

            // Make group separation scale with spacing so groups never overlap
            let maxGroupWidth = 1;
            for (const g of groups) {
                if (g.type === 'multiply') {
                    maxGroupWidth = Math.max(maxGroupWidth, ((g.a || 1) - 1) * s + 1);
                } else if (g.type === 'number') {
                    maxGroupWidth = Math.max(maxGroupWidth, ((g.value || 1) - 1) * s + 1);
                }
            }
            const groupGap = maxGroupWidth + 2 * s + 2;

            let maxTopY = 1;

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const color = colors[i % colors.length];
                const startX = (i - (groups.length - 1) / 2) * groupGap;
                let groupResult = 0;
                const groupMeshes = [];

                if (group.type === 'multiply') {
                    const a = group.a || 1;
                    const b = group.b || 1;
                    const c = group.c || 1;
                    groupResult = a * b * c;

                    const offsetZ = -(b - 1) * s / 2;

                    for (let layer = 0; layer < c; layer++) {
                        for (let row = 0; row < b; row++) {
                            for (let col = 0; col < a; col++) {
                                const mesh = this.createCube(
                                    startX + col * s,
                                    -6.5 + layer * s,
                                    offsetZ + row * s,
                                    1,
                                    color
                                );
                                groupMeshes.push(mesh);
                            }
                        }
                    }

                    expressionStr += (expressionStr ? ' + ' : '') + `${a}×${b}` + (c > 1 ? `×${c}` : '');
                    maxTopY = Math.max(maxTopY, 1 + (c - 1) * s);
                } else if (group.type === 'number') {
                    groupResult = group.value;
                    for (let j = 0; j < group.value; j++) {
                        const mesh = this.createCube(
                            startX + j * s,
                            -6.5,
                            0,
                            1,
                            color
                        );
                        groupMeshes.push(mesh);
                    }
                    expressionStr += (expressionStr ? ' + ' : '') + group.value;
                }

                totalResult += groupResult;
                renderedGroups.push({
                    meshes: groupMeshes,
                    startX,
                    groupIndex: i,
                    totalGroups: groups.length
                });
            }

            // Frame camera to fit all groups in their initial spread positions
            const totalWidth = (groups.length - 1) * groupGap + maxGroupWidth;
            this.setupCameraForExtents(totalWidth, maxGroupWidth, maxTopY);

            // Slide groups toward center
            await this.slideGroupsTogether(renderedGroups);

            // Show label
            this.createLabel(`${expressionStr} = ${totalResult}`, 0, maxTopY + 4, 0);

            // Stay in formation; user must click DROP to start physics
            this.hasFilled = true;
            this.isAnimating = false;
        } catch (e) {
            console.error('Animation error:', e);
            this.isAnimating = false;
        }
    }

    async fillBox(a, b, c, color) {
        const s = this.spacing;
        const offsetX = -(a - 1) * s / 2;
        const offsetZ = -(b - 1) * s / 2;

        // Create every cube up front at its final position and size — no scaling.
        // Start y at -6.5 so the bottom layer drops exactly 3 cube heights.
        // Disable castShadow until the cube is fully opaque so shadows don't
        // appear before the blocks themselves during fade-in.
        const cells = [];
        for (let layer = 0; layer < c; layer++) {
            for (let row = 0; row < b; row++) {
                for (let col = 0; col < a; col++) {
                    const x = offsetX + col * s;
                    const z = offsetZ + row * s;
                    const y = -6.5 + layer * s;
                    const mesh = this.createCube(x, y, z, 1, color);
                    mesh.castShadow = false;
                    mesh.material.transparent = true;
                    mesh.material.opacity = 0;
                    cells.push(mesh);
                }
            }
        }

        const total = cells.length;
        const fillDuration = 2000; // fixed window regardless of cube count
        const cellFade = 250;
        const stagger = total > 1 ? (fillDuration - cellFade) / (total - 1) : 0;

        const startTime = Date.now();
        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                let allDone = true;
                for (let i = 0; i < cells.length; i++) {
                    const t = Math.max(0, Math.min(1, (elapsed - i * stagger) / cellFade));
                    cells[i].material.opacity = t;
                    if (t >= 1 && !cells[i].castShadow) {
                        cells[i].castShadow = true;
                    }
                    if (t < 1) allDone = false;
                }
                if (allDone) {
                    resolve();
                } else {
                    requestAnimationFrame(animate);
                }
            };
            animate();
        });
    }

    setupCameraForBox(a, b, c) {
        const xExtent = (a - 1) * this.spacing + 1;
        const zExtent = (b - 1) * this.spacing + 1;
        const topY = 1 + (c - 1) * this.spacing;
        this.setupCameraForExtents(xExtent, zExtent, topY);
    }

    setupCameraForExtents(xExtent, zExtent, topY) {
        // Frame so the floor center (y = -10) and top of the stack are both
        // visible, with margin = 2 × current spacing on every side.
        const margin = 2 * this.spacing;
        const floorY = -10;

        const targetY = (topY + floorY) / 2;
        const halfHeight = (topY - floorY) / 2 + margin;
        const halfWidth = Math.max(xExtent, zExtent) / 2 + margin;

        this.frameToShow(new THREE.Vector3(0, targetY, 0), halfWidth, halfHeight);
    }

    frameToShow(target, halfWidth, halfHeight) {
        const fovRad = this.camera.fov * Math.PI / 180;
        const aspect = this.camera.aspect || 1;
        const tanHalfFov = Math.tan(fovRad / 2);

        // Distance needed for vertical fit, and for horizontal fit
        const distV = halfHeight / tanHalfFov;
        const distH = halfWidth / (aspect * tanHalfFov);
        const dist = Math.max(distV, distH);

        // Camera tilted 30° above target, pulled back along +Z
        const angle = Math.PI / 6;
        this.camera.position.set(
            target.x,
            target.y + dist * Math.sin(angle),
            target.z + dist * Math.cos(angle)
        );
        this.camera.lookAt(target.x, target.y, target.z);
        this.camera.updateProjectionMatrix();
    }

    async slideGroupsTogether(groups) {
        const duration = 600;
        const start = Date.now();

        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - start;
                const t = Math.min(1, elapsed / duration);

                for (const group of groups) {
                    const targetX = 0;
                    const moveDistance = Math.abs(group.startX - targetX);
                    const direction = group.startX < 0 ? 1 : -1;
                    const newX = group.startX + (moveDistance * t * direction);

                    for (const mesh of group.meshes) {
                        mesh.position.x = newX;
                    }
                }

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            animate();
        });
    }

    async startDrop() {
        if (!this.hasFilled || this.isAnimating) return;
        this.isAnimating = true;
        this.dropAborted = false;

        // Snapshot mesh positions/orientations so RESET can snap back here
        this.preDropState = this.cubes.map(({ mesh }) => ({
            mesh,
            position: mesh.position.clone(),
            quaternion: mesh.quaternion.clone()
        }));

        // Create physics bodies at the meshes' current positions (no extra
        // y offset — meshes already start at -6.5, three units above the
        // floor's resting plane).
        for (const { mesh, color, size } of this.cubes) {
            this.physics.createCube(
                mesh.position.x,
                mesh.position.y,
                mesh.position.z,
                size,
                color
            );
        }

        const maxIterations = 300;
        let iterations = 0;

        return new Promise(resolve => {
            const simulate = () => {
                if (this.dropAborted) {
                    this.isAnimating = false;
                    resolve();
                    return;
                }

                this.physics.step();

                for (let i = 0; i < this.cubes.length; i++) {
                    const { mesh } = this.cubes[i];
                    const physicsBody = this.physics.bodies[i];
                    if (physicsBody) {
                        const state = this.physics.getBodyState(physicsBody.body);
                        mesh.position.set(
                            state.position.x,
                            state.position.y,
                            state.position.z
                        );
                        mesh.quaternion.set(
                            state.quaternion.x,
                            state.quaternion.y,
                            state.quaternion.z,
                            state.quaternion.w
                        );
                    }
                }

                iterations++;

                if (this.physics.hasSettled() || iterations > maxIterations) {
                    this.isAnimating = false;
                    resolve();
                } else {
                    requestAnimationFrame(simulate);
                }
            };
            simulate();
        });
    }

    snapBackToFormation() {
        if (!this.preDropState) return;

        // Break out of the simulation loop if it's still running
        this.dropAborted = true;

        // Restore each mesh to its pre-drop position and orientation
        for (const { mesh, position, quaternion } of this.preDropState) {
            mesh.position.copy(position);
            mesh.quaternion.copy(quaternion);
        }

        // Drop physics bodies so a subsequent DROP starts clean
        this.physics.clear();
        this.isAnimating = false;
    }

    generateColors(count) {
        const hues = [];
        for (let i = 0; i < Math.max(count, 1); i++) {
            hues.push(new THREE.Color().setHSL(i / Math.max(count, 1), 0.8, 0.5));
        }
        return hues;
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    clear() {
        // Remove all cubes
        for (const { mesh } of this.cubes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        this.cubes = [];

        // Remove all labels
        for (const label of this.labels) {
            this.scene.remove(label);
            label.geometry.dispose();
            label.material.dispose();
        }
        this.labels = [];

        // Clear physics
        this.physics.clear();

        // Stop camera animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Reset drop tracking
        this.hasFilled = false;
        this.preDropState = null;
        this.dropAborted = false;

        // Reset camera
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        window.removeEventListener('resize', this.resizeHandler);

        // Dispose geometries and materials
        this.scene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });

        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}
