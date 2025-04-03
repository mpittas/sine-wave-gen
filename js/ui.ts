import * as dat from "dat.gui";
import { WaveAnimation } from "./WaveAnimation";
import { BASE_DEFAULT_OPTIONS, PRESET_OPTIONS, WaveOptions } from "./constants";
import { rgbStringToHex, hexToRgbString } from "./helpers";

// Define a type for the UI-specific configuration, extending WaveOptions
interface UIConfig extends Required<WaveOptions> {
  canvasBackgroundColor: string;
  preset: keyof typeof PRESET_OPTIONS;
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById(
    "waveCanvas"
  ) as HTMLCanvasElement | null;
  const exportButton = document.getElementById(
    "exportJsButton"
  ) as HTMLButtonElement | null;
  const exportOutput = document.getElementById(
    "exportOutput"
  ) as HTMLPreElement | null;
  const guiContainer = document.getElementById(
    "gui-container"
  ) as HTMLElement | null;
  const toggleExportButton = document.getElementById(
    "toggleExport"
  ) as HTMLButtonElement | null;
  const exportControls = exportOutput?.closest(
    ".export-controls"
  ) as HTMLElement | null;

  if (!canvas) {
    console.error("Canvas element #waveCanvas not found!");
    return;
  }
  if (
    !exportButton ||
    !exportOutput ||
    !guiContainer ||
    !toggleExportButton ||
    !exportControls
  ) {
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
  const initialPresetName =
    BASE_DEFAULT_OPTIONS.preset as keyof typeof PRESET_OPTIONS;
  const initialPreset = PRESET_OPTIONS[initialPresetName] || {};
  const initialConfig: UIConfig = {
    ...BASE_DEFAULT_OPTIONS,
    ...initialPreset,
    preset: initialPresetName, // Ensure preset name is part of initial config
    canvasBackgroundColor: "#282828",
    baseColor: rgbStringToHex(BASE_DEFAULT_OPTIONS.baseColor), // Convert initial baseColor to hex for GUI
  };

  // Use a type assertion for the config that will be mutated by the GUI
  const config: UIConfig = { ...initialConfig };

  // --- Initialize Wave Animation ---
  const waveAnimation = new WaveAnimation(canvas, {
    ...config,
    // Convert hex color back to RGB string for the animation class
    baseColor: hexToRgbString(config.baseColor),
  });

  // --- Create GUI ---
  const gui = new dat.GUI({ autoPlace: false });
  guiContainer.appendChild(gui.domElement);

  let canvasHeightController: dat.GUIController | undefined;
  let fullScreenController: dat.GUIController | undefined;
  let presetController: dat.GUIController | undefined;
  let minOpacityController: dat.GUIController | undefined;
  let maxOpacityController: dat.GUIController | undefined;

  const setControllerVisibility = (
    controller: dat.GUIController | undefined,
    visible: boolean
  ): void => {
    if (controller?.domElement) {
      // Use optional chaining
      const parentLi = controller.domElement.closest("li");
      if (parentLi) {
        parentLi.style.display = visible ? "" : "none";
      }
    }
  };

  function applyPreset(presetName: keyof typeof PRESET_OPTIONS): void {
    const presetValues = PRESET_OPTIONS[presetName] || {};
    const combinedPresetConfig = {
      ...BASE_DEFAULT_OPTIONS,
      ...presetValues,
      preset: presetName,
      baseColor: rgbStringToHex(
        presetValues.baseColor || BASE_DEFAULT_OPTIONS.baseColor
      ),
      canvasBackgroundColor: config.canvasBackgroundColor, // Keep current bg color
      useFullScreenHeight: false, // Presets disable fullscreen
    };

    // Update the main config object
    Object.assign(config, combinedPresetConfig);

    // Update the animation with potentially converted color format
    waveAnimation.setOptions({
      ...combinedPresetConfig,
      baseColor: hexToRgbString(config.baseColor), // Send RGB string
    });

    // Update GUI controllers to reflect the new config state
    gui.__controllers.forEach((controller) => {
      const prop = controller.property as keyof UIConfig;
      if (prop in config) {
        // Type assertion needed because controller.property is string
        controller.setValue((config as any)[prop]);
      }
    });

    // Ensure height controllers visibility is updated
    setControllerVisibility(
      canvasHeightController,
      !config.useFullScreenHeight
    );
    setControllerVisibility(fullScreenController, true); // Make sure fullscreen toggle is visible
  }

  // --- Add GUI Controls ---
  presetController = gui
    .add(
      config,
      "preset",
      Object.keys(PRESET_OPTIONS) as Array<keyof typeof PRESET_OPTIONS>
    )
    .name("Preset")
    .onChange(applyPreset);

  const animFolder = gui.addFolder("Animation");
  animFolder
    .add(config, "speed", 1000, 30000, 500)
    .name("Speed (ms)")
    .onChange((value: number) => waveAnimation.setOptions({ speed: value }));
  animFolder
    .add(config, "waveDirectionMode", ["opposite", "forward", "backward"])
    .name("Direction Mode")
    .onChange((value: "opposite" | "forward" | "backward") =>
      waveAnimation.setOptions({ waveDirectionMode: value })
    );
  animFolder.open();

  const appearanceFolder = gui.addFolder("Appearance");
  appearanceFolder
    .addColor(config, "baseColor")
    .name("Base Color")
    .onChange((value: string) => {
      // GUI gives hex, animation expects RGB string
      waveAnimation.setOptions({ baseColor: hexToRgbString(value) });
    });
  appearanceFolder
    .add(config, "lineWidth", 0.5, 5, 0.1)
    .name("Line Width")
    .onChange((value: number) =>
      waveAnimation.setOptions({ lineWidth: value })
    );

  canvasHeightController = appearanceFolder
    .add(config, "canvasHeight", 100, 800, 10)
    .name("Canvas Height")
    .onChange((value: number) => {
      if (!config.useFullScreenHeight) {
        waveAnimation.setOptions({ canvasHeight: value });
      }
    });

  fullScreenController = appearanceFolder
    .add(config, "useFullScreenHeight")
    .name("Make canvas full screen")
    .onChange((isFullScreen: boolean) => {
      waveAnimation.setOptions({ useFullScreenHeight: isFullScreen });
      setControllerVisibility(canvasHeightController, !isFullScreen);
    });

  // Set initial visibility based on config
  setControllerVisibility(canvasHeightController, !config.useFullScreenHeight);

  appearanceFolder
    .add(config, "overflowMargin", 0, 300, 10)
    .name("Overflow Margin")
    .onChange((value: number) =>
      waveAnimation.setOptions({ overflowMargin: value })
    );

  minOpacityController = appearanceFolder
    .add(config, "minOpacity", 0, 1, 0.01)
    .name("Min Opacity")
    .onChange((value: number) => {
      if (value > config.maxOpacity) {
        config.maxOpacity = value;
        if (maxOpacityController) maxOpacityController.setValue(value);
      }
      waveAnimation.setOptions({
        minOpacity: value,
        maxOpacity: config.maxOpacity,
      });
    });

  maxOpacityController = appearanceFolder
    .add(config, "maxOpacity", 0, 1, 0.01)
    .name("Max Opacity")
    .onChange((value: number) => {
      if (value < config.minOpacity) {
        config.minOpacity = value;
        if (minOpacityController) minOpacityController.setValue(value);
      }
      waveAnimation.setOptions({
        minOpacity: config.minOpacity,
        maxOpacity: value,
      });
    });

  appearanceFolder
    .addColor(config, "canvasBackgroundColor")
    .name("Canvas BG Color")
    .onChange((value: string) => {
      document.documentElement.style.setProperty("--canvas-bg-color", value);
    });
  appearanceFolder.open();

  const shapeFolder = gui.addFolder("Wave Shape");
  shapeFolder
    .add(config, "waveCount", 2, 40, 2)
    .name("Wave Count")
    .onChange((value: number) =>
      waveAnimation.setOptions({ waveCount: value })
    );
  shapeFolder
    .add(config, "amplitude", 5, 100, 1)
    .name("Base Amplitude")
    .onChange((value: number) =>
      waveAnimation.setOptions({ amplitude: value })
    );
  shapeFolder
    .add(config, "frequency", 0.0005, 0.01, 0.0001)
    .name("Frequency")
    .onChange((value: number) =>
      waveAnimation.setOptions({ frequency: value })
    );
  shapeFolder
    .add(config, "centerAmplitudeBoost")
    .name("Center Boost")
    .onChange((value: boolean) =>
      waveAnimation.setOptions({ centerAmplitudeBoost: value })
    );
  shapeFolder.open();

  const staggerFolder = gui.addFolder("Staggering");
  staggerFolder
    .add(config, "amplitudeStagger", 0, 10, 0.1)
    .name("Amplitude Stagger")
    .onChange((value: number) =>
      waveAnimation.setOptions({ amplitudeStagger: value })
    );
  staggerFolder
    .add(config, "phaseStagger", 0, Math.PI / 2, 0.01)
    .name("Phase Stagger (rad)")
    .onChange((value: number) =>
      waveAnimation.setOptions({ phaseStagger: value })
    );
  staggerFolder
    .add(config, "yOffsetStagger", 0, 50, 1)
    .name("Y-Offset Stagger")
    .onChange((value: number) =>
      waveAnimation.setOptions({ yOffsetStagger: value })
    );
  staggerFolder.open();

  // --- Export Functionality ---
  function generateJsSnippet(): string {
    // Create a clean options object based on the *current* animation state
    const exportOptions: Partial<WaveOptions> = { ...waveAnimation.options };

    // Remove default values to keep snippet minimal
    (Object.keys(exportOptions) as Array<keyof WaveOptions>).forEach((key) => {
      if (key === "preset") return; // Keep preset if it was selected
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
