const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
const CHAPTER_WARMTH = [-0.55, 0.28, -0.18, 0.62];

function boot() {
    const scrubs = Array.from(document.querySelectorAll(".scrub"));
    const chapters = document.querySelectorAll(".case");
    chapters.forEach((chapter, index) => {
        chapter.dataset.chapter = String(index);
    });

    const entries = scrubs.map((scrub) => {
        const sticky = scrub.querySelector(".scrub-sticky");
        const pieces = Array.from(scrub.querySelectorAll(".piece"));
        pieces.forEach((piece) => {
            piece._x = Number(piece.style.getPropertyValue("--x")) || 0;
            piece._y = Number(piece.style.getPropertyValue("--y")) || 0;
        });
        return { scrub, sticky, pieces, forced: false };
    });

    let chapterObserver = null;
    let queued = false;
    let enabled = false;

    function setWarmth(value) {
        document.dispatchEvent(new CustomEvent("galaxy-warmth", { detail: value }));
    }

    function sectionProgress(scrub) {
        const rect = scrub.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel <= 1) {
            return rect.top <= 0 ? 1 : 0;
        }
        return Math.min(1, Math.max(0, -rect.top / travel));
    }

    function writePiece(piece, join) {
        const next = Math.min(1, Math.max(0, join)).toFixed(4);
        if (piece.dataset.join === next) {
            return;
        }
        piece.dataset.join = next;
        piece.style.setProperty("--join", next);
    }

    function clearPiece(piece) {
        delete piece.dataset.join;
        piece.style.removeProperty("--join");
        piece.classList.remove("is-locked");
    }

    function paint() {
        if (!enabled) {
            return;
        }
        entries.forEach((entry) => {
            const progress = entry.forced ? 1 : sectionProgress(entry.scrub);
            entry.pieces.forEach((piece) => {
                writePiece(piece, progress);
            });
        });
    }

    function requestPaint() {
        if (!enabled || queued || document.hidden) {
            return;
        }
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            if (!document.hidden) {
                paint();
            }
        });
    }

    function clampPieceOffsets() {
        const margin = 12;
        const vw = window.innerWidth / 100;
        const vh = window.innerHeight / 100;
        entries.forEach((entry) => {
            entry.pieces.forEach((piece) => {
                delete piece.dataset.join;
                piece.style.setProperty("--join", "1");
            });
        });
        const writes = [];
        entries.forEach((entry) => {
            if (!entry.sticky) {
                return;
            }
            const sticky = entry.sticky.getBoundingClientRect();
            entry.pieces.forEach((piece) => {
                const layout = piece.getBoundingClientRect();
                const minX = sticky.left + margin - layout.left;
                const maxX = sticky.right - margin - layout.right;
                const minY = sticky.top + margin - layout.top;
                const maxY = sticky.bottom - margin - layout.bottom;
                const wantX = piece._x * vw;
                const wantY = piece._y * vh;
                const x = minX > maxX ? 0 : Math.min(maxX, Math.max(minX, wantX));
                const y = minY > maxY ? 0 : Math.min(maxY, Math.max(minY, wantY));
                writes.push([piece, (x / vw).toFixed(3), (y / vh).toFixed(3)]);
            });
        });
        writes.forEach(([piece, x, y]) => {
            piece.style.setProperty("--x", x);
            piece.style.setProperty("--y", y);
        });
    }

    function pin() {
        entries.forEach((entry) => {
            entry.scrub.classList.add("is-pinned");
        });
    }

    function unpin() {
        entries.forEach((entry) => {
            entry.scrub.classList.remove("is-pinned", "is-forced");
            entry.forced = false;
            entry.pieces.forEach(clearPiece);
        });
    }

    function watchChapters() {
        if (chapterObserver) {
            chapterObserver.disconnect();
        }
        const seen = new Map();
        chapterObserver = new IntersectionObserver((records) => {
            records.forEach((record) => {
                if (record.isIntersecting) {
                    seen.set(record.target, record.intersectionRatio);
                } else {
                    seen.delete(record.target);
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
            setWarmth(CHAPTER_WARMTH[Number(active.dataset.chapter)] || 0);
        }, { threshold: [0.12, 0.25, 0.4] });
        chapters.forEach((chapter) => chapterObserver.observe(chapter));
    }

    function enable() {
        if (enabled) {
            return;
        }
        enabled = true;
        document.documentElement.classList.add("motion");
        pin();
        clampPieceOffsets();
        watchChapters();
        paint();
    }

    function disable() {
        enabled = false;
        document.documentElement.classList.remove("motion");
        if (chapterObserver) {
            chapterObserver.disconnect();
            chapterObserver = null;
        }
        unpin();
        setWarmth(0);
    }

    function sync() {
        if (REDUCED.matches) {
            disable();
            return;
        }
        enable();
    }

    document.addEventListener("focusin", () => {
        if (!enabled) {
            return;
        }
        const active = document.activeElement;
        const scrub = active && active.closest ? active.closest(".scrub") : null;
        entries.forEach((entry) => {
            entry.forced = entry.scrub === scrub;
            entry.scrub.classList.toggle("is-forced", entry.forced);
        });
        paint();
    });

    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", () => {
        if (!enabled) {
            return;
        }
        clampPieceOffsets();
        requestPaint();
    }, { passive: true });
    if (document.fonts) {
        document.fonts.ready.then(() => {
            if (!enabled) {
                return;
            }
            clampPieceOffsets();
            paint();
        });
    }
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            requestPaint();
        }
    });
    REDUCED.addEventListener("change", sync);
    sync();
}

if (document.querySelector(".scrub")) {
    boot();
} else {
    document.addEventListener("DOMContentLoaded", boot);
}
