const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('admin-password');
const adminDashboard = document.getElementById('admin-dashboard');
const playerList = document.getElementById('admin-player-list');
const startGameBtn = document.getElementById('start-game-btn');

// Admin login
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const password = passwordInput.value;

  socket.emit('adminLogin', { password: password});
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


socket.on('connect', () => {
    console.log('Client connected to server');
});
