import pyautogui
import win32api
import win32con
import time

class InputSender:
    def __init__(self, network):
        self.network = network
        self.last_pos = None
        
    def send_mouse_event(self, action, pos=None, button='left', sub_action=None):
        """Send mouse event to server"""
        if action == 'move' and pos == self.last_pos:
            return
            
        self.last_pos = pos if pos else self.last_pos
        
        event_data = {
            'action': action,
            'pos': pos if pos else self.last_pos,
            'button': button
        }
        
        if sub_action:
            event_data['sub_action'] = sub_action
            
        self.network.send_message(MessageType.MOUSE_EVENT, event_data)

    def send_key_event(self, key, action):
        """Send keyboard event to server"""
        self.network.send_message(MessageType.KEYBOARD_EVENT, {
            'key': key,
            'action': action
        })

    def get_clipboard(self):
        """Request clipboard data from server"""
        self.network.send_message(MessageType.CLIPBOARD_DATA, {'request': True})

    def send_clipboard(self, data):
        """Send clipboard data to server"""
        self.network.send_message(MessageType.CLIPBOARD_DATA, {'data': data})
