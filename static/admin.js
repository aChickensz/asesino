const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('admin-password');
const adminDashboard = document.getElementById('admin-dashboard');
const startGameBtn = document.getElementById('start-game-btn');

// Admin state
let isAuthenticated = false;
let adminUsername = null;
let willPlay = false;

// Initialize connection status indicator
function initConnectionStatus() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    statusDiv.className = 'connected';
    statusDiv.innerHTML = '<span id="connection-status-dot"></span><span id="connection-status-text">Connected</span>';
    document.body.appendChild(statusDiv);
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

document.addEventListener("DOMContentLoaded", () => {
    const playCheckbox = document.getElementById('admin-play-checkbox');
    const usernameField = document.getElementById('admin-username');

    // Set the initial state based on the checkbox's default value
    usernameField.disabled = !playCheckbox.checked;
    usernameField.required = playCheckbox.checked;

    // Add the event listener to handle changes
    playCheckbox.addEventListener('change', function () {
        if (this.checked) {
            usernameField.disabled = false;
            usernameField.required = true;
        } else {
            usernameField.disabled = true;
            usernameField.required = false;
            usernameField.value = ''; // Clear the value
        }
    });
});

// Admin login
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = passwordInput.value;
  willPlay = document.getElementById('admin-play-checkbox').checked;
  adminUsername = willPlay ? document.getElementById('admin-username').value.trim() : null;

  // Store credentials in localStorage
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('adminPassword', password);
  localStorage.setItem('willPlay', willPlay.toString());
  if (adminUsername) {
    localStorage.setItem('adminUsername', adminUsername);
  }

  socket.emit('adminLogin', { password, username: adminUsername, willPlay });
});

// Auto-restore admin state from localStorage
function restoreAdminState() {
    const storedAuth = localStorage.getItem('isAuthenticated') === 'true';
    const storedPassword = localStorage.getItem('adminPassword');
    const storedWillPlay = localStorage.getItem('willPlay') === 'true';
    const storedUsername = localStorage.getItem('adminUsername');
    
    if (storedAuth && storedPassword) {
        isAuthenticated = true;
        willPlay = storedWillPlay;
        adminUsername = storedUsername;
        
        // Wait for socket to be ready, then auto-login
        if (socket.connected) {
            socket.emit('adminLogin', { 
                password: storedPassword, 
                username: adminUsername, 
                willPlay: storedWillPlay 
            });
        }
    }
}

// Restore state when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreAdminState);
} else {
    restoreAdminState();
}

socket.on('loginSuccess', () => {
  isAuthenticated = true;
  localStorage.setItem('isAuthenticated', 'true');
  loginForm.classList.add('hidden');
  adminDashboard.classList.remove('hidden');
  socket.emit('requestState');
});


// Start the game
startGameBtn.addEventListener('click', () => {
    const confirmation = confirm('Are you sure you want to start the game?');
    if (confirmation) {
        socket.emit('startGame');
        showNewCardsBanner(); // Show the banner when the game starts
    }
});
socket.on('updatePlayers', (data) => {
    const playerQueue = document.getElementById('player-queue');
    if (!playerQueue) return;
    playerQueue.innerHTML = '';
    data.players.forEach((player) => {
        const li = document.createElement('li');
        li.textContent = player;
        playerQueue.appendChild(li);
    });
});

socket.on('loginFailure', (data) => {
    alert(`Error: ${data.message}`);
    // Clear authentication state on failure
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('adminPassword');
    isAuthenticated = false;
});

// Function to show the "New Cards Received" banner
function showNewCardsBanner() {
    // Create the banner element
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

    // Add the banner to the document body
    document.body.appendChild(banner);

    // Remove the banner after a short delay (e.g., 1 second)
    setTimeout(() => {
        banner.remove();
    }, 1000);
}

socket.on('assignCard', (data) => {
    localStorage.setItem('adminCard', data.card);
    const cardContainer = document.getElementById('admin-card-container');
    cardContainer.innerHTML = '';
    const cardImage = document.createElement('img');
    cardImage.src = `/static/images/${data.card}.svg`;
    cardImage.alt = 'Your card';
    cardImage.style.cssText = 'width:150px;height:auto';
    cardContainer.appendChild(cardImage);
});

socket.on('stateRestored', (data) => {
    if (data.players) {
        const playerQueue = document.getElementById('player-queue');
        if (playerQueue) {
            playerQueue.innerHTML = '';
            data.players.forEach((player) => {
                const li = document.createElement('li');
                li.textContent = player;
                playerQueue.appendChild(li);
            });
        }
    }
    
    if (data.adminCard) {
        localStorage.setItem('adminCard', data.adminCard);
        const cardContainer = document.getElementById('admin-card-container');
        if (cardContainer) {
            cardContainer.innerHTML = '';
            const cardImage = document.createElement('img');
            cardImage.src = `/static/images/${data.adminCard}.svg`;
            cardImage.alt = 'Your card';
            cardImage.style.cssText = 'width:150px;height:auto';
            cardContainer.appendChild(cardImage);
        }
    }
});

socket.on('connect', () => {
    console.log('Client connected to server');
    updateConnectionStatus('connected', 'Connected');
    
    // Auto-reauthenticate if we were previously authenticated
    const storedAuth = localStorage.getItem('isAuthenticated') === 'true';
    const storedPassword = localStorage.getItem('adminPassword');
    const storedWillPlay = localStorage.getItem('willPlay') === 'true';
    const storedUsername = localStorage.getItem('adminUsername');
    
    if (storedAuth && storedPassword && !isAuthenticated) {
        isAuthenticated = true;
        willPlay = storedWillPlay;
        adminUsername = storedUsername;
        socket.emit('adminLogin', { 
            password: storedPassword, 
            username: adminUsername, 
            willPlay: storedWillPlay 
        });
    }
    
    // Request state after reconnection
    if (isAuthenticated) {
        socket.emit('requestState');
    }
});

socket.on('disconnect', () => {
    updateConnectionStatus('disconnected', 'Disconnected');
});

socket.on('reconnect_attempt', (attemptNumber) => {
    updateConnectionStatus('reconnecting', `Reconnecting... (${attemptNumber})`);
});

socket.on('reconnect', () => {
    updateConnectionStatus('connected', 'Connected');
    
    const storedAuth = localStorage.getItem('isAuthenticated') === 'true';
    const storedPassword = localStorage.getItem('adminPassword');
    const storedWillPlay = localStorage.getItem('willPlay') === 'true';
    const storedUsername = localStorage.getItem('adminUsername');
    
    if (storedAuth && storedPassword) {
        socket.emit('adminLogin', { 
            password: storedPassword, 
            username: storedUsername, 
            willPlay: storedWillPlay 
        });
    }
    
    if (isAuthenticated) {
        socket.emit('requestState');
    }
});

socket.on('reconnect_error', () => {
    updateConnectionStatus('reconnecting', 'Reconnecting...');
});

socket.on('reconnect_failed', () => {
    updateConnectionStatus('disconnected', 'Connection Failed');
});
