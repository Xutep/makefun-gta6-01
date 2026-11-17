// Marisol City — keyboard + mouse input. Tracks held keys and the mouse
// position in screen space, plus edge-triggered "just pressed" keys.

export function createInput() {
  const input = {
    keys: new Set(),
    pressed: new Set(), // keys pressed since last consume
    mouse: { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 },
    anyKey: false,
  };

  const keyName = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(k);
      input.pressed.add(k);
    }
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  return input;
}

export function attachMouse(input, canvas) {
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function wasPressed(input, ...names) {
  for (const n of names) if (input.pressed.has(n)) return true;
  return false;
}

export function endFrame(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
}
