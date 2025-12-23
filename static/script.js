const joinForm = document.getElementById('join-form');
const joinText = document.getElementById('join-text');
const playerNameInput = document.getElementById('player-name');
const queueSection = document.getElementById('queue-section');

// Store player name locally
let playerName = '';
let hasJoined = false;
let gameStarted = false;

// Initialize connection status indicator
function initConnectionStatus() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    // Start with disconnected state - will update when actually connected
    const isConnected = socket && socket.connected;
    statusDiv.className = isConnected ? 'connected' : 'disconnected';
    statusDiv.innerHTML = '<span id="connection-status-dot"></span><span id="connection-status-text">' + (isConnected ? 'Connected' : 'Disconnected') + '</span>';
    document.body.appendChild(statusDiv);
    
    // Periodically verify connection status
    setInterval(() => {
        const actualConnected = socket && socket.connected;
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            const currentState = statusDiv.className;
            if (actualConnected && currentState !== 'connected') {
                updateConnectionStatus('connected', 'Connected');
            } else if (!actualConnected && currentState === 'connected') {
                updateConnectionStatus('disconnected', 'Disconnected');
            }
        }
    }, 2000);
}

function updateConnectionStatus(state, text) {
    const statusDiv = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-status-text');
    if (statusDiv && statusText) {
        statusDiv.className = state;
        statusText.textContent = text || state.charAt(0).toUpperCase() + state.slice(1);
    }
}

// Initialize on page load (ensure DOM is ready)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConnectionStatus);
} else {
    initConnectionStatus();
}

// Event listener for form submission
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  playerName = playerNameInput.value.trim();

  if (playerName) {
    // Store player name in localStorage
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('hasJoined', 'true');
    hasJoined = true;
    
    // Send player name to server
    socket.emit('join', { name: playerName });
    // Switch to queue section
    joinForm.classList.add('hidden');
    joinText.classList.add('hidden');
    queueSection.classList.remove('hidden');
  }
  else {
    console.error("Element with id 'player-name' not found!");
  }
});

// Auto-restore state from localStorage on page load
function restorePlayerState() {
    const storedName = localStorage.getItem('playerName');
    const storedHasJoined = localStorage.getItem('hasJoined') === 'true';
    
    if (storedName) {
        playerName = storedName;
        if (playerNameInput) {
            playerNameInput.value = storedName;
        }
    }
    
    if (storedHasJoined && storedName) {
        hasJoined = true;
        if (socket.connected) {
            socket.emit('join', { name: storedName });
            if (joinForm) joinForm.classList.add('hidden');
            if (joinText) joinText.classList.add('hidden');
            if (queueSection) queueSection.classList.remove('hidden');
            socket.emit('requestState', { name: storedName });
        }
    }
}

// Restore state when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restorePlayerState);
} else {
    restorePlayerState();
}


socket.on('connect', () => {
    updateConnectionStatus('connected', 'Connected');
    
    const storedName = localStorage.getItem('playerName');
    const storedHasJoined = localStorage.getItem('hasJoined') === 'true';
    
    if (storedHasJoined && storedName) {
        playerName = storedName;
        hasJoined = true;
        socket.emit('join', { name: storedName });
        if (joinForm) joinForm.classList.add('hidden');
        if (joinText) joinText.classList.add('hidden');
        if (queueSection) queueSection.classList.remove('hidden');
    }
    
    if (gameStarted && storedName) {
        socket.emit('requestState', { name: storedName });
    }
});

socket.on('disconnect', () => {
    updateConnectionStatus('disconnected', 'Disconnected');
});

socket.on('reconnect_attempt', (attemptNumber) => {
    updateConnectionStatus('reconnecting', `Reconnecting... (${attemptNumber})`);
});

socket.on('reconnect', (attemptNumber) => {
    updateConnectionStatus('connected', 'Connected');
    
    const storedName = localStorage.getItem('playerName');
    const storedHasJoined = localStorage.getItem('hasJoined') === 'true';
    
    if (storedHasJoined && storedName) {
        socket.emit('join', { name: storedName });
    }
    
    if (gameStarted && storedName) {
        socket.emit('requestState', { name: storedName });
    }
});

