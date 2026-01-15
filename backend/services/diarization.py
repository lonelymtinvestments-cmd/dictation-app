import logging
from typing import Optional

from config import config
from models import SpeakerSegment

logger = logging.getLogger(__name__)

# Lazy load diarization pipeline
_diarization_pipeline = None


def get_diarization_pipeline():
    """Load pyannote diarization pipeline on first use."""
    global _diarization_pipeline
    if _diarization_pipeline is None:
        if not config.HF_TOKEN:
            raise ValueError("HuggingFace token not configured for diarization")

        from pyannote.audio import Pipeline

        logger.info("Loading pyannote diarization pipeline...")
        _diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", use_auth_token=config.HF_TOKEN
        )

    return _diarization_pipeline


async def diarize(audio_path: str) -> list[dict]:
    """
    Perform speaker diarization on audio file.

    Returns:
        List of speaker segments with start, end, and speaker label
    """
    pipeline = get_diarization_pipeline()

    logger.info(f"Running speaker diarization: {audio_path}")
    diarization = pipeline(audio_path)

    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append(
            {
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker,
            }
        )

    return segments


def align_transcription_with_speakers(
    transcription_segments: list[dict], speaker_segments: list[dict]
) -> list[SpeakerSegment]:
    """
    Align transcription segments with speaker diarization.

    For each transcription segment, find the speaker who was talking
    during most of that segment.
    """
    aligned = []

    for trans_seg in transcription_segments:
        trans_start = trans_seg["start"]
        trans_end = trans_seg["end"]
        trans_mid = (trans_start + trans_end) / 2

        # Find speaker at midpoint of transcription segment
        speaker = "Unknown"
        for spk_seg in speaker_segments:
            if spk_seg["start"] <= trans_mid <= spk_seg["end"]:
                speaker = spk_seg["speaker"]
                break

        aligned.append(
            SpeakerSegment(
                speaker=speaker,
                start_time=trans_start,
                end_time=trans_end,
                text=trans_seg["text"],
            )
        )

    return aligned


def merge_consecutive_speaker_segments(
    segments: list[SpeakerSegment],
) -> list[SpeakerSegment]:
    """
    Merge consecutive segments from the same speaker.
    """
    if not segments:
        return []

    merged = [segments[0]]

    for seg in segments[1:]:
        if seg.speaker == merged[-1].speaker:
            # Same speaker - merge text
            merged[-1] = SpeakerSegment(
                speaker=seg.speaker,
                start_time=merged[-1].start_time,
                end_time=seg.end_time,
                text=merged[-1].text + " " + seg.text,
            )
        else:
            merged.append(seg)

    return merged


def is_diarization_available() -> bool:
    """Check if speaker diarization is available."""
    if not config.HF_TOKEN:
        return False
    try:
        from pyannote.audio import Pipeline

        return True
    except ImportError:
        return False
