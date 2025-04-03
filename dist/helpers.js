// --- Helper Functions ---
export function rgbStringToHex(rgbString) {
    if (!rgbString || typeof rgbString !== "string")
        return "#ffffff"; // Default white on error
    const match = rgbString.match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    if (!match)
        return "#ffffff"; // Default white if format is wrong
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    // Clamp values to 0-255
    const clamp = (val) => Math.max(0, Math.min(255, val));
    const toHex = (c) => clamp(c).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
export function hexToRgbString(hex) {
    if (!hex || typeof hex !== "string" || !hex.startsWith("#"))
        return "255, 255, 255"; // Default white on error
    let r = 0, g = 0, b = 0;
    // 3 digits
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
        // 6 digits
    }
    else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    else {
        return "255, 255, 255"; // Default white on invalid length
    }
    return `${r}, ${g}, ${b}`;
}
