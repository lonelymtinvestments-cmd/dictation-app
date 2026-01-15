import os
import tempfile
import logging
from typing import Optional

from config import config
from models import TranscriptionMethod, TranscriptionResult, SpeakerSegment

logger = logging.getLogger(__name__)

# Lazy load whisper to avoid slow startup
_whisper_model = None


def get_whisper_model():
    """Load faster-whisper model on first use."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        logger.info(f"Loading faster-whisper model: {config.WHISPER_MODEL}")
        # Use CPU with int8 quantization for better compatibility
        _whisper_model = WhisperModel(
            config.WHISPER_MODEL,
            device="cpu",
            compute_type="int8"
        )
    return _whisper_model


async def transcribe_local(
    audio_path: str, language: Optional[str] = None
) -> tuple[str, list[dict], float]:
    """
    Transcribe audio using local faster-whisper model.

    Returns:
        Tuple of (full_text, segments, duration)
    """
    model = get_whisper_model()

    logger.info(f"Transcribing with local faster-whisper: {audio_path}")

    # faster-whisper returns segments iterator and info
    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
    )

    segments = []
    full_text_parts = []

    for seg in segments_iter:
        segments.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
        })
        full_text_parts.append(seg.text.strip())

    full_text = " ".join(full_text_parts)
    duration = segments[-1]["end"] if segments else 0.0

    return full_text, segments, duration


async def transcribe_cloud(
    audio_path: str, language: Optional[str] = None
) -> tuple[str, list[dict], float]:
    """
    Transcribe audio using OpenAI Whisper API.

    Returns:
        Tuple of (full_text, segments, duration)
    """
    from openai import OpenAI

    if not config.OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")

    client = OpenAI(api_key=config.OPENAI_API_KEY)

    logger.info(f"Transcribing with OpenAI API: {audio_path}")

    with open(audio_path, "rb") as audio_file:
        # Request verbose JSON for timestamps
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            language=language,
        )

    segments = []
    for seg in response.segments or []:
        segments.append(
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            }
        )

    duration = response.duration or (segments[-1]["end"] if segments else 0.0)

    return response.text, segments, duration


async def transcribe(
    audio_path: str,
    method: TranscriptionMethod = TranscriptionMethod.LOCAL,
    language: Optional[str] = None,
) -> tuple[str, list[dict], float]:
    """
    Transcribe audio file using specified method.

    Args:
        audio_path: Path to audio file
        method: Transcription method (local or cloud)
        language: Language code (auto-detect if None)

    Returns:
        Tuple of (full_text, segments, duration)
    """
    if method == TranscriptionMethod.LOCAL:
        return await transcribe_local(audio_path, language)
    else:
        return await transcribe_cloud(audio_path, language)


def is_whisper_available() -> bool:
    """Check if local Whisper is available."""
    try:
        from faster_whisper import WhisperModel
        return True
    except ImportError:
        return False


def is_cloud_available() -> bool:
    """Check if cloud transcription is available."""
    return bool(config.OPENAI_API_KEY)
