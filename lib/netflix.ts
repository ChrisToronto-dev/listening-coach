export type NetflixClip = { id: string; watchId: string; title: string; start: number; end: number; notes: string; createdAt: string };
export type NetflixTab = { tabId: number; watchId: string; title: string };
export type NetflixStatus = { ready: boolean; watchId: string; time: number; duration: number; paused: boolean; loop: boolean; start?: number; end?: number; subtitle: string; error?: string; failed?: boolean };
