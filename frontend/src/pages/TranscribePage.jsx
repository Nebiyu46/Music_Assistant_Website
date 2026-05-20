import { useNavigate } from "react-router-dom";
import AudioTranscribe from "../components/AudioTranscribe";
import styles from "./SubPage.module.css";

export default function TranscribePage() {
  const navigate = useNavigate();
  return (
    <div className={styles.root} style={{ padding: "32px", boxSizing: "border-box" }}>
      <button className={styles.back} onClick={() => navigate("/")}>
        ← Back
      </button>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div className={styles.playerHeader}>
          <span className={styles.chip}>🎙️ MIDI Toolbox</span>
          <h2 className={styles.title}>Audio Transcription</h2>
          <p className={styles.sub}>
            Automatic Masinko transcription powered by your finetuned Basic Pitch model.
          </p>
        </div>
        <AudioTranscribe />
      </div>
    </div>
  );
}
