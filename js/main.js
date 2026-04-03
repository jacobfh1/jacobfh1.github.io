/* ===== DNA Double Helix Background ===== */
(function () {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
    let mouse = { x: null, y: null };
    let time = 0;
    let scrollOffset = 0;
    let floatingParticles = [];

    // Helix parameters
    const HELIX = {
        amplitude: 80,
        verticalStep: 18,
        rotationSpeed: 0.008,
        basePairSpacing: 3,
        nucleotideSize: 2.5,
        strandOpacity: 0.6,
        rungOpacity: 0.15,
        depthScale: 0.4,
        // Breathing: amplitude oscillates gently
        breathSpeed: 0.003,
        breathAmount: 8,        // +/- pixels on amplitude
        // Traveling pulse: a bright wave that moves along the helix
        pulseSpeed: 0.025,      // how fast the pulse travels (radians/frame in i-space)
        pulseWidth: 8,          // how many nucleotides wide the pulse is
        pulseIntensity: 0.5,    // extra brightness at pulse center
        // Mouse proximity glow
        mouseGlowRadius: 180,   // pixels — how close the cursor needs to be
        mouseGlowBoost: 0.6,    // extra opacity multiplier at center
    };

    const BASE_COLORS = {
        cyan: { r: 6, g: 182, b: 212 },
        purple: { r: 139, g: 92, b: 246 },
    };

    // Track scroll for helix phase shift
    window.addEventListener('scroll', () => {
        scrollOffset = window.pageYOffset * 0.002;
    });

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initFloatingParticles();
    }

    class FloatingParticle {
        constructor() { this.reset(); }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.3;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = (Math.random() - 0.5) * 0.2;
            this.opacity = Math.random() * 0.25 + 0.05;
            this.hue = Math.random() > 0.5 ? 187 : 263;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initFloatingParticles() {
        floatingParticles = [];
        const count = Math.min(Math.floor((canvas.width * canvas.height) / 30000), 40);
        for (let i = 0; i < count; i++) {
            floatingParticles.push(new FloatingParticle());
        }
    }

    // Breathing amplitude
    function currentAmplitude() {
        return HELIX.amplitude + Math.sin(time * (HELIX.breathSpeed / HELIX.rotationSpeed)) * HELIX.breathAmount;
    }

    function getHelixPoint(i, offset, t, amp) {
        const angle = (i * 0.12) + t + offset;
        const depth = Math.cos(angle);
        const x = Math.sin(angle) * amp;
        const scale = 1 + depth * HELIX.depthScale;
        return { x, depth, scale, angle };
    }

    // Pulse position (which nucleotide index the pulse is centered on)
    let pulsePos1 = 0;
    let pulsePos2 = 0;

    // Calculate pulse brightness for a given nucleotide index
    function pulseGlow(i, pulseCenter) {
        const dist = Math.abs(i - pulseCenter);
        if (dist > HELIX.pulseWidth) return 0;
        // Smooth bell curve
        const t = dist / HELIX.pulseWidth;
        return HELIX.pulseIntensity * (1 - t * t);
    }

    // Mouse proximity brightness boost for a screen-space point
    function mouseGlow(screenX, screenY) {
        if (mouse.x === null) return 0;
        const dx = screenX - mouse.x;
        const dy = screenY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > HELIX.mouseGlowRadius) return 0;
        const t = dist / HELIX.mouseGlowRadius;
        return HELIX.mouseGlowBoost * (1 - t * t);
    }

    function drawHelix(centerX, startY, count, helixId) {
        const nucleotides1 = [];
        const nucleotides2 = [];
        const rungs = [];
        const amp = currentAmplitude();
        // Each helix gets its own scroll phase offset for variety
        const phaseShift = scrollOffset + (helixId * 0.5);
        const t = time + phaseShift;
        const pulse = helixId === 0 ? pulsePos1 : pulsePos2;

        for (let i = 0; i < count; i++) {
            const y = startY + i * HELIX.verticalStep;
            const p1 = getHelixPoint(i, 0, t, amp);
            const p2 = getHelixPoint(i, Math.PI, t, amp);

            // Mouse parallax
            let mx = 0, my = 0;
            if (mouse.x !== null) {
                const dx = (mouse.x - centerX) / canvas.width;
                const dy = (mouse.y - canvas.height / 2) / canvas.height;
                mx = dx * 20 * p1.depth;
                my = dy * 10;
            }

            // Pulse + mouse glow boost per nucleotide
            const screenX1 = centerX + p1.x + mx;
            const screenX2 = centerX + p2.x + mx;
            const screenY = y + my;
            const boost1 = pulseGlow(i, pulse) + mouseGlow(screenX1, screenY);
            const boost2 = pulseGlow(i, pulse) + mouseGlow(screenX2, screenY);

            const n1 = { x: screenX1, y: screenY, depth: p1.depth, scale: p1.scale, boost: boost1, index: i };
            const n2 = { x: screenX2, y: screenY, depth: p2.depth, scale: p2.scale, boost: boost2, index: i };

            nucleotides1.push(n1);
            nucleotides2.push(n2);

            if (i % HELIX.basePairSpacing === 0) {
                rungs.push({ n1, n2, index: i });
            }
        }

        // 1. Draw rungs (base pairs)
        rungs.forEach(rung => {
            const avgDepth = (rung.n1.depth + rung.n2.depth) / 2;
            const avgBoost = (rung.n1.boost + rung.n2.boost) / 2;
            const opacity = Math.min(1, HELIX.rungOpacity * (0.5 + avgDepth * 0.5) + avgBoost * 0.1);
            if (opacity <= 0) return;

            const color = rung.index % 6 < 3 ? BASE_COLORS.cyan : BASE_COLORS.purple;
            ctx.beginPath();
            ctx.moveTo(rung.n1.x, rung.n1.y);
            ctx.lineTo(rung.n2.x, rung.n2.y);
            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
            ctx.lineWidth = 1.5 * (0.5 + avgDepth * 0.3);
            ctx.stroke();

            [rung.n1, rung.n2].forEach(n => {
                const dotOpacity = Math.min(1, opacity * 1.5 + n.boost * 0.3);
                ctx.beginPath();
                ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${dotOpacity})`;
                ctx.fill();
            });
        });

        // 2. Draw strand backbones
        function drawStrand(nucleotides, color) {
            const segments = [];
            for (let i = 0; i < nucleotides.length - 1; i++) {
                const avg = (nucleotides[i].depth + nucleotides[i + 1].depth) / 2;
                segments.push({ i, depth: avg });
            }
            segments.sort((a, b) => a.depth - b.depth);

            segments.forEach(seg => {
                const n = nucleotides[seg.i];
                const next = nucleotides[seg.i + 1];
                const avgBoost = (n.boost + next.boost) / 2;
                const opacity = Math.min(1, HELIX.strandOpacity * (0.3 + (seg.depth + 1) * 0.35) + avgBoost * 0.25);
                if (opacity <= 0.02) return;

                ctx.beginPath();
                ctx.moveTo(n.x, n.y);
                ctx.lineTo(next.x, next.y);
                ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
                ctx.lineWidth = 1.8 * (0.5 + (seg.depth + 1) * 0.3);
                ctx.stroke();
            });

            // Draw nucleotide dots
            nucleotides.forEach(n => {
                const baseOpacity = HELIX.strandOpacity * (0.4 + (n.depth + 1) * 0.3);
                const opacity = Math.min(1, baseOpacity + n.boost * 0.35);
                if (opacity <= 0.02) return;
                const size = HELIX.nucleotideSize * n.scale * (1 + n.boost * 0.3);

                ctx.beginPath();
                ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
                ctx.fill();

                // Glow on front-facing nucleotides or boosted ones
                if (n.depth > 0.6 || n.boost > 0.15) {
                    const glowSize = size * (2.5 + n.boost * 2);
                    const glowOpacity = Math.min(0.25, opacity * 0.15 + n.boost * 0.12);
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, glowSize, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${glowOpacity})`;
                    ctx.fill();
                }
            });
        }

        drawStrand(nucleotides1, BASE_COLORS.cyan);
        drawStrand(nucleotides2, BASE_COLORS.purple);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw floating particles
        floatingParticles.forEach(p => {
            p.update();
            p.draw();
        });

        // Advance pulse positions (they travel down the helix, then loop)
        const nucleotideCount = Math.ceil(canvas.height / HELIX.verticalStep) + 10;
        pulsePos1 += 0.075;   // ~4.5 nucleotides/sec at 60fps — subtle
        pulsePos2 += 0.058;   // slightly slower for the second helix
        if (pulsePos1 > nucleotideCount + HELIX.pulseWidth) pulsePos1 = -HELIX.pulseWidth;
        if (pulsePos2 > nucleotideCount + HELIX.pulseWidth) pulsePos2 = -HELIX.pulseWidth;

        // Draw helix(es)
        const helixCount = canvas.width > 1200 ? 2 : 1;

        if (helixCount === 1) {
            drawHelix(canvas.width * 0.85, -HELIX.verticalStep * 5, nucleotideCount, 0);
        } else {
            drawHelix(canvas.width * 0.12, -HELIX.verticalStep * 5, nucleotideCount, 0);
            drawHelix(canvas.width * 0.88, -HELIX.verticalStep * 8, nucleotideCount, 1);
        }

        time += HELIX.rotationSpeed;
        requestAnimationFrame(animate);
    }

    // Mouse tracking
    let mouseTimeout;
    window.addEventListener('mousemove', (e) => {
        if (!mouseTimeout) {
            mouseTimeout = setTimeout(() => {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
                mouseTimeout = null;
            }, 16);
        }
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('resize', () => {
        resize();
    });

    resize();
    animate();
})();

