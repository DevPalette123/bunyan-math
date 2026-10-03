import { useEffect, useRef } from "react";
import type { LessonVideo } from "../../data/lessons";

interface LessonVideoPlayerProps {
  video: LessonVideo;
  title: string;
  /** Fires exactly once, only when the video actually reaches its real end —
   * never on open, play, pause, or seek. */
  onEnded?: () => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Loaded once per page, shared across every lesson the student opens —
// injecting the script tag more than once would just re-run YouTube's own
// bootstrap needlessly.
let youTubeApiPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (youTubeApiPromise) return youTubeApiPromise;
  youTubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return youTubeApiPromise;
}

export default function LessonVideoPlayer({ video, title, onEnded }: LessonVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    if (video.type !== "youtube") return;

    let cancelled = false;
    // Real YouTube Player API (postMessage under the hood) — not a plain
    // iframe load, which fires the moment the embed appears and tells us
    // nothing about whether the student actually watched it.
    loadYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: video.youtubeId,
        playerVars: { rel: 0 },
        events: {
          onStateChange: (event: { data: number }) => {
            // YT.PlayerState.ENDED === 0 — used as a literal so this file
            // doesn't depend on window.YT existing at module-eval time.
            if (event.data === 0 && !endedRef.current) {
              endedRef.current = true;
              onEnded?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Player may already be torn down by YouTube itself — harmless.
      }
      playerRef.current = null;
    };
    // Re-create the player only when the underlying video actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.type, (video as any).youtubeId]);

  function handleLocalVideoEnded() {
    // Native <video> "ended" event — fires only at real end, never on pause
    // or a manual seek to the last frame while still playing.
    if (endedRef.current) return;
    endedRef.current = true;
    onEnded?.();
  }

  return (
    <div className="w-full rounded-3xl overflow-hidden shadow-soft bg-black">
      {/* 16:9 responsive box — works the same way for both the YouTube
          iframe and the local <video> tag, never overflows the page width,
          never causes horizontal scroll. */}
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        {video.type === "youtube" ? (
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            role="group"
            aria-label={`فيديو شرح ${title}`}
          />
        ) : (
          <video
            className="absolute inset-0 w-full h-full object-contain bg-black"
            src={video.src}
            controls
            preload="metadata"
            onEnded={handleLocalVideoEnded}
          >
            متصفحك لا يدعم تشغيل الفيديو.
          </video>
        )}
      </div>
    </div>
  );
}
