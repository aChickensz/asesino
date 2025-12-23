from flask import Flask, render_template, request, send_from_directory
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
players = []  # List of {'name': str, 'sid': str}
admin_sid = None
player_to_card = {}  # Maps player name to card
name_to_sid = {}  # Maps player name to current sid
game_started = False

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
    print(f'Client connected (sid: {request.sid})')

@socketio.on('disconnect')
def handle_disconnect():
    global players, admin_sid, player_to_card, name_to_sid

    # Find player by sid
    disconnected_player = next((p for p in players if p['sid'] == request.sid), None)
    
    if disconnected_player:
        # Remove from players list but keep card assignment (for reconnection)
        players = [player for player in players if player['sid'] != request.sid]
        # Don't remove from name_to_sid yet - will be updated on reconnect
        print(f"Player {disconnected_player['name']} disconnected (will keep state for reconnection)")
    
    if request.sid == admin_sid:
        admin_sid = None
        print('Admin disconnected')

    # Broadcast updated player list
    emit('updatePlayers', {'players': [player['name'] for player in players]}, broadcast=True)
    print('Client has disconnected')

@socketio.on('join')
def handle_join(data):
    global players, name_to_sid, player_to_card

    name = data.get('name')
    if not name:
        emit('error', {'message': 'Name is required'}, room=request.sid)
        return
    
    # Check if this is a reconnection (name exists but different sid)
    existing_player = next((p for p in players if p['name'] == name), None)
    
    if existing_player:
        # Reconnection: update the sid
        existing_player['sid'] = request.sid
        name_to_sid[name] = request.sid
        
        # If game started and player has a card, resend it
        if game_started and name in player_to_card:
            emit('assignCard', {'card': player_to_card[name]}, room=request.sid)
    else:
        # New player: check if name is taken by another active player
        if name in name_to_sid:
            old_sid = name_to_sid[name]
            # Check if the old sid is still in the players list (still connected)
            if any(p['sid'] == old_sid for p in players) and old_sid != request.sid:
                emit('error', {'message': 'Name already taken'}, room=request.sid)
                return
        
        # Add new player to the list
        players.append({'name': name, 'sid': request.sid})
        name_to_sid[name] = request.sid
    
    emit('updatePlayers', {'players': [player['name'] for player in players]}, broadcast=True)

@socketio.on('adminLogin')
def handle_admin_login(data):
    global admin_sid, players, name_to_sid, player_to_card, game_started

    password = data.get('password')
    will_play = data.get('willPlay', False)
    username = data.get('username')

    if password == ADMIN_PASSWORD:
        admin_sid = request.sid
        emit('loginSuccess', room=admin_sid)
        emit('updatePlayers', {'players': [player['name'] for player in players]}, room=admin_sid)

        # If admin is playing, ensure the username is unique or handle reconnection
        if will_play and username:
            existing_player = next((p for p in players if p['name'] == username), None)
            
            if existing_player:
                # Reconnection: update sid
                existing_player['sid'] = admin_sid
                name_to_sid[username] = admin_sid
                if game_started and username in player_to_card:
                    emit('assignCard', {'card': player_to_card[username]}, room=admin_sid)
            else:
                # New admin player
                if any(player['name'] == username for player in players):
                    emit('loginFailure', {'message': 'Username already taken'}, room=request.sid)
                    return

                players.append({'name': username, 'sid': admin_sid})
                name_to_sid[username] = admin_sid
                emit('updatePlayers', {'players': [player['name'] for player in players]}, broadcast=True)
    else:
        emit('loginFailure', {'message': 'Invalid password'}, room=request.sid)

