/* global dat */ // Tell linters dat is globally available
import { WaveAnimation } from "./WaveAnimation.js";
import { BASE_DEFAULT_OPTIONS, PRESET_OPTIONS } from "./constants.js";
import { rgbStringToHex, hexToRgbString } from "./helpers.js";

// --- DAT.GUI INTEGRATION ---
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("waveCanvas");
  const exportButton = document.getElementById("exportJsButton");
  const exportOutput = document.getElementById("exportOutput");
  const guiContainer = document.getElementById("gui-container");
  const toggleExportButton = document.getElementById("toggleExport");

  if (!canvas) {
    console.error("Canvas element #waveCanvas not found!");
    return;
  }
  if (!exportButton || !exportOutput || !guiContainer || !toggleExportButton) {
    console.error("One or more required UI elements are missing!");
    return;
  }
  if (typeof dat === "undefined") {
    console.error(
      "dat.GUI library not loaded. Please ensure it is included before this script."
    );
    alert("dat.GUI not loaded! UI controls will not work.");
    return;
  }

  // --- Configuration Object for GUI ---
  const initialConfig = {
    ...BASE_DEFAULT_OPTIONS,
    ...PRESET_OPTIONS[BASE_DEFAULT_OPTIONS.preset],
    canvasBackgroundColor: "#282828",
  };
  initialConfig.baseColor = rgbStringToHex(initialConfig.baseColor);

  const config = { ...initialConfig };

  // --- Initialize Wave Animation ---
  const waveAnimation = new WaveAnimation(canvas, {
    ...config,
    baseColor: hexToRgbString(config.baseColor),
  });

  // --- Create GUI ---
  const gui = new dat.GUI({ autoPlace: false });
  guiContainer.appendChild(gui.domElement);

  let canvasHeightController;
  let fullScreenController;
  let presetController;
  let minOpacityController, maxOpacityController;

  const setControllerVisibility = (controller, visible) => {
    if (controller && controller.domElement) {
      const parentLi = controller.domElement.closest("li");
      if (parentLi) {
        parentLi.style.display = visible ? "" : "none";
      }
    }
  };

  function applyPreset(presetName) {
    if (!PRESET_OPTIONS[presetName]) return;
    const presetValues = PRESET_OPTIONS[presetName];
    const baseDefaultsForPreset = { ...BASE_DEFAULT_OPTIONS };
    const combinedPresetConfig = { ...baseDefaultsForPreset, ...presetValues };
    combinedPresetConfig.preset = presetName;
    combinedPresetConfig.baseColor = rgbStringToHex(
      combinedPresetConfig.baseColor
    );
    combinedPresetConfig.useFullScreenHeight = false;

    Object.assign(config, combinedPresetConfig);

    waveAnimation.setOptions({
      preset: presetName,
      useFullScreenHeight: false,
    });

    gui.__controllers.forEach((controller) => {
      if (config.hasOwnProperty(controller.property)) {
        controller.setValue(config[controller.property]);
      }
    });

    if (presetController && presetController.property === "preset") {
      presetController.setValue(presetName);
    }
    setControllerVisibility(canvasHeightController, true);
    setControllerVisibility(fullScreenController, true); // Ensure fullscreen checkbox is visible
    // Make sure height controller is visible after preset load
    setControllerVisibility(
      canvasHeightController,
      !config.useFullScreenHeight
    );
  }

  // --- Add GUI Controls ---
  presetController = gui
    .add(config, "preset", Object.keys(PRESET_OPTIONS))
    .name("Preset")
    .onChange(applyPreset);

  const animFolder = gui.addFolder("Animation");
  animFolder
    .add(config, "speed", 1000, 30000, 500)
    .name("Speed (ms)")
    .onChange(() => waveAnimation.setOptions({ speed: config.speed }));
  animFolder
    .add(config, "waveDirectionMode", ["opposite", "forward", "backward"])
    .name("Direction Mode")
    .onChange(() =>
      waveAnimation.setOptions({ waveDirectionMode: config.waveDirectionMode })
    );
  animFolder.open();

  const appearanceFolder = gui.addFolder("Appearance");
  appearanceFolder
    .addColor(config, "baseColor")
    .name("Base Color")
    .onChange(() => {
      const rgbColorString = hexToRgbString(config.baseColor);
      waveAnimation.setOptions({ baseColor: rgbColorString });
    });
  appearanceFolder
    .add(config, "lineWidth", 0.5, 5, 0.1)
    .name("Line Width")
    .onChange(() => waveAnimation.setOptions({ lineWidth: config.lineWidth }));

  canvasHeightController = appearanceFolder
    .add(config, "canvasHeight", 100, 800, 10)
    .name("Canvas Height")
    .onChange(() => {
      if (!config.useFullScreenHeight) {
        waveAnimation.setOptions({ canvasHeight: config.canvasHeight });
      }
    });

  fullScreenController = appearanceFolder
    .add(config, "useFullScreenHeight")
    .name("Make canvas full screen")
    .onChange((isFullScreen) => {
      waveAnimation.setOptions({ useFullScreenHeight: isFullScreen });
      setControllerVisibility(canvasHeightController, !isFullScreen);
    });

  setControllerVisibility(canvasHeightController, !config.useFullScreenHeight);

  appearanceFolder
    .add(config, "overflowMargin", 0, 300, 10)
    .name("Overflow Margin")
    .onChange(() =>
      waveAnimation.setOptions({ overflowMargin: config.overflowMargin })
    );

  minOpacityController = appearanceFolder
    .add(config, "minOpacity", 0, 1, 0.01)
    .name("Min Opacity")
    .onChange(() => {
      if (config.minOpacity > config.maxOpacity) {
        config.maxOpacity = config.minOpacity;
        if (maxOpacityController)
          maxOpacityController.setValue(config.maxOpacity);
      }
      waveAnimation.setOptions({
        minOpacity: config.minOpacity,
        maxOpacity: config.maxOpacity,
      });
    });

  maxOpacityController = appearanceFolder
    .add(config, "maxOpacity", 0, 1, 0.01)
    .name("Max Opacity")
    .onChange(() => {
      if (config.maxOpacity < config.minOpacity) {
        config.minOpacity = config.maxOpacity;
        if (minOpacityController)
          minOpacityController.setValue(config.minOpacity);
      }
      waveAnimation.setOptions({
        minOpacity: config.minOpacity,
        maxOpacity: config.maxOpacity,
      });
    });

  appearanceFolder
    .addColor(config, "canvasBackgroundColor")
    .name("Canvas BG Color")
    .onChange((value) => {
      document.documentElement.style.setProperty("--canvas-bg-color", value);
    });
  appearanceFolder.open();

  const shapeFolder = gui.addFolder("Wave Shape");
  shapeFolder
    .add(config, "waveCount", 2, 40, 2)
    .name("Wave Count")
    .onChange(() => waveAnimation.setOptions({ waveCount: config.waveCount }));
  shapeFolder
    .add(config, "amplitude", 5, 100, 1)
    .name("Base Amplitude")
    .onChange(() => waveAnimation.setOptions({ amplitude: config.amplitude }));
  shapeFolder
    .add(config, "frequency", 0.0005, 0.01, 0.0001)
    .name("Frequency")
    .onChange(() => waveAnimation.setOptions({ frequency: config.frequency }));
  shapeFolder
    .add(config, "centerAmplitudeBoost")
    .name("Center Boost")
    .onChange(() =>
      waveAnimation.setOptions({
        centerAmplitudeBoost: config.centerAmplitudeBoost,
      })
    );
  shapeFolder.open();

  const staggerFolder = gui.addFolder("Staggering");
  staggerFolder
    .add(config, "amplitudeStagger", 0, 10, 0.1)
    .name("Amplitude Stagger")
    .onChange(() =>
      waveAnimation.setOptions({ amplitudeStagger: config.amplitudeStagger })
    );
  staggerFolder
    .add(config, "phaseStagger", 0, Math.PI / 2, 0.01)
    .name("Phase Stagger (rad)")
    .onChange(() =>
      waveAnimation.setOptions({ phaseStagger: config.phaseStagger })
    );
  staggerFolder
    .add(config, "yOffsetStagger", 0, 50, 1)
    .name("Y-Offset Stagger")
    .onChange(() =>
      waveAnimation.setOptions({ yOffsetStagger: config.yOffsetStagger })
    );
  staggerFolder.open();

  // --- Export Functionality ---
  function generateJsSnippet() {
    const exportOptions = { ...config };
    delete exportOptions.preset;
    delete exportOptions.canvasBackgroundColor; // Exclude UI-only state
    delete exportOptions.useFullScreenHeight; // Exclude UI control state

    if (
      exportOptions.baseColor &&
      typeof exportOptions.baseColor === "string" &&
      exportOptions.baseColor.startsWith("#")
    ) {
      exportOptions.baseColor = hexToRgbString(exportOptions.baseColor);
    }

    let optionsString = JSON.stringify(
      exportOptions,
      (key, value) => {
        if (typeof value === "number") {
          return parseFloat(value.toFixed(4));
        }
        return value;
      },
      2
    );
    optionsString = optionsString.replace(/"([^"]+)":/g, "$1:");

    const snippet = `
// 1. Include the WaveAnimation class (ensure Wave.js, constants.js, helpers.js are available too)
//    <script type="module" src="./js/WaveAnimation.js"></script> ...or however you manage modules.

// 2. Get your canvas element:
const canvasElement = document.getElementById('yourCanvasId'); // <-- CHANGE THIS ID

// 3. Create the animation instance:
if (canvasElement) {
  // Ensure the WaveAnimation class is available in this scope
  // If using modules, you might need: import { WaveAnimation } from './js/WaveAnimation.js';

  const waveAnim = new WaveAnimation(canvasElement, ${optionsString});

  // Optional: If you need to destroy it later
  // window.addEventListener('unload', () => waveAnim.destroy());

} else {
  console.error("Canvas element #yourCanvasId not found!");
}
`;
    exportOutput.textContent = snippet.trim();
  }

  exportButton.addEventListener("click", generateJsSnippet);
  generateJsSnippet(); // Initial generation

  // Export toggle
  const exportControls = document.querySelector(".export-controls");
  toggleExportButton.addEventListener("click", () => {
    exportControls.classList.toggle("collapsed");
  });

  // Optional: Cleanup on unload
  // window.addEventListener('beforeunload', () => {
  //     waveAnimation.destroy();
  //     if (gui) gui.destroy();
  // });
});
