import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from shared.network import NetworkManager
from shared.protocol import MessageType
from viewer import RemoteDesktopViewer
import threading
import time
import pygame
import json

class RemoteDesktopClient:
    def __init__(self, host, port):
        self.network = NetworkManager(host, port)
        self.viewer = RemoteDesktopViewer()
        self.running = False
        
        # Register message handlers
        self.network.register_callback(MessageType.SCREEN_DATA, self.handle_screen_data)
        self.network.register_callback(MessageType.CLIPBOARD_DATA, self.handle_clipboard)
        self.network.register_callback(MessageType.AUTH_RESPONSE, self.handle_auth_response)

    def start(self):
        """Start the client"""
        self.running = True
        self.network.connect()
        
        # Send authentication (dummy)
        auth_data = {'username': 'client', 'password': 'password'}
        self.network.send_message(MessageType.AUTH_REQUEST, auth_data)
        
        # Start input handling
        threading.Thread(target=self.handle_user_input, daemon=True).start()
        
        # Start screen viewer
        self.viewer.start()
        print("Remote Desktop Client started")

    def stop(self):
        """Stop the client"""
        self.running = False
        self.network.stop()
        self.viewer.stop()
        print("Remote Desktop Client stopped")

    def handle_screen_data(self, data, sock):
        """Handle incoming screen data"""
        try:
            frame = bytes.fromhex(data['frame'])
            self.viewer.update_frame(frame)
        except Exception as e:
            print(f"Error handling screen data: {e}")

    def handle_clipboard(self, data, sock):
        """Handle clipboard data"""
        # In production, implement clipboard syncing
        pass

    def handle_auth_response(self, data, sock):
        """Handle authentication response"""
        if data.get('success'):
            print("Authentication successful")
        else:
            print(f"Authentication failed: {data.get('message')}")
            self.stop()

    def handle_user_input(self):
        """Handle user input events"""
        pygame.init()
        pygame.display.set_caption('Remote Desktop')
        
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.stop()
                elif event.type == pygame.MOUSEMOTION:
                    self.send_mouse_event('move', pygame.mouse.get_pos())
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    button = 'left' if event.button == 1 else 'right' if event.button == 3 else 'middle'
                    self.send_mouse_event('click', pygame.mouse.get_pos(), button, 'down')
                elif event.type == pygame.MOUSEBUTTONUP:
                    button = 'left' if event.button == 1 else 'right' if event.button == 3 else 'middle'
                    self.send_mouse_event('click', pygame.mouse.get_pos(), button, 'up')
                elif event.type == pygame.KEYDOWN:
                    key_name = pygame.key.name(event.key)
                    self.send_keyboard_event(key_name, 'down')
                elif event.type == pygame.KEYUP:
                    key_name = pygame.key.name(event.key)
                    self.send_keyboard_event(key_name, 'up')
            
            time.sleep(0.01)

    def send_mouse_event(self, action, pos, button='left', sub_action=None):
        """Send mouse event to server"""
        event_data = {
            'action': action,
            'pos': pos,
            'button': button
        }
        
        if sub_action:
            event_data['sub_action'] = sub_action
            
        if action == 'scroll':
            event_data['amount'] = button  # Using button as scroll amount for simplicity
            
        self.network.send_message(MessageType.MOUSE_EVENT, event_data)

    def send_keyboard_event(self, key, action):
        """Send keyboard event to server"""
        self.network.send_message(MessageType.KEYBOARD_EVENT, {
            'key': key,
            'action': action
        })

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python client_main.py <host> <port>")
        sys.exit(1)
        
    host = sys.argv[1]
    port = int(sys.argv[2])
    
    client = RemoteDesktopClient(host, port)
    client.start()
    
    try:
        while client.running:
            time.sleep(1)
    except KeyboardInterrupt:
        client.stop()
