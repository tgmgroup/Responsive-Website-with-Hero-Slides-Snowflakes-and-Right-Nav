// script.js
// Combined script for theme, targeted slider, snowflakes (with mouse tracking + toggle), and toggles

// --- Theme Toggle Logic ---
const themeToggleButton = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;
const sunIcon = '&#x2600;'; // ☀️ Sun icon
const moonIcon = '&#x1F319;'; // 🌙 Moon icon

function applyTheme(theme) {
    const isDark = theme === 'dark';
    htmlElement.classList.toggle('dark', isDark);
    if (themeToggleButton) {
        themeToggleButton.innerHTML = isDark ? sunIcon : moonIcon;
    }
    try {
        localStorage.setItem('theme', theme);
    } catch (e) {
        console.warn("Could not save theme preference to localStorage.", e);
    }
}

function initializeTheme() {
    let currentTheme = 'dark'; // Default to dark
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
            currentTheme = savedTheme;
        } else {
            // No saved theme, check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                currentTheme = 'light'; // Only switch default if system prefers light
            }
        }
    } catch (e) {
        console.warn("Could not read theme preference from localStorage.", e);
    }
    applyTheme(currentTheme);
}

if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
        const isDark = htmlElement.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
    });
} else { console.warn("Theme toggle button ('#theme-toggle') not found."); }

try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        // Only react if no theme manually set via localStorage
        try {
            if (!localStorage.getItem('theme')) {
                applyTheme(event.matches ? 'dark' : 'light');
            }
        } catch (e) { console.warn("Could not access localStorage in system theme listener.", e); }
    });
} catch (e) { console.warn("System theme change listener not supported or failed to attach.", e); }
// --- End Theme Toggle Logic ---


// --- Slideshow Logic (with Auto-Advance and ID Targeting) ---
// [NO CHANGES HERE - Keep the original slideshow logic]
const slides = document.querySelectorAll('.slide');
const slidesContainer = document.querySelector('.slides-container');
const prevButton = document.getElementById('prev-slide');
const nextButton = document.getElementById('next-slide');
const slideTriggers = document.querySelectorAll('.slide-nav-trigger');
let currentSlideIndex = 0;
let slideIntervalId = null;
const SLIDE_INTERVAL_DELAY = 5000; // 5 seconds

function findSlideIndexById(targetId) {
    let foundIndex = -1;
    slides.forEach((slide, index) => {
        if (slide.id === targetId) { foundIndex = index; }
    });
    return foundIndex;
}

function showSlide(index) {
    if (slides.length === 0) return;
    const validIndex = (index % slides.length + slides.length) % slides.length;
    currentSlideIndex = validIndex;
    slides.forEach(slide => { slide.classList.remove('active'); });
    if (slides[validIndex]) {
        slides[validIndex].classList.add('active');
    } else { console.error(`Slide at index ${validIndex} not found.`); }
}

function showSlideById(targetId) {
    const indexToShow = findSlideIndexById(targetId);
    if (indexToShow !== -1) { showSlide(indexToShow); }
    else { console.warn(`Slide with ID '${targetId}' not found.`); }
}

function nextSlide() { showSlide(currentSlideIndex + 1); }
function previousSlide() { showSlide(currentSlideIndex - 1); }
function stopSlideShow() { if (slideIntervalId) { clearInterval(slideIntervalId); slideIntervalId = null; } }
function startSlideShow() {
    stopSlideShow();
    if (slides.length > 1) { slideIntervalId = setInterval(nextSlide, SLIDE_INTERVAL_DELAY); }
}

// Event Listeners for Slider
if (nextButton) { nextButton.addEventListener('click', () => { stopSlideShow(); nextSlide(); startSlideShow(); }); }
else { console.warn("Next slide button ('#next-slide') not found."); }
if (prevButton) { prevButton.addEventListener('click', () => { stopSlideShow(); previousSlide(); startSlideShow(); }); }
else { console.warn("Previous slide button ('#prev-slide') not found."); }
if (slideTriggers.length > 0) {
    slideTriggers.forEach(trigger => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = trigger.getAttribute('data-target-slide');
            if (targetId) { stopSlideShow(); showSlideById(targetId); startSlideShow(); }
            else { console.warn("Slide trigger missing 'data-target-slide'.", trigger); }
        });
    });
} else { console.warn("No slide trigger elements found with class '.slide-nav-trigger'."); }
if (slidesContainer) {
    slidesContainer.addEventListener('mouseenter', () => { if (slideIntervalId) stopSlideShow(); });
    slidesContainer.addEventListener('mouseleave', startSlideShow);
} else { console.warn("Slides container ('.slides-container') not found for hover effect."); }
// --- End Slideshow Logic ---


