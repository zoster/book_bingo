// Constants
const BOARD_SIZE = 5;
const STORAGE_KEY = 'bookBingoBoard';
const TITLE_KEY = 'bingoCardTitle';
const COMPANY_COLORS = {
    primary: '#e74f26',
    secondary: '#1e2632',
    dark: '#2a3342'
};

const STATUS_TYPES = {
    DONE: 'done',
    PLANNED: 'planned',
    IN_PROGRESS: 'in-progress'
};

let boardState = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
let selectedCellIndex = null;
let dropOverlay = document.getElementById('dropOverlay');
let isEditingTitle = false;

// Initialize the board
function initBoard() {
    const grid = document.getElementById('bingoGrid');
    grid.innerHTML = '';
    
    // Load saved title
    const savedTitle = localStorage.getItem(TITLE_KEY);
    if (savedTitle) {
        document.getElementById('pageTitle').innerHTML = savedTitle;
    }
    
    // Load saved state
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            // Ensure we have the right structure
            boardState = parsed.map(item => {
                if (!item) return null;
                
                return {
                    dataUrl: item.dataUrl,
                    fileName: item.fileName || 'book-cover.jpg',
                    status: item.status || STATUS_TYPES.DONE
                };
            });
        } catch (e) {
            console.error('Error loading saved state:', e);
            boardState = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
        }
    } else {
        boardState = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    }
    
    // Create grid cells
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const cell = createBingoCell(i);
        grid.appendChild(cell);
        
        // Load existing book cover with saved status
        if (boardState[i] && boardState[i].dataUrl) {
            loadBookIntoCell(i, boardState[i].dataUrl, boardState[i].fileName, boardState[i].status);
        }
    }
    
    setupEventListeners();
    showStateIndicator('Ready! Click a square to add a book cover');
}

// Create a bingo cell with all elements
function createBingoCell(index) {
    const cell = document.createElement('div');
    cell.className = 'bingo-cell';
    cell.dataset.index = index;
    
    // Placeholder content
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.innerHTML = `
        <div class="placeholder-icon">📚</div>
    `;
    
    // Book cover image
    const img = document.createElement('img');
    img.className = 'book-cover';
    img.alt = 'Book cover';
    
    // Status badge
    const statusBadge = document.createElement('div');
    statusBadge.className = 'status-badge';
    
    // Status menu
    const statusMenu = document.createElement('div');
    statusMenu.className = 'status-menu';
    statusMenu.innerHTML = `
        <div class="status-option planned" data-status="${STATUS_TYPES.PLANNED}">Planned</div>
        <div class="status-option in-progress" data-status="${STATUS_TYPES.IN_PROGRESS}">Reading</div>
        <div class="status-option done" data-status="${STATUS_TYPES.DONE}">Done</div>
    `;
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeBook(index);
    };
    
    // Status menu click handlers
    statusMenu.querySelectorAll('.status-option').forEach(option => {
        option.onclick = (e) => {
            e.stopPropagation();
            const status = e.target.dataset.status;
            setBookStatus(index, status);
        };
    });
    
    // Click handler for cell selection
    cell.onclick = (e) => {
        if (!e.target.closest('.status-menu') && !e.target.closest('.remove-btn')) {
            selectCell(index);
        }
    };
    
    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        cell.addEventListener(eventName, handleDragDrop);
    });
    
    cell.appendChild(placeholder);
    cell.appendChild(img);
    cell.appendChild(statusBadge);
    cell.appendChild(statusMenu);
    cell.appendChild(removeBtn);
    
    return cell;
}

// Setup global event listeners
function setupEventListeners() {
    // Setup global paste listener
    document.addEventListener('paste', handlePaste);
    
    // Setup global drag and drop
    document.addEventListener('dragenter', showDropOverlay);
    document.addEventListener('dragleave', (e) => {
        if (e.clientX <= 0 || e.clientY <= 0 || 
            e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            hideDropOverlay();
        }
    });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        hideDropOverlay();
        if (selectedCellIndex !== null) {
            handleFileDrop(e.dataTransfer.files[0], selectedCellIndex);
        }
    });
    
    // Setup title edit listener
    document.addEventListener('click', (e) => {
        if (isEditingTitle && !e.target.closest('.title-container')) {
            saveTitleEdit();
        }
    });
}

