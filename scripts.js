// script.js
// Combined script for theme, targeted slider, snowflakes, and toggles

// --- Theme Toggle Logic ---
// [NO CHANGES HERE - Keep the original theme logic]
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


// --- Snowflake Effect Logic (Modified for Toggle and Performance) ---

const snowFall = (() => {
    //----------------------------------
    // Internal State
    //----------------------------------
    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let flakes = []; // Array to hold Flake objects
    let flakeRequestPerFrame = 0; // How many flakes to create per frame (calculated in resize)
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
    const PI = Math.PI;
    const FPS = 60;

    //----------------------------------
    // Objects (Point, Vector, Particle, Flake - simplified)
    //----------------------------------

    class Point {
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
            this.forces = new Map(); // Still keep for gravity/friction, but not external forces
        }

        setForce(forceName, forceValue = { x: 0, y: 0 }) {
            this.forces.set(forceName, new Vector(forceValue.x, forceValue.y));
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
            // Only sum gravity and friction forces
            const acceleration = Vector.add(Array.from(this.forces.values()));
            this.forces.clear();
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
            // Calculate new speed and position based on gravity/friction
            this.updateSpeedAndPosition();
            // Apply positional noise *after* main physics calculation
            this.applyNoise();
        }

        applyNoise() {
            // Simpler approach: Directly translate position by noise amount this frame
            const noiseForce = new Vector(
                (random(-100, 100) / 100) * FLAKE_NOISE_X * this.depth,
                (random(-100, 100) / 100) * FLAKE_NOISE_Y * this.depth
            );
            this.position.translate(noiseForce);
        }

        draw(ctx) {
            if (!ctx) return; // Safety check
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.size, 0, 2 * PI);
            // You might want to tie this to the theme later
            ctx.fillStyle = "white";
            ctx.fill();
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
    }

    // Main animation loop function
    function draw() {
        // --- Loop Control ---
        // Stop the loop if isRunning is false
        if (!isRunning) {
            animationFrameId = null; // Clear ID when loop actually stops
            return;
        }

        // Clear the canvas for the new frame
        if (ctx) {
             ctx.clearRect(0, 0, width, height);
        } else {
             console.error("Snowfall: Canvas context lost.");
             stop(); // Stop animation if context is lost
             return;
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
        // Iterate backwards for safe removal
        for (let i = flakes.length - 1; i >= 0; i--) {
            const flake = flakes[i];
            const removalPadding = 50;

            if (flake.position.y > height + removalPadding ||
                flake.position.x < -removalPadding ||
                flake.position.x > width + removalPadding)
            {
                flakes.splice(i, 1); // Remove the flake
                continue;
            }

            flake.evolve();
            flake.draw(ctx);
        }

        // Request the next frame
        animationFrameId = window.requestAnimationFrame(draw);
    }

    //----------------------------------
    // Public Interface
    //----------------------------------
    function init() {
        canvas = document.getElementById("snowfall");
        if (!canvas || typeof canvas.getContext !== 'function') {
            console.error("Snowfall effect requires a <canvas id='snowfall'></canvas> element.");
            return false; // Indicate initialization failure
        }
        ctx = canvas.getContext("2d");

        // --- Initial Setup ---
        resize(); // Call resize once initially to set dimensions and parameters
        window.addEventListener('resize', resize); // Re-calculate on window resize
        // NO mouse/touch listeners needed anymore

        console.log("Snowfall initialized.");
        return true; // Indicate success
    }

    function start() {
        if (!canvas) {
            console.error("Snowfall cannot start: not initialized or canvas not found.");
            return;
        }
        if (isRunning) {
            // console.log("Snowfall already running.");
            return; // Already running
        }
        isRunning = true;
        canvas.style.display = 'block'; // Make sure canvas is visible
        console.log("Snowfall started.");
        // Start the animation loop *only if* it's not already requested
        if (!animationFrameId) {
            draw(); // Start the animation loop
        }
    }

    function stop() {
        if (!isRunning) {
            // console.log("Snowfall already stopped.");
            return; // Already stopped
        }
        isRunning = false;
        // Cancel the *next* frame request. The current frame might finish.
        if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (canvas) {
            canvas.style.display = 'none'; // Hide canvas
            // Optional: Clear canvas visually when stopped
            // if(ctx) {
            //    ctx.clearRect(0, 0, width, height);
            // }
            // Optional: Clear the flakes array
            // flakes = [];
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


// --- Snowfall Toggle Logic (Uses new start/stop) ---
const snowToggleButton = document.getElementById('snow-toggle');
const snowIcon = '&#x2744;'; // ❄️ Snowflake
const noSnowIcon = '&#x1F6AB;'; // 🚫 Prohibited/Off symbol
let isSnowEnabled = true; // Default state (will be checked against localStorage)

function setInitialSnowState() {
    try {
        const savedSnowPref = localStorage.getItem('snowEnabled');
        // Default to true if nothing is saved or if value is invalid/not 'false'
        isSnowEnabled = savedSnowPref !== 'false';
    } catch (e) {
        console.warn("Could not read snow preference from localStorage.", e);
        isSnowEnabled = true; // Default to enabled if localStorage fails
    }

    if (snowToggleButton) {
        snowToggleButton.innerHTML = isSnowEnabled ? snowIcon : noSnowIcon;
    }
    // Initial visibility/state is handled by DOMContentLoaded listener now
}

function toggleSnow() {
    // Check if snowFall and its methods exist
    if (!snowFall || typeof snowFall.start !== 'function' || typeof snowFall.stop !== 'function') {
         console.error("Snowfall controller (start/stop methods) not available.");
         return;
    }

    isSnowEnabled = !isSnowEnabled; // Toggle the state

    if (isSnowEnabled) {
        snowFall.start(); // Start the animation
        if (snowToggleButton) snowToggleButton.innerHTML = snowIcon;
        try { localStorage.setItem('snowEnabled', 'true'); } catch(e) { console.warn("Could not save snow preference.", e); }
    } else {
        snowFall.stop(); // Stop the animation
        if (snowToggleButton) snowToggleButton.innerHTML = noSnowIcon;
        try { localStorage.setItem('snowEnabled', 'false'); } catch(e) { console.warn("Could not save snow preference.", e); }
    }
}

if (snowToggleButton) {
    snowToggleButton.addEventListener('click', toggleSnow);
} else { console.warn("Snow toggle button ('#snow-toggle') not found."); }
// --- End Snowfall Toggle Logic ---


// --- Initializations ---
initializeTheme(); // Apply theme early
setInitialSnowState(); // Determine initial snow state from localStorage

// Start the slideshow automatically (if elements exist)
if (slides.length > 0 && prevButton && nextButton) {
    startSlideShow();
} else { console.warn("Slideshow auto-start skipped: Slides or buttons not found."); }

// Initialize snowflake effect after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    // Check if snowFall object and init method are available
    if (typeof snowFall !== 'undefined' && typeof snowFall.init === 'function') {
        // Initialize the snowfall module (gets canvas, sets resize listener, etc.)
        if (snowFall.init()) { // Returns true if canvas found
             console.log("DOM Ready: Snowfall initialized successfully.");
            // Check the state determined by setInitialSnowState
            if (isSnowEnabled) {
                console.log("DOM Ready: Starting snowfall based on initial state.");
                snowFall.start(); // Start animation if initially enabled
            } else {
                 console.log("DOM Ready: Snowfall initially disabled.");
                 // Ensure canvas is hidden if starting disabled
                 // snowFall.stop() could be called, but hiding is sufficient if it hasn't started.
                 const canvas = document.getElementById('snowfall');
                 if (canvas) canvas.style.display = 'none';
            }
        } else {
            console.error("DOM Ready: Snowfall initialization failed (e.g., canvas not found).");
        }
    } else {
        console.error("DOM Ready: Snowfall object or init method not found.");
    }
});
// --- End Initializations ---