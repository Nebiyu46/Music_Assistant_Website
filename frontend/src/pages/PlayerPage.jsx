import { useNavigate } from "react-router-dom";
import MidiPlayer from "../components/MidiPlayer";
import styles from "./SubPage.module.css";

export default function PlayerPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.root}>
      <button className={styles.back} onClick={() => navigate("/")}>
        ← Back
      </button>
      <div className={styles.playerWrap}>
        <div className={styles.playerHeader}>
          <span className={styles.chip}>🎹 MIDI Player</span>
          <h2 className={styles.title}>Visualizer</h2>
          <p className={styles.sub}>Upload a .mid file and watch the notes fall.</p>
        </div>
        <MidiPlayer />
      </div>
    </div>
  );
}
