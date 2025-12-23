const joinForm = document.getElementById('join-form');
const joinText = document.getElementById('join-text');
const playerNameInput = document.getElementById('player-name');
const queueSection = document.getElementById('queue-section');
const playerList = document.getElementById('player-list');

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
                console.log('Connection status mismatch - socket is connected but UI shows disconnected, updating...');
                updateConnectionStatus('connected', 'Connected');
            } else if (!actualConnected && currentState === 'connected') {
                console.log('Connection status mismatch - socket is disconnected but UI shows connected, updating...');
                updateConnectionStatus('disconnected', 'Disconnected');
            }
        }
    }, 2000); // Check every 2 seconds
}

function updateConnectionStatus(state, text) {
    const statusDiv = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-status-text');
    if (statusDiv && statusText) {
        statusDiv.className = state;
        statusText.textContent = text || state.charAt(0).toUpperCase() + state.slice(1);
    }
    // Also verify actual socket connection state
    console.log('Connection status updated to:', state, 'Actual socket.connected:', socket.connected);
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
    console.log('Joining with name: ', playerName);
    console.log('Socket connected:', socket.connected);
    console.log('Socket id:', socket.id);
    socket.emit('join', { name: playerName });
    console.log('Join event emitted');
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
    const storedCard = localStorage.getItem('assignedCard');
    const storedGameStarted = localStorage.getItem('gameStarted') === 'true';
    
    if (storedName) {
        playerName = storedName;
        if (playerNameInput) {
            playerNameInput.value = storedName;
        }
    }
    
    if (storedHasJoined && storedName) {
        hasJoined = true;
        // Wait for socket to be ready, then auto-join
        if (socket.connected) {
            console.log('restorePlayerState: Socket connected, emitting join for', storedName);
            socket.emit('join', { name: storedName });
            if (joinForm) joinForm.classList.add('hidden');
            if (joinText) joinText.classList.add('hidden');
            if (queueSection) queueSection.classList.remove('hidden');
            
            // Always request state from server to verify current game state
            // Don't trust localStorage - server is source of truth
            socket.emit('requestState', { name: storedName });
        } else {
            console.log('restorePlayerState: Socket not connected yet, will join on connect event');
        }
    }
    
    // Don't display card from localStorage immediately
    // Wait for server to confirm via stateRestored event
    // This prevents showing stale cards from previous game sessions
}

// Restore state when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restorePlayerState);
} else {
    restorePlayerState();
}


socket.on('connect', () => {
    console.log('Client connected to server, socket.id:', socket.id);
    console.log('Socket.connected:', socket.connected);
    updateConnectionStatus('connected', 'Connected');
    
    // Always try to rejoin if we have stored credentials
    // Don't check !hasJoined because restorePlayerState might have set it
    const storedName = localStorage.getItem('playerName');
    const storedHasJoined = localStorage.getItem('hasJoined') === 'true';
    
    console.log('On connect - storedName:', storedName, 'storedHasJoined:', storedHasJoined, 'hasJoined:', hasJoined);
    
    if (storedHasJoined && storedName) {
        playerName = storedName;
        hasJoined = true;
        console.log('Auto-joining with name:', storedName);
        socket.emit('join', { name: storedName });
        console.log('Auto-join event emitted on connect');
        if (joinForm) joinForm.classList.add('hidden');
        if (joinText) joinText.classList.add('hidden');
        if (queueSection) queueSection.classList.remove('hidden');
    }
    
    // Request state if game was started
    if (gameStarted && storedName) {
        console.log('Requesting state for game that was started');
        socket.emit('requestState', { name: storedName });
    }
});

