import { useEffect, useState } from "react";
import "./index.css"; // Assuming you have a CSS file, otherwise remove this line

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function App() {
  const [songs, setSongs] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Load songs on startup
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setStatus("Loading songs...");
        const res = await fetch(`${API_BASE}/api/songs`);
        if (!res.ok) throw new Error("Failed to load songs");
        const data = await res.json();
        setSongs(data);
        // Default to the first song if available
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
        setStatus("");
      } catch (err) {
        setStatus("Error: " + err.message);
      }
    };

    fetchSongs();
  }, []);

  // Handler for SD Card Download (CSV)
  const handleDownload = async () => {
    if (!selectedId) return;
    setLoading(true);
    setStatus("Preparing file download...");
    try {
      const res = await fetch(`${API_BASE}/api/download/${selectedId}`);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "song.txt"; // Changed to .txt as per STM32 preference
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus("File downloaded successfully.");
    } catch (err) {
      setStatus("Download Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for Direct UART Transfer (USB Cable)
  const handleSendToDevice = async () => {
    if (!selectedId) return;
    setLoading(true);
    setStatus("Sending data to STM32 via USB...");
    
    try {
      const res = await fetch(`${API_BASE}/api/send/${selectedId}`, {
        method: "POST",
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send to device");
      }

      setStatus("Success: " + data.message);
      alert("Success! " + data.message); // Popup for confirmation
    } catch (err) {
      console.error(err);
      setStatus("Transfer Error: " + err.message);
      alert("Error: " + err.message + "\n\nIs the USB cable connected?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>STM32 Music Loader</h1>
        <p>Select a song to download to SD Card or send directly via USB.</p>
      </header>

      <div className="card">
        <div className="control-group">
          <label htmlFor="song-select">Select Song:</label>
          <select
            id="song-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={!songs.length || loading}
          >
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </div>

        <div className="button-group">
          {/* Button 1: Download File */}
          <button 
            onClick={handleDownload} 
            disabled={!selectedId || loading}
            className="btn btn-secondary"
          >
            {loading ? "Working..." : "Download .TXT File"}
          </button>

          {/* Button 2: Send to STM32 */}
          <button 
            onClick={handleSendToDevice} 
            disabled={!selectedId || loading}
            className="btn btn-primary"
            style={{ marginLeft: "10px", backgroundColor: "#007bff", color: "white" }}
          >
            {loading ? "Sending..." : "Send to STM32 (USB)"}
          </button>
        </div>

        {status && (
          <div className={`status-message ${status.includes("Error") ? "error" : "success"}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;