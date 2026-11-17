// Keyboard and mouse input for Solara Bay. One object owns every key and
// the pointer-lock mouse delta, so the player and vehicle controllers both
// read the same state and the screenshot presets can drive it too.

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.pointerLocked = false;
    this.onFirstGesture = null;
    this._gestureFired = false;
    this._onKeyDown = (event) => this._handleKey(event, true);
    this._onKeyUp = (event) => this._handleKey(event, false);
    this._onMouseMove = (event) => {
      if (this.pointerLocked) {
        this.mouseDeltaX += event.movementX || 0;
        this.mouseDeltaY += event.movementY || 0;
      }
    };
    this._onMouseDown = (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        this._fireGesture();
      }
    };
    this._onMouseUp = (event) => {
      if (event.button === 0) this.mouseDown = false;
    };
    this._onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('blur', this._onBlur);
  }

  _handleKey(event, down) {
    const code = event.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      event.preventDefault();
    }
    if (down && !event.repeat) this._fireGesture();
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  _fireGesture() {
    if (!this._gestureFired) {
      this._gestureFired = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Edge-triggered read: true once per physical press.
  wasPressed(code) {
    if (this.keys.has(code)) {
      this.keys.delete(code);
      return true;
    }
    return false;
  }

  consumeClick() {
    const clicked = this.mouseClicked;
    this.mouseClicked = false;
    return clicked;
  }

  consumeMouseDelta() {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  requestPointerLock() {
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Headless or gesture-less calls reject; the game plays fine with
          // arrow-key camera control instead.
        });
      }
    } catch (error) {
      // Pointer lock is a nicety; the game also steers with the arrow keys.
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
