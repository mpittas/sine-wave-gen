/* eslint-disable no-console */
/* global dat */ // Tell linters dat is globally available

// --- START OF WAVE ANIMATION CODE ---

// --- Preset Definitions ---
const PRESET_OPTIONS = {
    classic: {
        speed: 10000, amplitude: 40, frequency: 0.002, waveCount: 16, lineWidth: 1.5,
        amplitudeStagger: 2.5, phaseStagger: 0.2, yOffsetStagger: 8,
        centerAmplitudeBoost: true, waveDirectionMode: 'opposite',
    },
    calm: {
        speed: 15000, amplitude: 25, frequency: 0.0015, waveCount: 10, lineWidth: 1.8,
        amplitudeStagger: 1.5, phaseStagger: 0.1, yOffsetStagger: 12,
        centerAmplitudeBoost: false, waveDirectionMode: 'opposite',
    },
    sharp: {
        speed: 8000, amplitude: 50, frequency: 0.0035, waveCount: 20, lineWidth: 1.2,
        amplitudeStagger: 1.0, phaseStagger: 0.3, yOffsetStagger: 5,
        centerAmplitudeBoost: true, waveDirectionMode: 'opposite',
    },
    uniform: {
        speed: 12000, amplitude: 35, frequency: 0.002, waveCount: 12,
        amplitudeStagger: 0, phaseStagger: 0, yOffsetStagger: 15,
        centerAmplitudeBoost: false, waveDirectionMode: 'forward',
    },
    spaced: {
        speed: 20000, amplitude: 60, frequency: 0.001, waveCount: 6, lineWidth: 2,
        amplitudeStagger: 5, phaseStagger: 0.5, yOffsetStagger: 40,
        centerAmplitudeBoost: true, waveDirectionMode: 'opposite',
    }
};

/** @type {Required<WaveOptions>} - Base defaults if no preset selected */
const BASE_DEFAULT_OPTIONS = {
    preset: 'classic', // Default preset selection
    speed: 10000,
    baseColor: "123, 59, 174",
    lineWidth: 1.5,
    waveCount: 16,
    amplitude: 40,
    frequency: 0.002,
    canvasHeight: 400, // Use fixed height for CodePen demo simplicity
    rotation: 0,
    overflowMargin: 100,
    amplitudeStagger: 2.5,
    phaseStagger: 0.2,
    yOffsetStagger: 8,
    centerAmplitudeBoost: true,
    waveDirectionMode: 'opposite',
    // Removed heightSourceSelector for simplicity in this demo
};

const TWO_PI = Math.PI * 2;

class Wave {
    constructor(amplitude, frequency, phase, yOffset, direction) {
        this.amplitude = amplitude;
        this.frequency = frequency;
        this.phase = phase;
        this.yOffset = yOffset;
        this.direction = direction;
    }
}

