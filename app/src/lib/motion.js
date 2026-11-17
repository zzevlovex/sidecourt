import { prefersReducedMotion } from 'svelte/motion';

// Transition settings that switch off for people who ask for less motion.
export const motion = (options = {}) => (prefersReducedMotion.current ? { ...options, duration: 0, delay: 0 } : options);
