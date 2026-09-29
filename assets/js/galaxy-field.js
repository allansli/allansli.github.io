// Clock-driven nebula. The field does not read scroll position.
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const STATIC_TIME = 6.5;
const MAX_PIXEL_RATIO = 1.5;
const DUST_COUNT = 840;

function boot() {
    const canvas = document.getElementById("galaxy-field");
    if (!canvas || !webglSupported()) {
        return;
    }

    import("three")
        .then((THREE) => {
            mountField(THREE, canvas);
        })
        .catch(() => {
            document.documentElement.classList.remove("webgl");
        });
}

function webglSupported() {
    try {
        const probe = document.createElement("canvas");
        return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch (error) {
        return false;
    }
}

function mountField(THREE, canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false
    });

    if (!renderer.getContext()) {
        return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x05060a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
    camera.position.set(0, 0, 8);

    const nebulaMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: STATIC_TIME }
        },
        vertexShader: nebulaVertex,
        fragmentShader: nebulaFragment,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
    });
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), nebulaMaterial);
    nebula.position.z = -6;
    camera.add(nebula);
    scene.add(camera);

    const dust = createDust(THREE);
    scene.add(dust.points);

    let frame = 0;
    let origin = performance.now();
    let pausedAt = 0;
    let pausedTotal = 0;
    let reduced = REDUCED_MOTION.matches;

    function elapsedSeconds() {
        if (reduced) {
            return STATIC_TIME;
        }
        return (performance.now() - origin - pausedTotal) / 1000;
    }

    function resize() {
        const width = Math.max(window.innerWidth, 1);
        const height = Math.max(window.innerHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const distance = Math.abs(nebula.position.z);
        const halfH = Math.tan((camera.fov * Math.PI) / 360) * distance;
        const halfW = halfH * camera.aspect;
        nebula.scale.set(halfW * 2.2, halfH * 2.2, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.setSize(width, height, false);
        draw(elapsedSeconds());
    }

    function draw(time) {
        nebulaMaterial.uniforms.uTime.value = time;
        dust.material.uniforms.uTime.value = time;
        if (reduced) {
            camera.position.set(0, 0, 8);
        } else {
            camera.position.set(
                Math.sin(time * 0.045) * 0.55,
                Math.cos(time * 0.031) * 0.28,
                8 + Math.sin(time * 0.02) * 0.3
            );
        }
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
    }

    function stop() {
        if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
    }

    function loop() {
        stop();
        if (reduced || document.hidden) {
            draw(elapsedSeconds());
            return;
        }
        const tick = () => {
            frame = requestAnimationFrame(tick);
            draw(elapsedSeconds());
        };
        tick();
    }

    window.addEventListener("resize", resize);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            pausedAt = performance.now();
            stop();
            return;
        }
        if (pausedAt) {
            pausedTotal += performance.now() - pausedAt;
            pausedAt = 0;
        }
        loop();
    });

    REDUCED_MOTION.addEventListener("change", () => {
        reduced = REDUCED_MOTION.matches;
        if (reduced) {
            origin = performance.now();
            pausedTotal = 0;
        }
        loop();
    });

    canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        stop();
        document.documentElement.classList.remove("webgl");
    });

    resize();
    document.documentElement.classList.add("webgl");
    loop();
}

function createDust(THREE) {
    const positions = new Float32Array(DUST_COUNT * 3);
    const colors = new Float32Array(DUST_COUNT * 3);
    const sizes = new Float32Array(DUST_COUNT);
    const palette = [
        [0.55, 0.62, 0.86],
        [0.62, 0.46, 0.78],
        [0.78, 0.58, 0.36],
        [0.72, 0.74, 0.8]
    ];

    for (let index = 0; index < DUST_COUNT; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * 26;
        positions[index * 3 + 1] = (Math.random() - 0.5) * 15;
        positions[index * 3 + 2] = -2 - Math.random() * 16;
        const color = palette[index % palette.length];
        colors[index * 3] = color[0];
        colors[index * 3 + 1] = color[1];
        colors[index * 3 + 2] = color[2];
        sizes[index] = 0.7 + Math.random() * 1.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: STATIC_TIME }
        },
        vertexShader: dustVertex,
        fragmentShader: dustFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });

    return { points: new THREE.Points(geometry, material), material };
}

const nebulaVertex = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const nebulaFragment = `
precision mediump float;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float value = 0.0;
    float weight = 0.5;
    for (int octave = 0; octave < 5; ++octave) {
        value += weight * noise(p);
        p *= 2.03;
        weight *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = vUv;
    float t = uTime * 0.018;
    vec2 drift = vec2(t * 0.35, t * 0.12);
    float broad = fbm(uv * vec2(1.6, 2.4) + drift);
    float lane = fbm(vec2(uv.x * 0.8 + broad, uv.y * 3.4 - t * 0.2));
    float veil = fbm(uv * 3.2 + vec2(-t * 0.15, broad));

    vec3 voidColor = vec3(0.02, 0.025, 0.05);
    vec3 indigo = vec3(0.18, 0.26, 0.58);
    vec3 violet = vec3(0.40, 0.14, 0.48);
    vec3 dust = vec3(0.58, 0.32, 0.14);

    vec3 color = voidColor;
    color = mix(color, indigo, smoothstep(0.22, 0.68, broad));
    color = mix(color, violet, smoothstep(0.38, 0.76, lane) * 0.9);
    color += dust * smoothstep(0.5, 0.88, lane) * veil * 0.28;

    float vignette = smoothstep(1.35, 0.15, length((uv - vec2(0.5, 0.46)) * vec2(1.1, 0.95)));
    color *= mix(0.82, 1.0, vignette);
    gl_FragColor = vec4(color, 1.0);
}
`;

const dustVertex = `
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
varying vec3 vColor;

void main() {
    vColor = aColor;
    vec3 drifted = position;
    drifted.x += sin(uTime * 0.05 + position.y * 0.17) * 0.45;
    drifted.y += cos(uTime * 0.04 + position.x * 0.11) * 0.28;
    vec4 viewPosition = modelViewMatrix * vec4(drifted, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * (150.0 / max(1.0, -viewPosition.z));
}
`;

const dustFragment = `
precision mediump float;
varying vec3 vColor;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) {
        discard;
    }
    float alpha = smoothstep(0.5, 0.08, dist) * 0.35;
    gl_FragColor = vec4(vColor, alpha);
}
`;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
