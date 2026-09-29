const supports = () => typeof document !== 'undefined' && 'startViewTransition' in document;

export function withViewTransition(update: () => void) {
  if (!supports()) {
    update();
    return;
  }
  document.startViewTransition(update);
}