// Set book reading status
function setBookStatus(index, status) {
    if (!boardState[index]) return;
    
    console.log(`Setting status for book ${index} to ${status}`);
    
    boardState[index].status = status;
    updateCellStatus(index, status);
    saveState();
    
    const statusText = {
        [STATUS_TYPES.DONE]: 'Done',
        [STATUS_TYPES.PLANNED]: 'Planned',
        [STATUS_TYPES.IN_PROGRESS]: 'In Progress'
    }[status];
    
    showStateIndicator(`Book status updated to: ${statusText}`);
}

// Update cell display for status
function updateCellStatus(index, status) {
    const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
    const badge = cell.querySelector('.status-badge');
    const img = cell.querySelector('.book-cover');
    const menuOptions = cell.querySelectorAll('.status-option');
    
    // Update cell class
    cell.classList.remove('status-planned', 'status-in-progress', 'status-done');
    if (status !== STATUS_TYPES.DONE) {
        cell.classList.add(`status-${status}`);
    }
    
    // Update badge
    badge.className = 'status-badge ' + status;
    badge.textContent = status === STATUS_TYPES.IN_PROGRESS ? 'Reading' : 
                       status === STATUS_TYPES.PLANNED ? 'Planned' : 
                       'Done';
    
    // Update menu options
    menuOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.status === status) {
            option.classList.add('active');
        }
    });
    
    // Update image opacity and blur
    if (status !== STATUS_TYPES.DONE) {
        img.style.opacity = '0.5';
        img.style.filter = 'blur(4px)';
    } else {
        img.style.opacity = '1';
        img.style.filter = 'none';
    }
}

// Load book into cell with proper parameter handling
function loadBookIntoCell(index, dataUrl, fileName, status) {
    const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
    const img = cell.querySelector('.book-cover');
    
    // Validate and normalize parameters
    if (!status || !(Object.values(STATUS_TYPES).includes(status))) {
        status = STATUS_TYPES.DONE;
    }
    
    if (!fileName || typeof fileName !== 'string') {
        fileName = 'book-cover.jpg';
    }
    
    // Save to board state FIRST (before image loads)
    boardState[index] = {
        dataUrl: dataUrl,
        fileName: fileName,
        status: status
    };
    
    // Save immediately
    saveState();
    
    // Load image
    img.onload = () => {
        cell.classList.add('has-book', 'book-added');
        updateCellStatus(index, status);
    };
    
    img.onerror = () => {
        console.error('Error loading image');
        showStateIndicator('Error loading image');
        // Remove from state if image fails to load
        boardState[index] = null;
        saveState();
    };
    
    img.src = dataUrl;
    
    // Apply status immediately (in case img.onload never fires)
    cell.classList.add('has-book', 'book-added');
    updateCellStatus(index, status);
}

// Start editing title
function startTitleEdit() {
    if (isEditingTitle) return;
    
    const titleElement = document.getElementById('pageTitle');
    const currentTitle = titleElement.textContent.replace(/\s+/g, ' ').trim();
    const titleContainer = document.getElementById('titleContainer');
    
    titleContainer.classList.add('editing');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'title-input';
    input.value = currentTitle;
    input.placeholder = "Enter your bingo card title...";
    input.maxLength = 50;
    
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            saveTitleEdit();
        } else if (e.key === 'Escape') {
            cancelTitleEdit();
        }
    };
    
    input.onblur = () => {
        setTimeout(saveTitleEdit, 100);
    };
    
    titleElement.innerHTML = '';
    titleElement.appendChild(input);
    input.focus();
    input.select();
    
    isEditingTitle = true;
}

// Save title edit
function saveTitleEdit() {
    if (!isEditingTitle) return;
    
    const input = document.querySelector('.title-input');
    const titleContainer = document.getElementById('titleContainer');
    const titleElement = document.getElementById('pageTitle');
    
    let newTitle = input.value.trim();
    if (newTitle === '') {
        newTitle = '📚 My Book Bingo';
    }
    
    // Add emoji if not present
    if (!newTitle.includes('📚') && !newTitle.includes('🎯')) {
        newTitle = '📚 ' + newTitle;
    }
    
    titleElement.innerHTML = newTitle;
    titleContainer.classList.remove('editing');
    
    // Save to localStorage
    localStorage.setItem(TITLE_KEY, newTitle);
    
    isEditingTitle = false;
    showStateIndicator('Title updated!');
}

