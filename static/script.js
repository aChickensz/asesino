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

    // Clear and update the body content with the card
    document.body.innerHTML = '';
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
});

