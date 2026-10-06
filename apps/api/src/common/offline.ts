/** OFFLINE=1 forces every upstream call onto local cache/fixtures and turns cloud models off, so the demo runs with the wifi off. */
export const isOffline = () => process.env.OFFLINE === '1' || process.env.OFFLINE === 'true';
