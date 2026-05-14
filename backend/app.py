import io
import time
from pathlib import Path
from typing import Dict, List, Tuple
import io

import serial  # pip install pyserial
import mido    # pip install mido
from flask import Flask, abort, jsonify, send_file, request
from flask_cors import CORS
from music21 import converter

# --- CONFIGURATION ---
COM_PORT = 'COM10'  # <--- CHANGE THIS to your actual STM32 Port (e.g., /dev/ttyACM0 on Linux/Mac)
BAUD_RATE = 115200

BASE_DIR = Path(__file__).resolve().parent
SONGS_DIR = BASE_DIR / "songs"

app = Flask(__name__)
CORS(app)  # Allow React to talk to Flask

# Store loaded songs in memory
SONGS: Dict[int, Dict[str, List[Tuple[int, int, int]]]] = {}


# --- HELPER: MIDI PARSER ---
def parse_midi_to_notes(midi_path: Path) -> List[Tuple[int, int, int]]:
    """
    Parse a MIDI file into (start_ms, midi_note, duration_ms) tuples.
    """
    mid = mido.MidiFile(midi_path)
    tempo = 500_000  # Default 120 BPM
    ticks_per_beat = mid.ticks_per_beat
    current_time_sec = 0.0
    note_on_times: Dict[int, float] = {}
    notes: List[Tuple[int, int, int]] = []

    for msg in mido.merge_tracks(mid.tracks):
        # Update current time
        if msg.time:
            current_time_sec += mido.tick2second(msg.time, ticks_per_beat, tempo)

        if msg.type == "set_tempo":
            tempo = msg.tempo
        elif msg.type == "note_on" and msg.velocity > 0:
            note_on_times[msg.note] = current_time_sec
        elif msg.type in ("note_off", "note_on") and msg.velocity == 0:
            if msg.note in note_on_times:
                start = note_on_times.pop(msg.note)
                duration = current_time_sec - start
                notes.append(
                    (
                        int(round(start * 1000)),
                        int(msg.note),
                        int(round(duration * 1000)),
                    )
                )

    # Sort by start time
    notes.sort(key=lambda n: n[0])
    return notes


# --- HELPER: UART SENDER ---
def send_over_uart(song_data: List[Tuple[int, int, int]], port: str) -> bool:
    """
    Opens the serial port and streams the song data to the STM32.
    """
    try:
        print(f"Opening {port}...")
        ser = serial.Serial(port, BAUD_RATE, timeout=2)
        time.sleep(2)  # Wait for DTR/RTS reset if applicable

        # 1. Send START command
        ser.write(b"START\n")
        time.sleep(0.1)

        # 2. Stream Data
        print(f"Sending {len(song_data)} notes...")
        for start, note, duration in song_data:
            # Format: "START,NOTE,DURATION\n"
            line = f"{start},{note},{duration}\n"
            ser.write(line.encode('utf-8'))
            
            # Throttle slightly to prevent STM32 buffer overflow
            time.sleep(0.01)

        # 3. Send END command
        ser.write(b"END\n")
        print("Waiting for verification from STM32...")
        # Read response for 3 seconds
        end_time = time.time() + 3
        while time.time() < end_time:
            if ser.in_waiting:
                # Read line from STM32 and print it to Python Console
                print(f"STM32: {ser.readline().decode('utf-8', errors='ignore').strip()}")
        ser.close()
        print("Transfer complete.")
        return True

    except serial.SerialException as e:
        print(f"UART Error: {e}")
        return False
    except Exception as e:
        print(f"General Error: {e}")
        return False


# --- INITIALIZATION ---
def load_songs_from_folder():
    """Load all .mid files from the 'songs' folder."""
    global SONGS
    song_id = 1
    
    # Create folder if it doesn't exist
    if not SONGS_DIR.exists():
        SONGS_DIR.mkdir()
        print(f"Created songs folder at {SONGS_DIR}")
        return

    print(f"Scanning {SONGS_DIR} for MIDI files...")
    for midi_file in sorted(SONGS_DIR.glob("*.mid")) + sorted(SONGS_DIR.glob("*.midi")):
        try:
            notes = parse_midi_to_notes(midi_file)
            title = midi_file.stem.replace("-", " ").title()
            SONGS[song_id] = {"title": title, "notes": notes}
            print(f"Loaded: {title} ({len(notes)} notes)")
            song_id += 1
        except Exception as e:
            print(f"Failed to load {midi_file.name}: {e}")

# Load songs immediately
load_songs_from_folder()


# --- FLASK ROUTES ---

@app.route("/api/songs", methods=["GET"])
def get_songs():
    """Return list of available songs."""
    song_list = [{"id": sid, "title": data["title"]} for sid, data in SONGS.items()]
    return jsonify(song_list)
@app.route("/api/convert-upload", methods=["POST"])
def convert_upload():
    """Convert an uploaded MIDI file to MusicXML in real-time."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    
    try:
        # Save to a temporary location so music21 can read it
        temp_midi = "temp_upload.mid"
        file.save(temp_midi)
        
        # Convert MIDI -> MusicXML
        score = converter.parse(temp_midi)
        xml_out = score.write('musicxml')
        
        with open(xml_out, 'rb') as f:
            data = f.read()
            
        return send_file(
            io.BytesIO(data),
            mimetype="application/vnd.recordare.musicxml+xml"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download/<int:song_id>", methods=["GET"])
def download_song(song_id: int):
    """Download song as song.txt (CSV format) for SD Card."""
    song = SONGS.get(song_id)
    if not song:
        abort(404, description="Song not found")

    lines = [f"{start},{note},{duration}" for start, note, duration in song["notes"]]
    csv_body = "\n".join(lines)

    file_stream = io.BytesIO(csv_body.encode("utf-8"))
    
    return send_file(
        file_stream,
        mimetype="text/plain",
        as_attachment=True,
        download_name="song.txt",
    )


@app.route("/api/send/<int:song_id>", methods=["POST"])
def send_to_stm32(song_id: int):
    """Trigger UART transfer to STM32."""
    song = SONGS.get(song_id)
    if not song:
        return jsonify({"error": "Song not found"}), 404

    # Call the UART helper function
    success = send_over_uart(song["notes"], COM_PORT)

    if success:
        return jsonify({"message": f"Successfully sent '{song['title']}' to STM32!"}), 200
    else:
        return jsonify({"error": f"Failed to connect to {COM_PORT}. Check USB cable."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)