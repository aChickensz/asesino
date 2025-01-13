const joinForm = document.getElementById('join-form');
const joinText = document.getElementById('join-text');
const playerNameInput = document.getElementById('player-name');
const queueSection = document.getElementById('queue-section');
const playerList = document.getElementById('player-list');

// Store player name locally
let playerName = '';

// Event listener for form submission
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  playerName = playerNameInput.value.trim();

  if (playerName) {
    // Send player name to server
    console.log('Joining with name: ', playerName);
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


socket.on('connect', () => {
    console.log('Client connected to server');
});

socket.on('assignCard', (data) => {
    const card = data.card;
    console.log(`Received card: ${card}`);

    // Display the card on the player's screen
    const cardImage = document.createElement('img');
    cardImage.src = `/static/images/${card}.svg`;
    cardImage.alt = `Your card: ${card}`;
    document.body.innerHTML = ''; // Clear the screen
    document.body.appendChild(cardImage);
});


socket.on('updatePlayers', (data) => {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = ''; // Clear current list

    // Add each player to the list
    data.players.forEach((player) => {
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);
    });
});

socket.on('error', (data) => {
    console.error('Error:', data.message);
});