socket.on('reconnect_error', () => {
    updateConnectionStatus('reconnecting', 'Reconnecting...');
});

socket.on('reconnect_failed', () => {
    updateConnectionStatus('disconnected', 'Connection Failed');
});

socket.on('assignCard', (data) => {
    const card = data.card;
    localStorage.setItem('assignedCard', card);
    gameStarted = true;

    // Show banner
    const existingBanner = document.getElementById('new-cards-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'new-cards-banner';
    banner.textContent = 'New Cards Received';
    banner.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:5px;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:1000;font-size:1.2rem;text-align:center';
    document.documentElement.appendChild(banner);
    setTimeout(() => banner.remove(), 1000);

    // Display card
    const cardImage = document.createElement('img');
    cardImage.src = `/static/images/${card}.svg`;
    cardImage.alt = 'Your card';
    cardImage.style.cssText = 'margin-top:20px;width:200px;height:auto';
    document.body.innerHTML = '';
    if (!document.getElementById('connection-status')) {
        initConnectionStatus();
    }
    document.body.appendChild(cardImage);
});

socket.on('stateRestored', (data) => {
    if (data.gameStarted !== undefined) {
        gameStarted = data.gameStarted;
        localStorage.setItem('gameStarted', data.gameStarted.toString());
        if (!data.gameStarted) {
            localStorage.removeItem('assignedCard');
        }
    }
    
    if (data.card) {
        localStorage.setItem('assignedCard', data.card);
        gameStarted = true;
        const cardImage = document.createElement('img');
        cardImage.src = `/static/images/${data.card}.svg`;
        cardImage.alt = 'Your card';
        cardImage.style.cssText = 'margin-top:20px;width:200px;height:auto';
        document.body.innerHTML = '';
        if (!document.getElementById('connection-status')) {
            initConnectionStatus();
        }
        document.body.appendChild(cardImage);
    } else if (data.gameStarted === false && hasJoined) {
        const existingCard = document.querySelector('img[alt="Your card"]');
        if (existingCard) {
            document.body.innerHTML = '';
            if (!document.getElementById('connection-status')) {
                initConnectionStatus();
            }
            const container = document.createElement('div');
            container.className = 'container';
            container.innerHTML = '<h1>Asesino</h1><div id="queue-section"><h2>Waiting for the game to start...</h2><ul id="player-list"></ul></div>';
            document.body.appendChild(container);
        }
    }
    
    if (data.players) {
        const playerList = document.getElementById('player-list');
        if (playerList) {
            playerList.innerHTML = '';
            data.players.forEach((player) => {
                const li = document.createElement('li');
                li.textContent = player;
                playerList.appendChild(li);
            });
        }
    }
    
    if (hasJoined) {
        if (joinForm) joinForm.classList.add('hidden');
        if (joinText) joinText.classList.add('hidden');
        if (queueSection) queueSection.classList.remove('hidden');
    }
});

socket.on('updatePlayers', (data) => {
    const playerList = document.getElementById('player-list');
    if (playerList) {
        playerList.innerHTML = '';
        data.players.forEach((player) => {
            const li = document.createElement('li');
            li.textContent = player;
            playerList.appendChild(li);
        });
    }
});

socket.on('gameStarted', () => {
    gameStarted = true;
    localStorage.setItem('gameStarted', 'true');
});

socket.on('error', (data) => {
    const errorMessage = document.createElement('p');
    errorMessage.id = 'error-message';
    errorMessage.style.color = 'red';
    errorMessage.textContent = `Error: ${data.message}`;

    const existingError = document.getElementById('error-message');
    if (existingError) existingError.remove();

    joinForm.parentNode.insertBefore(errorMessage, joinForm.nextSibling);
    joinForm.classList.remove('hidden');
    joinText.classList.remove('hidden');
    queueSection.classList.add('hidden');
    
    if (data.message.includes('already taken')) {
        localStorage.removeItem('hasJoined');
        hasJoined = false;
    }
});

