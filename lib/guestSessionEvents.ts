type Listener = () => void;

let listeners: Listener[] = [];

export function onGuestSessionCreated(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function emitGuestSessionCreated(): void {
  listeners.forEach((fn) => fn());
}
