// Chrome serializes this function into Netflix's MAIN world. Never write to
// HTMLMediaElement.currentTime: Netflix must manage its own media pipeline.
export async function netflixControl(command) {
  try {
    if (location.origin !== 'https://www.netflix.com' || location.pathname.match(/^\/watch\/(\d+)\/?$/)?.[1] !== command.watchId) throw Error('The video changed. Reconnect it from the app.');
    if (!['status', 'seek', 'play', 'pause'].includes(command.action)) throw Error('Unsupported playback command.');
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
    const ids = api?.getAllPlayerSessionIds?.()?.filter(id => typeof id === 'string' && id.startsWith('watch-')) ?? [];
    if (ids.length !== 1) throw Error('Could not find the Netflix player. Play the title, then reconnect.');
    const p = api.getVideoPlayerBySessionId(ids[0]);
    if (!p || !['getCurrentTime', 'getDuration', 'seek', 'play', 'pause'].every(key => typeof p[key] === 'function')) throw Error('Playback controls are unavailable for the current Netflix player.');
    const duration = p.getDuration() / 1000;
    if (!Number.isFinite(duration) || duration <= 0) throw Error('Wait for the Netflix title to finish loading.');
    if (command.action === 'seek') {
      if (!Number.isFinite(command.time) || command.time < 0 || command.time > duration) throw Error('Choose a time within the video duration.');
      await p.seek(Math.round(command.time * 1000));
    } else if (command.action === 'play') await p.play();
    else if (command.action === 'pause') await p.pause();
    const time = p.getCurrentTime() / 1000;
    if (!Number.isFinite(time)) throw Error('Could not read the Netflix playback time.');
    return { time, duration };
  } catch (e) { return { failed: true, error: e.message || 'Could not run the Netflix player command.' }; }
}
