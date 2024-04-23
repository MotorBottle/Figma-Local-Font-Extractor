const { ipcRenderer } = require('electron');

const selectFolderButton = document.getElementById('selectFolderButton');
const toggleServerButton = document.getElementById('toggleServerButton');
const designFileListContainer = document.getElementById('designFileList');
const currentPathDisplay = document.getElementById('currentPath');

// Event listener for selecting a folder
selectFolderButton.addEventListener('click', () => {
    ipcRenderer.send('select-folder');
});

// Event listener for toggling the server
toggleServerButton.addEventListener('click', () => {
    ipcRenderer.send('toggle-server'); // Adjust based on actual server start/stop functionality
});

// Update the design file list from the main process
ipcRenderer.on('update-design-file-list', (event, designFiles) => {
    designFileListContainer.innerHTML = '';
    designFiles.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'design-file-record';
        fileElement.innerHTML = `
            <div class="design-file-details">
                <div class="design-file-title">${file.fileName}</div>
                <div class="design-file-updated">Updated: ${file.lastUpdatedTime}</div>
                <div class="design-file-fonts">Fonts Used: ${file.fonts.join(', ')}</div>
            </div>
            <div class="design-file-actions">
                <img src="extract.svg" id="extract-${index}" class="extract-btn" alt="Extract Fonts" title="Extract Fonts">
                <img src="openDir.svg" id="open-${index}" class="open-btn" alt="Open Folder" title="Open Folder">
            </div>
        `;
        designFileListContainer.appendChild(fileElement);

        document.getElementById(`extract-${index}`).addEventListener('click', () => {
            ipcRenderer.send('find-and-copy-fonts', { fontFamilies: file.fonts, destFolderName: file.folderName });
        });
        
        document.getElementById(`open-${index}`).addEventListener('click', () => {
            ipcRenderer.send('open-folder', file.folderName);
        });
    });
});

// Handle the folder selection response
ipcRenderer.on('folder-selected', (event, path) => {
    if (path) {
        document.getElementById('currentPath').textContent = `Current Path: ${path}`;
    } else {
        document.getElementById('currentPath').textContent = 'Current Path: Not set';
    }
});

ipcRenderer.on('fonts-copied', (event, { status, message, count, copiedFiles }) => {
    console.log(status, message);
    if (status === 'Success') {
        alert(`Successfully copied ${count} font files.`);
    } else if (status === 'NoneCopied') {
        alert("No new fonts were copied, all fonts already exist in the destination.");
    } else {
        alert("An error occurred while copying fonts.");
    }
    // Additional logic as needed
});
  