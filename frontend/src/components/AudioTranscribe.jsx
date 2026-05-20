import { useState } from "react";
import styles from "./MidiScore.module.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export default function AudioTranscribe() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("Select a WAV recording to transcribe.");
  const [midiBlob, setMidiBlob] = useState(null);
  const [midiName, setMidiName] = useState("");
  const [noteCount, setNoteCount] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setMidiBlob(null);
    setNoteCount(null);
    setStatus(`Ready: ${file.name}`);
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    setBusy(true);
    setStatus("Transcribing on server (this may take a moment)...");
    setMidiBlob(null);
    setNoteCount(null);

    try {
      const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Transcription failed");
      }

      const blob = await response.blob();
      const count = response.headers.get("X-Note-Count");
      const base = selectedFile.name.replace(/\.[^.]+$/, "");
      const outName = `${base}.mid`;

      setMidiBlob(blob);
      setMidiName(outName);
      setNoteCount(count ? Number(count) : null);
      setStatus("Transcription complete.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!midiBlob) return;
    const url = URL.createObjectURL(midiBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = midiName || "transcription.mid";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <div className={styles.cardHeader}>
          <h3>🎙️ Audio → MIDI</h3>
          <p>
            Upload a WAV recording of Masinko playing. The finetuned Basic Pitch
            model returns a MIDI file.
          </p>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.uploadBox}>
            📁 Choose WAV File
            <input
              type="file"
              hidden
              accept=".wav,audio/wav,audio/wave"
              onChange={handleFileChange}
            />
          </label>
          {selectedFile && (
            <div className={styles.fileName}>{selectedFile.name}</div>
          )}
        </div>

        <button
          className={styles.primaryBtn}
          onClick={handleTranscribe}
          disabled={!selectedFile || busy}
        >
          {busy ? "Transcribing…" : "🎵 Transcribe to MIDI"}
        </button>

        {midiBlob && (
          <button className={styles.primaryBtn} onClick={handleDownload}>
            ⬇️ Download MIDI
          </button>
        )}

        <div className={styles.status}>{status}</div>
      </div>

      <div className={styles.preview}>
        <div className={styles.previewToolbar}>
          <div className={styles.toolbarTitle}>🎼 Transcription Result</div>
        </div>

        <div
          className={styles.canvasContainer}
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          {midiBlob ? (
            <div
              style={{
                textAlign: "center",
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--text, #fff)",
                maxWidth: 420,
              }}
            >
              <p style={{ fontSize: "1.1rem", marginBottom: 12 }}>
                {midiName}
              </p>
              {noteCount != null && (
                <p style={{ color: "var(--accent2, #00e5ff)", marginBottom: 24 }}>
                  {noteCount} notes detected
                </p>
              )}
              <p style={{ color: "var(--muted, #888)", fontSize: "0.85rem" }}>
                Download the MIDI file, then open it in the MIDI Player or Sheet
                Music studio.
              </p>
            </div>
          ) : (
            <p
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--muted, #888)",
              }}
            >
              Your transcribed MIDI will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
