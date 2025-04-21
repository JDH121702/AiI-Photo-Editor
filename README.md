# AI Photo Style Editor

An Electron-based desktop application designed to analyze RAW photos and suggest Adobe Lightroom Develop settings based on user-selected styles or reference images, leveraging the OpenAI GPT-4o API.

## Current Status

*   **Core Structure:** Basic Electron application structure is set up (`main.js`, `renderer.js`, `preload.js`, `index.html`, `style.css`).
*   **UI:** Basic user interface allows selecting target RAW images, subject types, predefined styles, and reference images.
*   **File Handling:** Uses Electron's `dialog` module for reliable file selection in the main process.
*   **RAW Conversion:** Integrates with the external command-line tool **ImageMagick** (`magick` command) to convert RAW files to PNG format for analysis.
*   **OpenAI Integration:** Includes setup for the OpenAI Node.js client and constructs prompts for the GPT-4o vision model, including Base64 encoded image data.
*   **Known Issue:** The OpenAI API call with image data is currently **hanging or timing out**, even with increased timeout settings. Basic text-only API calls work, indicating the issue lies within the image data handling or the asynchronous flow involving image conversion and the API call. This needs further debugging.

## Prerequisites

1.  **Node.js and npm:** Required for running the Electron application. Download from [nodejs.org](https://nodejs.org/).
2.  **ImageMagick:** Required for RAW image conversion. Download from [imagemagick.org](https://imagemagick.org/) and ensure the `magick` command is added to your system's PATH during installation.
3.  **OpenAI API Key:** You need an API key from OpenAI ([platform.openai.com](https://platform.openai.com/)).

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JDH121702/AiI-Photo-Editor.git
    cd AiI-Photo-Editor
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set OpenAI API Key:** Before running the application, set the `OPENAI_API_KEY` environment variable in your terminal session:
    *   **PowerShell:** `$env:OPENAI_API_KEY="your_actual_api_key"`
    *   **CMD:** `set OPENAI_API_KEY=your_actual_api_key`
    *   **Bash/Zsh:** `export OPENAI_API_KEY="your_actual_api_key"`
    (Replace `your_actual_api_key` with your real key).

## Running the App

1.  Make sure the API key is set in your current terminal session (see Setup step 3).
2.  Run the start command:
    ```bash
    npm start
    ```
3.  Use the UI to select files and options, then click "Analyze Image".

## Next Steps / Debugging

*   Investigate the root cause of the OpenAI API call timeout when image data is included.
    *   Check network configurations or potential blocking.
    *   Experiment with different image sizes or encoding methods.
    *   Further refine error handling around the API call.
*   Implement parsing of the OpenAI text response to extract settings into a structured format.
*   Improve UI/UX based on testing.
*   Package the application for distribution (e.g., using Electron Forge or Electron Builder).