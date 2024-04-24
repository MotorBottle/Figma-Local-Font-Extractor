const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { exec } = require('child_process');


const server = express();
server.use(cors()); // This will allow all domains to access your server
const PORT = 3000; // Set a port for the local server

server.use(express.json()); // Middleware to parse JSON

server.post('/receive-data', (req, res) => {
  console.log("Received data:", req.body); // Ensure this logs the expected data
  if (mainWindow && mainWindow.webContents) {
    updateAndSendToRenderer(req.body); // Direct function call to handle data
  }
  res.send({ status: 'Success', message: 'Data received' });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Set a default path for the root folder where fonts and metadata will be stored
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const defaultFolderPath = path.join(app.getPath('downloads'), 'ExtractedFonts');
const defaultSettings = { rootFolderPath: defaultFolderPath };

// For development
// let pythonScriptPath = path.join(__dirname, 'GetFont.py');
// let pythonExecutablePath;
// if (process.platform === "win32") {
//   // Path for Windows bundled Python executable
//   pythonExecutablePath = path.join(__dirname, 'python', 'python.exe'); // For Windows
// } else {
//   // Default to system Python on macOS (and potentially other Unix-like systems)
//   pythonExecutablePath = 'python3';
// }

// For dist
let pythonScriptPath = path.join(process.resourcesPath, 'GetFont.py');
let pythonExecutablePath;
if (process.platform === "win32") {
  // Path for Windows bundled Python executable
  pythonExecutablePath = path.join(process.resourcesPath, 'python', 'python.exe'); // For Windows
} else {
  // Default to system Python on macOS (and potentially other Unix-like systems)
  pythonExecutablePath = 'python3';
}

let rootFolderPath = app.getPath('userData');
let dataFilePath = path.join(rootFolderPath, 'design_files_metadata.json');

let mainWindow;

async function initializeApp() {
    try {
        await checkAndInstallDependencies(); // Assuming this is promisified or synchronous
        setupIPCListeners(); // Setup IPC listeners for app communication
        initializeAppSettings(); // Load or set default settings
        createWindow();
    } catch (error) {
        console.error("Failed to initialize the application:", error);
        app.quit(); // Optionally quit the app if initialization fails critically
    }
}

app.whenReady().then(initializeApp);

function initializeAppSettings() {
  let settings = loadSettings();
  rootFolderPath = settings.rootFolderPath;
  dataFilePath = path.join(rootFolderPath, 'design_files_metadata.json');

  // Ensure the root folder and the JSON file exist
  if (!fs.existsSync(rootFolderPath)) {
      fs.mkdirSync(rootFolderPath, { recursive: true });
  }
  if (!fs.existsSync(dataFilePath)) {
      fs.writeFileSync(dataFilePath, JSON.stringify([]), 'utf-8');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      icon: path.join(__dirname, 'icon' + (process.platform === 'darwin' ? '.icns' : '.ico')), // Chooses .icns for Mac, .ico for others
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
      },
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.webContents.send('folder-selected', rootFolderPath);
      sendDesignFileRecords();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
      app.quit();
  }
});

function saveSettings(settings) {
  try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
      console.error("Failed to save settings:", error);
  }
}

function loadSettings() {
  try {
      let settings = defaultSettings;  // Start with default settings
      if (fs.existsSync(settingsPath)) {
          const settingsData = fs.readFileSync(settingsPath, 'utf-8');
          const loadedSettings = JSON.parse(settingsData);
          settings = { ...defaultSettings, ...loadedSettings }; // Override defaults with any loaded settings
      }
      return settings;
  } catch (error) {
      console.error("Failed to load settings:", error);
      return defaultSettings;  // Return defaults if there's an error reading the file
  }
}

function checkAndInstallDependencies() {
  return new Promise((resolve, reject) => {
    // let scriptPath = path.join(__dirname, process.platform === 'win32' ? 'install_dependencies.cmd' : 'check_and_install_fonttools.py');
    let scriptPath = path.join(process.resourcesPath, process.platform === 'win32' ? 'install_dependencies.cmd' : 'check_and_install_fonttools.py');

    if (process.platform !== 'win32') {
      // Try to set permissions on macOS/Linux before executing
      exec(`chmod +x "${scriptPath}"`, (chmodError) => {
        if (chmodError) {
          console.error(`Error setting permissions: ${chmodError}`);
          reject(chmodError);
          return;
        }
        executeDependencyScript(scriptPath, resolve, reject);
      });
    } else {
      executeDependencyScript(scriptPath, resolve, reject);
    }
  });
}

