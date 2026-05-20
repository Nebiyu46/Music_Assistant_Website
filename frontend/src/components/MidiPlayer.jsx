import { useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import styles from "./MidiPlayer.module.css";

const COLORS = [
  "#c8ff00", "#00e5ff", "#ff3cac", "#ff9100",
  "#a78bfa", "#34d399", "#f472b6", "#fb923c",
];

const KEY_COUNT = 88;
const MIN_MIDI = 21; 
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PIANO_KEYS = [];
let whiteCount = 0;
for (let i = 0; i < KEY_COUNT; i++) {
  const midi = i + MIN_MIDI;
  const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
  const label = `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
  PIANO_KEYS.push({ midi, isBlack, whiteIdx: isBlack ? whiteCount - 1 : whiteCount, label });
  if (!isBlack) whiteCount++;
}
const TOTAL_WHITE_KEYS = 52; 

const INSTRUMENT_PRESETS = {
  piano: {
    oscillator: { type: "triangle8" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.1, release: 1.5 }
  },
  strings: {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.5, decay: 0.1, sustain: 0.8, release: 2 }
  },
  synth: {
    oscillator: { type: "square" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5 }
  },
  marimba: {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.4 }
  }
};

export default function MidiPlayer() {
  const [notes, setNotes] = useState([]);
  const [fileName, setFileName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(-6);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [instrument, setInstrument] = useState("piano");

  const canvasRef = useRef(null);
  const synthRef = useRef(null); 
  const partRef = useRef(null); 
  const rafRef = useRef(null);

  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    synthRef.current.set(INSTRUMENT_PRESETS.piano);
    Tone.Destination.volume.value = volume;

    return () => {
      synthRef.current?.dispose();
      partRef.current?.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []);

  const handleInstrumentChange = (e) => {
    const val = e.target.value;
    setInstrument(val);
    if (synthRef.current) {
      synthRef.current.releaseAll(); 
      synthRef.current.set(INSTRUMENT_PRESETS[val]);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const SPEED = 220; 

    const draw = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;

      const WHITE_W = W / TOTAL_WHITE_KEYS;
      const BLACK_W = WHITE_W * 0.6;
      const current = Tone.Transport.seconds;
      setElapsed(current);

      if (playing && duration > 0 && current >= duration) handleStop();

      ctx.fillStyle = "#04040e";
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let n = 0; n <= TOTAL_WHITE_KEYS; n++) {
        ctx.beginPath(); ctx.moveTo(n * WHITE_W, 0); ctx.lineTo(n * WHITE_W, H); ctx.stroke();
      }

      const HORIZON = H - 10; 
      const grd = ctx.createLinearGradient(0, HORIZON - 6, 0, HORIZON + 6);
      grd.addColorStop(0, "rgba(200,255,0,0)");
      grd.addColorStop(0.5, "rgba(200,255,0,0.45)");
      grd.addColorStop(1, "rgba(200,255,0,0)");
      ctx.fillStyle = grd; ctx.fillRect(0, HORIZON - 6, W, 12);

      notes.forEach((note, i) => {
        const k = PIANO_KEYS.find(pk => pk.midi === note.midi);
        if (!k) return;

        let x, w;
        if (k.isBlack) { x = (k.whiteIdx + 1) * WHITE_W - (BLACK_W / 2); w = BLACK_W; } 
        else { x = k.whiteIdx * WHITE_W; w = WHITE_W; }

        const col = COLORS[i % COLORS.length];
        const noteH = note.duration * SPEED;
        const y = HORIZON - (note.time - current) * SPEED - noteH;

        if (y + noteH < 0 || y > H) return; 

        ctx.shadowBlur = 15; ctx.shadowColor = col; ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x + 1, y, w - 2, noteH, 4) : ctx.rect(x + 1, y, w - 2, noteH);
        ctx.fill(); ctx.shadowBlur = 0;

        if (note.time <= current && note.time + note.duration >= current) {
          ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x + 1, y + noteH - 6, w - 2, 6, 2) : ctx.rect(x + 1, y + noteH - 6, w - 2, 6);
          ctx.fill();
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [notes, playing, duration]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await handleStop();
    const buf = await file.arrayBuffer();
    const midi = new Midi(buf);
    let parsed = [];
    
    midi.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        parsed.push({ midi: note.midi, time: note.time, duration: note.duration });
      });
    });

    const totalDuration = Math.max(...parsed.map((n) => n.time + n.duration), 0);
    setNotes(parsed); setFileName(file.name); setDuration(totalDuration + 1); setElapsed(0);

    if (partRef.current) partRef.current.dispose();
    partRef.current = new Tone.Part((time, note) => {
      if (synthRef.current) {
        synthRef.current.triggerAttackRelease(Tone.Frequency(note.midi, "midi"), note.duration, time);
      }
    }, parsed).start(0);

    Tone.Transport.position = 0;
  };

  const handlePlay = async () => {
    if (!notes.length) return;
    await Tone.start();
    Tone.Transport.start();
    setPlaying(true);
  };

  const handlePause = () => {
    Tone.Transport.pause();
    if (synthRef.current) synthRef.current.releaseAll(); 
    setPlaying(false);
  };

  const handleStop = () => {
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    if (synthRef.current) synthRef.current.releaseAll();
    setElapsed(0); setPlaying(false);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    Tone.Destination.volume.value = val; 
  };

  const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className={styles.player}>
      <div className={styles.topbar}>
        <label className={styles.uploadBtn}>
          <input type="file" accept=".mid,.midi" onChange={handleUpload} hidden />
          ↑ Load MIDI
        </label>

        {fileName && <span className={styles.fileName}>{fileName}</span>}

        <div className={styles.transport}>
          <button className={styles.tBtn} onClick={handleStop} disabled={!notes.length}>■</button>
          {playing ? (
            <button className={`${styles.tBtn} ${styles.tBtnActive}`} onClick={handlePause}>⏸</button>
          ) : (
            <button className={`${styles.tBtn} ${styles.tBtnPlay}`} onClick={handlePlay} disabled={!notes.length}>▶</button>
          )}
        </div>

        <div className={styles.instrumentSelector}>
          <select value={instrument} onChange={handleInstrumentChange}>
            <option value="piano">🎹 Syn-Piano</option>
            <option value="strings">🎻 Syn-Strings</option>
            <option value="synth">🤖 Retro Synth</option>
            <option value="marimba">🪵 Marimba</option>
          </select>
        </div>

        <button 
          className={`${styles.tBtn} ${showNotes ? styles.tBtnActive : ""}`} 
          onClick={() => setShowNotes(!showNotes)}
          style={{ width: "auto", padding: "0 16px", fontSize: "0.8rem" }}
        >
          {showNotes ? "Hide Notes" : "Show Notes"}
        </button>

        <div className={styles.volumeControl}>
          <span>🔊</span>
          <input type="range" min="-40" max="10" value={volume} onChange={handleVolumeChange} />
        </div>
      </div>

      <div className={styles.canvasContainer}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {!notes.length && <div className={styles.empty}>Load a .mid file above to begin</div>}
      </div>

      <div className={styles.progressRow}>
        <span className={styles.time}>{fmt(elapsed)}</span>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className={styles.time}>{fmt(duration)}</span>
      </div>

      <div className={styles.keyboardWrap}>
        <div className={styles.keyboard}>
          {PIANO_KEYS.map((key) => {
            const active = playing && notes.some((n) => n.midi === key.midi && n.time <= elapsed && n.time + n.duration >= elapsed);
            if (!key.isBlack) {
              return (
                <div key={key.midi} className={`${styles.whiteKey} ${active ? styles.activeWhite : ""}`} style={{ left: `${(key.whiteIdx / TOTAL_WHITE_KEYS) * 100}%`, width: `${100 / TOTAL_WHITE_KEYS}%` }}>
                  {showNotes && <span className={styles.keyLabelDark}>{key.label}</span>}
                </div>
              );
            } else {
              return (
                <div key={key.midi} className={`${styles.blackKey} ${active ? styles.activeBlack : ""}`} style={{ left: `${((key.whiteIdx + 1) / TOTAL_WHITE_KEYS) * 100}%`, width: `${(100 / TOTAL_WHITE_KEYS) * 0.6}%`, marginLeft: `-${(100 / TOTAL_WHITE_KEYS) * 0.3}%` }}>
                  {showNotes && <span className={styles.keyLabelLight}>{key.label}</span>}
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}