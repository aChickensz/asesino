const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('admin-password');
const adminDashboard = document.getElementById('admin-dashboard');
const playerList = document.getElementById('admin-player-list');
const startGameBtn = document.getElementById('start-game-btn');

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
  const willPlay = document.getElementById('admin-play-checkbox').checked;
  const username = willPlay ? document.getElementById('admin-username').value.trim() : null;

  socket.emit('adminLogin', { password, username, willPlay });
});

socket.on('loginSuccess', () => {
  console.log('Login Success');
  loginForm.classList.add('hidden');
  adminDashboard.classList.remove('hidden');
});


// Start the game
startGameBtn.addEventListener('click', () => {
    const confirmation = confirm('Are you sure you want to start the game?');
    if (confirmation) {
        socket.emit('startGame');
        showNewCardsBanner(); // Show the banner when the game starts
    }
});
document.addEventListener("DOMContentLoaded", () => {
    socket.on('updatePlayers', (data) => {
        const playerQueue = document.getElementById('player-queue');
        if (!playerQueue) {
            console.error("Element with id 'player-queue' not found!");
            return;
        }
        playerQueue.innerHTML = ''; // Clear current list

        data.players.forEach((player) => {
            const li = document.createElement('li');
            li.textContent = player;
            playerQueue.appendChild(li);
        });
    });
});

socket.on('loginFailure', (data) => {
    alert(`Error: ${data.message}`);
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
    const card = data.card;
    console.log(`Admin received card: ${card}`);

    const cardContainer = document.getElementById('admin-card-container');

    // Remove any existing card display
    cardContainer.innerHTML = '';

    // Add the card image
    const cardImage = document.createElement('img');
    cardImage.src = `/static/images/${card}.svg`;
    cardImage.alt = `Your card`;
    cardImage.style.width = '150px'; // Optional: set width
    cardImage.style.height = 'auto'; // Maintain aspect ratio
    cardContainer.appendChild(cardImage);
});

socket.on('connect', () => {
    console.log('Client connected to server');
});