/* ===== Typing Effect ===== */
(function () {
    const phrases = [
        'turn biological data into discoveries.',
        'help people see what their data is telling them.',
        'bridge biology and computer science.',
        'believe small steps lead to big breakthroughs.',
        'mentor the next generation of scientists.',
        'explore, build, and teach.'
    ];

    const el = document.getElementById('typed-text');
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 50;

    function type() {
        const currentPhrase = phrases[phraseIndex];

        if (isDeleting) {
            el.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
            typeSpeed = 30;
        } else {
            el.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
            typeSpeed = 55;
        }

        if (!isDeleting && charIndex === currentPhrase.length) {
            isDeleting = true;
            typeSpeed = 2000;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            typeSpeed = 400;
        }

        setTimeout(type, typeSpeed);
    }

    setTimeout(type, 1200);
})();

/* ===== Scroll Reveal ===== */
(function () {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        }
    );

    document.querySelectorAll('.reveal').forEach((el) => {
        observer.observe(el);
    });
})();

/* ===== Navbar ===== */
(function () {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Active link highlight on scroll
    const sections = document.querySelectorAll('.section, .hero');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach((section) => {
            const top = section.offsetTop - 100;
            if (window.pageYOffset >= top) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach((link) => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
})();

/* ===== Theme Toggle ===== */
(function () {
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    // Check saved preference or system preference
    const saved = localStorage.getItem('theme');
    if (saved) {
        html.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        html.setAttribute('data-theme', 'light');
    }

    toggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
})();

/* ===== Smooth Scroll for anchor links ===== */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

/* ===== Back to Top Button ===== */
(function () {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 600) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

/* ===== Contact Form ===== */
(function () {
    const form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            if (form.action.includes('your-form-id')) {
                e.preventDefault();
                const btn = form.querySelector('.btn-submit span');
                btn.textContent = 'Thanks! Message received.';
                setTimeout(() => {
                    btn.textContent = 'Send Message';
                    form.reset();
                }, 3000);
            }
        });
    }
})();

/* ===== Scroll Progress Bar ===== */
(function () {
    const progressBar = document.getElementById('scroll-progress');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        progressBar.style.width = progress + '%';
    });
})();

