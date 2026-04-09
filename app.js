/**
 * Hand Gesture 3D Visualizer - Core Engine
 * Powered by Three.js & MediaPipe
 */

const PARTICLE_COUNT = 15000;
const MORPH_SPEED = 0.08;
const PARTICLE_SIZE = 0.12;

let scene, camera, renderer, particleSystem;
let currentShape = 'sphere';
let handX = 0, handY = 0;
let isPinching = false;
let isTracking = false;

const shapes = {
    sphere: [],
    heart: [],
    flower: [],
    saturn: [],
    fireworks: []
};

// --- Initialization ---

async function init() {
    setupThreeJS();
    generateShapes();
    setupMediaPipe();
    animate();
    
    // UI Events
    document.getElementById('init-btn').addEventListener('click', startSystem);
}

function setupThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Particle System Setup
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 100;
        colors[i] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: PARTICLE_SIZE,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.9
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    window.addEventListener('resize', onWindowResize);
}

function generateShapes() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // 1. Sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = 10 + Math.random() * 0.5;
        shapes.sphere.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        // 2. Heart
        const t = Math.random() * Math.PI * 2;
        const h_scale = 0.55;
        const x_h = 16 * Math.pow(Math.sin(t), 3);
        const y_h = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        const z_h = (Math.random() - 0.5) * 8; 
        const v = 1 - Math.random() * 0.1; 
        shapes.heart.push(x_h * h_scale * v, y_h * h_scale * v, z_h);

        // 3. Flower
        const f_theta = Math.random() * Math.PI * 2;
        const f_phi = (Math.random() - 0.5) * Math.PI;
        const k = 4; // 8 petals
        const r_f = 12 * Math.cos(k * f_theta) + 3;
        shapes.flower.push(
            r_f * Math.cos(f_theta) * Math.cos(f_phi),
            r_f * Math.sin(f_theta) * Math.cos(f_phi),
            8 * Math.sin(f_phi)
        );

        // 4. Saturn
        if (i < PARTICLE_COUNT * 0.35) {
            const s_theta = Math.random() * Math.PI * 2;
            const s_phi = Math.acos((Math.random() * 2) - 1);
            const s_r = 7;
            shapes.saturn.push(s_r * Math.sin(s_phi) * Math.cos(s_theta), s_r * Math.sin(s_phi) * Math.sin(s_theta), s_r * Math.cos(s_phi));
        } else {
            const ring_angle = Math.random() * Math.PI * 2;
            const ring_r = 10 + Math.random() * 7;
            shapes.saturn.push(ring_r * Math.cos(ring_angle), (Math.random()-0.5) * 0.8, ring_r * Math.sin(ring_angle));
        }

        // 5. Fireworks
        const fw_theta = Math.random() * Math.PI * 2;
        const fw_phi = Math.acos((Math.random() * 2) - 1);
        const fw_r = Math.pow(Math.random(), 2) * 25; 
        shapes.fireworks.push(fw_r * Math.sin(fw_phi) * Math.cos(fw_theta), fw_r * Math.sin(fw_phi) * Math.sin(fw_theta), fw_r * Math.cos(fw_phi));
    }
}

// --- MediaPipe Logic ---

let hands;

function setupMediaPipe() {
    const videoElement = document.getElementById('video-feed');
    
    hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            if(isTracking) await hands.send({image: videoElement});
        },
        width: 320,
        height: 240
    });
    camera.start();
}

function countFingers(landmarks) {
    let count = 0;
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];

    // Thumb check
    if (landmarks[4].x < landmarks[3].x) count++;

    for(let i=0; i<4; i++) {
        if(landmarks[tips[i]].y < landmarks[pips[i]].y) count++;
    }
    return count;
}

function onResults(results) {
    const statusVal = document.getElementById('status-value');
    const items = document.querySelectorAll('.gesture-item');
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusVal.innerText = "ACTIVE";
        statusVal.style.color = "var(--primary)";
        
        const landmarks = results.multiHandLandmarks[0];
        const fingers = countFingers(landmarks);
        
        // Update current shape based on fingers
        const shapeMap = ['sphere', 'sphere', 'heart', 'flower', 'saturn', 'fireworks'];
        const newShape = shapeMap[Math.min(fingers, 5)];
        
        if(newShape !== currentShape) {
            currentShape = newShape;
            // Update UI list
            items.forEach(item => {
                item.classList.remove('active');
                if(item.getAttribute('data-shape') === currentShape) item.classList.add('active');
            });
        }

        // Pinch Detection
        const dx = landmarks[4].x - landmarks[8].x;
        const dy = landmarks[4].y - landmarks[8].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        isPinching = dist < 0.04;
        
        if(isPinching) document.body.classList.add('pinch-active');
        else document.body.classList.remove('pinch-active');

        // Rotation mapping
        handX = (landmarks[9].x - 0.5) * 2;
        handY = (landmarks[9].y - 0.5) * 2;

    } else {
        statusVal.innerText = "STANDBY";
        statusVal.style.color = "rgba(255,255,255,0.3)";
        isPinching = false;
        handX *= 0.95;
        handY *= 0.95;
    }
}

// --- Animation & Effects ---

function animate() {
    requestAnimationFrame(animate);

    const positions = particleSystem.geometry.attributes.position.array;
    const cols = particleSystem.geometry.attributes.color.array;
    const target = shapes[currentShape];
    const time = Date.now() * 0.001;

    particleSystem.rotation.y += 0.003 + (handX * 0.08);
    particleSystem.rotation.z += (handY * 0.05);

    // Dynamic Colors
    let r_t, g_t, b_t;
    if(isPinching) {
        r_t=1; g_t=0.0; b_t=0.9; // Magenta pinch highlight
    } else {
        r_t = 0.4 + 0.4 * Math.sin(time * 0.8);
        g_t = 0.6 + 0.3 * Math.sin(time * 0.8 + 2);
        b_t = 0.9 + 0.1 * Math.sin(time * 0.8 + 4);
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const idx = i * 3;
        
        // Morphing
        positions[idx] += (target[idx] - positions[idx]) * MORPH_SPEED;
        positions[idx+1] += (target[idx+1] - positions[idx+1]) * MORPH_SPEED;
        positions[idx+2] += (target[idx+2] - positions[idx+2]) * MORPH_SPEED;

        if (isPinching) {
            const pulse = 1 + Math.sin(time * 10) * 0.02;
            positions[idx] *= pulse;
            positions[idx+1] *= pulse;
            positions[idx+2] *= pulse;
        }

        // Colors
        cols[idx] += (r_t - cols[idx]) * 0.08;
        cols[idx+1] += (g_t - cols[idx+1]) * 0.08;
        cols[idx+2] += (b_t - cols[idx+2]) * 0.08;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
}

// --- Helper Functions ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function startSystem() {
    const landing = document.getElementById('landing-screen');
    const btn = document.getElementById('init-btn');
    const loader = document.querySelector('.loading-bar');
    const progress = document.querySelector('.loading-progress');
    
    btn.style.display = 'none';
    loader.style.display = 'block';
    
    let p = 0;
    const interval = setInterval(() => {
        p += 5;
        progress.style.width = p + '%';
        if(p >= 100) {
            clearInterval(interval);
            landing.style.opacity = '0';
            setTimeout(() => {
                landing.style.display = 'none';
                isTracking = true;
            }, 1000);
        }
    }, 50);
}

// Start the app
window.onload = init;
