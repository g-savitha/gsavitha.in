import { useEffect, useRef, useState } from 'react';
import type { AudioSource } from '../../utils/audio';

interface AudioPlayerProps {
  slug: string;
  title: string;
  sources: AudioSource[];
}

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function AudioPlayer({ slug, title, sources }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedSecondRef = useRef(-1);
  const resumeAfterLanguageChangeRef = useRef(false);
  const storageKey = `blog-audio:${slug}`;

  const [selectedUrl, setSelectedUrl] = useState(sources[0].url);
  const selectedSource = sources.find((source) => source.url === selectedUrl) ?? sources[0];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(selectedSource.duration ?? 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.load();
    setCurrentTime(0);
    setDuration(selectedSource.duration ?? 0);
    setIsUnavailable(false);
    setStatus('Loading…');
  }, [selectedSource.duration, selectedUrl]);

  const restorePosition = (audio: HTMLAudioElement) => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      if (saved.src === audio.currentSrc && saved.time > 0 && saved.time < audio.duration - 5) {
        audio.currentTime = saved.time;
      }
    } catch {
      // Playback remains available when storage is unavailable or malformed.
    }
  };

  const handleLoadedMetadata = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setDuration(audio.duration);
    restorePosition(audio);
    setStatus('Ready');

    if (resumeAfterLanguageChangeRef.current) {
      resumeAfterLanguageChangeRef.current = false;
      try {
        await audio.play();
      } catch {
        setStatus('Unable to play audio');
      }
    }
  };

  const handleTogglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    setStatus('Loading…');
    try {
      await audio.play();
    } catch {
      setStatus('Unable to play audio');
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);
    const second = Math.floor(audio.currentTime);
    if (second > 0 && second !== lastSavedSecondRef.current && second % 5 === 0) {
      lastSavedSecondRef.current = second;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ src: audio.currentSrc, time: audio.currentTime }),
        );
      } catch {
        // Saving progress is optional.
      }
    }
  };

  const handleSeek = (percentage: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (percentage / 100) * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const handleLanguageChange = (url: string) => {
    const audio = audioRef.current;
    resumeAfterLanguageChangeRef.current = Boolean(audio && !audio.paused);
    audio?.pause();
    setSelectedUrl(url);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setStatus('Ready');
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Clearing saved progress is optional.
    }
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <section className="audio-player not-prose" aria-label={`Listen to ${title}`}>
      <audio
        ref={audioRef}
        preload="metadata"
        src={selectedSource.url}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => {
          setIsPlaying(true);
          setStatus('Playing');
        }}
        onPause={() => {
          setIsPlaying(false);
          if (!audioRef.current?.ended) setStatus('Paused');
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          setIsUnavailable(true);
          setStatus('Audio unavailable');
        }}
      />

      <div className="audio-player__heading">
        <span className="audio-player__eyebrow">Listen to this article</span>
        <span className="audio-player__status" aria-live="polite">
          {status}
        </span>
      </div>

      <div className="audio-player__controls">
        <div className="audio-player__controls-group">
          <button
            className="audio-player__play"
            type="button"
            disabled={isUnavailable}
            aria-label={isPlaying ? 'Pause article' : 'Play article'}
            onClick={handleTogglePlayback}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <span className="audio-player__time">{formatTime(currentTime)}</span>
        </div>

        <label className="sr-only" htmlFor={`audio-progress-${slug}`}>
          Audio progress
        </label>
        <input
          id={`audio-progress-${slug}`}
          className="audio-player__progress"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          aria-label="Audio progress"
          onChange={(event) => handleSeek(Number(event.currentTarget.value))}
        />

        <div className="audio-player__controls-group">
          <span className="audio-player__time">{formatTime(duration)}</span>

          {sources.length > 1 && (
            <label>
              <span className="sr-only">Narration language</span>
              <select
                className="audio-select"
                value={selectedUrl}
                aria-label="Narration language"
                onChange={(event) => handleLanguageChange(event.currentTarget.value)}
              >
                {sources.map((source) => (
                  <option key={source.url} value={source.url}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            <span className="sr-only">Playback speed</span>
            <select
              className="audio-select"
              value={playbackRate}
              aria-label="Playback speed"
              onChange={(event) => handleSpeedChange(Number(event.currentTarget.value))}
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