// --- Snowflake Effect Logic (Reintroducing Mouse Tracking, Keeping Toggle) ---

const snowFall = (() => {
    //----------------------------------
    // Internal State
    //----------------------------------
    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let flakes = []; // Array to hold Flake objects
    let flakeRequestPerFrame = 0; // How many flakes to create per frame
    let castRadius = 0; // Mouse influence radius (calculated in resize)
    let castField = null; // The ForceField for mouse interaction
    let mouse = null; // Tracks mouse position and speed
    let throttledCastFlakes = null; // Throttled function for mouse events
    let isRunning = false; // Flag to control the animation loop
    let animationFrameId = null; // Store the requestAnimationFrame ID

    //----------------------------------
    // Constants
    //----------------------------------
    const FLAKE_FREQUENCY = 7;
    const FLAKE_MIN_SPEED = 30;
    const FLAKE_MAX_SPEED = 180;
    const FLAKE_SIZE_NOISE = 0.5;
    const FLAKE_MIN_SIZE = 0.4;
    const FLAKE_MAX_SIZE = 1.6;
    const FLAKE_FRICTION = 0.035;
    const FLAKE_NOISE_X = 0.07;
    const FLAKE_NOISE_Y = 0.02;
    // Constants for Mouse Interaction (Reintroduced)
    const FLAKE_CAST_RADIUS_RATIO = 0.4;
    const FLAKE_CAST_FORCE = 0.05;
    const FLAKE_CAST_DEPTH_TRIGGER = 0.4; // (Note: this wasn't used in original Flake.evolve, but keep constant)
    const FLAKE_CAST_THROTTLE = 50; // Throttle delay in ms
    const PI = Math.PI;
    const FPS = 60;

    //----------------------------------
    // Objects (Point, Vector, Particle, Flake, ForceField, FlakeCaster - Reintroduced)
    //----------------------------------

    class Point {
        static distance(a, b) {
            return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
        }
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        translate(translateVect) {
            this.x += translateVect.x;
            this.y += translateVect.y;
        }
    }

    class Vector {
        static add(vectors) {
            let result = new Vector(0, 0);
            vectors.forEach((vector) => {
                result.x += vector.x;
                result.y += vector.y;
            });
            return result;
        }
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        get length() {
            return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
        }
    }

    class Particle {
        static deduceMass(targetSpeed, friction) {
            return targetSpeed.y * friction;
        }
        constructor(
            position = { x: 0, y: 0 },
            { mass = 0, friction = 0, initialSpeed = { x: 0, y: 0 } }
        ) {
            this.position = new Point(position.x, position.y);
            this.mass = mass;
            this.friction = friction;
            this.speed = new Vector(initialSpeed.x, initialSpeed.y);
            this.forces = new Map(); // Map to store various forces (weight, friction, cast)
        }

        setForce(forceName, forceValue = { x: 0, y: 0 }) {
            this.forces.set(forceName, new Vector(forceValue.x, forceValue.y));
        }
        // Method to remove a force, useful if a force source stops (like mouse)
        removeForce(forceName) {
             this.forces.delete(forceName);
        }

        applyGravity() {
            this.setForce("weight", { x: 0, y: this.mass });
        }

        applyFriction() {
            this.setForce("friction", {
                x: -this.speed.x * this.friction,
                y: -this.speed.y * this.friction
            });
        }

        updateSpeedAndPosition() {
            if (this.mass) this.applyGravity();
            if (this.friction) this.applyFriction();
            // Sum ALL forces currently in the map (weight, friction, AND cast if present)
            const acceleration = Vector.add(Array.from(this.forces.values()));
            // Clear forces that are recalculated each frame (gravity, friction)
            // External forces like 'cast' are added/removed by the ForceField
            this.forces.delete("weight");
            this.forces.delete("friction");

            this.speed = Vector.add([this.speed, acceleration]);
            this.position.translate(this.speed);
        }
    }

     class Flake extends Particle {
        constructor(position = { x: 0, y: 0 }) {
            const depth = random(0, 100) / 100;
            const initialSpeed = {
                x: 0,
                y: (FLAKE_MIN_SPEED + depth * (FLAKE_MAX_SPEED - FLAKE_MIN_SPEED)) / FPS
            };
            const mass = Particle.deduceMass(initialSpeed, FLAKE_FRICTION);

            super(position, {
                mass: mass,
                friction: FLAKE_FRICTION,
                initialSpeed: { x: initialSpeed.x, y: initialSpeed.y }
            });

            this.depth = depth;
            this.size = FLAKE_MIN_SIZE + depth * (FLAKE_MAX_SIZE - FLAKE_MIN_SIZE);
            this.size = this.size * (1 + FLAKE_SIZE_NOISE * (random(-100, 100) / 100));
        }

        evolve() {
            // External forces (like 'cast') are applied by ForceField *before* this
            // Calculate new speed and position based on ALL current forces
            this.updateSpeedAndPosition();
            // Apply positional noise *after* main physics calculation
            this.applyNoise();
        }

        applyNoise() {
            const noiseForce = new Vector(
                (random(-100, 100) / 100) * FLAKE_NOISE_X * this.depth,
                (random(-100, 100) / 100) * FLAKE_NOISE_Y * this.depth
            );
            this.position.translate(noiseForce);
        }

        draw(ctx) {
            if (!ctx) return;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.size, 0, 2 * PI);
            ctx.fillStyle = "white";
            ctx.fill();
        }
    }

    // ForceField and FlakeCaster (Reintroduced from original script)
    class ForceField {
         constructor(forceName, initialWidth, initialHeight) {
             this.forceName = forceName;
             this.width = initialWidth || 0;
             this.height = initialHeight || 0;
             this.reset(initialWidth, initialHeight);
         }

         reset(l, h) {
             const targetWidth = Math.max(0, l !== undefined ? l : this.width);
             const targetHeight = Math.max(0, h !== undefined ? h : this.height);

             if (targetWidth > 30000 || targetHeight > 30000) {
                 console.warn("ForceField reset called with potentially excessive dimensions:", targetWidth, targetHeight);
                 return;
             }

             this.forces = Array(targetWidth)
                 .fill(null)
                 .map(() => Array(targetHeight).fill(null));
             this.isEmpty = true;
             this.width = targetWidth;
             this.height = targetHeight;
         }

         getForceAt(n, m) {
             if (this.isEmpty || n < 0 || n >= this.width || m < 0 || m >= this.height) {
                 return undefined;
             }
             let force = this.forces[n]?.[m]; // Optional chaining for safety
             if (!force) return undefined;
             if (typeof force.x === 'number' && typeof force.y === 'number') {
                 return { x: force.x, y: force.y };
             }
             return undefined;
         }

         setForceAt(n, m, value) {
             if (n < 0 || n >= this.width || m < 0 || m >= this.height) {
                 return;
             }
             if (typeof value?.x !== 'number' || typeof value?.y !== 'number') {
                  console.warn(`${this.forceName}: Invalid force value provided for ${n}, ${m}`);
                 return;
             }
             try {
                 this.forces[n][m] = { x: value.x, y: value.y };
                 this.isEmpty = false;
             } catch (e) {
                 console.error(`${this.forceName}: Failed to set force at ${n}, ${m}`, e);
             }
         }

         applyField(particles) {
             if (this.isEmpty) {
                  // If field is empty, ensure no lingering force from previous frame
                  particles.forEach(particle => {
                      if (particle instanceof Particle) {
                           particle.removeForce(this.forceName);
                      }
                  });
                 return;
             }

             particles.forEach((particle) => {
                 if (!(particle instanceof Particle)) {
                     return;
                 }
                 const x = Math.round(particle.position.x);
                 const y = Math.round(particle.position.y);
                 const force = this.getForceAt(x, y);

                 if (force) {
                     // Apply the force from this field to the particle for this frame
                     particle.setForce(this.forceName, force);
                 } else {
                      // If no force at this particle's location, remove any lingering force
                      particle.removeForce(this.forceName);
                 }
             });
             // Reset the field AFTER applying it, ready for next frame's calculation
             this.reset();
         }
     }

     class FlakeCaster extends ForceField {
         calculateField(x, y, force, castRadius) {
             if (castRadius <= 0) return;

             const boundary = Math.ceil(castRadius);
             const iMin = Math.max(0, Math.floor(x - boundary));
             const iMax = Math.min(this.width, Math.ceil(x + boundary));
             const jMin = Math.max(0, Math.floor(y - boundary));
             const jMax = Math.min(this.height, Math.ceil(y + boundary));

             for (let i = iMin; i < iMax; i++) {
                 for (let j = jMin; j < jMax; j++) {
                     const distanceToEpicenter = Point.distance({ x: x, y: y }, { x: i, y: j });

                     if (distanceToEpicenter < castRadius) {
                         let intensity = FLAKE_CAST_FORCE * (1 - distanceToEpicenter / castRadius);
                         intensity = Math.max(0, intensity);

                         const existingForce = this.getForceAt(i,j) || {x:0, y:0};
                         this.setForceAt(i, j, {
                             x: existingForce.x + force.x * intensity,
                             y: existingForce.y + force.y * intensity
                         });
                     }
                 }
             }
         }
     }

    //----------------------------------
    // Utils
    //----------------------------------
    function random(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function chance(probability) {
        const prob = Math.max(0, Math.min(1, probability));
        return Math.random() < prob;
    }

    //----------------------------------
    // Core Logic
    //----------------------------------

    // Function to handle window resize
    function resize() {
        if (!canvas) return;
        const { innerWidth, innerHeight } = window;
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        width = innerWidth;
        height = innerHeight;
        // Recalculate dynamic parameters
        flakeRequestPerFrame = ((width / 100) * FLAKE_FREQUENCY) / FPS;
        castRadius = FLAKE_CAST_RADIUS_RATIO * Math.min(width, height); // Recalc mouse radius
        // Reset the force field dimensions
        if (castField) {
            castField.reset(width, height);
        }
    }

    // Main animation loop function
    function draw() {
        // --- Loop Control ---
        if (!isRunning) {
            animationFrameId = null;
            return;
        }

        if (!ctx) {
             console.error("Snowfall: Canvas context lost.");
             stop();
             return;
        }
        ctx.clearRect(0, 0, width, height);

        // --- Apply forces (including mouse cast) ---
        if (castField) {
            castField.applyField(flakes); // Applies forces & resets field
        }

        // --- Create new flakes ---
        let nbFlakeToCreate = Math.floor(flakeRequestPerFrame);
        if (chance(flakeRequestPerFrame % 1)) {
            nbFlakeToCreate++;
        }
        for (let i = 0; i < nbFlakeToCreate; i++) {
            flakes.push(new Flake({ x: random(0, width), y: -FLAKE_MAX_SIZE }));
        }

        // --- Update and draw existing flakes ---
        for (let i = flakes.length - 1; i >= 0; i--) {
            const flake = flakes[i];
            const removalPadding = 50;

            if (flake.position.y > height + removalPadding ||
                flake.position.x < -removalPadding ||
                flake.position.x > width + removalPadding)
            {
                flakes.splice(i, 1);
                continue;
            }
            flake.evolve(); // Calculates physics based on forces set by applyField etc.
            flake.draw(ctx);
        }

        // Request the next frame
        animationFrameId = window.requestAnimationFrame(draw);
    }

    //----------------------------------
    // Public Interface
    //----------------------------------
    function init() {
        // *** Requires Lodash ***
        if (typeof _ === 'undefined' || typeof _.throttle !== 'function') {
            console.error("Snowfall effect requires Lodash library (specifically _.throttle) for mouse interaction. Make sure it's loaded before this script.");
            return false; // Stop initialization if Lodash isn't ready
        }

        canvas = document.getElementById("snowfall");
        if (!canvas || typeof canvas.getContext !== 'function') {
            console.error("Snowfall effect requires a <canvas id='snowfall'></canvas> element.");
            return false;
        }
        ctx = canvas.getContext("2d");

        // Initialize force field and mouse tracker (Reintroduced)
        castField = new FlakeCaster("cast", width, height); // Init with 0,0 until resize
        mouse = {
            currentPosition: { x: 0, y: 0 },
            prevPosition: { x: 0, y: 0 },
            move: function (x, y) {
                this.prevPosition.x = this.currentPosition.x;
                this.prevPosition.y = this.currentPosition.y;
                this.currentPosition.x = x;
                this.currentPosition.y = y;
            },
            get vitesse() {
                return {
                    x: this.currentPosition.x - this.prevPosition.x,
                    y: this.currentPosition.y - this.prevPosition.y
                };
            }
        };

        // Throttled function for mouse/touch events (Reintroduced)
        throttledCastFlakes = _.throttle((e) => {
            // Check if running, don't process mouse if stopped
            if (!isRunning || !castField || !mouse) return;

            let x, y;
            if (e.type === "mousemove") {
                x = e.clientX; y = e.clientY;
            } else if (e.type === "touchmove" && e.touches && e.touches.length > 0) {
                x = e.touches[0].clientX; y = e.touches[0].clientY;
            } else { return; }

            mouse.move(x, y);
            const vitesse = mouse.vitesse;
            if (vitesse.x !== 0 || vitesse.y !== 0) {
                // Calculate the force field based on mouse movement
                castField.calculateField(x, y, vitesse, castRadius);
            }
        }, FLAKE_CAST_THROTTLE);

        // --- Initial Setup ---
        resize(); // Call resize once initially to set dimensions and parameters
        window.addEventListener('resize', resize);
        // Add mouse/touch listeners (Reintroduced)
        window.addEventListener('mousemove', throttledCastFlakes);
        window.addEventListener('touchmove', throttledCastFlakes);

        console.log("Snowfall initialized (with mouse tracking).");
        return true; // Indicate success
    }

    function start() {
        if (!canvas) {
            console.error("Snowfall cannot start: not initialized or canvas not found.");
            return;
        }
        if (isRunning) return;
        isRunning = true;
        canvas.style.display = 'block';
        console.log("Snowfall started.");
        if (!animationFrameId) {
            draw();
        }
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        // When stopped, also clear any pending cast forces
        if (castField) {
            castField.reset(); // Clear the force field buffer
            // Ensure particles don't retain the last cast force
            flakes.forEach(flake => flake.removeForce('cast'));
        }
        if (canvas) {
            canvas.style.display = 'none';
        }
        console.log("Snowfall stopped.");
    }

    // Return the public methods
    return {
        init: init,
        start: start,
        stop: stop
    };
})();