class WaveAnimation {
    constructor(canvas, options = {}) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error("Provided element is not a valid Canvas.");
        }
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.options = {}; // Initialize in setOptions
        this.setOptions(options); // Initial setup

        this.animationFrameId = null;
        this.waves = [];
        this.waveColors = [];
        this.resizeHandler = this._resizeCanvas.bind(this);
        this.animateLoop = this._animate.bind(this);

        this.cachedWidth = 0;
        this.cachedHeight = 0;
        this.pixelRatio = window.devicePixelRatio || 1;
        this.stepSize = 4; // Will be updated in resize

        this.init();
    }

    /**
     * Sets or updates the animation options, applying presets if necessary.
     * @param {Partial<WaveOptions>} newOptions
     */
    setOptions(newOptions) {
        // 1. Start with base defaults
        let combinedOptions = { ...BASE_DEFAULT_OPTIONS };
        // 2. Determine the preset to use (from new options or current options)
        const presetName = newOptions.preset || this.options?.preset || BASE_DEFAULT_OPTIONS.preset;
        if (presetName && PRESET_OPTIONS[presetName]) {
            combinedOptions = { ...combinedOptions, ...PRESET_OPTIONS[presetName] };
        }
        // 3. Merge new options OVER the defaults/preset
        combinedOptions = { ...combinedOptions, ...newOptions };

         // Ensure waveCount is even
        if (combinedOptions.waveCount % 2 !== 0) {
            combinedOptions.waveCount = Math.max(2, combinedOptions.waveCount + 1); // Ensure even and at least 2
        }

        // Update the instance options
        this.options = combinedOptions;

         // Trigger updates if animation is already running
         if (this.animationFrameId) {
             this._resizeCanvas(); // Check if height changed
             this._createWaves(); // Recreate waves with new params
         }
    }

    init() {
        this._resizeCanvas();
        window.addEventListener("resize", this.resizeHandler);
        this._createWaves();
        if (!this.animationFrameId) { // Prevent multiple loops if init called again
             this.animateLoop();
        }
    }

    destroy() {
        window.removeEventListener("resize", this.resizeHandler);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.waves = [];
        this.waveColors = [];
    }

    // Use fixed height from options.canvasHeight for this demo
    _getTargetHeight() {
        return Math.max(50, this.options.canvasHeight || BASE_DEFAULT_OPTIONS.canvasHeight); // Ensure positive height
    }

    _resizeCanvas() {
        const currentWidth = window.innerWidth;
        const targetHeight = this._getTargetHeight();

        if (this.cachedWidth === currentWidth && this.cachedHeight === targetHeight) {
             return;
        }
        this.cachedWidth = currentWidth;
        this.cachedHeight = targetHeight;

        const { pixelRatio } = this;

        this.canvas.width = currentWidth * pixelRatio;
        this.canvas.height = targetHeight * pixelRatio;
        this.canvas.style.width = `${currentWidth}px`;
        this.canvas.style.height = `${targetHeight}px`;
        this.ctx.scale(pixelRatio, pixelRatio);

        this.stepSize = Math.max(2, Math.floor(currentWidth / 150));

        // Recreate waves if size changes after initialization
        if (this.waves.length > 0) {
            this._createWaves();
        }
    }

    _createWaves() {
        const {
            waveCount, amplitude, frequency, baseColor, canvasHeight, // Use fixed height here
            amplitudeStagger, phaseStagger, yOffsetStagger, waveDirectionMode
         } = this.options;
        const logicalHeight = this._getTargetHeight(); // Use the same fixed height
        const halfCount = waveCount / 2;
        this.waves = []; // Clear existing waves

        const createWaveSet = (count, baseOffsetY, defaultDirection, basePhase, freqMultiplier) => {
            const set = [];
            // Calculate total stagger height to help center the whole group
            const totalStaggerHeight = yOffsetStagger * (count - 1);
            const startYOffset = (logicalHeight / 2) + baseOffsetY - (totalStaggerHeight / 2);

            for (let i = 0; i < count; i++) {
                const waveAmplitude = amplitude + amplitudeStagger * i;
                const waveFrequency = frequency * freqMultiplier;
                const phase = basePhase + phaseStagger * i;
                const yOffset = startYOffset + yOffsetStagger * i;

                let direction = defaultDirection;
                if (waveDirectionMode === 'forward') direction = 1;
                if (waveDirectionMode === 'backward') direction = -1;

                set.push(new Wave(waveAmplitude, waveFrequency, phase, yOffset, direction));
            }
            return set;
        };

        let dir1 = 1, dir2 = -1;
        if (waveDirectionMode === 'forward') { dir1 = 1; dir2 = 1; }
        if (waveDirectionMode === 'backward') { dir1 = -1; dir2 = -1; }

        const waves1 = createWaveSet(halfCount, 0, dir1, 0, 1);
        const waves2 = createWaveSet(halfCount, -10, dir2, (waveDirectionMode === 'uniform' ? 0 : Math.PI / 3), 1.05);

        this.waves = [...waves1, ...waves2];

        this.waveColors = this.waves.map((_, index) =>
            `rgba(${baseColor}, ${0.1 + index * (0.8 / waveCount)})`
        );
    }

    _drawWaves(progress) {
        const { ctx, canvas, options, stepSize, waves, waveColors } = this;
        const logicalWidth = canvas.width / this.pixelRatio;
        const logicalHeight = canvas.height / this.pixelRatio;
        const rotationRadians = options.rotation * (Math.PI / 180);
        const { overflowMargin, centerAmplitudeBoost, lineWidth } = options;

        const startX = -overflowMargin;
        const endX = logicalWidth + overflowMargin;

        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        if (rotationRadians !== 0) {
            ctx.save();
            ctx.translate(logicalWidth / 2, logicalHeight / 2);
            ctx.rotate(rotationRadians);
            ctx.translate(-logicalWidth / 2, -logicalHeight / 2);
        }

        ctx.lineWidth = lineWidth;

        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            if (!wave) continue; // Safety check
            ctx.strokeStyle = waveColors[i] || 'rgba(255,255,255,0.1)'; // Fallback color

            ctx.beginPath();
            const phaseOffset = wave.phase + progress * TWO_PI * wave.direction;

            let currentX = startX;
            let normalizedX = Math.max(0, Math.min(1, currentX / logicalWidth));
            let amplitudeMultiplier = centerAmplitudeBoost ? (1 + Math.sin(normalizedX * Math.PI) * 0.5) : 1.0;
            let currentY = Math.sin(currentX * wave.frequency + phaseOffset) * wave.amplitude * amplitudeMultiplier + wave.yOffset;
            ctx.moveTo(currentX, currentY);

            for (currentX = startX + stepSize; currentX <= endX; currentX += stepSize) {
                normalizedX = Math.max(0, Math.min(1, currentX / logicalWidth));
                amplitudeMultiplier = centerAmplitudeBoost ? (1 + Math.sin(normalizedX * Math.PI) * 0.5) : 1.0;
                currentY = Math.sin(currentX * wave.frequency + phaseOffset) * wave.amplitude * amplitudeMultiplier + wave.yOffset;
                ctx.lineTo(currentX, currentY);
            }

            if (currentX !== endX + stepSize) {
                 normalizedX = Math.max(0, Math.min(1, endX / logicalWidth));
                 amplitudeMultiplier = centerAmplitudeBoost ? (1 + Math.sin(normalizedX * Math.PI) * 0.5) : 1.0;
                 currentY = Math.sin(endX * wave.frequency + phaseOffset) * wave.amplitude * amplitudeMultiplier + wave.yOffset;
                 ctx.lineTo(endX, currentY);
            }
            ctx.stroke();
        }

        if (rotationRadians !== 0) {
            ctx.restore();
        }
    }

    _animate() {
        const progress = (performance.now() % this.options.speed) / this.options.speed;
        this._drawWaves(progress);
        this.animationFrameId = requestAnimationFrame(this.animateLoop);
    }
}
// --- END OF WAVE ANIMATION CODE ---