// Cancel title edit
function cancelTitleEdit() {
    if (!isEditingTitle) return;
    
    const titleContainer = document.getElementById('titleContainer');
    const titleElement = document.getElementById('pageTitle');
    const savedTitle = localStorage.getItem(TITLE_KEY) || '📚 My Book Bingo';
    
    titleElement.innerHTML = savedTitle;
    titleContainer.classList.remove('editing');
    
    isEditingTitle = false;
}

// Select a cell
function selectCell(index) {
    // Deselect previous cell
    if (selectedCellIndex !== null) {
        const prevCell = document.querySelector(`.bingo-cell[data-index="${selectedCellIndex}"]`);
        prevCell.classList.remove('selected');
    }
    
    // Select new cell
    selectedCellIndex = index;
    const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
    cell.classList.add('selected');
    
    showStateIndicator(`Square ${Math.floor(index/5)+1}-${(index%5)+1} selected. Drop or paste a book cover!`);
}

// Handle drag and drop events
function handleDragDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
        this.style.borderColor = COMPANY_COLORS.primary;
        this.style.background = `rgba(${parseInt(COMPANY_COLORS.primary.slice(1, 3), 16)}, ${parseInt(COMPANY_COLORS.primary.slice(3, 5), 16)}, ${parseInt(COMPANY_COLORS.primary.slice(5, 7), 16)}, 0.1)`;
    } else if (e.type === 'dragleave') {
        this.style.borderColor = '';
        this.style.background = '';
    } else if (e.type === 'drop') {
        this.style.borderColor = '';
        this.style.background = '';
        const index = parseInt(this.dataset.index);
        selectCell(index);
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileDrop(files[0], index);
        }
    }
}

// Show drop overlay
function showDropOverlay(e) {
    if (e.dataTransfer.types.includes('Files')) {
        dropOverlay.classList.add('active');
    }
}

// Hide drop overlay
function hideDropOverlay() {
    dropOverlay.classList.remove('active');
}

// Handle paste from clipboard
function handlePaste(e) {
    if (selectedCellIndex === null) return;
    
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
                handleFileDrop(file, selectedCellIndex);
                e.preventDefault();
                break;
            }
        }
    }
}

// Compress image before saving to localStorage
async function compressImage(dataUrl, maxWidth = 300, maxHeight = 300) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => {
            // If compression fails, return the original
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
}

