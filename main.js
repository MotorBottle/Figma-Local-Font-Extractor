const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

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
const defaultSettings = {
  rootFolderPath: app.getPath('documents'),  // Default path to user's Documents folder
};

let rootFolderPath = app.getPath('userData');
let dataFilePath = path.join(rootFolderPath, 'design_files_metadata.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    // Ensure settings are loaded and then send the path
    const settings = loadSettings();
    rootFolderPath = settings.rootFolderPath;
    mainWindow.webContents.send('folder-selected', rootFolderPath);
    sendDesignFileRecords(); // After ensuring the data file exists
  });

  mainWindow.once('ready-to-show', () => {
      mainWindow.show();
  });
}

app.whenReady().then(() => {
  setupIPCListeners();  // Ensure this is done before createWindow()
  const settings = loadSettings();
  rootFolderPath = settings.rootFolderPath;
  dataFilePath = path.join(rootFolderPath, 'design_files_metadata.json');
  createWindow();
  if (rootFolderPath) {
    mainWindow.webContents.send('folder-selected', rootFolderPath);
  }
  if (fs.existsSync(dataFilePath)) {
      sendDesignFileRecords();
  }
});


app.on('window-all-closed', () => {
  app.quit();
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
    const pythonProcess = spawn('python', [path.join(__dirname, 'GetFont.py'), fontFamiliesArg, destFolder]);
  
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

