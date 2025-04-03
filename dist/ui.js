import * as dat from "dat.gui";
import { WaveAnimation } from "./WaveAnimation";
import { BASE_DEFAULT_OPTIONS, PRESET_OPTIONS } from "./constants";
import { rgbStringToHex, hexToRgbString } from "./helpers";
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("waveCanvas");
    const exportButton = document.getElementById("exportJsButton");
    const exportOutput = document.getElementById("exportOutput");
    const guiContainer = document.getElementById("gui-container");
    const toggleExportButton = document.getElementById("toggleExport");
    const exportControls = exportOutput === null || exportOutput === void 0 ? void 0 : exportOutput.closest(".export-controls");
    if (!canvas) {
        console.error("Canvas element #waveCanvas not found!");
        return;
    }
    if (!exportButton ||
        !exportOutput ||
        !guiContainer ||
        !toggleExportButton ||
        !exportControls) {
        console.error("One or more required UI elements are missing!");
        return;
    }
    if (typeof dat === "undefined") {
        console.error("dat.GUI library not loaded. Please ensure it is included before this script.");
        alert("dat.GUI not loaded! UI controls will not work.");
        return;
    }
    // --- Configuration Object for GUI ---
    const initialPresetName = BASE_DEFAULT_OPTIONS.preset;
    const initialPreset = PRESET_OPTIONS[initialPresetName] || {};
    const initialConfig = Object.assign(Object.assign(Object.assign({}, BASE_DEFAULT_OPTIONS), initialPreset), { preset: initialPresetName, canvasBackgroundColor: "#282828", baseColor: rgbStringToHex(BASE_DEFAULT_OPTIONS.baseColor) });
    // Use a type assertion for the config that will be mutated by the GUI
    const config = Object.assign({}, initialConfig);
    // --- Initialize Wave Animation ---
    const waveAnimation = new WaveAnimation(canvas, Object.assign(Object.assign({}, config), { 
        // Convert hex color back to RGB string for the animation class
        baseColor: hexToRgbString(config.baseColor) }));
    // --- Create GUI ---
    const gui = new dat.GUI({ autoPlace: false });
    guiContainer.appendChild(gui.domElement);
    let canvasHeightController;
    let fullScreenController;
    let presetController;
    let minOpacityController;
    let maxOpacityController;
    const setControllerVisibility = (controller, visible) => {
        if (controller === null || controller === void 0 ? void 0 : controller.domElement) {
            // Use optional chaining
            const parentLi = controller.domElement.closest("li");
            if (parentLi) {
                parentLi.style.display = visible ? "" : "none";
            }
        }
    };
    function applyPreset(presetName) {
        const presetValues = PRESET_OPTIONS[presetName] || {};
        const combinedPresetConfig = Object.assign(Object.assign(Object.assign({}, BASE_DEFAULT_OPTIONS), presetValues), { preset: presetName, baseColor: rgbStringToHex(presetValues.baseColor || BASE_DEFAULT_OPTIONS.baseColor), canvasBackgroundColor: config.canvasBackgroundColor, useFullScreenHeight: false });
        // Update the main config object
        Object.assign(config, combinedPresetConfig);
        // Update the animation with potentially converted color format
        waveAnimation.setOptions(Object.assign(Object.assign({}, combinedPresetConfig), { baseColor: hexToRgbString(config.baseColor) }));
        // Update GUI controllers to reflect the new config state
        gui.__controllers.forEach((controller) => {
            const prop = controller.property;
            if (prop in config) {
                // Type assertion needed because controller.property is string
                controller.setValue(config[prop]);
            }
        });
        // Ensure height controllers visibility is updated
        setControllerVisibility(canvasHeightController, !config.useFullScreenHeight);
        setControllerVisibility(fullScreenController, true); // Make sure fullscreen toggle is visible
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
        .onChange((value) => waveAnimation.setOptions({ speed: value }));
    animFolder
        .add(config, "waveDirectionMode", ["opposite", "forward", "backward"])
        .name("Direction Mode")
        .onChange((value) => waveAnimation.setOptions({ waveDirectionMode: value }));
    animFolder.open();
    const appearanceFolder = gui.addFolder("Appearance");
    appearanceFolder
        .addColor(config, "baseColor")
        .name("Base Color")
        .onChange((value) => {
        // GUI gives hex, animation expects RGB string
        waveAnimation.setOptions({ baseColor: hexToRgbString(value) });
    });
    appearanceFolder
        .add(config, "lineWidth", 0.5, 5, 0.1)
        .name("Line Width")
        .onChange((value) => waveAnimation.setOptions({ lineWidth: value }));
    canvasHeightController = appearanceFolder
        .add(config, "canvasHeight", 100, 800, 10)
        .name("Canvas Height")
        .onChange((value) => {
        if (!config.useFullScreenHeight) {
            waveAnimation.setOptions({ canvasHeight: value });
        }
    });
    fullScreenController = appearanceFolder
        .add(config, "useFullScreenHeight")
        .name("Make canvas full screen")
        .onChange((isFullScreen) => {
        waveAnimation.setOptions({ useFullScreenHeight: isFullScreen });
        setControllerVisibility(canvasHeightController, !isFullScreen);
    });
    // Set initial visibility based on config
    setControllerVisibility(canvasHeightController, !config.useFullScreenHeight);
    appearanceFolder
        .add(config, "overflowMargin", 0, 300, 10)
        .name("Overflow Margin")
        .onChange((value) => waveAnimation.setOptions({ overflowMargin: value }));
    minOpacityController = appearanceFolder
        .add(config, "minOpacity", 0, 1, 0.01)
        .name("Min Opacity")
        .onChange((value) => {
        if (value > config.maxOpacity) {
            config.maxOpacity = value;
            if (maxOpacityController)
                maxOpacityController.setValue(value);
        }
        waveAnimation.setOptions({
            minOpacity: value,
            maxOpacity: config.maxOpacity,
        });
    });
    maxOpacityController = appearanceFolder
        .add(config, "maxOpacity", 0, 1, 0.01)
        .name("Max Opacity")
        .onChange((value) => {
        if (value < config.minOpacity) {
            config.minOpacity = value;
            if (minOpacityController)
                minOpacityController.setValue(value);
        }
        waveAnimation.setOptions({
            minOpacity: config.minOpacity,
            maxOpacity: value,
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
        .onChange((value) => waveAnimation.setOptions({ waveCount: value }));
    shapeFolder
        .add(config, "amplitude", 5, 100, 1)
        .name("Base Amplitude")
        .onChange((value) => waveAnimation.setOptions({ amplitude: value }));
    shapeFolder
        .add(config, "frequency", 0.0005, 0.01, 0.0001)
        .name("Frequency")
        .onChange((value) => waveAnimation.setOptions({ frequency: value }));
    shapeFolder
        .add(config, "centerAmplitudeBoost")
        .name("Center Boost")
        .onChange((value) => waveAnimation.setOptions({ centerAmplitudeBoost: value }));
    shapeFolder.open();
    const staggerFolder = gui.addFolder("Staggering");
    staggerFolder
        .add(config, "amplitudeStagger", 0, 10, 0.1)
        .name("Amplitude Stagger")
        .onChange((value) => waveAnimation.setOptions({ amplitudeStagger: value }));
    staggerFolder
        .add(config, "phaseStagger", 0, Math.PI / 2, 0.01)
        .name("Phase Stagger (rad)")
        .onChange((value) => waveAnimation.setOptions({ phaseStagger: value }));
    staggerFolder
        .add(config, "yOffsetStagger", 0, 50, 1)
        .name("Y-Offset Stagger")
        .onChange((value) => waveAnimation.setOptions({ yOffsetStagger: value }));
    staggerFolder.open();
    // --- Export Functionality ---
    function generateJsSnippet() {
        // Create a clean options object based on the *current* animation state
        const exportOptions = Object.assign({}, waveAnimation.options);
        // Remove default values to keep snippet minimal
        Object.keys(exportOptions).forEach((key) => {
            if (key === "preset")
                return; // Keep preset if it was selected
            if (exportOptions[key] === BASE_DEFAULT_OPTIONS[key]) {
                delete exportOptions[key];
            }
        });
        // Remove internal/UI state not relevant for export
        delete exportOptions.useFullScreenHeight;
        // Format the options nicely
        let optionsString = JSON.stringify(exportOptions, null, 2)
            .replace(/"([^(")"]+)":/g, "$1:") // Remove quotes from keys
            .replace(/"/g, "'"); // Use single quotes for strings
        const snippet = `
const canvasElement = document.getElementById('yourCanvasId'); // Make sure to set your canvas ID
if (canvasElement instanceof HTMLCanvasElement) {
  // Assuming WaveAnimation class is available globally or imported
  const waveAnimation = new WaveAnimation(canvasElement, ${optionsString});
} else {
  console.error('Canvas element not found or is not a canvas!');
}
    `.trim();
        return snippet;
    }
    exportButton.addEventListener("click", () => {
        const snippet = generateJsSnippet();
        exportOutput.textContent = snippet;
        exportControls.classList.remove("collapsed"); // Ensure visible
        console.log("Generated JS Snippet:", snippet);
    });
    toggleExportButton.addEventListener("click", () => {
        exportControls.classList.toggle("collapsed");
    });
    // Initial generation for display
    // exportOutput.textContent = generateJsSnippet(); // Optional: generate on load
    exportControls.classList.add("collapsed"); // Start collapsed
});
