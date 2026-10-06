import type { MarsHardware } from '@mars-explorer/shared';

/** State of a spacecraft on a given date: not yet landed, working, or silent since its last contact. */
export const hardwareState = (h: MarsHardware, date: string): 'future' | 'silent' | 'active' => (h.landed > date ? 'future' : h.lastContact && h.lastContact < date ? 'silent' : 'active');
