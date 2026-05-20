import { useNavigate } from "react-router-dom";
import MidiScore from "../components/MidiScore";
import styles from "./SubPage.module.css";

export default function ScorePage() {
  const navigate = useNavigate();
  return (
    <div className={styles.root} style={{ padding: "32px", boxSizing: "border-box" }}>
      <button className={styles.back} onClick={() => navigate("/")}>
        ← Back
      </button>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div className={styles.playerHeader}>
          <span className={styles.chip}>🎼 MIDI Toolbox</span>
          <h2 className={styles.title}>Sheet Music Studio</h2>
        </div>
        <MidiScore />
      </div>
    </div>
  );
}