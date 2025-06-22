import struct
import json
from enum import Enum

class MessageType(Enum):
    SCREEN_DATA = 1
    MOUSE_EVENT = 2
    KEYBOARD_EVENT = 3
    CLIPBOARD_DATA = 4
    FILE_TRANSFER = 5
    AUTH_REQUEST = 6
    AUTH_RESPONSE = 7
    DISCONNECT = 8

def create_message(msg_type, data):
    """Create a binary message with header and payload"""
    json_data = json.dumps(data).encode('utf-8')
    header = struct.pack('!II', msg_type.value, len(json_data))
    return header + json_data

def read_message(sock):
    """Read a message from socket"""
    header = sock.recv(8)
    if len(header) != 8:
        return None, None
        
    msg_type, length = struct.unpack('!II', header)
    data = sock.recv(length)
    while len(data) < length:
        remaining = length - len(data)
        data += sock.recv(remaining)
    
    return MessageType(msg_type), json.loads(data.decode('utf-8'))
