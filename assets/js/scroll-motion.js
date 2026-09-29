const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
const CHAPTER_WARMTH = [-0.55, 0.28, -0.18, 0.62];

function boot() {
    const proofItems = document.querySelectorAll(".proof-list > li");
    const chapters = document.querySelectorAll(".case");
    const claim = document.querySelector("#hero-title");
    chapters.forEach((chapter, index) => {
        chapter.dataset.chapter = String(index);
    });

    let revealObserver = null;
    let chapterObserver = null;
    let fallbackBound = false;

    function setWarmth(value) {
        document.dispatchEvent(new CustomEvent("galaxy-warmth", { detail: value }));
    }

    function disconnect() {
        if (revealObserver) {
            revealObserver.disconnect();
            revealObserver = null;
        }
        if (chapterObserver) {
            chapterObserver.disconnect();
            chapterObserver = null;
        }
    }

    function clearMotionStyles() {
        if (!claim) {
            return;
        }
        claim.style.opacity = "";
        claim.style.transform = "";
        claim.style.letterSpacing = "";
    }

    function enable() {
        document.documentElement.classList.add("motion");
        disconnect();

        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-in");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.18 });

        proofItems.forEach((item) => revealObserver.observe(item));
        chapters.forEach((chapter) => revealObserver.observe(chapter));

        const seen = new Map();
        chapterObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    seen.set(entry.target, entry.intersectionRatio);
                } else {
                    seen.delete(entry.target);
                }
            });
            let active = null;
            let ratio = 0;
            seen.forEach((value, element) => {
                if (value >= ratio) {
                    active = element;
                    ratio = value;
                }
            });
            if (!active) {
                setWarmth(0);
                return;
            }
            const index = Number(active.dataset.chapter);
            setWarmth(CHAPTER_WARMTH[index] || 0);
        }, { threshold: [0.2, 0.45, 0.7] });

        chapters.forEach((chapter) => chapterObserver.observe(chapter));

        if (claim && !fallbackBound && !CSS.supports("animation-timeline", "scroll(root)")) {
            fallbackBound = true;
            let queued = false;
            const onScroll = () => {
                if (queued || REDUCED.matches) {
                    return;
                }
                queued = true;
                requestAnimationFrame(() => {
                    const distance = Math.max(window.innerHeight * 0.42, 1);
                    const progress = Math.min(1, window.scrollY / distance);
                    claim.style.opacity = String(1 - progress * 0.48);
                    claim.style.transform = `translate3d(0, ${(-12 * progress).toFixed(2)}px, 0) scale(${(1 - progress * 0.02).toFixed(4)})`;
                    claim.style.letterSpacing = `${(-0.045 + progress * 0.012).toFixed(4)}em`;
                    queued = false;
                });
            };
            window.addEventListener("scroll", onScroll, { passive: true });
            claim.dataset.scrollFallback = "true";
        }
    }

    function disable() {
        document.documentElement.classList.remove("motion");
        disconnect();
        document.querySelectorAll(".is-in").forEach((element) => {
            element.classList.remove("is-in");
        });
        clearMotionStyles();
        setWarmth(0);
    }

    document.addEventListener("focusin", (event) => {
        if (REDUCED.matches || !event.target.closest) {
            return;
        }
        const proof = event.target.closest(".proof-list > li");
        const chapter = event.target.closest(".case");
        if (proof) {
            proof.classList.add("is-in");
        }
        if (chapter) {
            chapter.classList.add("is-in");
        }
    });

    function sync() {
        if (REDUCED.matches) {
            disable();
            return;
        }
        enable();
    }

    REDUCED.addEventListener("change", sync);
    sync();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
