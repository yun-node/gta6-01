// input.js — keyboard + mouse state, pointer lock, drag-look fallback.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this._pressed = new Set(); // edge-triggered presses: survive until a frame consumes them
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.clickQueue = 0; // queued clicks: every click fires one shot, even at low fps
    this.locked = false;
    this._dragging = false; this._lastX = 0; this._lastY = 0;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this._pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.clickQueue += 1;
      this._dragging = true; this._lastX = e.clientX; this._lastY = e.clientY;
      if (document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (_) { /* drag-look fallback */ }
      }
    });
    addEventListener('mouseup', () => { this.mouseDown = false; this._dragging = false; });
    this._lockAt = 0; this._lockSpike = 0;
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        // Engaging pointer lock fires spurious mousemove spikes (the pointer
        // recentring) that can arrive late, especially under SwiftShader:
        // ignore input for a second after locking, plus the first few
        // events, and clamp any single event so a spike can never spin the camera.
        if (performance.now() - this._lockAt < 1200 || this._lockSpike < 3) { this._lockSpike += 1; return; }
        this.mouseDX += Math.max(-80, Math.min(80, e.movementX));
        this.mouseDY += Math.max(-80, Math.min(80, e.movementY));
      } else if (this._dragging) {
        this.mouseDX += (e.clientX - this._lastX) * 2.2;
        this.mouseDY += (e.clientY - this._lastY) * 2.2;
        this._lastX = e.clientX; this._lastY = e.clientY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { this._lockAt = performance.now(); this._lockSpike = 0; }
    });
  }
  down(code) { return !!this.keys[code]; }
  pressed(code) { const v = this._pressed.has(code); if (v) this._pressed.delete(code); return v; }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  consumeClick() { if (this.clickQueue > 0) { this.clickQueue -= 1; return true; } return false; }
}
