const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const OpenAI = require('openai'); // Import OpenAI

// --- OpenAI Client Initialization ---
// IMPORTANT: Load API Key securely from environment variable
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120 * 1000, // Increased timeout to 120 seconds (2 minutes)
  });
  console.log('OpenAI client initialized.');
} else {
  console.error('FATAL ERROR: OPENAI_API_KEY environment variable not set.');
  // We could potentially quit the app or disable functionality here,
  // but for now, we'll let the analysis fail later if the key is missing.
}
// --- End OpenAI Client Initialization ---


let mainWindow; // Keep a reference to the main window
let currentTargetPath = null; // Store the path received from renderer
let currentReferencePath = null; // Store the path received from renderer

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({ // Assign to mainWindow
    width: 1000, // Increased width slightly
    height: 700, // Increased height slightly
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false // Recommended for security
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools (optional - useful for debugging)
  // mainWindow.webContents.openDevTools();
}

// --- IPC Handlers ---

// Handle requests from renderer to open file dialogs
async function handleFileOpen(options) {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
  if (canceled || filePaths.length === 0) {
    console.log('File selection cancelled.');
    return null;
  } else {
    console.log('File selected:', filePaths[0]);
    return filePaths[0];
  }
}

ipcMain.handle('dialog:selectTargetImage', async () => {
  const filePath = await handleFileOpen({
    title: 'Select Target RAW Image',
    buttonLabel: 'Select Target',
    properties: ['openFile'],
    filters: [
      { name: 'RAW Images', extensions: ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'pef', 'rw2'] }, // Add more as needed
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  currentTargetPath = filePath; // Store the path directly in main process
  return filePath; // Return path to renderer (for display)
});

ipcMain.handle('dialog:selectReferenceImage', async () => {
  const filePath = await handleFileOpen({
     title: 'Select Reference Image',
     buttonLabel: 'Select Reference',
     properties: ['openFile'],
     filters: [
       { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tiff'] },
       { name: 'All Files', extensions: ['*'] }
     ]
  });
  currentReferencePath = filePath; // Store the path directly in main process
  return filePath; // Return path to renderer (for display)
});

// Handler for the main analysis request
// Make the handler async to use await for OpenAI call
ipcMain.on('analyze-image-request', async (event, data) => {
  console.log('Main process received analyze request:', data);

  // Check if OpenAI client is initialized
  if (!openai) {
      const errorMsg = "OpenAI API Key not configured. Please set the OPENAI_API_KEY environment variable.";
      console.error(errorMsg);
      mainWindow.webContents.send('analysis-image-error', `Error: ${errorMsg}`);
      return;
  }

  // Paths are no longer in 'data', use stored paths
  const { subjectType, styleApproach, styleValue } = data;
  const targetPathToUse = currentTargetPath; // Use the stored path
  const referencePathToUse = currentReferencePath; // Use the stored path

  // --- Input Validation ---
  // Validate the *stored* target path
  if (typeof targetPathToUse !== 'string' || !targetPathToUse) {
    const errorMsg = `Target image path is not set or invalid: ${targetPathToUse}`;
    console.error(errorMsg);
    mainWindow.webContents.send('analysis-image-error', `Error: Please select a valid target RAW image first.`);
    return; // Stop processing
  }
  // Validate the *stored* reference path if needed
  if (styleApproach === 'reference' && (typeof referencePathToUse !== 'string' || !referencePathToUse)) {
     const errorMsg = `Reference image path is not set or invalid: ${referencePathToUse}`;
     console.error(errorMsg);
     mainWindow.webContents.send('analysis-image-error', `Error: Please select a valid reference image first.`);
     return; // Stop processing
  }
  // --- End Input Validation ---

  // 1. Define temporary output path for converted image
  const tempDir = os.tmpdir();
  // Ensure filename is safe for filesystem and URLs (replace spaces, etc.)
  const safeBaseName = path.basename(targetPathToUse).replace(/[^a-zA-Z0-9.-]/g, '_');
  const outputFileName = `converted-${Date.now()}-${safeBaseName}.png`; // Use PNG
  const convertedImagePath = path.join(tempDir, outputFileName);
  console.log(`Attempting to convert RAW to: ${convertedImagePath}`);

  // 2. Construct ImageMagick command
  const magickCommand = 'magick';
  const args = [ targetPathToUse, convertedImagePath ];

  // 3. Execute ImageMagick (Wrap in a Promise for async/await)
  const convertPromise = new Promise((resolve, reject) => {
      execFile(magickCommand, args, (error, stdout, stderr) => {
          if (error) {
              console.error(`ImageMagick execution error: ${error.message}`);
              console.error(`stderr: ${stderr}`);
              let userError = `Failed to convert RAW image. Error: ${error.message}`;
              if (error.message.includes('ENOENT')) {
                  userError = "Failed to convert RAW image. Please ensure ImageMagick is installed and accessible in your system's PATH.";
              }
              reject(userError); // Reject the promise with the error message
          } else {
              console.log(`ImageMagick conversion successful. Output at: ${convertedImagePath}`);
              console.log(`stdout: ${stdout}`);
              resolve(convertedImagePath); // Resolve the promise with the path
          }
      });
  });

  try {
      // Wait for conversion to finish
      const finalConvertedPath = await convertPromise;

      // --- 4. Prepare and Call OpenAI API ---
      console.log('Preparing OpenAI API call...');
      mainWindow.webContents.send('analysis-image-result', 'Conversion OK. Calling OpenAI...'); // Update status

      // Read the converted image file
      const targetImageBuffer = fs.readFileSync(finalConvertedPath);
      const targetImageBase64 = targetImageBuffer.toString('base64');

      // Construct the prompt messages
      const messages = [
          {
              role: "system",
              content: "You are an expert photo editor AI. Analyze the provided image(s) and suggest specific Adobe Lightroom Develop module settings (like Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Temperature, Tint, Vibrance, Saturation, HSL sliders, Color Grading wheels, etc.) to achieve the desired style. Provide the settings as a clear list or key-value pairs."
          },
          {
              role: "user",
              content: [] // Content will be added below
          }
      ];

      let userPromptText = `Analyze the target image (Subject: ${subjectType}). `;

      // Add style information to the prompt
      if (styleApproach === 'predefined') {
          userPromptText += `Suggest Lightroom settings to achieve a "${styleValue}" style.`;
          messages[1].content.push({ type: "text", text: userPromptText });
          messages[1].content.push({
              type: "image_url",
              image_url: { url: `data:image/png;base64,${targetImageBase64}`, detail: "low" } // Use low detail
          });
      } else if (styleApproach === 'reference') {
          userPromptText += `Suggest Lightroom settings to make the target image match the style and mood of the provided reference image.`;
          // Read and encode reference image
          const referenceImageBuffer = fs.readFileSync(referencePathToUse);
          const referenceImageBase64 = referenceImageBuffer.toString('base64');
          // Determine reference image type (basic check)
          const refExt = path.extname(referencePathToUse).toLowerCase();
          const refMimeType = refExt === '.png' ? 'image/png' : (refExt === '.jpg' || refExt === '.jpeg' ? 'image/jpeg' : 'image/webp'); // Add more if needed

          messages[1].content.push({ type: "text", text: userPromptText });
          messages[1].content.push({
              type: "image_url",
              image_url: { url: `data:image/png;base64,${targetImageBase64}`, detail: "low" } // Target image
          });
           messages[1].content.push({
              type: "image_url",
              image_url: { url: `data:${refMimeType};base64,${referenceImageBase64}`, detail: "low" } // Reference image
          });
      }

      console.log('Sending request to OpenAI API...');
      let completion;
      try {
          completion = await openai.chat.completions.create({
              model: "gpt-4o", // Use the appropriate vision model
              messages: messages,
              max_tokens: 500 // Adjust token limit as needed
          });
          console.log('OpenAI API raw response:', completion); // Log the full response
      } catch (apiError) {
          console.error("Error during OpenAI API call:", apiError);
          // Try to send a more specific error message if available
          let errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
          if (apiError instanceof OpenAI.APIError) {
              errorMessage = `OpenAI API Error: ${apiError.status} ${apiError.name} - ${apiError.message}`;
          }
          mainWindow.webContents.send('analysis-image-error', `Error calling OpenAI: ${errorMessage}`);
          // Clean up temp file even if API fails
          fs.unlink(finalConvertedPath, (err) => {
              if (err) console.error(`Error deleting temp file ${finalConvertedPath} after API error:`, err);
              else console.log(`Deleted temp file ${finalConvertedPath} after API error.`);
          });
          return; // Stop further processing in the outer try block
      }


      console.log('OpenAI API call successful.');
      const resultText = completion?.choices?.[0]?.message?.content;

      if (resultText) {
          console.log('OpenAI Result Text:', resultText);
          // Send the raw text result back for now
          mainWindow.webContents.send('analysis-image-result', resultText);
      } else {
          console.error("Received no text content from OpenAI response:", completion);
          throw new Error("Received empty or invalid response content from OpenAI."); // Let outer catch handle this
      }

      // --- 5. Cleanup Temporary File --- // Renumbered from 6 to 5
      fs.unlink(finalConvertedPath, (err) => {
          if (err) console.error(`Error deleting temp file ${finalConvertedPath}:`, err);
          else console.log(`Deleted temp file: ${finalConvertedPath}`);
      });

  } catch (error) {
      // Handle errors from conversion promise or OpenAI API call
      console.error('Error during analysis pipeline:', error);
      mainWindow.webContents.send('analysis-image-error', `Error: ${error}`);
  }
});
// --- End IPC Handler ---


// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});