import { useCallback, useEffect, useRef, useState } from 'react';
import useOnline from '../lib/useOnline.js';
import { useI18n } from '../i18n/index.jsx';
import Icon from './Icon.jsx';
import { fmtTime } from '../lib/video.js';

// Власний інтерфейс поверх YouTube IFrame API: без рекомендацій, кнопок «Далі» і назв відео.
// Фрагмент (start/end) і кількість повторів (loops: 0 = безкінечно) задає тренер.
// Поки відео на паузі чи завершене, iframe закрито нашим постером, тому підказки YouTube не видно.
// Плеєр не вантажиться, доки учень не натисне кнопку. Потрібен інтернет.
let apiPromise = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => {
        apiPromise = null;
        reject(new Error('yt'));
      };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export default function YouTubePlayer({ video, title }) {
  const { t } = useI18n();
  const online = useOnline();
  const id = video && video.id;
  const start = Number(video && video.start) || 0;
  const endCfg = Number(video && video.end) || 0;
  const loops = video && video.loops !== undefined && video.loops !== null ? Number(video.loops) : 1;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('paused'); // playing | paused | ended
  const [now, setNow] = useState(start);
  const [dur, setDur] = useState(0);
  const [round, setRound] = useState(1);
  const [failed, setFailed] = useState(false);
  const host = useRef(null);
  const player = useRef(null);
  const roundRef = useRef(1);
  const stateRef = useRef('paused');

  const endT = endCfg > 0 ? endCfg : dur;
  const span = Math.max(1, endT - start);

  const finish = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (loops === 0 || roundRef.current < loops) {
      roundRef.current += 1;
      setRound(roundRef.current);
      p.seekTo(start, true);
      p.playVideo();
    } else {
      p.pauseVideo();
      p.seekTo(start, true);
      stateRef.current = 'ended';
      setStatus('ended');
      setNow(start);
    }
  }, [loops, start]);

  // Створення плеєра після першого натискання.
  useEffect(() => {
    if (!open || !id) return undefined;
    let dead = false;
    loadYT()
      .then((YT) => {
        if (dead || !host.current) return;
        player.current = new YT.Player(host.current, {
          host: 'https://www.youtube-nocookie.com',
          videoId: id,
          playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0, start: Math.floor(start) },
          events: {
            onReady: (e) => {
              setDur(e.target.getDuration() || 0);
              e.target.playVideo();
            },
            onStateChange: (e) => {
              const S = YT.PlayerState;
              if (e.data === S.PLAYING) {
                stateRef.current = 'playing';
                setStatus('playing');
                setDur(e.target.getDuration() || 0);
              } else if (e.data === S.PAUSED) {
                if (stateRef.current !== 'ended') {
                  stateRef.current = 'paused';
                  setStatus('paused');
                }
              } else if (e.data === S.ENDED) {
                finish();
              }
            }
          }
        });
      })
      .catch(() => setFailed(true));
    return () => {
      dead = true;
      if (player.current && player.current.destroy) player.current.destroy();
      player.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  // Відстеження позиції: повтори й зупинка в кінці фрагмента.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const iv = setInterval(() => {
      const p = player.current;
      if (!p || !p.getCurrentTime) return;
      const cur = p.getCurrentTime();
      setNow(cur);
      const end = endCfg > 0 ? endCfg : p.getDuration() || 0;
      if (end > 0 && cur >= end - 0.15) finish();
    }, 200);
    return () => clearInterval(iv);
  }, [status, endCfg, finish]);

  if (!id) return null;

  const toggle = () => {
    const p = player.current;
    if (!p) return;
    if (status === 'playing') p.pauseVideo();
    else {
      if (status === 'ended') {
        roundRef.current = 1;
        setRound(1);
        stateRef.current = 'paused';
      }
      p.playVideo();
    }
  };

  const seek = (e) => {
    const p = player.current;
    if (!p) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const to = start + ratio * span;
    p.seekTo(to, true);
    setNow(to);
  };

  const thumb = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;

  if (!open) {
    return (
      <button
        type="button"
        className="yt-thumb"
        onClick={() => online && setOpen(true)}
        disabled={!online}
        style={{ backgroundImage: online ? thumb : 'none' }}
      >
        <span className="yt-play" aria-hidden="true">
          <Icon name="play" size={28} />
        </span>
        <span className="yt-label">{online ? title || t('exercise.watch') : t('video.onlineOnly')}</span>
      </button>
    );
  }

  const pct = Math.min(100, Math.max(0, ((now - start) / span) * 100));
  return (
    <div className="yt">
      <div className="video yt-frame">
        <div ref={host} className="yt-host" />
        <button type="button" className="yt-shield" aria-label={status === 'playing' ? t('video.pause') : t('video.play')} onClick={toggle} />
        {status !== 'playing' && (
          <button type="button" className="yt-cover" style={{ backgroundImage: thumb }} onClick={toggle} aria-label={t('video.play')}>
            <span className="yt-play" aria-hidden="true">
              <Icon name={status === 'ended' ? 'replay' : 'play'} size={28} />
            </span>
          </button>
        )}
        {failed && <div className="video-empty yt-failed">{t('video.error')}</div>}
      </div>
      <div className="yt-bar">
        <button type="button" className="icon-btn" onClick={toggle} aria-label={status === 'playing' ? t('video.pause') : t('video.play')}>
          <Icon name={status === 'playing' ? 'pause' : 'play'} size={22} />
        </button>
        <div className="yt-track" onClick={seek} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t('video.seek')}>
          <div className="yt-fill" style={{ width: pct + '%' }} />
        </div>
        <span className="yt-time">{fmtTime(Math.max(0, now - start))} / {fmtTime(span)}</span>
        {loops !== 1 && <span className="yt-loop">↻ {loops === 0 ? round : `${round}/${loops}`}</span>}
      </div>
    </div>
  );
}
