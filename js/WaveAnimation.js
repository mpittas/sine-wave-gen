import { Wave } from "./Wave.js";
import { PRESET_OPTIONS, BASE_DEFAULT_OPTIONS, TWO_PI } from "./constants.js";

export class WaveAnimation {
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
    let needsResize = false;
    let needsWaveRecreation = false;
    let oldPreset = this.options.preset; // Store old preset name
    const previousOptions = { ...this.options }; // Store previous state

    // Handle preset change specifically
    if (newOptions.preset && newOptions.preset !== oldPreset) {
      const presetName = newOptions.preset;
      const presetValues = PRESET_OPTIONS[presetName] || {};
      // Rebuild options: base -> preset -> any *other* newOptions passed alongside preset
      this.options = {
        ...BASE_DEFAULT_OPTIONS,
        ...presetValues,
        // Merge other options passed *with* the preset change request
        ...Object.fromEntries(
          Object.entries(newOptions).filter(([key]) => key !== "preset")
        ),
      };
      needsWaveRecreation = true; // Presets usually change wave structure/appearance
      // Check if height relevant to preset changed
      const oldHeight = previousOptions.canvasHeight;
      const presetHeight = presetValues.canvasHeight;
      const baseHeight = BASE_DEFAULT_OPTIONS.canvasHeight;
      if (
        (presetHeight !== undefined && presetHeight !== oldHeight) ||
        (presetHeight === undefined && this.options.canvasHeight !== oldHeight)
      ) {
        needsResize = true;
      }
      // Presets imply non-fullscreen height
      this.options.useFullScreenHeight =
        newOptions.useFullScreenHeight === true; // Allow override if explicitly passed with preset
      if (
        this.options.useFullScreenHeight !== previousOptions.useFullScreenHeight
      ) {
        needsResize = true;
      }
    } else {
      // For non-preset changes, merge onto current options
      this.options = { ...this.options, ...newOptions };

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
      } else if (needsWaveRecreation) {
        this._createWaves(); // Recreate waves only if necessary parameters changed
      }
      // Other parameters like speed, rotation, line width etc. are used directly in _drawWaves or _animate
      // and don't require explicit recreation calls here.
    }
  }

  init() {
    this._resizeCanvas();
    window.addEventListener("resize", this.resizeHandler);
    this._createWaves();
    if (!this.animationFrameId) {
      // Prevent multiple loops if init called again
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

  // Use fixed height from options.canvasHeight OR full screen
  _getTargetHeight() {
    if (this.options.useFullScreenHeight) {
      return window.innerHeight;
    }
    return Math.max(
      50,
      this.options.canvasHeight || BASE_DEFAULT_OPTIONS.canvasHeight
    ); // Ensure positive height
  }

  _resizeCanvas() {
    const currentWidth = window.innerWidth;
    const targetHeight = this._getTargetHeight();

    if (
      this.cachedWidth === currentWidth &&
      this.cachedHeight === targetHeight
    ) {
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
      waveCount,
      amplitude,
      frequency,
      baseColor,
      canvasHeight, // Use fixed height here
      amplitudeStagger,
      phaseStagger,
      yOffsetStagger,
      waveDirectionMode,
      minOpacity,
      maxOpacity,
    } = this.options;
    const logicalHeight = this._getTargetHeight(); // Use the same fixed height
    const halfCount = waveCount / 2;
    this.waves = []; // Clear existing waves

    const createWaveSet = (
      count,
      baseOffsetY,
      defaultDirection,
      basePhase,
      freqMultiplier
    ) => {
      const set = [];
      // Calculate total stagger height to help center the whole group
      const totalStaggerHeight = yOffsetStagger * (count - 1);
      const startYOffset =
        logicalHeight / 2 + baseOffsetY - totalStaggerHeight / 2;

      for (let i = 0; i < count; i++) {
        const waveAmplitude = amplitude + amplitudeStagger * i;
        const waveFrequency = frequency * freqMultiplier;
        const phase = basePhase + phaseStagger * i;
        const yOffset = startYOffset + yOffsetStagger * i;

        let direction = defaultDirection;
        if (waveDirectionMode === "forward") direction = 1;
        if (waveDirectionMode === "backward") direction = -1;

        set.push(
          new Wave(waveAmplitude, waveFrequency, phase, yOffset, direction)
        );
      }
      return set;
    };

    let dir1 = 1,
      dir2 = -1;
    if (waveDirectionMode === "forward") {
      dir1 = 1;
      dir2 = 1;
    }
    if (waveDirectionMode === "backward") {
      dir1 = -1;
      dir2 = -1;
    }

    const waves1 = createWaveSet(halfCount, 0, dir1, 0, 1);
    const waves2 = createWaveSet(
      halfCount,
      -10,
      dir2,
      waveDirectionMode === "uniform" ? 0 : Math.PI / 3,
      1.05
    );

    this.waves = [...waves1, ...waves2];

    // Calculate opacity gradient based on min/max options
    const opacityRange = maxOpacity - minOpacity;
    // Prevent division by zero if waveCount is 1 (though we ensure it's >= 2)
    const opacityStep = waveCount > 1 ? opacityRange / (waveCount - 1) : 0;

    this.waveColors = this.waves.map((_, index) => {
      let calculatedOpacity = minOpacity + index * opacityStep;
      calculatedOpacity = Math.max(0, Math.min(1, calculatedOpacity)); // Clamp opacity between 0 and 1
      return `rgba(${baseColor}, ${calculatedOpacity})`;
    });
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
      ctx.strokeStyle = waveColors[i] || "rgba(255,255,255,0.1)"; // Fallback color

      ctx.beginPath();
      const phaseOffset = wave.phase + progress * TWO_PI * wave.direction;

      let currentX = startX;
      let normalizedX = Math.max(0, Math.min(1, currentX / logicalWidth));
      let amplitudeMultiplier = centerAmplitudeBoost
        ? 1 + Math.sin(normalizedX * Math.PI) * 0.5
        : 1.0;
      let currentY =
        Math.sin(currentX * wave.frequency + phaseOffset) *
          wave.amplitude *
          amplitudeMultiplier +
        wave.yOffset;
      ctx.moveTo(currentX, currentY);

      for (
        currentX = startX + stepSize;
        currentX <= endX;
        currentX += stepSize
      ) {
        normalizedX = Math.max(0, Math.min(1, currentX / logicalWidth));
        amplitudeMultiplier = centerAmplitudeBoost
          ? 1 + Math.sin(normalizedX * Math.PI) * 0.5
          : 1.0;
        currentY =
          Math.sin(currentX * wave.frequency + phaseOffset) *
            wave.amplitude *
            amplitudeMultiplier +
          wave.yOffset;
        ctx.lineTo(currentX, currentY);
      }

      if (currentX !== endX + stepSize) {
        normalizedX = Math.max(0, Math.min(1, endX / logicalWidth));
        amplitudeMultiplier = centerAmplitudeBoost
          ? 1 + Math.sin(normalizedX * Math.PI) * 0.5
          : 1.0;
        currentY =
          Math.sin(endX * wave.frequency + phaseOffset) *
            wave.amplitude *
            amplitudeMultiplier +
          wave.yOffset;
        ctx.lineTo(endX, currentY);
      }
      ctx.stroke();
    }

    if (rotationRadians !== 0) {
      ctx.restore();
    }
  }

  _animate() {
    const progress =
      (performance.now() % this.options.speed) / this.options.speed;
    this._drawWaves(progress);
    this.animationFrameId = requestAnimationFrame(this.animateLoop);
  }
}