/* ===== Cursor Glow ===== */
(function () {
    const glow = document.getElementById('cursor-glow');
    if (!glow || window.innerWidth < 768) return;

    let glowX = 0, glowY = 0;
    let currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
        glowX = e.clientX;
        glowY = e.clientY;
        glow.style.opacity = '1';
    });

    document.addEventListener('mouseleave', () => {
        glow.style.opacity = '0';
    });

    function animateGlow() {
        currentX += (glowX - currentX) * 0.08;
        currentY += (glowY - currentY) * 0.08;
        glow.style.left = currentX + 'px';
        glow.style.top = currentY + 'px';
        requestAnimationFrame(animateGlow);
    }

    animateGlow();
})();

/* ===== 3D Tilt Effect on Cards ===== */
(function () {
    if (window.innerWidth < 768) return;

    const cards = document.querySelectorAll('.project-card, .beyond-card, .skill-category, .teaching-card, .education-card, .detail-card');

    cards.forEach(card => {
        card.classList.add('tilt-card');

        // Add shine overlay
        const shine = document.createElement('div');
        shine.classList.add('tilt-shine');
        card.appendChild(shine);

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -4;
            const rotateY = ((x - centerX) / centerX) * 4;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

            // Position shine
            const gradX = (x / rect.width) * 100;
            const gradY = (y / rect.height) * 100;
            shine.style.background = `radial-gradient(circle at ${gradX}% ${gradY}%, rgba(6, 182, 212, 0.12) 0%, transparent 60%)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
            card.style.transition = 'transform 0.5s ease';
            setTimeout(() => {
                card.style.transition = '';
            }, 500);
        });

        card.addEventListener('mouseenter', () => {
            card.style.transition = 'none';
        });
    });
})();

/* ===== Magnetic Button Effect ===== */
(function () {
    if (window.innerWidth < 768) return;

    const buttons = document.querySelectorAll('.btn-primary, .btn-outline');

    buttons.forEach(btn => {
        btn.classList.add('btn-magnetic');

        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });
})();

/* ===== Animated Timeline ===== */
(function () {
    const timeline = document.querySelector('.timeline');
    if (!timeline) return;

    const markers = timeline.querySelectorAll('.timeline-marker');

    function updateTimeline() {
        const rect = timeline.getBoundingClientRect();
        const timelineTop = rect.top;
        const timelineHeight = rect.height;
        const viewportCenter = window.innerHeight * 0.6;

        // Calculate progress
        const progress = Math.max(0, Math.min(1, (viewportCenter - timelineTop) / timelineHeight));
        timeline.style.setProperty('--timeline-progress', (progress * 100) + '%');

        // Activate markers
        markers.forEach(marker => {
            const markerRect = marker.getBoundingClientRect();
            if (markerRect.top < viewportCenter) {
                marker.classList.add('active');
            } else {
                marker.classList.remove('active');
            }
        });
    }

    window.addEventListener('scroll', updateTimeline);
    updateTimeline();
})();

/* ===== Text Scramble on Hero Name Hover ===== */
(function () {
    const heroName = document.querySelector('.hero-name');
    if (!heroName) return;

    const originalText = heroName.textContent;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';
    let isAnimating = false;

    heroName.addEventListener('mouseenter', () => {
        if (isAnimating) return;
        isAnimating = true;

        let iteration = 0;
        const maxIterations = originalText.length;

        const interval = setInterval(() => {
            heroName.textContent = originalText
                .split('')
                .map((char, index) => {
                    if (char === ' ') return ' ';
                    if (index < iteration) return originalText[index];
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join('');

            iteration += 1 / 2;

            if (iteration >= maxIterations) {
                heroName.textContent = originalText;
                clearInterval(interval);
                isAnimating = false;
            }
        }, 30);
    });
})();

/* ===== Section Title Parallax ===== */
(function () {
    if (window.innerWidth < 768) return;

    const titles = document.querySelectorAll('.section-title');

    window.addEventListener('scroll', () => {
        titles.forEach(title => {
            const rect = title.getBoundingClientRect();
            const viewportCenter = window.innerHeight / 2;
            const offset = (rect.top - viewportCenter) * 0.04;
            title.style.transform = `translateY(${offset}px)`;
        });
    });
})();

/* ===== Skill Tags Ripple on Click ===== */
(function () {
    document.querySelectorAll('.skill-tag').forEach(tag => {
        tag.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(6, 182, 212, 0.3);
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
                width: 50px;
                height: 50px;
                left: ${e.offsetX - 25}px;
                top: ${e.offsetY - 25}px;
            `;
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple keyframes
    const style = document.createElement('style');
    style.textContent = `@keyframes ripple { to { transform: scale(4); opacity: 0; } }`;
    document.head.appendChild(style);
})();

/* ===== Smooth Reveal for Contact Items ===== */
(function () {
    const contactItems = document.querySelectorAll('.contact-item');
    contactItems.forEach((item, i) => {
        item.style.transitionDelay = (i * 0.1) + 's';
    });
})();

/* ===== 3D Protein Viewer (3Dmol.js) ===== */
(function () {
    const viewerEl = document.getElementById('mol-viewer');
    if (!viewerEl) return;

    // Protein database — structures relevant to my research
    const proteins = {
        '1PRG': {
            title: 'PPAR\u03B3 (Human)',
            description: 'Peroxisome proliferator-activated receptor gamma — a nuclear receptor and master regulator of adipogenesis and glucose metabolism. This structure shows the ligand-binding domain bound to rosiglitazone, a thiazolidinedione antidiabetic drug. Central to my BSc thesis on genome-wide PPAR\u03B3 analysis.',
            residues: '272',
            method: 'X-ray',
            resolution: '2.3 \u00C5'
        },
        '2RH1': {
            title: '\u03B22-Adrenergic Receptor',
            description: 'The first human GPCR crystallised at high resolution — a breakthrough that earned the 2012 Nobel Prize in Chemistry. This seven-transmembrane receptor is a primary drug target for asthma and COPD, and a cornerstone of modern pharmacology and drug design.',
            residues: '442',
            method: 'X-ray',
            resolution: '2.4 \u00C5'
        },
        '6CMO': {
            title: 'GLP-1 Receptor (GPCR)',
            description: 'Glucagon-like peptide-1 receptor — a class B GPCR and the target of blockbuster drugs like semaglutide (Ozempic/Wegovy). This structure reveals how peptide hormones activate GPCRs, directly informing pharmaceutical design for diabetes and obesity.',
            residues: '462',
            method: 'Cryo-EM',
            resolution: '3.3 \u00C5'
        },
        '1TSR': {
            title: 'p53 Bound to DNA',
            description: 'Tumour suppressor p53 — the "guardian of the genome" — bound to its consensus DNA sequence. This transcription factor is mutated in over half of all cancers. The structure shows how zinc-coordinated loops make sequence-specific contacts with the major groove.',
            residues: '195 + DNA',
            method: 'X-ray',
            resolution: '2.2 \u00C5'
        },
        '1AAY': {
            title: 'Zif268 Zinc Finger \u00D7 DNA',
            description: 'A classic Cys2-His2 zinc finger transcription factor bound to its DNA target. Each zinc finger recognises three base pairs in the major groove. This modular architecture inspired engineered zinc finger nucleases — a precursor to modern gene editing.',
            residues: '90 + DNA',
            method: 'X-ray',
            resolution: '1.6 \u00C5'
        }
    };

    let viewer = null;
    let currentStyle = 'cartoon';
    let isSpinning = true;
    let currentPDB = '1PRG';
    let viewerInitialized = false;

    function getBackgroundColor() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'light' ? 0xf0f3f6 : 0x0d1117;
    }

    function getColorScheme() {
        return { colorscheme: 'spectral' };
    }

    function applyStyle(style) {
        if (!viewer) return;
        viewer.setStyle({}, {});

        switch (style) {
            case 'cartoon':
                viewer.setStyle({}, { cartoon: { ...getColorScheme(), opacity: 0.95 } });
                break;
            case 'stick':
                viewer.setStyle({}, { stick: { ...getColorScheme(), radius: 0.15 } });
                break;
            case 'sphere':
                viewer.setStyle({}, { sphere: { ...getColorScheme(), scale: 0.3 } });
                break;
            case 'surface':
                viewer.setStyle({}, { cartoon: { ...getColorScheme(), opacity: 0.5 } });
                viewer.addSurface($3Dmol.SurfaceType.VDW, {
                    opacity: 0.7,
                    colorscheme: 'spectral'
                });
                break;
        }

        viewer.render();
    }

    function updateInfo(pdbId) {
        const info = proteins[pdbId];
        if (!info) return;

        document.getElementById('mol-title').textContent = info.title;
        document.getElementById('mol-pdb-code').textContent = pdbId;
        document.getElementById('mol-description').textContent = info.description;
        document.getElementById('mol-residues').textContent = info.residues;
        document.getElementById('mol-method').textContent = info.method;
        document.getElementById('mol-resolution').textContent = info.resolution;
    }

    function loadProtein(pdbId) {
        if (!viewer) return;

        viewerEl.classList.add('loading');
        currentPDB = pdbId;
        updateInfo(pdbId);

        const url = 'https://files.rcsb.org/download/' + pdbId + '.pdb';

        fetch(url)
            .then(function (res) { return res.text(); })
            .then(function (data) {
                viewer.removeAllModels();
                viewer.removeAllSurfaces();
                viewer.addModel(data, 'pdb');
                applyStyle(currentStyle);
                viewer.zoomTo();
                viewer.render();
                if (isSpinning) viewer.spin(true);
                viewerEl.classList.remove('loading');
            })
            .catch(function () {
                viewerEl.classList.remove('loading');
            });
    }

    function initViewer() {
        if (viewerInitialized || typeof $3Dmol === 'undefined') return;
        viewerInitialized = true;

        viewer = $3Dmol.createViewer(viewerEl, {
            backgroundColor: getBackgroundColor(),
            antialias: true,
            cartoonQuality: 8
        });

        loadProtein(currentPDB);

        // Style buttons
        document.querySelectorAll('.mol-btn[data-style]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.mol-btn[data-style]').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentStyle = btn.dataset.style;
                viewer.removeAllSurfaces();
                applyStyle(currentStyle);
            });
        });

        // Spin toggle
        var spinBtn = document.querySelector('.mol-btn-spin');
        if (spinBtn) {
            spinBtn.addEventListener('click', function () {
                isSpinning = !isSpinning;
                spinBtn.classList.toggle('active', isSpinning);
                viewer.spin(isSpinning);
            });
        }

        // Protein selector
        var selector = document.getElementById('mol-protein-select');
        if (selector) {
            selector.addEventListener('change', function () {
                loadProtein(selector.value);
            });
        }

        // Theme change observer
        var themeObserver = new MutationObserver(function () {
            if (viewer) {
                viewer.setBackgroundColor(getBackgroundColor());
                viewer.render();
            }
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    // Lazy-init when section scrolls into view
    var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                // Wait for 3Dmol to load if needed
                if (typeof $3Dmol !== 'undefined') {
                    initViewer();
                } else {
                    var check = setInterval(function () {
                        if (typeof $3Dmol !== 'undefined') {
                            clearInterval(check);
                            initViewer();
                        }
                    }, 200);
                }
                sectionObserver.disconnect();
            }
        });
    }, { rootMargin: '200px' });

    var section = document.querySelector('.molecule-section');
    if (section) sectionObserver.observe(section);
})();
