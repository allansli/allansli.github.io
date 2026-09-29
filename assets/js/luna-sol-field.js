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
    scene.fog = new THREE.FogExp2(0x05060a, 0.02);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, 0, 8);

    const glowMap = createGlowTexture(THREE);
    const field = new THREE.Group();
    scene.add(field);

    const haze = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowMap,
        color: 0x9aabC4,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
    }));
    field.add(haze);

    const luna = createBody(THREE, glowMap, {
        sprite: 0xc4e7ff,
        core: 0xc4e7ff,
        spriteOpacity: 0.72
    });
    const sol = createBody(THREE, glowMap, {
        sprite: 0xff9f40,
        core: 0xff9f40,
        spriteOpacity: 0.78
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
        const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
        const halfW = halfH * camera.aspect;
        const wide = camera.aspect >= 1;
        const lunaAngle = (time / LUNA_PERIOD) * Math.PI * 2;
        const solAngle = (time / SOL_PERIOD) * Math.PI * 2 + 0.9;
        const ampX = halfW * (wide ? 0.07 : 0.05);
        const ampY = halfH * 0.06;

        haze.position.set(halfW * 0.15, halfH * 0.2, -1.2);
        haze.scale.set(halfW * 1.4, halfH * 1.3, 1);

        const lunaScale = halfH * (wide ? 0.78 : 0.7);
        const solScale = halfH * (wide ? 0.62 : 0.56);
        luna.userData.sprite.scale.set(lunaScale, lunaScale, 1);
        sol.userData.sprite.scale.set(solScale, solScale, 1);
        luna.userData.core.scale.setScalar(lunaScale * 0.2);
        sol.userData.core.scale.setScalar(solScale * 0.22);

        luna.position.set(
            halfW * (wide ? 0.42 : -0.16) + Math.cos(lunaAngle) * ampX + Math.sin(lunaAngle * 2) * ampX * 0.35,
            halfH * (wide ? -0.2 : 0.28) + Math.sin(lunaAngle) * ampY,
            0
        );
        sol.position.set(
            halfW * (wide ? 0.78 : 0.28) + Math.cos(solAngle) * ampX * 0.8,
            halfH * (wide ? 0.48 : 0.62) + Math.sin(solAngle) * ampY * 0.85,
            0.15
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
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 24),
        new THREE.MeshBasicMaterial({ color: spec.core })
    );
    group.add(sprite, core);
    group.userData.sprite = sprite;
    group.userData.core = core;
    return group;
}

function createGlowTexture(THREE) {
    const surface = document.createElement("canvas");
    surface.width = 128;
    surface.height = 128;
    const context = surface.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.82)");
    gradient.addColorStop(0.46, "rgba(255,255,255,0.22)");
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
