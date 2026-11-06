import { fireEvent } from '@testing-library/react';

// jsdom has no AnimationEvent, so React listens for the prefixed name there and
// fireEvent.animationEnd never reaches it.
export function endAnimation(element: Element) {
  fireEvent(element, new Event('webkitAnimationEnd', { bubbles: true }));
}
