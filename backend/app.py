import io
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple
from itertools import groupby

import mido    # pip install mido
from flask import Flask, abort, jsonify, send_file, request
from flask_cors import CORS
from music21 import converter

from transcription import transcribe_wav_to_midi_bytes

# --- CONFIGURATION ---
BASE_DIR = Path(__file__).resolve().parent
SONGS_DIR = BASE_DIR / "songs"

app = Flask(__name__)
CORS(app, expose_headers=["X-Note-Count"])

# Store loaded songs in memory
SONGS: Dict[int, Dict[str, List[Tuple[int, int, int]]]] = {}


# --- HELPER: MIDI PARSER ---
def parse_midi_to_notes(midi_path: Path) -> List[Tuple[int, int, int]]:
    mid = mido.MidiFile(midi_path)
    tempo = 500_000
    ticks_per_beat = mid.ticks_per_beat
    current_time_sec = 0.0
    note_on_times: Dict[int, float] = {}
    notes: List[Tuple[int, int, int]] = []

    for msg in mido.merge_tracks(mid.tracks):
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
                notes.append((
                    int(round(start * 1000)),
                    int(msg.note),
                    int(round(duration * 1000)),
                ))

    notes.sort(key=lambda n: n[0])

    # Group by start time, keep only highest note
    filtered = []
    for start_time, group in groupby(notes, key=lambda n: n[0]):
        group_list = list(group)
        # Keep the highest MIDI note (melody)
        best = max(group_list, key=lambda n: n[1])
        filtered.append(best)

    return filtered


def notes_to_csv(notes: List[Tuple[int, int, int]]) -> str:
    """STM32 format: start_ms,note,duration_ms per line."""
    return "\n".join(f"{start},{note},{duration}" for start, note, duration in notes)


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


@app.route("/api/transcribe", methods=["POST"])
def transcribe_audio():
    """Transcribe an uploaded WAV file to MIDI using the finetuned Basic Pitch model."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in (".wav", ".wave"):
        return jsonify({"error": "Only .wav files are supported"}), 400

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            file.save(tmp.name)
            wav_path = Path(tmp.name)

        midi_bytes, note_count = transcribe_wav_to_midi_bytes(wav_path)
        wav_path.unlink(missing_ok=True)

        out_name = Path(file.filename).stem + ".mid"
        response = send_file(
            io.BytesIO(midi_bytes),
            mimetype="audio/midi",
            as_attachment=True,
            download_name=out_name,
        )
        response.headers["X-Note-Count"] = str(note_count)
        return response
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/convert-midi-stm32", methods=["POST"])
def convert_midi_stm32():
    """Convert uploaded MIDI to STM32 CSV (start_ms,note,duration_ms)."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in (".mid", ".midi"):
        return jsonify({"error": "Only .mid / .midi files are supported"}), 400

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            file.save(tmp.name)
            midi_path = Path(tmp.name)

        notes = parse_midi_to_notes(midi_path)
        midi_path.unlink(missing_ok=True)

        if not notes:
            return jsonify({"error": "No notes found in MIDI file"}), 400

        csv_body = notes_to_csv(notes)
        response = send_file(
            io.BytesIO(csv_body.encode("utf-8")),
            mimetype="text/plain",
        )
        response.headers["X-Note-Count"] = str(len(notes))
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download/<int:song_id>", methods=["GET"])
def download_song(song_id: int):
    """Download song as song.txt (CSV format) for SD Card or Web Serial streaming."""
    song = SONGS.get(song_id)
    if not song:
        abort(404, description="Song not found")

    csv_body = notes_to_csv(song["notes"])

    file_stream = io.BytesIO(csv_body.encode("utf-8"))
    
    return send_file(
        file_stream,
        mimetype="text/plain",
        as_attachment=True,
        download_name="song.txt",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)