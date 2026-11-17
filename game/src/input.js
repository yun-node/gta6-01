// input.js — keyboard + mouse state, pointer lock, drag-look fallback.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mouseClicked = false;
    this.locked = false;
    this._dragging = false; this._lastX = 0; this._lastY = 0;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true;
      this._dragging = true; this._lastX = e.clientX; this._lastY = e.clientY;
      if (document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (_) { /* drag-look fallback */ }
      }
    });
    addEventListener('mouseup', () => { this.mouseDown = false; this._dragging = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      else if (this._dragging) {
        this.mouseDX += (e.clientX - this._lastX) * 2.2;
        this.mouseDY += (e.clientY - this._lastY) * 2.2;
        this._lastX = e.clientX; this._lastY = e.clientY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }
  down(code) { return !!this.keys[code]; }
  pressed(code) { const v = !!this.keys[code]; if (v) this.keys[code] = false; return v; }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  consumeClick() { const c = this.mouseClicked; this.mouseClicked = false; return c; }
}
