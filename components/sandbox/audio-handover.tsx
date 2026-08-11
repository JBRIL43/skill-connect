"use client";

import { Mic, Pause, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AudioHandover } from "@/lib/sandbox/reality";

export function AudioHandoverPlayer({
  handover,
  onListened,
}: {
  handover: AudioHandover;
  onListened: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [listened, setListened] = useState(false);

  const markListened = useCallback(() => {
    if (listened) return;
    setListened(true);
    onListened();
  }, [listened, onListened]);

  function playWithSpeech() {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      markListened();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(handover.script);
    utterance.rate = 1.15;
    utterance.pitch = 1.05;
    utterance.onend = () => {
      setPlaying(false);
      markListened();
    };
    utterance.onerror = () => {
      setPlaying(false);
      markListened();
    };
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }

  function togglePlayback() {
    if (handover.audioSrc && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
        return;
      }
      void audioRef.current.play();
      setPlaying(true);
      return;
    }

    if (playing) {
      stopSpeech();
      return;
    }
    playWithSpeech();
  }

  return (
    <div className="panel-muted space-y-3 p-3">
      <div className="flex items-start gap-2">
        <Mic aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-slate-200">{handover.title}</p>
          <p className="text-[11px] text-slate-500">
            From {handover.sender} · ~{handover.durationSeconds}s · background street noise
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Listen once and extract the critical facts yourself — there is no transcript until
        you finish. Use the assistant to verify what you heard.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={togglePlayback}>
          {playing ? (
            <>
              <Pause aria-hidden className="size-3.5" />
              Pause
            </>
          ) : (
            <>
              <Play aria-hidden className="size-3.5" />
              Play handover
            </>
          )}
        </Button>
        {!listened ? (
          <Button type="button" size="sm" variant="ghost" onClick={markListened}>
            I took notes — continue
          </Button>
        ) : (
          <span className="text-[11px] text-verdant-400">Notes captured — full brief unlocked</span>
        )}
      </div>

      {handover.audioSrc ? (
        <audio
          ref={audioRef}
          src={handover.audioSrc}
          onEnded={() => {
            setPlaying(false);
            markListened();
          }}
          preload="none"
        />
      ) : null}
    </div>
  );
}
