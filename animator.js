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

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(
            container.clientWidth || window.innerWidth,
            container.clientHeight || window.innerHeight
        );
        // Cap pixel ratio at 2 — uncapped retina would render 4× the pixels
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        // Clear container and add canvas
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);

        this.setupLighting();
        this.setupEnvironment();

        this.cubeData = [];
        this.instancedMesh = null;
        this.labels = [];
        this.physics = new PhysicsWorld();
        this.isAnimating = false;
        this.animationFrameId = null;
        this.disposed = false;
        this.spacing = 1.2;
        this.hasFilled = false;
        this.preDropState = null;
        this.dropAborted = false;

        this.resizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);

        this.logRendererInfo();
    }

    logRendererInfo() {
        const gl = this.renderer.getContext();
        const isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined') && (gl instanceof WebGL2RenderingContext);
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

        let vendor = 'unknown';
        let renderer = 'unknown';
        if (debugInfo) {
            vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }

        // Detect known software renderers
        const softwarePatterns = /swiftshader|llvmpipe|software|microsoft basic render|ansi|mesa offscreen/i;
        const isSoftware = softwarePatterns.test(renderer) || softwarePatterns.test(vendor);
        const acceleration = isSoftware ? 'SOFTWARE (CPU rasterization)' : 'HARDWARE (GPU)';

        console.log('%c[Visualizer] Renderer info', 'font-weight: bold; color: #2a9d3f');
        console.log(`  WebGL version : ${isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0'}`);
        console.log(`  GPU vendor    : ${vendor}`);
        console.log(`  GPU renderer  : ${renderer}`);
        console.log(`  Acceleration  : ${acceleration}`);
        console.log(`  Power pref    : high-performance (asks for discrete GPU on dual-GPU systems)`);
        console.log(`  Pixel ratio   : ${this.renderer.getPixelRatio()} (device DPR ${window.devicePixelRatio || 1})`);
        console.log(`  Max texture   : ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}px`);
        console.log('  Three.js scene rendering runs on the GPU when acceleration is HARDWARE.');
        console.log('  Cubes are batched into a single THREE.InstancedMesh — 1 draw call per scene.');
        console.log('  Cannon.js physics runs on the CPU (single-threaded JS) regardless.');

        if (isSoftware) {
            console.warn(
                '[Visualizer] Browser is using SOFTWARE rendering. The GPU is NOT engaged. ' +
                'Enable hardware acceleration in your browser settings (Chrome: chrome://gpu) ' +
                'or check that your GPU drivers are installed.'
            );
        }
    }

    // Swap between inline (main-thread) Cannon and worker-thread Cannon.
    // No-op if the requested backend is already active.
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

    // Allocate a single THREE.InstancedMesh that will hold every cube for the
    // current animation. One draw call covers all instances regardless of count.
    _initInstancedMesh(count) {
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
            this.instancedMesh = null;
        }

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // white base — multiplied by instance color
            metalness: 0.3,
            roughness: 0.6
        });

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Disable frustum culling: physics scatters instances and the batch's
        // bounds aren't recomputed each frame.
        mesh.frustumCulled = false;
        this.scene.add(mesh);

        this.instancedMesh = mesh;
        this.cubeData = [];

        console.log(
            `[Render] Allocated InstancedMesh with capacity ${count} ` +
            `(1 draw call covers every cube — GPU instancing)`
        );

        return mesh;
    }

    // Write cubeData[i] into the i-th slot of the InstancedMesh's matrix buffer.
    // Caller is responsible for setting instanceMatrix.needsUpdate after a batch.
    _writeInstance(i) {
        const data = this.cubeData[i];
        MathAnimator._tmpScaleVec.set(data.scale, data.scale, data.scale);
        MathAnimator._tmpMatrix.compose(data.position, data.quaternion, MathAnimator._tmpScaleVec);
        this.instancedMesh.setMatrixAt(i, MathAnimator._tmpMatrix);
    }

    _markInstanceDirty() {
        if (this.instancedMesh) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
        }
    }

    _addCube(x, y, z, color, scale = 1) {
        const i = this.cubeData.length;
        this.cubeData.push({
            position: new THREE.Vector3(x, y, z),
            quaternion: new THREE.Quaternion(),
            scale,
            color
        });
        this._writeInstance(i);
        this.instancedMesh.setColorAt(i, color);
        return i;
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
            let totalResult = 0;
            let expressionStr = '';
            const colors = this.generateColors(Math.max(groups.length, 2));

            // Pre-compute total cube count and max group width so we can size
            // the InstancedMesh up front.
            let totalCubes = 0;
            let maxGroupWidth = 1;
            for (const g of groups) {
                if (g.type === 'multiply') {
                    totalCubes += (g.a || 1) * (g.b || 1) * (g.c || 1);
                    maxGroupWidth = Math.max(maxGroupWidth, ((g.a || 1) - 1) * s + 1);
                } else if (g.type === 'number') {
                    totalCubes += (g.value || 1);
                    maxGroupWidth = Math.max(maxGroupWidth, ((g.value || 1) - 1) * s + 1);
                }
            }
            const groupGap = maxGroupWidth + 2 * s + 2;

            this._initInstancedMesh(totalCubes);

            const renderedGroups = [];
            let maxTopY = 1;

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const color = colors[i % colors.length];
                const startX = (i - (groups.length - 1) / 2) * groupGap;
                let groupResult = 0;
                const indices = []; // instance indices belonging to this group

                if (group.type === 'multiply') {
                    const a = group.a || 1;
                    const b = group.b || 1;
                    const c = group.c || 1;
                    groupResult = a * b * c;

                    const offsetZ = -(b - 1) * s / 2;

                    for (let layer = 0; layer < c; layer++) {
                        for (let row = 0; row < b; row++) {
                            for (let col = 0; col < a; col++) {
                                const relX = col * s;
                                const idx = this._addCube(
                                    startX + relX,
                                    -6.5 + layer * s,
                                    offsetZ + row * s,
                                    color
                                );
                                indices.push({ idx, relX });
                            }
                        }
                    }

                    expressionStr += (expressionStr ? ' + ' : '') + `${a}×${b}` + (c > 1 ? `×${c}` : '');
                    maxTopY = Math.max(maxTopY, 1 + (c - 1) * s);
                } else if (group.type === 'number') {
                    groupResult = group.value;
                    for (let j = 0; j < group.value; j++) {
                        const relX = j * s;
                        const idx = this._addCube(
                            startX + relX,
                            -6.5,
                            0,
                            color
                        );
                        indices.push({ idx, relX });
                    }
                    expressionStr += (expressionStr ? ' + ' : '') + group.value;
                }

                totalResult += groupResult;
                renderedGroups.push({
                    indices,
                    startX,
                    groupIndex: i,
                    totalGroups: groups.length
                });
            }

            this._markInstanceDirty();
            if (this.instancedMesh.instanceColor) {
                this.instancedMesh.instanceColor.needsUpdate = true;
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
        const total = a * b * c;

        // One InstancedMesh holds every cube for this expression.
        this._initInstancedMesh(total);

        // Create every instance at its final position with scale 0 (a zero-volume
        // cube renders no fragments and casts no shadow, so we get the desired
        // staggered reveal AND no shadow-before-block flash, without needing
        // a custom shader for per-instance opacity).
        for (let layer = 0; layer < c; layer++) {
            for (let row = 0; row < b; row++) {
                for (let col = 0; col < a; col++) {
                    const x = offsetX + col * s;
                    const z = offsetZ + row * s;
                    const y = -6.5 + layer * s;
                    this._addCube(x, y, z, color, 0);
                }
            }
        }
        this._markInstanceDirty();
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }

        const fillDuration = 2000; // fixed window regardless of cube count
        const cellGrow = 250;
        const stagger = total > 1 ? (fillDuration - cellGrow) / (total - 1) : 0;

        const startTime = Date.now();
        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                let allDone = true;
                for (let i = 0; i < total; i++) {
                    const t = Math.max(0, Math.min(1, (elapsed - i * stagger) / cellGrow));
                    if (this.cubeData[i].scale !== t) {
                        this.cubeData[i].scale = t;
                        this._writeInstance(i);
                    }
                    if (t < 1) allDone = false;
                }
                this._markInstanceDirty();
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

                // Each group's center moves linearly from its startX toward 0.
                // For an instance with offset relX from the group center, its
                // current x is (startX * (1 - t) + relX).
                for (const group of groups) {
                    const groupX = group.startX * (1 - t);
                    for (const { idx, relX } of group.indices) {
                        this.cubeData[idx].position.x = groupX + relX;
                        this._writeInstance(idx);
                    }
                }
                this._markInstanceDirty();

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            animate();
        });
    }

    async startDrop({ friction = 0.5, rowDelay = 60, rotRange = 0.5 } = {}) {
        if (!this.hasFilled || this.isAnimating) return;
        this.isAnimating = true;
        this.dropAborted = false;

        // Snapshot pre-drop state for RESET
        this.preDropState = this.cubeData.map(d => ({
            position: d.position.clone(),
            quaternion: d.quaternion.clone()
        }));

        await this.physics.waitReady();
        this.physics.reset();

        // Group cubes by y-row (round to nearest 0.5), sort bottom (lowest y) first
        const rowMap = new Map();
        this.cubeData.forEach((data, idx) => {
            const rowKey = Math.round(data.position.y * 2) / 2;
            if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
            rowMap.get(rowKey).push(idx);
        });
        const sortedRowKeys = [...rowMap.keys()].sort((a, b) => a - b);

        const addRowToPhysics = (rowKey) => {
            if (this.dropAborted) return;
            for (const idx of rowMap.get(rowKey)) {
                const data = this.cubeData[idx];
                // Apply random rotation
                const randomAxis = new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize();
                const randomAngle = (Math.random() - 0.5) * rotRange;
                const randomQuat = new THREE.Quaternion();
                randomQuat.setFromAxisAngle(randomAxis, randomAngle);
                data.quaternion.multiplyQuaternions(randomQuat, data.quaternion);

                this.physics.addCube(data.position.x, data.position.y, data.position.z, 1, friction, friction);
            }
        };

        // Add bottom row immediately, schedule subsequent rows
        addRowToPhysics(sortedRowKeys[0]);
        for (let i = 1; i < sortedRowKeys.length; i++) {
            const key = sortedRowKeys[i];
            const delay = i * rowDelay;
            setTimeout(() => addRowToPhysics(key), delay);
        }

        const dropStart = performance.now();
        const cubeCount = this.cubeData.length;

        return new Promise(resolve => {
            const simulate = async () => {
                if (this.dropAborted) {
                    this.isAnimating = false;
                    resolve();
                    return;
                }

                const result = await this.physics.stepAndGetStates();
                if (this.dropAborted || result.stale) {
                    this.isAnimating = false;
                    resolve();
                    return;
                }

                // Only update cubes that have been added to physics so far
                const physicsN = result.states.length / 7;
                for (let i = 0; i < physicsN; i++) {
                    const base = i * 7;
                    const data = this.cubeData[i];
                    if (!data) continue;
                    data.position.set(result.states[base], result.states[base + 1], result.states[base + 2]);
                    data.quaternion.set(result.states[base + 3], result.states[base + 4], result.states[base + 5], result.states[base + 6]);
                    this._writeInstance(i);
                }
                this._markInstanceDirty();

                // Only settle once all cubes are in physics
                if (result.settled && physicsN >= cubeCount) {
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

        // Restore each instance to its pre-drop position and orientation
        for (let i = 0; i < this.preDropState.length; i++) {
            const snap = this.preDropState[i];
            const data = this.cubeData[i];
            if (!data) continue;
            data.position.copy(snap.position);
            data.quaternion.copy(snap.quaternion);
            this._writeInstance(i);
        }
        this._markInstanceDirty();

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
        // Drop the InstancedMesh holding all cubes
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
            this.instancedMesh = null;
        }
        this.cubeData = [];

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

        // Tear down the physics backend (terminates the worker if active)
        if (this.physics) {
            this.physics.dispose();
            this.physics = null;
        }

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

// Scratch objects shared across all MathAnimator instances — avoids
// allocating thousands of Matrix4/Vector3 per frame during physics.
MathAnimator._tmpMatrix = new THREE.Matrix4();
MathAnimator._tmpScaleVec = new THREE.Vector3();
