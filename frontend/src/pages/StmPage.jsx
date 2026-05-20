import { useState } from "react";
import { Link } from "react-router-dom";
import DragDropZone from "../components/DragDropZone";
import styles from "../components/StmPanel.module.css";
import scoreStyles from "../components/MidiScore.module.css";
import {
  fetchStm32CsvFromMidiFile,
  sendCsvToStm32,
} from "../utils/stm32";

export default function StmPage() {
  const [midiFile, setMidiFile] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [noteCount, setNoteCount] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMidiFile = async (file) => {
    setMidiFile(file);
    setCsvText("");
    setNoteCount(null);
    setLoading(true);
    setStatus("Converting MIDI for STM32…");

    try {
      const csv = await fetchStm32CsvFromMidiFile(file);
      setCsvText(csv);
      const lines = csv.split("\n").filter((l) => l.trim());
      setNoteCount(lines.length);
      setStatus(`Ready: ${lines.length} notes converted.`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setMidiFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!csvText) return;
    const blob = new Blob([csvText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "song.txt";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Downloaded song.txt");
  };

  const handleSendToDevice = async () => {
    if (!csvText) return;
    setLoading(true);
    try {
      await sendCsvToStm32(csvText, setStatus);
      setStatus("Transfer complete.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        width: "100vw",
        backgroundColor: "var(--bg)",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.chip}>⚡ STM32</span>
          <h2 className={styles.title}>Device Transfer</h2>
          <p className={styles.sub}>
            Upload a MIDI file. It is converted to start,note,duration (ms) and
            sent over UART serial.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>MIDI file</label>
          <DragDropZone
            accept=".mid,.midi,audio/midi,audio/mid"
            onFile={handleMidiFile}
            disabled={loading}
            className={scoreStyles.uploadBox}
          >
            📁 Drop MIDI here or click to browse
          </DragDropZone>
          {midiFile && (
            <div className={scoreStyles.fileName}>{midiFile.name}</div>
          )}
          {noteCount != null && (
            <div className={scoreStyles.fileName}>{noteCount} notes</div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={handleDownload}
            disabled={loading || !csvText}
          >
            ↓ Download .txt
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSendToDevice}
            disabled={loading || !csvText}
          >
            {loading ? "Working…" : "Send to STM32 →"}
          </button>
        </div>

        {status && (
          <div className={styles.status}>
            <span className={styles.statusDot} />
            {status}
          </div>
        )}

        <p className={styles.footerLink}>
          Don&apos;t have a MIDI file?{" "}
          <Link to="/transcribe">Transcribe from WAV →</Link>
        </p>
      </div>
    </div>
  );
}
