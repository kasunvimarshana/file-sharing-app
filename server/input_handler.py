import pyautogui
import pywintypes
import win32api
import win32con
import time

class InputHandler:
    def __init__(self):
        # Initialize with a small delay to prevent instant action
        pyautogui.PAUSE = 0.01
        # Fail-safe is enabled by default for safety
        pyautogui.FAILSAFE = True
        
    def handle_mouse_event(self, data):
        """Handle mouse event data"""
        try:
            if data['action'] == 'move':
                x, y = data['pos']
                pyautogui.moveTo(x, y)
                
            elif data['action'] == 'click':
                x, y = data['pos']
                button = data['button']
                clicks = data.get('clicks', 1)
                pyautogui.click(x=x, y=y, button=button, clicks=clicks)
                
            elif data['action'] == 'drag':
                x, y = data['pos']
                button = data['button']
                pyautogui.dragTo(x, y, button=button)
                
            elif data['action'] == 'scroll':
                pyautogui.scroll(data['amount'])
                
        except Exception as e:
            print(f"Mouse event error: {e}")

    def handle_keyboard_event(self, data):
        """Handle keyboard event data"""
        try:
            key = data['key']
            action = data['action']
            
            if action == 'press':
                pyautogui.press(key)
            elif action == 'down':
                pyautogui.keyDown(key)
            elif action == 'up':
                pyautogui.keyUp(key)
            elif action == 'write':
                pyautogui.write(key)
        except Exception as e:
            print(f"Keyboard event error: {e}")

    def get_clipboard(self):
        """Get clipboard content"""
        try:
            import win32clipboard
            win32clipboard.OpenClipboard()
            data = win32clipboard.GetClipboardData()
            win32clipboard.CloseClipboard()
            return {'data': data}
        except Exception as e:
            print(f"Error getting clipboard: {e}")
            return None

    def set_clipboard(self, data):
        """Set clipboard content"""
        try:
            import win32clipboard
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardText(data['data'])
            win32clipboard.CloseClipboard()
            return True
        except Exception as e:
            print(f"Error setting clipboard: {e}")
            return False
