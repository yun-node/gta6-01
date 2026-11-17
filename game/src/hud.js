// hud.js — DOM HUD: money, wanted stars, health, mission objective, speed,
// hint line, toasts, and the 2D canvas minimap (top-down city view).
import { CITY_EXTENT, ROAD_SPACING } from './city.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money'),
      stars: document.getElementById('stars'),
      healthfill: document.getElementById('healthfill'),
      healthlabel: document.getElementById('healthlabel'),
      mname: document.getElementById('mname'),
      mtext: document.getElementById('mtext'),
      mtimer: document.getElementById('mtimer'),
      speed: document.getElementById('speed'),
      gear: document.getElementById('gear'),
      hint: document.getElementById('hint'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      wantedFlash: document.getElementById('wantedFlash'),
      minimap: document.getElementById('minimap'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this._toastT = null;
  }
  show() { this.el.hud.classList.add('on'); }
  hide() { this.el.hud.classList.remove('on'); }
  toast(text, ms) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms || 2400);
  }
  setHint(text) { this.el.hint.textContent = text || ''; this.el.hint.style.display = text ? '' : 'none'; }
  update(state) {
    this.el.money.innerHTML = `$${Math.round(state.money).toLocaleString()} <small>SOLMAR</small>`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < state.wanted ? 'lit' : 'dim'}">★</span>`;
    this.el.stars.innerHTML = stars;
    this.el.healthfill.style.width = `${state.health}%`;
    this.el.healthfill.style.background = state.health > 50
      ? 'linear-gradient(90deg,#37d67a,#a8f04a)' : state.health > 25
      ? 'linear-gradient(90deg,#e8a13a,#ffd23e)' : 'linear-gradient(90deg,#d43a2f,#ff7a5a)';
    this.el.healthlabel.textContent = `HEALTH ${Math.round(state.health)}  ·  AMMO ${state.ammo === Infinity ? '∞' : state.ammo}`;
    const obj = state.objective;
    this.el.mname.textContent = obj.name;
    this.el.mtext.textContent = obj.text;
    this.el.mtimer.textContent = obj.timeLeft > 0 ? `⏱ ${Math.ceil(obj.timeLeft)}s left` : '';
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    this.el.speed.textContent = state.inCar ? kmh : '—';
    this.el.gear.textContent = state.inCar ? (kmh > 90 ? 'TOP GEAR' : kmh > 40 ? 'CRUISING' : 'IN CAR — SPACE TO BRAKE') : 'ON FOOT — E NEAR A CAR TO STEAL IT';
    this.el.crosshair.style.display = (!state.inCar && state.playing) ? 'block' : 'none';
    this.el.wantedFlash.style.borderColor = state.wanted >= 3 ? 'rgba(255,40,40,.55)' : 'rgba(255,40,40,0)';
    this._drawMinimap(state);
  }
  _drawMinimap(state) {
    const c = this.mm, S = 190;
    const scale = S / (CITY_EXTENT * 2 + 40);
    const toMap = (x, z) => [(x + CITY_EXTENT + 20) * scale, (z + CITY_EXTENT + 20) * scale];
    c.fillStyle = '#0e2a1a'; c.fillRect(0, 0, S, S);
    // ocean + beach at the bottom
    c.fillStyle = '#2a7fc4'; c.fillRect(0, toMap(0, 210)[1], S, S);
    c.fillStyle = '#e8d29a'; c.fillRect(0, toMap(0, 198)[1], S, 8);
    // roads
    c.strokeStyle = '#3a3f46'; c.lineWidth = 5;
    for (let i = -3; i <= 3; i++) {
      const p = toMap(i * ROAD_SPACING, 0)[0];
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, S); c.stroke();
      const q = toMap(0, i * ROAD_SPACING)[1];
      c.beginPath(); c.moveTo(0, q); c.lineTo(S, q); c.stroke();
    }
    // buildings as faint blocks
    c.fillStyle = 'rgba(255,255,255,.22)';
    for (let bx = -3; bx < 3; bx++) for (let bz = -3; bz < 3; bz++) {
      const [x, y] = toMap(bx * ROAD_SPACING + 26, bz * ROAD_SPACING + 26);
      c.fillRect(x - 9, y - 9, 18, 18);
    }
    // mission marker
    if (state.target) {
      const [x, y] = toMap(state.target.x, state.target.z);
      c.fillStyle = '#ffd23e';
      c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    }
    // traffic + police dots
    c.fillStyle = '#9fd8ff';
    for (const t of state.traffic || []) { const [x, y] = toMap(t.x, t.z); c.fillRect(x - 2, y - 2, 4, 4); }
    c.fillStyle = '#ff4040';
    for (const p of state.police || []) { const [x, y] = toMap(p.x, p.z); c.fillRect(x - 2.5, y - 2.5, 5, 5); }
    // player arrow
    const [px, py] = toMap(state.px, state.pz);
    c.save(); c.translate(px, py); c.rotate(-state.camYaw);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }
}
