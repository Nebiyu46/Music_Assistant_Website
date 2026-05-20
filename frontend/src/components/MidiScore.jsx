import { useRef, useState, useEffect } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import styles from "./MidiScore.module.css";

const API_BASE = "http://localhost:5000";

export default function MidiScore() {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("Select a MIDI file to begin.");
  const [zoom, setZoom] = useState(1.0);
  const [sheetLoaded, setSheetLoaded] = useState(false);

  useEffect(() => {
    if (containerRef.current && !osmdRef.current) {
      osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
        drawTitle: true,
        drawSubtitle: true,
        drawPartNames: false,
        renderBackend: "svg",
      });
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatus(`Ready to render: ${e.target.files[0].name}`);
      setSheetLoaded(false); 
    }
  };

  const handleUploadAndRender = async () => {
    if (!selectedFile || !osmdRef.current) return;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setStatus("Converting on server...");
      
      const response = await fetch(`${API_BASE}/api/convert-upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Server conversion failed");
      
      const xmlData = await response.text();

      setStatus("Rendering Sheet Music...");
      
      await osmdRef.current.load(xmlData);
      setSheetLoaded(true);
      osmdRef.current.render();
      
      setStatus("Render complete!");
    } catch (err) {
      console.error(err);
      setStatus("Error: Check Flask server.");
      setSheetLoaded(false);
    }
  };

  useEffect(() => {
    if (sheetLoaded && osmdRef.current && osmdRef.current.IsReadyToRender) {
      osmdRef.current.Zoom = zoom;
      osmdRef.current.render();
    }
  }, [zoom, sheetLoaded]);

  return (
    <div className={styles.layout}>
      {/* LEFT SIDEBAR */}
      <div className={styles.sidebar}>
        <div className={styles.cardHeader}>
          <h3>☁️ Upload & Convert</h3>
          <p>Generate professional sheet music from any MIDI file.</p>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.uploadBox}>
            📁 Choose MIDI File
            <input 
              type="file" 
              hidden 
              onChange={handleFileChange} 
              accept=".mid,.midi" 
            />
          </label>
          {selectedFile && <div className={styles.fileName}>{selectedFile.name}</div>}
        </div>

        <button 
          className={styles.primaryBtn} 
          onClick={handleUploadAndRender}
          disabled={!selectedFile}
        >
          🎵 Convert to Sheet Music
        </button>

        <div className={styles.status}>{status}</div>
      </div>

      {/* RIGHT PREVIEW AREA */}
      <div className={styles.preview}>
        <div className={styles.previewToolbar}>
          <div className={styles.toolbarTitle}>📄 Sheet Music Preview</div>
          <div className={styles.zoomControls}>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}>+</button>
          </div>
        </div>

        <div className={styles.canvasContainer}>
          <div className={styles.canvasWrapper} ref={containerRef} />
        </div>
      </div>
    </div>
  );
}