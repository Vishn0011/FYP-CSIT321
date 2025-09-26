// Simple auth event bus
const bus = new EventTarget();

export function emitAuthChanged() {
  bus.dispatchEvent(new Event("auth-changed"));
}

export function onAuthChanged(handler) {
  bus.addEventListener("auth-changed", handler);
  return () => bus.removeEventListener("auth-changed", handler);
}
