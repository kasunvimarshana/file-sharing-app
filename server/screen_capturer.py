import time
import numpy as np
from PIL import ImageGrab
from io import BytesIO
import zlib

class ScreenCapturer:
    def __init__(self, quality=70, fps=30):
        self.quality = quality
        self.fps = fps
        self.last_capture = 0
        self.frame_interval = 1.0 / fps
        self.previous_frame = None
        self.region = None  # Can be set to capture specific region (x, y, width, height)

    def capture(self, diff=True):
        """Capture screen and return compressed image data"""
        now = time.time()
        if now - self.last_capture < self.frame_interval:
            return None
            
        self.last_capture = now
        
        try:
            # Capture screen
            img = ImageGrab.grab(bbox=self.region) if self.region else ImageGrab.grab()
            
            # Convert to JPEG
            buf = BytesIO()
            img.save(buf, format='JPEG', quality=self.quality)
            frame_data = buf.getvalue()
            
            # Calculate difference if needed
            if diff and self.previous_frame:
                current_frame = np.frombuffer(buf.getvalue(), dtype=np.uint8)
                diff_frame = np.frombuffer(self.previous_frame, dtype=np.uint8)
                
                if len(current_frame) == len(diff_frame):
                    diff_result = np.not_equal(current_frame, diff_frame)
                    if not np.any(diff_result):
                        return None
                    
            self.previous_frame = frame_data
            
            # Compress using zlib
            compressed = zlib.compress(frame_data)
            
            return compressed
            
        except Exception as e:
            print(f"Screen capture error: {e}")
            return None

    def set_region(self, region):
        """Set the screen region to capture (x, y, width, height)"""
        self.region = region

    def set_quality(self, quality):
        """Set JPEG quality (1-100)"""
        self.quality = max(1, min(100, quality))

    def set_fps(self, fps):
        """Set frames per second"""
        self.fps = max(1, min(60, fps))
        self.frame_interval = 1.0 / self.fps
