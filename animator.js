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
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;

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

        const colors = this.generateColors(c ? c : 1);
        const result = c ? a * b * c : a * b;

        try {
            // 1. Draw and fill grid
            await this.drawAndFillGrid(a, b, colors[0]);

            // 2. Extrude to 1-unit tall cubes
            await this.extrudeToUnit(a, b, 1);

            if (c) {
                // 3. Extrude into 3D prism
                await this.extrude3D(a, b, c, colors);
            }

            // 4. Show label
            const expr = c ? `${a} × ${b} × ${c}` : `${a} × ${b}`;
            this.createLabel(`${expr} = ${result}`, 0, 15, 0);

            // 5. Drop physics
            await this.dropPhysics();

            this.isAnimating = false;
        } catch (e) {
            console.error('Animation error:', e);
            this.isAnimating = false;
        }
    }

    async animateAddition(groups) {
        this.isAnimating = true;
        this.clear();

        try {
            // Render groups separately
            const renderedGroups = [];
            let totalResult = 0;
            let expressionStr = '';
            const colors = this.generateColors(Math.max(groups.length, 2));

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const color = colors[i % colors.length];
                let groupResult = 0;
                let groupMeshes = [];

                if (group.type === 'multiply') {
                    const a = group.a || 1;
                    const b = group.b || 1;
                    const c = group.c || null;
                    groupResult = c ? a * b * c : a * b;

                    // Create grid for this group
                    const spacing = 1.5;
                    const startX = (i - (groups.length - 1) / 2) * 10;
                    for (let row = 0; row < b; row++) {
                        for (let col = 0; col < a; col++) {
                            const mesh = this.createCube(
                                startX + col * spacing,
                                0.5,
                                row * spacing,
                                1,
                                color
                            );
                            groupMeshes.push(mesh);
                        }
                    }

                    if (c) {
                        // Add depth layers
                        for (let layer = 1; layer < c; layer++) {
                            for (let row = 0; row < b; row++) {
                                for (let col = 0; col < a; col++) {
                                    const mesh = this.createCube(
                                        startX + col * spacing,
                                        0.5,
                                        row * spacing - layer * spacing,
                                        1,
                                        color
                                    );
                                    groupMeshes.push(mesh);
                                }
                            }
                        }
                    }

                    expressionStr += (expressionStr ? ' + ' : '') + `${a}×${b}` + (c ? `×${c}` : '');
                } else if (group.type === 'number') {
                    groupResult = group.value;
                    const startX = (i - (groups.length - 1) / 2) * 10;
                    for (let j = 0; j < group.value; j++) {
                        const mesh = this.createCube(
                            startX + j * 1.5,
                            0.5,
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
                    startX: (i - (groups.length - 1) / 2) * 10,
                    groupIndex: i,
                    totalGroups: groups.length
                });
            }

            // Animate groups sliding together
            await this.slideGroupsTogether(renderedGroups);

            // Show label
            this.createLabel(`${expressionStr} = ${totalResult}`, 0, 15, 0);

            // Drop physics
            await this.dropPhysics();

            this.isAnimating = false;
        } catch (e) {
            console.error('Animation error:', e);
            this.isAnimating = false;
        }
    }

    async drawAndFillGrid(cols, rows, color) {
        // Fade in empty grid cells
        const spacing = 2;
        const offsetX = -(cols - 1) * spacing / 2;
        const offsetZ = -(rows - 1) * spacing / 2;

        const cellDuration = 50; // ms per cell
        const startTime = Date.now();

        const createCell = () => {
            let filledCount = 0;
            const updateCell = () => {
                const elapsed = Date.now() - startTime;
                const targetCount = Math.floor(elapsed / cellDuration);

                while (filledCount < targetCount && filledCount < cols * rows) {
                    const row = Math.floor(filledCount / cols);
                    const col = filledCount % cols;
                    const x = offsetX + col * spacing;
                    const z = offsetZ + row * spacing;

                    const mesh = this.createCube(x, 0.5, z, 1, color);
                    mesh.material.transparent = true;
                    mesh.material.opacity = 0;

                    const duration = 200;
                    const start = Date.now();
                    const animate = () => {
                        const t = (Date.now() - start) / duration;
                        if (t < 1) {
                            mesh.material.opacity = Math.min(1, t);
                            requestAnimationFrame(animate);
                        }
                    };
                    animate();

                    filledCount++;
                }

                if (filledCount < cols * rows) {
                    requestAnimationFrame(updateCell);
                }
            };
            updateCell();
        };

        return new Promise(resolve => {
            createCell();
            setTimeout(resolve, cols * rows * cellDuration + 300);
        });
    }

    async extrudeToUnit(cols, rows, height) {
        const duration = 400;
        const start = Date.now();

        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - start;
                const t = Math.min(1, elapsed / duration);

                for (const { mesh } of this.cubes) {
                    mesh.scale.y = t;
                    mesh.position.y = 0.5 * t;
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

    async extrude3D(a, b, c, colors) {
        const spacing = 2;
        const offsetX = -(a - 1) * spacing / 2;
        const offsetZ = -(b - 1) * spacing / 2;

        // Add new layers for depth
        for (let layer = 1; layer < c; layer++) {
            for (let row = 0; row < b; row++) {
                for (let col = 0; col < a; col++) {
                    const x = offsetX + col * spacing;
                    const z = offsetZ + row * spacing;
                    const mesh = this.createCube(x, 0.5, z - layer * spacing, 1, colors[layer % colors.length]);
                    mesh.material.transparent = true;
                    mesh.material.opacity = 0;

                    const duration = 200;
                    const start = Date.now();
                    const animate = () => {
                        const t = (Date.now() - start) / duration;
                        if (t < 1) {
                            mesh.material.opacity = Math.min(1, t);
                            requestAnimationFrame(animate);
                        }
                    };
                    animate();
                }
            }
        }

        // Orbit camera to show depth
        const duration = 800;
        const start = Date.now();
        const initialCamPos = this.camera.position.clone();

        return new Promise(resolve => {
            const animate = () => {
                const elapsed = Date.now() - start;
                const t = Math.min(1, elapsed / duration);

                const angle = (Math.PI / 6) * t;
                this.camera.position.x = initialCamPos.x + Math.sin(angle) * 5;
                this.camera.position.z = initialCamPos.z + Math.cos(angle) * 5;
                this.camera.lookAt(0, 5, -3);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            animate();
        });
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

    async dropPhysics() {
        // Convert Three.js meshes to physics bodies
        for (const { mesh, color, size } of this.cubes) {
            const body = this.physics.createCube(
                mesh.position.x,
                mesh.position.y + 10,
                mesh.position.z,
                size,
                color
            );
        }

        // Simulate physics until settled
        const maxIterations = 300;
        let iterations = 0;

        return new Promise(resolve => {
            const simulate = () => {
                this.physics.step();

                // Update Three.js meshes from physics bodies
                for (let i = 0; i < this.cubes.length; i++) {
                    const { mesh } = this.cubes[i];
                    const physicsBody = this.physics.bodies[i];
                    if (physicsBody) {
                        const state = this.physics.getBodyState(physicsBody.body);
                        mesh.position.copy(new THREE.Vector3(
                            state.position.x,
                            state.position.y,
                            state.position.z
                        ));
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
                    // Slow orbit camera around final pile
                    this.startCameraOrbit();
                    resolve();
                } else {
                    requestAnimationFrame(simulate);
                }
            };
            simulate();
        });
    }

    startCameraOrbit() {
        const startAngle = 0;
        const startTime = Date.now();
        const orbitDuration = 4000;

        const orbit = () => {
            const elapsed = Date.now() - startTime;
            const t = (elapsed % orbitDuration) / orbitDuration;
            const angle = startAngle + t * Math.PI * 2;

            this.camera.position.x = Math.cos(angle) * 15;
            this.camera.position.z = Math.sin(angle) * 15;
            this.camera.lookAt(0, 0, 0);

            this.animationFrameId = requestAnimationFrame(orbit);
        };
        orbit();
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
