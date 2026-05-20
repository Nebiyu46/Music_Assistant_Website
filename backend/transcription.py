"""Audio-to-MIDI transcription using the finetuned Basic Pitch PyTorch model."""

from __future__ import annotations

import io
import sys
from pathlib import Path
from typing import Dict, Tuple

import librosa
import numpy as np
import pretty_midi
import torch

VENDOR_DIR = Path(__file__).resolve().parent / "vendor" / "basic-pitch-torch"


def _ensure_vendor():
    if not VENDOR_DIR.is_dir():
        raise FileNotFoundError(
            "basic-pitch-torch not found. Run backend/setup_vendor.ps1 first."
        )
    if str(VENDOR_DIR) not in sys.path:
        sys.path.insert(0, str(VENDOR_DIR))


_ensure_vendor()

import scipy.signal

if not hasattr(scipy.signal, "gaussian"):
    from scipy.signal.windows import gaussian as _gaussian

    scipy.signal.gaussian = _gaussian  # type: ignore[attr-defined]

from basic_pitch_torch.model import BasicPitchTorch  # noqa: E402
from basic_pitch_torch.note_creation import model_output_to_notes  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CKPT = BASE_DIR / "masinqo_basic_pitch_best_v3.pth"

BEST_CFG = {
    "onset_thresh": 0.85,
    "frame_thresh": 0.35,
    "min_note_len": 11,
    "infer_onsets": True,
    "melodia_trick": True,
}

TIME_STRETCH_FACTOR = 2.0

_model = None
_device = None


def _get_device() -> torch.device:
    global _device
    if _device is None:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _device


def _resolve_checkpoint() -> Path:
    if DEFAULT_CKPT.exists():
        return DEFAULT_CKPT
    matches = sorted(BASE_DIR.glob("*.pth"))
    if matches:
        return matches[0]
    raise FileNotFoundError(
        f"No checkpoint found. Place masinqo_basic_pitch_best_v3.pth in {BASE_DIR}"
    )


def _load_model() -> BasicPitchTorch:
    global _model
    if _model is not None:
        return _model

    device = _get_device()
    ckpt = _resolve_checkpoint()
    model = BasicPitchTorch().to(device)
    try:
        state = torch.load(ckpt, map_location=device, weights_only=True)
    except TypeError:
        state = torch.load(ckpt, map_location=device)
    model.load_state_dict(state)
    model.eval()
    _model = model
    return _model


def _model_forward(model: BasicPitchTorch, audio_path: Path) -> Dict[str, np.ndarray]:
    y, _ = librosa.load(str(audio_path), sr=22050, mono=True)
    x = torch.tensor(y, dtype=torch.float32).unsqueeze(0).unsqueeze(1).to(_get_device())
    with torch.no_grad():
        out = model(x)
    return {
        "onset": out["onset"].squeeze(0).cpu().numpy(),
        "note": out["note"].squeeze(0).cpu().numpy(),
        "contour": out["contour"].squeeze(0).cpu().numpy(),
    }


def _decode(outputs: Dict[str, np.ndarray], cfg: dict) -> Tuple[pretty_midi.PrettyMIDI, list]:
    midi, note_events = model_output_to_notes(
        outputs,
        onset_thresh=cfg["onset_thresh"],
        frame_thresh=cfg["frame_thresh"],
        infer_onsets=cfg["infer_onsets"],
        min_note_len=cfg["min_note_len"],
        include_pitch_bends=True,
        multiple_pitch_bends=False,
        melodia_trick=cfg["melodia_trick"],
    )

    for inst in midi.instruments:
        for note in inst.notes:
            note.start *= TIME_STRETCH_FACTOR
            note.end *= TIME_STRETCH_FACTOR
        for pb in inst.pitch_bends:
            pb.time *= TIME_STRETCH_FACTOR

    corrected_events = []
    for ev in note_events:
        corrected_events.append(
            (ev[0] * TIME_STRETCH_FACTOR, ev[1] * TIME_STRETCH_FACTOR, ev[2], ev[3])
        )

    return midi, corrected_events


def transcribe_wav_to_midi_bytes(
    wav_path: Path,
    *,
    rename_to_masinko: bool = True,
) -> Tuple[bytes, int]:
    """Transcribe a WAV file and return MIDI bytes plus note count."""
    model = _load_model()
    outputs = _model_forward(model, wav_path)
    midi, note_events = _decode(outputs, BEST_CFG)

    if rename_to_masinko:
        program = pretty_midi.instrument_name_to_program("Violin")
        for inst in midi.instruments:
            inst.program = program
            inst.name = "Masinko"

    buf = io.BytesIO()
    midi.write(buf)
    return buf.getvalue(), len(note_events)
