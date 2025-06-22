import sys
import os

# Add parent directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from shared.network import NetworkManager
from shared.protocol import MessageType
from screen_capturer import ScreenCapturer
from input_handler import InputHandler
from compression import CompressionManager
import threading
import time

class RemoteDesktopServer:
    def __init__(self):
        self.network = NetworkManager()
        self.capturer = ScreenCapturer()
        self.input_handler = InputHandler()
        self.clients = {}
        self.running = False
        
        # Register message handlers
        self.network.register_callback(MessageType.MOUSE_EVENT, self.handle_mouse_event)
        self.network.register_callback(MessageType.KEYBOARD_EVENT, self.handle_keyboard_event)
        self.network.register_callback(MessageType.CLIPBOARD_DATA, self.handle_clipboard)
        self.network.register_callback(MessageType.AUTH_REQUEST, self.handle_auth)

    def start(self):
        """Start the server"""
        self.running = True
        threading.Thread(target=self.network.start_server, daemon=True).start()
        
        # Start screen broadcast loop
        threading.Thread(target=self.broadcast_screen, daemon=True).start()
        print("Remote Desktop Server started")

    def stop(self):
        """Stop the server"""
        self.running = False
        self.network.stop()
        print("Remote Desktop Server stopped")

    def handle_mouse_event(self, data, client):
        """Handle incoming mouse events"""
        self.input_handler.handle_mouse_event(data)

    def handle_keyboard_event(self, data, client):
        """Handle incoming keyboard events"""
        self.input_handler.handle_keyboard_event(data)

    def handle_clipboard(self, data, client):
        """Handle clipboard data"""
        if data.get('request'):
            # Client is requesting clipboard data
            clipboard_data = self.input_handler.get_clipboard()
            if clipboard_data:
                self.network.send_message(MessageType.CLIPBOARD_DATA, clipboard_data, client)
        else:
            # Client is sending clipboard data
            self.input_handler.set_clipboard(data)

    def handle_auth(self, data, client):
        """Handle authentication (dummy implementation)"""
        # In production, implement proper authentication
        print(f"Authentication request from client: {data.get('username')}")
        response = {'success': True, 'message': 'Authenticated'}
        self.network.send_message(MessageType.AUTH_RESPONSE, response, client)

    def broadcast_screen(self):
        """Continuously capture and send screen updates to clients"""
        while self.running:
            frame = self.capturer.capture()
            if frame:
                # In a real implementation, you would send to multiple clients
                # Here we just send to the first client for simplicity
                if hasattr(self.network, 'sock') and self.network.sock:
                    self.network.send_message(MessageType.SCREEN_DATA, {'frame': frame.hex()})
            
            time.sleep(1.0 / self.capturer.fps)

if __name__ == "__main__":
    server = RemoteDesktopServer()
    server.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        server.stop()