// Handle file drop
async function handleFileDrop(file, index) {
    if (!file || !file.type.match('image.*')) {
        showStateIndicator('Please drop an image file (JPEG, PNG, etc.)');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showStateIndicator('Image too large! Please use images under 5MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        // Compress image before saving
        const compressedDataUrl = await compressImage(e.target.result);
        const fileName = file.name || `book-${Date.now()}.jpg`;
        loadBookIntoCell(index, compressedDataUrl, fileName, STATUS_TYPES.DONE);
        showStateIndicator(`Book cover added to square ${Math.floor(index/5)+1}-${(index%5)+1}`);
    };
    reader.readAsDataURL(file);
}

// Remove book from cell
function removeBook(index) {
    const cell = document.querySelector(`.bingo-cell[data-index="${index}"]`);
    const img = cell.querySelector('.book-cover');
    img.src = '';
    img.style.opacity = '1';
    img.style.filter = 'none';
    cell.classList.remove('has-book', 'book-added', 'status-planned', 'status-in-progress', 'status-done');
    boardState[index] = null;
    saveState();
    showStateIndicator('Book removed');
}

// Clear all books
function clearAllBooks() {
    if (confirm('Are you sure you want to remove all book covers?')) {
        boardState = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
        document.querySelectorAll('.bingo-cell').forEach(cell => {
            const img = cell.querySelector('.book-cover');
            img.src = '';
            img.style.opacity = '1';
            img.style.filter = 'none';
            cell.classList.remove('has-book', 'book-added', 'status-planned', 'status-in-progress', 'status-done');
        });
        saveState();
        showStateIndicator('All books cleared');
    }
}

// Save state to localStorage
function saveState() {
    try {
        // Ensure we're saving valid data
        const stateToSave = boardState.map(item => {
            if (!item) return null;
            
            // Make sure all required fields exist
            return {
                dataUrl: item.dataUrl,
                fileName: item.fileName || 'book-cover.jpg',
                status: item.status || STATUS_TYPES.DONE
            };
        });
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
        console.error('Error saving state:', e);
        showStateIndicator('Error saving progress');
        
        // Try to clear localStorage if it's full
        if (e.name === 'QuotaExceededError') {
            alert('Local storage is full. Clearing old data...');
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

// Show state indicator
function showStateIndicator(message) {
    const indicator = document.getElementById('stateIndicator');
    indicator.textContent = message;
    indicator.style.opacity = '1';
    
    setTimeout(() => {
        indicator.style.opacity = '0.8';
    }, 3000);
}

// Clear all data (reset board)
function clearAllData() {
    if (confirm('Are you sure you want to completely reset the board? This will clear ALL data including the title and cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TITLE_KEY);
        boardState = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
        initBoard();
        showStateIndicator('All data cleared and board reset');
    }
}

// Generate the bingo card image
async function generateBingoCard() {
    const generateBtn = document.getElementById('generateBtn');
    const originalText = generateBtn.innerHTML;
    
    // Count books
    const bookCount = boardState.filter(book => book !== null).length;
    if (bookCount === 0) {
        showStateIndicator('Add some books first!');
        return;
    }
    
    generateBtn.innerHTML = '<span>⏳</span> Generating...';
    generateBtn.classList.add('generating');
    
    try {
        // Create canvas for the grid
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Canvas dimensions
        const cellWidth = 200;
        const cellHeight = 300;
        const gap = 10;
        const padding = 40;
        
        const totalWidth = (cellWidth * BOARD_SIZE) + (gap * (BOARD_SIZE - 1)) + (padding * 2);
        const totalHeight = (cellHeight * BOARD_SIZE) + (gap * (BOARD_SIZE - 1)) + (padding * 2);
        
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        
        // Draw background with company colors
        const gradient = ctx.createLinearGradient(0, 0, totalWidth, totalHeight);
        gradient.addColorStop(0, COMPANY_COLORS.secondary);
        gradient.addColorStop(1, COMPANY_COLORS.dark);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
        
        // Draw grid background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(padding - 10, padding - 10, 
                    totalWidth - (padding - 10) * 2, 
                    totalHeight - (padding - 10) * 2);
        
        // Get title
        const title = document.getElementById('pageTitle').textContent;
        
        // Draw cells and collect promises
        const promises = [];
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const index = row * BOARD_SIZE + col;
                const x = padding + col * (cellWidth + gap);
                const y = padding + row * (cellHeight + gap);
                
                // Draw cell background
                ctx.fillStyle = boardState[index] ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(x, y, cellWidth, cellHeight);
                
                if (boardState[index]) {
                    // Load and draw book cover with status
                    const bookPromise = drawBookCoverWithStatus(
                        ctx, 
                        boardState[index].dataUrl, 
                        boardState[index].status,
                        x, y, cellWidth, cellHeight
                    ).catch(error => {
                        console.error(`Error drawing cover at [${row},${col}]:`, error);
                        drawPlaceholderCover(ctx, boardState[index].status, x, y, cellWidth, cellHeight);
                    });
                    promises.push(bookPromise);
                } else {
                    // Draw placeholder
                    drawPlaceholderCover(ctx, STATUS_TYPES.DONE, x, y, cellWidth, cellHeight);
                }
            }
        }
        
        // Wait for all images to load
        await Promise.allSettled(promises);
        
        // Draw title with company colors
        ctx.fillStyle = COMPANY_COLORS.primary;
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(title, totalWidth/2, 30);
        ctx.shadowBlur = 0;
        
        // Draw date
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'italic 18px Arial';
        const currentDate = new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
        ctx.fillText(`Generated on ${currentDate}`, totalWidth/2, totalHeight - 20);
        
        // Update preview
        updatePreview(canvas.toDataURL('image/jpeg', 0.95));
        
        generateBtn.innerHTML = '<span>✅</span> Generated!';
        showStateIndicator('Bingo card generated! Download or share it.');
        
        setTimeout(() => {
            generateBtn.innerHTML = originalText;
            generateBtn.classList.remove('generating');
        }, 2000);
        
    } catch (error) {
        console.error('Error generating bingo card:', error);
        generateBtn.innerHTML = originalText;
        generateBtn.classList.remove('generating');
        showStateIndicator('Error generating card. Please try again.');
    }
}

// Draw book cover with status badge
function drawBookCoverWithStatus(ctx, dataUrl, status, x, y, width, height) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            try {
                // Draw book cover
                const padding = 10;
                const coverX = x + padding;
                const coverY = y + padding;
                const coverWidth = width - padding * 2;
                const coverHeight = height - padding * 2;
                
                // Calculate dimensions
                const imgRatio = img.width / img.height;
                const coverRatio = coverWidth / coverHeight;
                
                let sourceX = 0;
                let sourceY = 0;
                let sourceWidth = img.width;
                let sourceHeight = img.height;
                
                // Calculate crop to fill the cover area
                if (imgRatio > coverRatio) {
                    sourceHeight = img.height;
                    sourceWidth = sourceHeight * coverRatio;
                    sourceX = (img.width - sourceWidth) / 2;
                } else {
                    sourceWidth = img.width;
                    sourceHeight = sourceWidth / coverRatio;
                    sourceY = (img.height - sourceHeight) / 2;
                }
                
                // Apply opacity and blur for non-done status
                if (status !== STATUS_TYPES.DONE) {
                    ctx.globalAlpha = 0.5;
                    // Create temporary canvas for blur effect
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCanvas.width = coverWidth;
                    tempCanvas.height = coverHeight;
                    
                    // Draw image to temp canvas
                    tempCtx.drawImage(
                        img,
                        sourceX, sourceY, sourceWidth, sourceHeight,
                        0, 0, coverWidth, coverHeight
                    );
                    
                    // Apply blur to temp canvas
                    tempCtx.filter = 'blur(4px)';
                    tempCtx.drawImage(tempCanvas, 0, 0);
                    
                    // Draw blurred image to main canvas
                    ctx.drawImage(tempCanvas, coverX, coverY);
                } else {
                    // Draw normal image for done status
                    ctx.drawImage(
                        img,
                        sourceX, sourceY, sourceWidth, sourceHeight,
                        coverX, coverY, coverWidth, coverHeight
                    );
                }
                
                // Reset alpha
                ctx.globalAlpha = 1;
                
                if (status !== STATUS_TYPES.DONE) {
                    // Draw status badge
                    const badgeText = status === STATUS_TYPES.IN_PROGRESS ? 'READING' : 'PLANNED';
                    
                    const badgeColor = status === STATUS_TYPES.PLANNED ? '#3498db' : '#f39c12';
                    
                    // Draw badge background
                    ctx.fillStyle = badgeColor;
                    const badgeWidth = coverWidth;
                    const badgeX = x + (width - badgeWidth) / 2;
                    const badgeY = y + 100;
                    
                    // Rounded rectangle for badge
                    const radius = 30;
                    const badgeHeight = 60;
                    ctx.beginPath();
                    ctx.moveTo(badgeX + radius, badgeY);
                    ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
                    ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
                    ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
                    ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
                    ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
                    ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
                    ctx.lineTo(badgeX, badgeY + radius);
                    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
                    ctx.closePath();
                    ctx.fill();
                    
                    // Draw badge text
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(badgeText, x + width/2, badgeY + 30);
                }
                
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = reject;
        img.src = dataUrl;
        
        setTimeout(() => {
            if (!img.complete) reject(new Error('Image load timeout'));
        }, 5000);
    });
}

