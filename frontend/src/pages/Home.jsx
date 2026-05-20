import { useNavigate } from "react-router-dom";
import FallingNotes from "../components/FallingNotes";
import styles from "./Home.module.css";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className={styles.root}>
      <FallingNotes />

      {/* Added scale to make the overall content slightly smaller */}
      <div className={styles.content} style={{ transform: "scale(0.95)", transformOrigin: "top center", maxWidth: "100vw" }}>
        {/* Badge */}
        <div className={styles.badge}>
          <span className={styles.dot} />
          STM32 · MIDI · UART
        </div>

        {/* Headline: Changed text and forced color to white */}
        <h1 className={styles.title} style={{ color: "white" }}>
          MIDI<br />
          Toolbox
        </h1>

        <p className={styles.sub}>
          Load a song. Visualize it. Send it to your STM32 over UART.
        </p>

        {/* Two main CTAs: Added flex and horizontal scroll */}
        <div 
          className={styles.cards} 
          style={{ display: "flex", overflowX: "auto", gap: "1rem", paddingBottom: "10px", width: "100%" }}
        >
          <button
            className={`${styles.card} ${styles.cardStm}`}
            onClick={() => navigate("/stm32")}
            style={{ flex: "0 0 auto", minWidth: "260px", whiteSpace: "normal" }}
          >
            <div className={styles.cardIcon}>⚡</div>
            <div className={styles.cardBody}>
              <h2>STM32 Transfer</h2>
              <p>Upload a MIDI file and send it to your device over serial.</p>
            </div>
            <div className={styles.cardArrow}>→</div>
          </button>

          <button
            className={`${styles.card} ${styles.cardPlayer}`}
            onClick={() => navigate("/player")}
            style={{ flex: "0 0 auto", minWidth: "260px", whiteSpace: "normal" }}
          >
            <div className={styles.cardIcon}>🎹</div>
            <div className={styles.cardBody}>
              <h2>MIDI Player</h2>
              <p>Upload any MIDI file and watch the falling-note visualizer.</p>
            </div>
            <div className={styles.cardArrow}>→</div>
          </button>

          {/* ADD THIS NEW BUTTON */}
          <button
            className={`${styles.card} ${styles.cardScore}`}
            onClick={() => navigate("/score")}
            style={{ flex: "0 0 auto", minWidth: "260px", whiteSpace: "normal" }}
          >
            <div className={styles.cardIcon}>🎼</div>
            <div className={styles.cardBody}>
              <h2>MIDI Score</h2>
              <p>View your loaded sequence as traditional sheet music.</p>
            </div>
            <div className={styles.cardArrow}>→</div>
          </button>

          <button
            className={`${styles.card} ${styles.cardTranscribe}`}
            onClick={() => navigate("/transcribe")}
            style={{ flex: "0 0 auto", minWidth: "260px", whiteSpace: "normal" }}
          >
            <div className={styles.cardIcon}>🎙️</div>
            <div className={styles.cardBody}>
              <h2>Audio Transcription</h2>
              <p>Upload a WAV recording and get an automatic MIDI transcription.</p>
            </div>
            <div className={styles.cardArrow}>→</div>
          </button>
        </div>

        {/* Tiny footer line */}
        <p className={styles.footer}>
          Built with React · Flask · Tone.js
        </p>
      </div>
    </div>
  );
}