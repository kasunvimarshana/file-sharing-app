import pygame
import zlib
from io import BytesIO
from PIL import Image

class RemoteDesktopViewer:
    def __init__(self):
        pygame.init()
        self.screen = None
        self.clock = pygame.time.Clock()
        self.running = False
        self.current_frame = None

    def start(self):
        """Start the viewer window"""
        if not self.running:
            self.screen = pygame.display.set_mode((800, 600), pygame.RESIZABLE)
            pygame.display.set_caption('Remote Desktop Viewer')
            self.running = True
            threading.Thread(target=self.render_loop, daemon=True).start()

    def stop(self):
        """Stop the viewer"""
        self.running = False
        pygame.quit()

    def update_frame(self, compressed_frame):
        """Update the current frame with new screen data"""
        try:
            # Decompress the frame
            frame_data = zlib.decompress(compressed_frame)
            
            # Convert to PIL image
            img = Image.open(BytesIO(frame_data))
            
            # Convert to Pygame surface
            mode = img.mode
            size = img.size
            data = img.tobytes()
            
            if mode == "RGB":
                self.current_frame = pygame.image.fromstring(data, size, "RGB")
            elif mode in ("RGBA", "RGBX"):
                self.current_frame = pygame.image.fromstring(data, size, "RGBA")

        except Exception as e:
            print(f"Error updating frame: {e}")

    def render_loop(self):
        """Main rendering loop"""
        while self.running:
            self.clock.tick(60)
            
            if self.current_frame:
                # Scale frame to window size
                window_size = self.screen.get_size()
                scaled_frame = pygame.transform.scale(self.current_frame, window_size)
                
                # Display the frame
                self.screen.blit(scaled_frame, (0, 0))
                pygame.display.flip()
            
            # Handle events to prevent hanging
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
