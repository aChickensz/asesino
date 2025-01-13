from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import os
import random
from dotenv import load_dotenv

load_dotenv()

# Get sensitive variables from environment
SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'default-secret-key')  # Default if not set
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'default-password')
PORT = int(os.getenv('FLASK_PORT', 8080))  # Convert to integer for port
DOMAIN = os.getenv('DOMAIN', 'http://localhost')


app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
socketio = SocketIO(app, cors_allowed_origins="*")

# State management
players = []
admin_sid = None
player_to_card = {}

@app.route('/')
def main_page():
    return render_template('index.html', domain=DOMAIN)

@app.route('/admin')
def admin_page():
    return render_template('admin.html', domain=DOMAIN)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico')

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print('Client connected to websocket')

@socketio.on('disconnect')
def handle_disconnect():
    global players, admin_sid, player_to_card

    # Remove disconnected player/admin
    players = [player for player in players if player['sid'] != request.sid]
    if request.sid == admin_sid:
        admin_sid = None

    # Reset the card if the player leaves
    player_to_card.pop(request.sid, None)

    # Broadcast updated player list
    emit('updatePlayers', {'players': [player['name'] for player in players]}, broadcast=True)
    print('Client has disconnected')

@socketio.on('join')
def handle_join(data):
    global players

    name = data.get('name')
    if any(player['name'] == name for player in players):
        emit('error', {'message': 'Name already taken'}, room=request.sid)
        return

    # Add player to the list
    players.append({'name': name, 'sid': request.sid})
    emit('updatePlayers', {'players': [player['name'] for player in players]}, broadcast=True)

    print(f"Player {name} has joined the game")

@socketio.on('adminLogin')
def handle_admin_login(data):
    global admin_sid

    password = data.get('password')
    if password == ADMIN_PASSWORD:  # Replace with secure validation
        admin_sid = request.sid
        emit('updatePlayers', {'players': [player['name'] for player in players]}, room=admin_sid)
        emit('loginSuccess')
        print("Admin Joined")
    else:
        emit('loginFailure', {'message': 'Invalid password'})

@socketio.on('startGame')
def handle_start_game():
    global players, player_to_card

    # Ensure only the admin can start the game
    if request.sid != admin_sid:
        emit('error', {'message': 'Only the admin can start the game'}, room=request.sid)
        print("Non-admin attempted to start the game")
        return

    # Ensure there are enough players to start the game
    if len(players) < 2:
        emit('error', {'message': 'Not enough players to start the game'}, room=request.sid)
        print("Not enough players to start the game")
        return

    # Prepare the deck: 1 joker and the rest as random cards from card1.svg to card26.svg
    regular_cards = [f'card{i}' for i in range(1, 27)]
    cards = ['joker'] + random.sample(regular_cards, len(players) - 1)
    random.shuffle(cards)

    # Assign cards to players and emit the 'assignCard' event privately
    for player, card in zip(players, cards):
        player_to_card[player['sid']] = card
        emit('assignCard', {'card': card}, room=player['sid'])
        print(f"Assigned card '{card}' to player '{player['name']}'")

    # Broadcast that the game has started
    emit('gameStarted', broadcast=True)
    print("Game started, cards assigned")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=PORT)
