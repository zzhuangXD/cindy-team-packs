import { easeOutCubic, easeOutBack, smooth } from './geometry.js';

export const OPENING_DURATION = 2.95;

export function openingMotion(seconds, index = 0) {
  const tear = easeOutCubic(seconds / 0.48);
  const peel = smooth((seconds - 0.22) / 0.75);
  const mouth = smooth((seconds - 0.28) / 0.6);
  const lift = smooth((seconds - 0.6) / 1.05);
  const drop = smooth((seconds - 0.78) / 1.15);
  const fanTime = Math.max(0, Math.min(1, (seconds - 1.45 - index * 0.075) / 0.95));
  return { tear, peel, mouth, lift, drop, fanTime, fan: easeOutBack(fanTime), fanDepth: smooth(fanTime) };
}
