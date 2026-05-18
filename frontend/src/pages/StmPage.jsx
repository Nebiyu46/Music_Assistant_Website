import { useEffect, useState } from "react";
import styles from "../components/StmPanel.module.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function StmPage() {
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

  // Helper function to replace Python's time.sleep()
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleSendToDevice = async () => {
    if (!selectedId) return;

    if (!("serial" in navigator)) {
      setStatus("Web Serial API is not supported in this browser. Use Chrome or Edge.");
      return;
    }

    setLoading(true);
    setStatus("Select your STM32 port...");

    try {
      // 1. Fetch the parsed text data directly from the existing download endpoint
      const res = await fetch(`${API_BASE}/api/download/${selectedId}`);
      if (!res.ok) throw new Error("Failed to fetch song data from backend");
      const csvText = await res.text();
      const lines = csvText.split("\n").filter((line) => line.trim() !== "");

      // 2. Request port access from user and open connection
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setStatus("Port opened. Sending data...");

      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();

      // 3. Send START command
      await writer.write(encoder.encode("START\n"));
      await delay(100);

      // 4. Stream Data
      for (let i = 0; i < lines.length; i++) {
        await writer.write(encoder.encode(lines[i] + "\n"));
        // 10ms throttle to prevent STM32 buffer overflow
        await delay(10);
      }

      // 5. Send END command
      await writer.write(encoder.encode("END\n"));
      
      writer.releaseLock();
      await delay(500); // Give the STM32 time to process END
      await port.close();

      setStatus("Transfer complete.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", width: "100vw", backgroundColor: "var(--bg)" }}>
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