// --- DAT.GUI INTEGRATION ---
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('waveCanvas');
    const exportButton = document.getElementById('exportJsButton');
    const exportOutput = document.getElementById('exportOutput');

    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    if (typeof dat === 'undefined') {
         console.error("dat.GUI library not loaded. Please add it in CodePen JS settings.");
         alert("dat.GUI not loaded! Check CodePen settings.");
         return;
    }

    // --- Configuration Object for GUI ---
    // Initialize with the default preset's values merged over base defaults
    const initialConfig = {
        ...BASE_DEFAULT_OPTIONS, // Start with base
        ...PRESET_OPTIONS[BASE_DEFAULT_OPTIONS.preset] // Apply default preset
    };
    const config = { ...initialConfig }; // Clone for GUI binding

    // --- Initialize Wave Animation ---
    const waveAnimation = new WaveAnimation(canvas, { ...config }); // Initial options

    // --- Create GUI ---
    const gui = new dat.GUI({ autoPlace: false }); // Don't automatically place
    document.getElementById('gui-container').appendChild(gui.domElement); // Place it manually

    // --- Helper to apply preset and update GUI ---
    function applyPreset(presetName) {
        if (!PRESET_OPTIONS[presetName]) return;

        const presetValues = PRESET_OPTIONS[presetName];
        // Update the config object
        Object.assign(config, presetValues);
        config.preset = presetName; // Ensure preset name is also updated

        // Update the animation directly
        waveAnimation.setOptions({ ...config }); // Pass the updated config

        // Update all GUI controllers to reflect the new config values
        gui.__controllers.forEach(controller => {
            if (controller.property !== 'preset') { // Don't update the preset dropdown itself recursively
                controller.setValue(config[controller.property]);
            }
        });
         // Make sure the preset dropdown shows the correct value
         presetController.setValue(presetName);
    }


    // --- Add GUI Controls ---

    // Preset Selector
    const presetController = gui.add(config, 'preset', Object.keys(PRESET_OPTIONS)).name('Preset').onChange(applyPreset);

    // Animation Folder
    const animFolder = gui.addFolder('Animation');
    animFolder.add(config, 'speed', 1000, 30000, 500).name('Speed (ms)').onChange(() => waveAnimation.setOptions({ speed: config.speed }));
    animFolder.add(config, 'rotation', -180, 180, 1).name('Rotation (deg)').onChange(() => waveAnimation.setOptions({ rotation: config.rotation }));
    animFolder.add(config, 'waveDirectionMode', ['opposite', 'forward', 'backward']).name('Direction Mode').onChange(() => waveAnimation.setOptions({ waveDirectionMode: config.waveDirectionMode }));
    animFolder.open(); // Open by default

    // Appearance Folder
    const appearanceFolder = gui.addFolder('Appearance');
    appearanceFolder.add(config, 'baseColor').name('Base Color (RGB)').onChange(() => waveAnimation.setOptions({ baseColor: config.baseColor }));
    appearanceFolder.add(config, 'lineWidth', 0.5, 5, 0.1).name('Line Width').onChange(() => waveAnimation.setOptions({ lineWidth: config.lineWidth }));
    appearanceFolder.add(config, 'canvasHeight', 100, 800, 10).name('Canvas Height').onChange(() => waveAnimation.setOptions({ canvasHeight: config.canvasHeight }));
    appearanceFolder.add(config, 'overflowMargin', 0, 300, 10).name('Overflow Margin').onChange(() => waveAnimation.setOptions({ overflowMargin: config.overflowMargin }));

    // Wave Shape Folder
    const shapeFolder = gui.addFolder('Wave Shape');
    shapeFolder.add(config, 'waveCount', 2, 40, 2).name('Wave Count').onChange(() => waveAnimation.setOptions({ waveCount: config.waveCount })); // Step 2 for even
    shapeFolder.add(config, 'amplitude', 5, 100, 1).name('Base Amplitude').onChange(() => waveAnimation.setOptions({ amplitude: config.amplitude }));
    shapeFolder.add(config, 'frequency', 0.0005, 0.01, 0.0001).name('Frequency').onChange(() => waveAnimation.setOptions({ frequency: config.frequency }));
    shapeFolder.add(config, 'centerAmplitudeBoost').name('Center Boost').onChange(() => waveAnimation.setOptions({ centerAmplitudeBoost: config.centerAmplitudeBoost }));

    // Staggering Folder
    const staggerFolder = gui.addFolder('Staggering');
    staggerFolder.add(config, 'amplitudeStagger', 0, 10, 0.1).name('Amplitude Stagger').onChange(() => waveAnimation.setOptions({ amplitudeStagger: config.amplitudeStagger }));
    staggerFolder.add(config, 'phaseStagger', 0, Math.PI / 2, 0.01).name('Phase Stagger (rad)').onChange(() => waveAnimation.setOptions({ phaseStagger: config.phaseStagger }));
    staggerFolder.add(config, 'yOffsetStagger', 0, 50, 1).name('Y-Offset Stagger').onChange(() => waveAnimation.setOptions({ yOffsetStagger: config.yOffsetStagger }));


    // --- Export Functionality ---
    function generateJsSnippet() {
        // Create a clean options object, excluding the 'preset' key itself
        const exportOptions = { ...config };
        delete exportOptions.preset; // Don't export the preset name, export the values

        // Format the options object nicely
        let optionsString = JSON.stringify(exportOptions, (key, value) => {
            // Keep numbers precise
            if (typeof value === 'number') {
                 return parseFloat(value.toFixed(4)); // Adjust precision as needed
            }
            return value;
        }, 2); // Indent with 2 spaces

        // Remove quotes from keys for cleaner look
         optionsString = optionsString.replace(/"([^"]+)":/g, '$1:');

        const snippet = `
// Ensure you have the WaveAnimation class defined above this code.
// Get your canvas element:
const canvasElement = document.getElementById('yourCanvasId'); // <-- Change 'yourCanvasId'

if (canvasElement) {
  const waveAnim = new WaveAnimation(canvasElement, ${optionsString});
} else {
  console.error("Canvas element not found!");
}
`;
        exportOutput.textContent = snippet.trim();
         console.log("Generated JS Snippet:", snippet.trim());
    }

    exportButton.addEventListener('click', generateJsSnippet);

    // Initial generation on load
    generateJsSnippet();

    // Optional: Cleanup on unload (useful in SPA, not strictly needed in CodePen)
    // window.addEventListener('beforeunload', () => {
    //     waveAnimation.destroy();
    //     gui.destroy();
    // });
});

// Add this at the end of the file
document.addEventListener('DOMContentLoaded', function() {
    const exportControls = document.querySelector('.export-controls');
    const toggleButton = document.getElementById('toggleExport');
    
    toggleButton.addEventListener('click', function() {
        exportControls.classList.toggle('collapsed');
    });
});
