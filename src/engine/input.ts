/** Keyboard state. Query with `down(code)`; `pressed(code)` is true only on the frame the key went down. */
const held = new Set<string>();
const justPressed = new Set<string>();

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    if (!held.has(e.code)) justPressed.add(e.code);
    held.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

export const down = (code: string): boolean => held.has(code);
export const pressed = (code: string): boolean => justPressed.has(code);
export const axis = (neg: string, pos: string): number => (down(pos) ? 1 : 0) - (down(neg) ? 1 : 0);

/** Call once per fixed update, after game logic has consumed `pressed` events. */
export function endInputFrame(): void { justPressed.clear(); }