function executeDependencyScript(scriptPath, resolve, reject) {
  exec(`"${scriptPath}"`, (error, stdout, stderr) => {
    if (error || (stderr && !isIgnorableWarning(stderr))) {
      console.error(`Error executing dependency script: ${error || stderr}`);
      reject(error || new Error(stderr));
      return;
    }
    if (stderr) {
      console.warn(`Warnings during dependency check: ${stderr}`);
    }
    console.log(`Output from dependency script: ${stdout}`);
    resolve(stdout);
  });
}

// Helper function to determine if stderr content is an ignorable warning
function isIgnorableWarning(stderr) {
  // Define what warnings can be ignored (e.g., PATH warnings or known non-critical warnings)
  const ignorablePatterns = [
      /is not on PATH/i,
      /You are using pip version/i,
      /Consider adding this directory to PATH/i,
      /You should consider upgrading via/i
  ];
  return ignorablePatterns.some(pattern => pattern.test(stderr));
}



function generateUniqueFolderName(baseName) {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${baseName}-${suffix}`;
}

function findRecord(records, fileName, creationTime) {
  return records.find(record =>
      record.fileName === fileName && record.creationTime === creationTime);
}

function updateAndSendToRenderer(data) {
  // Assume records is managed here
  let records = [];
  if (fs.existsSync(dataFilePath)) {
      records = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  }

  const existingRecord = findRecord(records, data.fileName, data.creationTime);
  if (existingRecord) {
      existingRecord.fonts = data.fonts;
      existingRecord.lastUpdatedTime = data.lastUpdatedTime;
  } else {
      data.folderName = generateUniqueFolderName(data.fileName);
      const newFolderPath = path.join(rootFolderPath, data.folderName);
      if (!fs.existsSync(newFolderPath)) {
          fs.mkdirSync(newFolderPath);
      }
      records.push(data);
  }

  fs.writeFileSync(dataFilePath, JSON.stringify(records, null, 2));
  mainWindow.webContents.send('update-design-file-list', records);
}


function sendDesignFileRecords() {
  if (mainWindow) {
    const designFileRecords = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    mainWindow.webContents.send('update-design-file-list', designFileRecords);
  }
}

function setupIPCListeners() {
  ipcMain.on('select-folder', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
  
    if (!canceled && filePaths && filePaths.length > 0) {
      rootFolderPath = filePaths[0];
      dataFilePath = path.join(rootFolderPath, 'design_files_metadata.json');
      saveSettings({ rootFolderPath });  // Save settings after updating path
      sendDesignFileRecords();  // Send the updated records to the renderer
      event.reply('folder-selected', rootFolderPath);
    }
  });

  ipcMain.on('find-and-copy-fonts', (event, { fontFamilies, destFolderName }) => {
    const destFolder = path.join(rootFolderPath, destFolderName);
    // Ensure the destination folder exists
    if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
    }
  
    // Convert the font families array to a comma-separated string
    const fontFamiliesArg = fontFamilies.join(',');
  
    // Spawn the Python process
    const pythonProcess = spawn(pythonExecutablePath, [pythonScriptPath, fontFamiliesArg, destFolder]);
  
    pythonProcess.stdout.on('data', (data) => {
      // Parse the data received from the Python script
      try {
          const output = data.toString();
          const result = JSON.parse(output);
          if (result.copiedFiles && result.copiedFiles.length > 0) {
              // Fonts were copied, send a success message with the count
              event.reply('fonts-copied', {
                  status: 'Success',
                  message: 'Fonts copied successfully',
                  count: result.count,
                  copiedFiles: result.copiedFiles
              });
          } else {
              // No fonts were copied, inform the renderer
              event.reply('fonts-copied', {
                  status: 'NoneCopied',
                  message: 'No new fonts were copied, all fonts already exist in the destination.',
                  count: 0
              });
          }
      } catch (error) {
          // Handle JSON parsing errors
          console.error('Error parsing Python output:', error);
          event.reply('fonts-copied', { status: 'Error', message: 'Failed to parse output from Python script.' });
      }
    });
  
    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data.toString()}`);
        event.reply('fonts-copied', { status: 'Error', message: data.toString() });
    });
  
    pythonProcess.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);
    });
  });

  ipcMain.on('open-folder', (event, folderName) => {
      const folderPath = path.join(rootFolderPath, folderName);
      require('electron').shell.openPath(folderPath);
  });

  ipcMain.on('open-external-link', (event, url) => {
    shell.openExternal(url).catch(err => console.log('Failed to open URL:', err));
  });
}

