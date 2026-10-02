// Mock of the Yandex Games SDK used by the smoke tests to exercise YandexPlatform.
(function () {
  const log = (window.__sdkLog = []);
  const listeners = {};
  let data = null;
  const ysdk = {
    environment: { i18n: { lang: 'en' } },
    deviceInfo: { isMobile: () => false, isTablet: () => false },
    features: {
      LoadingAPI: { ready: () => log.push('ready') },
      GameplayAPI: { start: () => log.push('start'), stop: () => log.push('stop') },
    },
    adv: {
      showFullscreenAdv: ({ callbacks }) => { log.push('fullscreen'); setTimeout(() => { callbacks.onOpen?.(); setTimeout(() => callbacks.onClose?.(true), 100); }, 10); },
      showRewardedVideo: ({ callbacks }) => { log.push('rewarded'); setTimeout(() => { callbacks.onOpen?.(); setTimeout(() => { callbacks.onRewarded?.(); callbacks.onClose?.(true); }, 150); }, 10); },
    },
    getPlayer: async () => ({
      getData: async () => data,
      setData: async (d) => { data = JSON.parse(JSON.stringify(d)); log.push('setData'); },
      isAuthorized: () => true,
      getUniqueID: () => 'me',
      getMode: () => '',
    }),
    leaderboards: {
      setScore: async (name, score) => log.push(`setScore:${name}:${score}`),
      getEntries: async () => ({ userRank: 2, entries: [
        { rank: 1, score: 30, player: { publicName: 'Alice', uniqueID: 'a' } },
        { rank: 2, score: 12, player: { publicName: 'Me', uniqueID: 'me' } },
      ] }),
    },
    auth: { openAuthDialog: async () => undefined },
    isAvailableMethod: async () => true,
    on: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
  };
  window.__sdkEmit = (ev) => (listeners[ev] || []).forEach((cb) => cb());
  window.YaGames = { init: async () => ysdk };
})();