// --- End Snowflake Effect Logic ---


// --- Snowfall Toggle Logic (No changes needed here) ---
const snowToggleButton = document.getElementById('snow-toggle');
const snowIcon = '&#x2744;'; // ❄️ Snowflake
const noSnowIcon = '&#x1F6AB;'; // 🚫 Prohibited/Off symbol
let isSnowEnabled = true; // Default state (will be checked against localStorage)

function setInitialSnowState() {
    try {
        const savedSnowPref = localStorage.getItem('snowEnabled');
        isSnowEnabled = savedSnowPref !== 'false';
    } catch (e) {
        console.warn("Could not read snow preference from localStorage.", e);
        isSnowEnabled = true;
    }

    if (snowToggleButton) {
        snowToggleButton.innerHTML = isSnowEnabled ? snowIcon : noSnowIcon;
    }
}

function toggleSnow() {
    if (!snowFall || typeof snowFall.start !== 'function' || typeof snowFall.stop !== 'function') {
         console.error("Snowfall controller (start/stop methods) not available.");
         return;
    }
    isSnowEnabled = !isSnowEnabled;
    if (isSnowEnabled) {
        snowFall.start();
        if (snowToggleButton) snowToggleButton.innerHTML = snowIcon;
        try { localStorage.setItem('snowEnabled', 'true'); } catch(e) { console.warn("Could not save snow preference.", e); }
    } else {
        snowFall.stop();
        if (snowToggleButton) snowToggleButton.innerHTML = noSnowIcon;
        try { localStorage.setItem('snowEnabled', 'false'); } catch(e) { console.warn("Could not save snow preference.", e); }
    }
}

