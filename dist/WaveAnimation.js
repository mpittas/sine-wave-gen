import { Wave } from "./Wave";
import { PRESET_OPTIONS, BASE_DEFAULT_OPTIONS, TWO_PI, } from "./constants";
export class WaveAnimation {
    constructor(canvas, options = {}) {
        this.animationFrameId = null;
        this.waves = [];
        this.waveColors = [];
        this.cachedWidth = 0;
        this.cachedHeight = 0;
        this.stepSize = 4; // Will be updated in resize
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        if (!this.ctx) {
            throw new Error("Could not get 2D context from canvas.");
        }
        this.options = Object.assign({}, BASE_DEFAULT_OPTIONS); // Initialize with base defaults
        this.pixelRatio = window.devicePixelRatio || 1;
        this.resizeHandler = this._resizeCanvas.bind(this);
        this.animateLoop = this._animate.bind(this);
        // Apply initial options *after* setting defaults and binding handlers
        this.setOptions(Object.assign(Object.assign({}, BASE_DEFAULT_OPTIONS), options)); // Apply initial options over defaults
        this.init();
    }
    /**
     * Sets or updates the animation options, applying presets if necessary.
     */
    setOptions(newOptions) {
        let needsResize = false;
        let needsWaveRecreation = false;
        let oldPreset = this.options.preset; // Store old preset name
        const previousOptions = Object.assign({}, this.options); // Store previous state
        // Handle preset change specifically
        if (newOptions.preset && newOptions.preset !== oldPreset) {
            const presetName = newOptions.preset; // Type assertion
            const presetValues = PRESET_OPTIONS[presetName] || {};
            // Rebuild options: base -> preset -> any *other* newOptions passed alongside preset
            this.options = Object.assign(Object.assign(Object.assign(Object.assign({}, BASE_DEFAULT_OPTIONS), presetValues), Object.fromEntries(Object.entries(newOptions).filter(([key]) => key !== "preset"))), { preset: presetName, useFullScreenHeight: false });
            // Explicitly apply useFullScreenHeight if passed *with* the preset
            if (newOptions.useFullScreenHeight !== undefined) {
                this.options.useFullScreenHeight = newOptions.useFullScreenHeight;
            }
            needsWaveRecreation = true; // Presets usually change wave structure/appearance
            // Check if height changed compared to previous state *after* applying preset
            if (this.options.canvasHeight !== previousOptions.canvasHeight) {
                needsResize = true;
            }
            if (this.options.useFullScreenHeight !== previousOptions.useFullScreenHeight) {
                needsResize = true;
            }
        }
        else {
            // For non-preset changes, merge onto current options
            this.options = Object.assign(Object.assign({}, this.options), newOptions);
            // Check which updates are needed by comparing with previousOptions
            needsResize =
                (newOptions.canvasHeight !== undefined &&
                    newOptions.canvasHeight !== previousOptions.canvasHeight) ||
                    // Check if fullscreen mode changed
                    (newOptions.useFullScreenHeight !== undefined &&
                        newOptions.useFullScreenHeight !==
                            previousOptions.useFullScreenHeight);
            needsWaveRecreation =
                needsResize || // Resize implies recreation
                    (newOptions.waveCount !== undefined &&
                        newOptions.waveCount !== previousOptions.waveCount) ||
                    (newOptions.amplitude !== undefined &&
                        newOptions.amplitude !== previousOptions.amplitude) ||
                    (newOptions.frequency !== undefined &&
                        newOptions.frequency !== previousOptions.frequency) ||
                    (newOptions.baseColor !== undefined &&
                        newOptions.baseColor !== previousOptions.baseColor) ||
                    (newOptions.amplitudeStagger !== undefined &&
                        newOptions.amplitudeStagger !== previousOptions.amplitudeStagger) ||
                    (newOptions.phaseStagger !== undefined &&
                        newOptions.phaseStagger !== previousOptions.phaseStagger) ||
                    (newOptions.yOffsetStagger !== undefined &&
                        newOptions.yOffsetStagger !== previousOptions.yOffsetStagger) ||
                    (newOptions.waveDirectionMode !== undefined &&
                        newOptions.waveDirectionMode !== previousOptions.waveDirectionMode) ||
                    (newOptions.minOpacity !== undefined &&
                        newOptions.minOpacity !== previousOptions.minOpacity) ||
                    (newOptions.maxOpacity !== undefined &&
                        newOptions.maxOpacity !== previousOptions.maxOpacity);
        }
        // Ensure waveCount is always even after potential changes
        if (this.options.waveCount % 2 !== 0) {
            this.options.waveCount = Math.max(2, this.options.waveCount + 1);
            // If waveCount was just changed (by newOptions or preset), ensure needsWaveRecreation is true
            if (newOptions.waveCount !== undefined || newOptions.preset) {
                needsWaveRecreation = true;
            }
        }
        // Trigger updates if animation is already running
        if (this.animationFrameId) {
            if (needsResize) {
                this._resizeCanvas(); // Resizing implicitly calls _createWaves if size changed
            }
            else if (needsWaveRecreation) {
                this._createWaves(); // Recreate waves only if necessary parameters changed
            }
            // Other parameters like speed, rotation, line width etc. are used directly in _drawWaves or _animate
            // and don't require explicit recreation calls here.
        }
    }
    init() {
        this._resizeCanvas(); // Call resize first to set initial dimensions
        window.addEventListener("resize", this.resizeHandler);
        // Waves are created by resize if needed, or explicitly if resize didn't change anything
        if (this.waves.length === 0) {
            this._createWaves();
        }
        if (!this.animationFrameId) {
            // Prevent multiple loops if init called again
            this.animationFrameId = requestAnimationFrame(this.animateLoop);
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
    // Use fixed height from options.canvasHeight OR full screen
    _getTargetHeight() {
        if (this.options.useFullScreenHeight) {
            return window.innerHeight;
        }
        // Provide a default if canvasHeight is somehow missing from options
        return Math.max(50, this.options.canvasHeight || BASE_DEFAULT_OPTIONS.canvasHeight);
    }
    _resizeCanvas() {
        if (!this.ctx)
            return; // Guard against null context
        const currentWidth = window.innerWidth;
        const targetHeight = this._getTargetHeight();
        if (this.cachedWidth === currentWidth &&
            this.cachedHeight === targetHeight) {
            return; // No change, no need to resize or recreate waves
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
        // Recreate waves needed due to size change
        this._createWaves();
    }
    _createWaves() {
        const { waveCount, amplitude, frequency, baseColor, 
        // canvasHeight is not directly needed here, use logicalHeight
        amplitudeStagger, phaseStagger, yOffsetStagger, waveDirectionMode, minOpacity, maxOpacity, centerAmplitudeBoost, // Added missing option
         } = this.options;
        const logicalHeight = this._getTargetHeight();
        const halfCount = waveCount / 2;
        this.waves = []; // Clear existing waves
        const createWaveSet = (count, baseOffsetY, defaultDirection, basePhase, freqMultiplier) => {
            const set = [];
            // Calculate total stagger height to help center the whole group
            const totalStaggerHeight = yOffsetStagger * (count - 1);
            const startYOffset = logicalHeight / 2 + baseOffsetY - totalStaggerHeight / 2;
            for (let i = 0; i < count; i++) {
                // Apply boost towards the center (waves closer to i=0)
                const boostFactor = centerAmplitudeBoost
                    ? (1 - i / count) * 0.5 + 1
                    : 1; // Example: 1.5x boost for first wave, down to 1x
                const waveAmplitude = (amplitude + amplitudeStagger * i) * boostFactor;
                const waveFrequency = frequency * freqMultiplier;
                const phase = basePhase + phaseStagger * i;
                const yOffset = startYOffset + yOffsetStagger * i;
                let direction = defaultDirection;
                if (waveDirectionMode === "forward")
                    direction = 1;
                if (waveDirectionMode === "backward")
                    direction = -1;
                set.push(new Wave(waveAmplitude, waveFrequency, phase, yOffset, direction));
            }
            return set;
        };
        let dir1 = 1, dir2 = -1;
        if (waveDirectionMode === "forward") {
            dir1 = 1;
            dir2 = 1;
        }
        else if (waveDirectionMode === "backward") {
            dir1 = -1;
            dir2 = -1;
        } // Default is "opposite": dir1=1, dir2=-1
        // Create two sets of waves
        const waves1 = createWaveSet(halfCount, 0, dir1, 0, 1); // Offset 0, Phase 0
        const waves2 = createWaveSet(halfCount, -yOffsetStagger / 2, dir2, Math.PI / 2, 1.1); // Slightly offset Y, Phase PI/2, slightly diff frequency
        this.waves = [...waves1, ...waves2];
        // --- Generate Wave Colors based on baseColor and opacity range ---
        const [rStr, gStr, bStr] = baseColor.split(",").map((s) => s.trim());
        const r = parseInt(rStr, 10);
        const g = parseInt(gStr, 10);
        const b = parseInt(bStr, 10);
        this.waveColors = this.waves.map((_, index) => {
            const progressRatio = index / (this.waves.length - 1 || 1); // Avoid division by zero if only one wave
            const opacity = minOpacity + (maxOpacity - minOpacity) * progressRatio;
            return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`;
        });
    }
    _drawWaves(progress) {
        if (!this.ctx)
            return; // Guard against null context
        const { ctx, canvas, options, stepSize, waves, waveColors } = this;
        const { lineWidth, overflowMargin } = options;
        const logicalWidth = this.cachedWidth; // Use cached logical width
        const logicalHeight = this.cachedHeight; // Use cached logical height
        ctx.clearRect(0, 0, canvas.width / this.pixelRatio, canvas.height / this.pixelRatio); // Use logical dimensions for clearRect
        ctx.lineWidth = lineWidth;
        waves.forEach((wave, index) => {
            ctx.strokeStyle = waveColors[index] || options.baseColor; // Fallback just in case
            ctx.beginPath();
            // Start point slightly off-screen left
            let startX = -overflowMargin;
            let startY = wave.yOffset +
                wave.amplitude *
                    Math.sin(wave.phase + progress * TWO_PI * wave.direction);
            ctx.moveTo(startX, startY);
            for (let x = startX; x <= logicalWidth + overflowMargin; x += stepSize) {
                const phaseOffset = wave.frequency * x;
                const y = wave.yOffset +
                    wave.amplitude *
                        Math.sin(wave.phase + phaseOffset + progress * TWO_PI * wave.direction);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        });
    }
    _animate(timestamp) {
        if (!this.ctx) {
            // Stop animation if context is lost
            if (this.animationFrameId)
                cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            return;
        }
        const progress = (timestamp % this.options.speed) / this.options.speed;
        this._drawWaves(progress);
        this.animationFrameId = requestAnimationFrame(this.animateLoop);
    }
}
