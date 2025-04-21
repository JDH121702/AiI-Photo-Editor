// This file will contain the JavaScript for the renderer process (the UI).

console.log('Renderer process loaded.');

// Get references to the relevant elements
const predefinedRadio = document.getElementById('style-approach-predefined');
const referenceRadio = document.getElementById('style-approach-reference');
const predefinedInputDiv = document.getElementById('predefined-style-input');
const referenceInputDiv = document.getElementById('reference-image-input');
const analyzeButton = document.getElementById('analyze-button');
const subjectTypeSelect = document.getElementById('subject-type-select');
const styleSelect = document.getElementById('style-select');
const settingsOutput = document.getElementById('settings-output');

// New elements for button-based file selection
const selectTargetButton = document.getElementById('select-target-button');
const targetFileDisplay = document.getElementById('target-file-display');
const selectReferenceButton = document.getElementById('select-reference-button');
const referenceFileDisplay = document.getElementById('reference-file-display');

// --- Event Listeners ---

// Function to toggle visibility of style input sections
function updateStyleInputVisibility() {
    if (predefinedRadio.checked) {
        predefinedInputDiv.style.display = 'block';
        referenceInputDiv.style.display = 'none';
    } else if (referenceRadio.checked) {
        predefinedInputDiv.style.display = 'none';
        referenceInputDiv.style.display = 'block';
    }
}
predefinedRadio.addEventListener('change', updateStyleInputVisibility);
referenceRadio.addEventListener('change', updateStyleInputVisibility);

// Button listeners for selecting files via main process dialog
selectTargetButton.addEventListener('click', async () => {
    console.log('Requesting target file selection...');
    const filePath = await window.electronAPI.handleSelectTargetImage();
    if (filePath) {
        console.log('Target file selected via main process:', filePath);
        // Display just the filename for brevity
        targetFileDisplay.textContent = filePath.split(/[\\/]/).pop();
    } else {
        console.log('Target file selection cancelled.');
        targetFileDisplay.textContent = '(No file selected)';
    }
});

selectReferenceButton.addEventListener('click', async () => {
    console.log('Requesting reference file selection...');
    const filePath = await window.electronAPI.handleSelectReferenceImage();
    if (filePath) {
        console.log('Reference file selected via main process:', filePath);
        // Display just the filename for brevity
        referenceFileDisplay.textContent = filePath.split(/[\\/]/).pop();
    } else {
        console.log('Reference file selection cancelled.');
        referenceFileDisplay.textContent = '(No file selected)';
    }
});


// Analyze button listener
analyzeButton.addEventListener('click', () => {
    console.log('Analyze button clicked!');
    settingsOutput.textContent = 'Sending request to backend...'; // Update status

    const subjectType = subjectTypeSelect.value;
    const styleApproach = document.querySelector('input[name="style-approach"]:checked').value;
    let styleValue = null;

    // Validation now happens primarily in the main process based on stored paths
    // We just need to ensure the user *intended* to select a reference if that mode is chosen

    const analysisData = {
        subjectType: subjectType,
        styleApproach: styleApproach,
        styleValue: null // Will be populated below if needed
    };

    if (styleApproach === 'predefined') {
        analysisData.styleValue = styleSelect.value;
        console.log('Selected Style:', analysisData.styleValue);
    } else if (styleApproach === 'reference') {
        // We assume the user selected a file if this mode is active.
        // Main process will error if the reference path wasn't actually set.
        console.log('Reference image style approach selected.');
    }

    // Send data (excluding paths) to the main process via IPC
    console.log('Sending analysis parameters to main process:', analysisData);
    window.electronAPI.analyzeImage(analysisData);
});

// --- IPC Listeners for Results/Errors ---

window.electronAPI.onAnalysisResult((result) => {
    console.log('Received analysis result:', result);
    // Format the result nicely. Assuming result is an object { setting: value, ... }
    let outputText = "Suggested Settings:\n";
    if (typeof result === 'object' && result !== null) {
        for (const [key, value] of Object.entries(result)) {
            outputText += `${key}: ${value}\n`;
        }
    } else {
        // Fallback for unexpected format or simple status messages
        outputText = `Received result:\n${JSON.stringify(result, null, 2)}`;
    }
    settingsOutput.textContent = outputText;
});

window.electronAPI.onAnalysisError((error) => {
    console.error('Received analysis error:', error);
    settingsOutput.textContent = `Error during analysis:\n${error}`;
});

// --- Initial Setup ---
updateStyleInputVisibility(); // Set initial visibility of style sections