if (snowToggleButton) {
    snowToggleButton.addEventListener('click', toggleSnow);
} else { console.warn("Snow toggle button ('#snow-toggle') not found."); }
// --- End Snowfall Toggle Logic ---


// --- Initializations (No changes needed here) ---
initializeTheme();
setInitialSnowState();

if (slides.length > 0 && prevButton && nextButton) {
    startSlideShow();
} else { console.warn("Slideshow auto-start skipped: Slides or buttons not found."); }

document.addEventListener("DOMContentLoaded", () => {
    if (typeof snowFall !== 'undefined' && typeof snowFall.init === 'function') {
        // Initialize (checks for Lodash, gets canvas, adds listeners)
        if (snowFall.init()) {
             console.log("DOM Ready: Snowfall initialized successfully.");
            if (isSnowEnabled) {
                console.log("DOM Ready: Starting snowfall based on initial state.");
                snowFall.start();
            } else {
                 console.log("DOM Ready: Snowfall initially disabled.");
                 const canvas = document.getElementById('snowfall');
                 if (canvas) canvas.style.display = 'none';
            }
        } else {
            console.error("DOM Ready: Snowfall initialization failed (check Lodash/canvas element).");
        }
    } else {
        console.error("DOM Ready: Snowfall object or init method not found.");
    }
});
// --- End Initializations ---