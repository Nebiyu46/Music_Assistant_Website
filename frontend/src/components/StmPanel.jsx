import { useEffect, useState } from "react";
import styles from "./StmPanel.module.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function StmPanel() {
  const [songs, setSongs] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/songs`);
        if (!res.ok) throw new Error("Failed to load songs");
        const data = await res.json();
        setSongs(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } catch {
        setStatus("Error loading songs.");
      }
    };
    fetchSongs();
  }, []);

  const handleDownload = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/download/${selectedId}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "song.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus("Downloaded successfully.");
    } catch {
      setStatus("Download failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToDevice = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/send/${selectedId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");
      setStatus(data.message);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.fullscreenWrapper}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.chip}>⚡ STM32</span>
          <h2 className={styles.title}>Device Transfer</h2>
          <p className={styles.sub}>Select a song and push it to your STM32 over UART serial.</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Song</label>
          <select
            className={styles.select}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={handleDownload}
            disabled={loading}
          >
            ↓ Download .txt
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSendToDevice}
            disabled={loading}
          >
            {loading ? "Sending…" : "Send to STM32 →"}
          </button>
        </div>

        {status && (
          <div className={styles.status}>
            <span className={styles.statusDot} />
            {status}
          </div>
        )}
      </div>
    </div>
  );
}