socket.on('disconnect', () => {
    console.log('Client disconnected from server');
    updateConnectionStatus('disconnected', 'Disconnected');
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
    updateConnectionStatus('reconnecting', `Reconnecting... (${attemptNumber})`);
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected after ${attemptNumber} attempts`);
    updateConnectionStatus('connected', 'Connected');
    
    // Auto-rejoin after reconnection
    const storedName = localStorage.getItem('playerName');
    const storedHasJoined = localStorage.getItem('hasJoined') === 'true';
    
    if (storedHasJoined && storedName) {
        socket.emit('join', { name: storedName });
    }
    
    // Request state if game was started
    if (gameStarted && storedName) {
        socket.emit('requestState', { name: storedName });
    }
});

socket.on('reconnect_error', (error) => {
    console.log('Reconnection error:', error);
    updateConnectionStatus('reconnecting', 'Reconnecting...');
});

socket.on('reconnect_failed', () => {
    console.log('Reconnection failed');
    updateConnectionStatus('disconnected', 'Connection Failed');
});

socket.on('assignCard', (data) => {
    const card = data.card;
    console.log(`Received assignCard event with card: ${card}`);
    
    // Store card in localStorage
    localStorage.setItem('assignedCard', card);
    gameStarted = true;

    // Ensure the banner is displayed first
    const existingBanner = document.getElementById('new-cards-banner');
    if (existingBanner) existingBanner.remove(); // Remove any existing banner

    const banner = document.createElement('div');
    banner.id = 'new-cards-banner';
    banner.textContent = 'New Cards Received';
    banner.style.position = 'fixed';
    banner.style.top = '10px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.backgroundColor = '#333';
    banner.style.color = '#fff';
    banner.style.padding = '10px 20px';
    banner.style.borderRadius = '5px';
    banner.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    banner.style.zIndex = '1000';
    banner.style.fontSize = '1.2rem';
    banner.style.textAlign = 'center';

    // Add the banner to the root document element to ensure it persists
    document.documentElement.appendChild(banner);

    // Remove the banner after a short delay
    setTimeout(() => {
        banner.remove();
    }, 1000);

    // Clear the screen and display the player's card
    const cardImage = document.createElement('img');
    cardImage.src = `/static/images/${card}.svg`;
    cardImage.alt = `Your card`;
    cardImage.style.marginTop = '20px';
    cardImage.style.width = '200px'; // Adjust the size of the card
    cardImage.style.height = 'auto'; // Maintain aspect ratio

    // Clear and update the body content with the card (but preserve connection status)
    const connectionStatus = document.getElementById('connection-status');
    const statusParent = connectionStatus ? connectionStatus.parentNode : null;
    document.body.innerHTML = '';
    // Re-initialize connection status if it was removed
    if (!document.getElementById('connection-status')) {
        initConnectionStatus();
    }
    document.body.appendChild(cardImage);
});

socket.on('stateRestored', (data) => {
    console.log('State restored:', data);
    
    // Update game started state from server (server is source of truth)
    if (data.gameStarted !== undefined) {
        gameStarted = data.gameStarted;
        localStorage.setItem('gameStarted', data.gameStarted.toString());
        
        // If game hasn't started, clear any stale card data
        if (!data.gameStarted) {
            localStorage.removeItem('assignedCard');
        }
    }
    
    if (data.card) {
        // Server confirms we have a card - display it
        localStorage.setItem('assignedCard', data.card);
        gameStarted = true;
        
        const cardImage = document.createElement('img');
        cardImage.src = `/static/images/${data.card}.svg`;
        cardImage.alt = `Your card`;
        cardImage.style.marginTop = '20px';
        cardImage.style.width = '200px';
        cardImage.style.height = 'auto';
        
        document.body.innerHTML = '';
        // Re-initialize connection status if it was removed
        if (!document.getElementById('connection-status')) {
            initConnectionStatus();
        }
        document.body.appendChild(cardImage);
    } else if (data.gameStarted === false && hasJoined) {
        // Game hasn't started - ensure we show queue, not stale card
        // Clear any card display that might be showing
        const existingCard = document.querySelector('img[alt="Your card"]');
        if (existingCard) {
            // Restore the queue view
            document.body.innerHTML = '';
            if (!document.getElementById('connection-status')) {
                initConnectionStatus();
            }
            // Recreate the container structure
            const container = document.createElement('div');
            container.className = 'container';
            container.innerHTML = `
                <h1>Asesino</h1>
                <div id="queue-section">
                    <h2>Waiting for the game to start...</h2>
                    <ul id="player-list"></ul>
                </div>
            `;
            document.body.appendChild(container);
            // Re-attach event listeners might be needed, but queue should work
        }
    }
    
    if (data.players) {
        // Update player list
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
    
    if (data.gameStarted && !data.card && hasJoined) {
        // Game started but we don't have a card yet - show queue
        if (joinForm) joinForm.classList.add('hidden');
        if (joinText) joinText.classList.add('hidden');
        if (queueSection) queueSection.classList.remove('hidden');
    } else if (!data.gameStarted && hasJoined) {
        // Game hasn't started - show queue
        if (joinForm) joinForm.classList.add('hidden');
        if (joinText) joinText.classList.add('hidden');
        if (queueSection) queueSection.classList.remove('hidden');
    }
});

socket.on('updatePlayers', (data) => {
    console.log('updatePlayers event received:', data);
    const playerList = document.getElementById('player-list');
    if (playerList) {
        playerList.innerHTML = ''; // Clear current list

        // Add each player to the list
        data.players.forEach((player) => {
            const li = document.createElement('li');
            li.textContent = player;
            playerList.appendChild(li);
        });
        console.log(`Updated player list with ${data.players.length} players`);
    } else {
        console.error('player-list element not found!');
    }
});

socket.on('gameStarted', () => {
    gameStarted = true;
    localStorage.setItem('gameStarted', 'true');
});

socket.on('error', (data) => {
    console.error('Error:', data.message);

    // Display an inline error message
    const errorMessage = document.createElement('p');
    errorMessage.id = 'error-message';
    errorMessage.style.color = 'red';
    errorMessage.textContent = `Error: ${data.message}`;

    // Remove any existing error message
    const existingError = document.getElementById('error-message');
    if (existingError) existingError.remove();

    // Append the error message below the form
    joinForm.parentNode.insertBefore(errorMessage, joinForm.nextSibling);

    // Re-enable the form for a new submission
    joinForm.classList.remove('hidden');
    joinText.classList.remove('hidden');
    queueSection.classList.add('hidden');
    
    // Clear localStorage on error (name conflict, etc.)
    if (data.message.includes('already taken')) {
        localStorage.removeItem('hasJoined');
        hasJoined = false;
    }
});

