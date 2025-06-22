export class InputHandler {
  private canvas: HTMLCanvasElement | null = null;
  private isControlActive = false;
  private onMouseEvent?: (event: any) => void;
  private onKeyboardEvent?: (event: any) => void;
  private mouseMoveThrottle = 50; // ms
  private lastMouseMove = 0;

  constructor() {
    this.setupGlobalKeyboardHandler();
  }

  attachToCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupCanvasHandlers();
  }

  private setupCanvasHandlers() {
    if (!this.canvas) return;

    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
  }

  private setupGlobalKeyboardHandler() {
    // Capture keyboard events globally when control is active
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    document.addEventListener('keypress', this.handleKeyPress.bind(this));
  }

  private getRelativeCoordinates(event: MouseEvent | Touch): { x: number, y: number } {
    if (!this.canvas) return { x: 0, y: 0 };

    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  private handleMouseDown(event: MouseEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    event.preventDefault();
    const coords = this.getRelativeCoordinates(event);
    
    this.onMouseEvent({
      type: 'click',
      x: coords.x,
      y: coords.y,
      button: event.button
    });
  }

  private handleMouseUp(event: MouseEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    event.preventDefault();
    const coords = this.getRelativeCoordinates(event);
    
    this.onMouseEvent({
      type: 'release',
      x: coords.x,
      y: coords.y,
      button: event.button
    });
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    const now = Date.now();
    if (now - this.lastMouseMove < this.mouseMoveThrottle) return;
    this.lastMouseMove = now;

    event.preventDefault();
    const coords = this.getRelativeCoordinates(event);
    
    this.onMouseEvent({
      type: 'move',
      x: coords.x,
      y: coords.y
    });
  }

  private handleWheel(event: WheelEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    event.preventDefault();
    const coords = this.getRelativeCoordinates(event);
    
    this.onMouseEvent({
      type: 'scroll',
      x: coords.x,
      y: coords.y,
      deltaX: event.deltaX,
      deltaY: event.deltaY
    });
  }

  private handleTouchStart(event: TouchEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    event.preventDefault();
    const touch = event.touches[0];
    const coords = this.getRelativeCoordinates(touch);
    
    this.onMouseEvent({
      type: 'click',
      x: coords.x,
      y: coords.y,
      button: 0 // Left click for touch
    });
  }

  private handleTouchEnd(event: TouchEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    event.preventDefault();
    const touch = event.changedTouches[0];
    const coords = this.getRelativeCoordinates(touch);
    
    this.onMouseEvent({
      type: 'release',
      x: coords.x,
      y: coords.y,
      button: 0
    });
  }

  private handleTouchMove(event: TouchEvent) {
    if (!this.isControlActive || !this.onMouseEvent) return;

    const now = Date.now();
    if (now - this.lastMouseMove < this.mouseMoveThrottle) return;
    this.lastMouseMove = now;

    event.preventDefault();
    const touch = event.touches[0];
    const coords = this.getRelativeCoordinates(touch);
    
    this.onMouseEvent({
      type: 'move',
      x: coords.x,
      y: coords.y
    });
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this.isControlActive || !this.onKeyboardEvent) return;

    // Prevent default for most keys when control is active
    if (this.shouldPreventDefault(event)) {
      event.preventDefault();
    }

    this.onKeyboardEvent({
      type: 'keydown',
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (!this.isControlActive || !this.onKeyboardEvent) return;

    if (this.shouldPreventDefault(event)) {
      event.preventDefault();
    }

    this.onKeyboardEvent({
      type: 'keyup',
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
  }

  private handleKeyPress(event: KeyboardEvent) {
    if (!this.isControlActive || !this.onKeyboardEvent) return;

    this.onKeyboardEvent({
      type: 'keypress',
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
  }

  private shouldPreventDefault(event: KeyboardEvent): boolean {
    // Don't prevent F5 (refresh) or Ctrl+R (refresh) or F12 (dev tools)
    if (event.key === 'F5' || event.key === 'F12') return false;
    if (event.ctrlKey && event.key === 'r') return false;
    if (event.ctrlKey && event.key === 'R') return false;
    
    // Prevent most other keys when control is active
    return true;
  }

  setControlActive(active: boolean) {
    this.isControlActive = active;
    
    if (this.canvas) {
      this.canvas.style.cursor = active ? 'crosshair' : 'default';
    }
  }

  setMouseEventHandler(handler: (event: any) => void) {
    this.onMouseEvent = handler;
  }

  setKeyboardEventHandler(handler: (event: any) => void) {
    this.onKeyboardEvent = handler;
  }

  cleanup() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    document.removeEventListener('keypress', this.handleKeyPress.bind(this));
  }
}