// Draw placeholder cover with status
function drawPlaceholderCover(ctx, status, x, y, width, height) {
    const padding = 10;
    const coverX = x + padding;
    const coverY = y + padding;
    const coverWidth = width - padding * 2;
    const coverHeight = height - padding * 2;
    
    // Draw placeholder icon
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.font = '100px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📚', coverX + coverWidth/2, coverY + coverHeight/2);    
}

// Update preview
function updatePreview(dataUrl) {
    const previewSection = document.getElementById('previewSection');
    const previewGrid = document.getElementById('previewGrid');
    
    // Create preview image
    previewGrid.innerHTML = '';
    const previewImg = document.createElement('img');
    previewImg.src = dataUrl;
    previewImg.style.width = '100%';
    previewImg.style.borderRadius = '5px';
    previewGrid.appendChild(previewImg);
    
    // Store the data URL for download
    previewGrid.dataset.imageUrl = dataUrl;
    
    // Show preview section
    previewSection.classList.add('active');
}

// Download bingo card
function downloadBingoCard() {
    const previewGrid = document.getElementById('previewGrid');
    const dataUrl = previewGrid.dataset.imageUrl;
    
    if (!dataUrl) {
        showStateIndicator('Please generate a bingo card first');
        return;
    }
    
    // Get title for filename
    const title = document.getElementById('pageTitle').textContent
        .replace(/[^\w\s]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
    
    const filename = title || 'book-bingo';
    
    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.jpg`;
    link.href = dataUrl;
    link.click();
    
    showStateIndicator('Bingo card downloaded!');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initBoard);
