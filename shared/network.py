import socket
import ssl
import threading
from typing import Callable

from shared.protocol import create_message

class NetworkManager:
    def __init__(self, host='', port=50000, use_ssl=True):
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.running = False
        self.callbacks = {}
        self.sock = None
        self.ssl_context = None
        
        if use_ssl:
            self.ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH) # ssl.Purpose.SERVER_AUTH

            self.ssl_context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')

    def start_server(self):
        """Start the server socket"""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(5)
        self.running = True
        
        print(f"Server listening on {self.host}:{self.port}")
        
        while self.running:
            try:
                client, addr = self.sock.accept()
                if self.use_ssl:
                    client = self.ssl_context.wrap_socket(client, server_side=True)
                
                print(f"Connection from {addr}")
                threading.Thread(target=self.handle_client, args=(client,), daemon=True).start()
            except Exception as e:
                if self.running:
                    print(f"Server error: {e}")
                break

    def connect(self):
        """Connect to a server"""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if self.use_ssl:
            self.sock = self.ssl_context.wrap_socket(self.sock, server_hostname=self.host)
        self.sock.connect((self.host, self.port))
        self.running = True
        threading.Thread(target=self.handle_incoming, daemon=True).start()

    def handle_client(self, client):
        """Handle an incoming client connection"""
        try:
            while self.running:
                msg_type, data = read_message(client)
                if msg_type is None:
                    break
                    
                if msg_type in self.callbacks:
                    self.callbacks[msg_type](data, client)
        except Exception as e:
            print(f"Client handling error: {e}")
        finally:
            client.close()

    def handle_incoming(self):
        """Handle incoming messages from the server"""
        try:
            while self.running:
                msg_type, data = read_message(self.sock)
                if msg_type is None:
                    break
                    
                if msg_type in self.callbacks:
                    self.callbacks[msg_type](data, self.sock)
        except Exception as e:
            print(f"Incoming message error: {e}")
        finally:
            self.stop()

    def send_message(self, msg_type, data, sock=None):
        """Send a message to the connected peer"""
        target_sock = sock if sock else self.sock
        if target_sock:
            try:
                target_sock.sendall(create_message(msg_type, data))
            except Exception as e:
                print(f"Error sending message: {e}")
                self.stop()

    def register_callback(self, msg_type, callback: Callable):
        """Register a callback for a message type"""
        self.callbacks[msg_type] = callback

    def stop(self):
        """Stop the network connection"""
        if self.running:
            self.running = False
            if self.sock:
                try:
                    self.sock.close()
                except:
                    pass
            self.sock = None
