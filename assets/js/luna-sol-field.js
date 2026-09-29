const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const FINE_POINTER = window.matchMedia("(hover: hover) and (pointer: fine)");
const LUNA_PERIOD = 52;
const SOL_PERIOD = 57;
const STATIC_TIME = 11.5;
const MAX_PIXEL_RATIO = 1.5;

function boot() {
    const canvas = document.getElementById("luna-sol-field");
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
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x05060a, 0.055);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0, 0.15, 8.4);

    const glowMap = createGlowTexture(THREE);
    const field = new THREE.Group();
    scene.add(field);

    const haze = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowMap,
        color: 0x8ea0b8,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
    }));
    haze.scale.set(13.5, 9.5, 1);
    haze.position.set(0.6, 0.7, -1.6);
    field.add(haze);

    const luna = createBody(THREE, glowMap, {
        sprite: 0xc5d4e6,
        core: 0xe7eef6,
        spriteScale: 5.4,
        spriteOpacity: 0.72,
        coreRadius: 0.46
    });
    const sol = createBody(THREE, glowMap, {
        sprite: 0xe8a84a,
        core: 0xffe3b5,
        spriteScale: 4.5,
        spriteOpacity: 0.8,
        coreRadius: 0.4
    });
    field.add(luna, sol);

    const pointer = { x: 0, y: 0 };
    const offset = { x: 0, y: 0 };
    let frame = 0;
    let origin = performance.now();
    let pausedAt = 0;
    let pausedTotal = 0;
    let reduced = REDUCED_MOTION.matches;
    let finePointer = FINE_POINTER.matches;

    function resize() {
        const width = Math.max(window.innerWidth, 1);
        const height = Math.max(window.innerHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.setSize(width, height, false);
        draw(elapsedSeconds());
    }

    function elapsedSeconds() {
        if (reduced) {
            return STATIC_TIME;
        }
        return (performance.now() - origin - pausedTotal) / 1000;
    }

    function draw(time) {
        const aspect = camera.aspect;
        const xAmp = aspect > 1.05 ? 2.15 : 1.05;
        const yAmp = aspect > 1.05 ? 0.78 : 0.95;
        const lunaAngle = (time / LUNA_PERIOD) * Math.PI * 2;
        const solAngle = (time / SOL_PERIOD) * Math.PI * 2 + 2.05;

        luna.position.set(
            1.15 + Math.cos(lunaAngle) * xAmp + Math.sin(lunaAngle * 2) * 0.16,
            0.85 + Math.sin(lunaAngle) * yAmp * 0.72 + Math.cos(lunaAngle * 0.47) * 0.1,
            Math.sin(lunaAngle * 0.73) * 0.4
        );
        sol.position.set(
            1.45 + Math.cos(solAngle) * xAmp * 0.9 + Math.sin(solAngle * 3) * 0.1,
            1.15 + Math.sin(solAngle) * yAmp * 0.62,
            Math.cos(solAngle * 0.81) * 0.32
        );

        if (!reduced) {
            const drift = finePointer ? 0 : Math.sin(time * 0.11) * 0.16;
            const targetX = (finePointer ? pointer.x * 0.26 : 0) + drift;
            const targetY = finePointer ? pointer.y * -0.14 : 0;
            offset.x += (targetX - offset.x) * 0.035;
            offset.y += (targetY - offset.y) * 0.035;
        } else {
            offset.x = 0;
            offset.y = 0;
        }
        field.position.set(offset.x, offset.y, 0);
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

    window.addEventListener("pointermove", (event) => {
        if (!finePointer || reduced) {
            return;
        }
        pointer.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
        pointer.y = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
    }, { passive: true });

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

    FINE_POINTER.addEventListener("change", () => {
        finePointer = FINE_POINTER.matches;
        pointer.x = 0;
        pointer.y = 0;
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

function createBody(THREE, glowMap, spec) {
    const group = new THREE.Group();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowMap,
        color: spec.sprite,
        transparent: true,
        opacity: spec.spriteOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    sprite.scale.set(spec.spriteScale, spec.spriteScale, 1);

    const core = new THREE.Mesh(
        new THREE.SphereGeometry(spec.coreRadius, 32, 24),
        new THREE.MeshBasicMaterial({ color: spec.core })
    );
    group.add(sprite, core);
    return group;
}

function createGlowTexture(THREE) {
    const surface = document.createElement("canvas");
    surface.width = 128;
    surface.height = 128;
    const context = surface.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.18, "rgba(255,255,255,0.62)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