@socketio.on('startGame')
def handle_start_game():
    global players, player_to_card, game_started, name_to_sid

    if request.sid != admin_sid:
        emit('error', {'message': 'Only the admin can start the game'}, room=request.sid)
        return

    if len(players) < 2:
        emit('error', {'message': 'Not enough players to start the game'}, room=request.sid)
        return

    # Prepare the deck: 1 joker and the rest random cards
    regular_cards = [f'card{i}' for i in range(1, 27)]
    cards = ['joker'] + random.sample(regular_cards, len(players) - 1)
    random.shuffle(cards)

    # Assign cards to players (track by name, not sid)
    for player, card in zip(players, cards):
        player_to_card[player['name']] = card
        emit('assignCard', {'card': card}, room=player['sid'])

    game_started = True
    emit('gameStarted', broadcast=True)

@socketio.on('requestState')
def handle_request_state(data=None):
    """Handle state restoration requests from clients"""
    global players, player_to_card, game_started, admin_sid, name_to_sid
    
    # Determine if this is from admin or player
    is_admin = request.sid == admin_sid
    
    if is_admin:
        # Admin requesting state
        response = {
            'players': [player['name'] for player in players],
            'gameStarted': game_started
        }
        
        # If admin is playing, include their card
        admin_player = next((p for p in players if p['sid'] == admin_sid), None)
        if admin_player and admin_player['name'] in player_to_card:
            response['adminCard'] = player_to_card[admin_player['name']]
        
        emit('stateRestored', response, room=request.sid)
    else:
        # Player requesting state
        player_name = data.get('name') if data else None
        
        if not player_name:
            # Try to find player by sid
            player = next((p for p in players if p['sid'] == request.sid), None)
            if player:
                player_name = player['name']
        
        if player_name:
            response = {
                'players': [player['name'] for player in players],
                'gameStarted': game_started
            }
            
            # If game started and player has a card, include it
            if game_started and player_name in player_to_card:
                response['card'] = player_to_card[player_name]
            
            emit('stateRestored', response, room=request.sid)
        else:
            emit('error', {'message': 'Player name not found'}, room=request.sid)

if __name__ == '__main__':
    CERT_FILE = os.path.expanduser('~/ssl/cert.pem')
    KEY_FILE = os.path.expanduser('~/ssl/key.pem')
    
    # Check if SSL files exist
    ssl_context = None
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        ssl_context = (CERT_FILE, KEY_FILE)
        print(f"Using SSL certificates: {CERT_FILE}, {KEY_FILE}")
    else:
        print(f"Warning: SSL certificates not found at {CERT_FILE} and {KEY_FILE}")
        print("Running without SSL (HTTP only)")
    
    # Port 443 requires root privileges
    # Check if we're root, and handle port selection accordingly
    try:
        is_root = os.geteuid() == 0
    except AttributeError:
        # Windows doesn't have geteuid()
        is_root = False
    
    # Determine which port to use
    if PORT == 443 and not is_root:
        print("Warning: Port 443 requires root privileges.")
        print("To use port 443, run with: sudo python3 app.py")
        print("Falling back to port 8443 (or set FLASK_PORT in .env)")
        server_port = 8443
    else:
        server_port = PORT
    
    print(f"Starting server on port {server_port}...")
    try:
        socketio.run(
            app,
            host='0.0.0.0',
            port=server_port,
            ssl_context=ssl_context,
            allow_unsafe_werkzeug=True  # Allow development server
        )
    except PermissionError:
        print(f"\nError: Permission denied binding to port {server_port}")
        print("Ports below 1024 require root privileges.")
        print(f"Please either:")
        print(f"  1. Run with sudo: sudo python3 app.py")
        print(f"  2. Use a higher port: Set FLASK_PORT=8443 in your .env file")
        raise
    except OSError as e:
        if "Permission denied" in str(e) or e.errno == 13:
            print(f"\nError: Permission denied binding to port {server_port}")
            print("Ports below 1024 require root privileges.")
            print(f"Please either:")
            print(f"  1. Run with sudo: sudo python3 app.py")
            print(f"  2. Use a higher port: Set FLASK_PORT=8443 in your .env file")
        raise
