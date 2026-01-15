"""
Streaming transcription service for real-time audio processing.
"""
import os
import io
import tempfile
import logging
from typing import Optional, Generator
from pydub import AudioSegment

from config import config
from services.transcription import get_whisper_model

logger = logging.getLogger(__name__)


class StreamingTranscriber:
    """
    Handles streaming audio transcription with buffering.

    Accumulates audio chunks and transcribes when buffer reaches threshold.
    Tracks time offset across multiple transcription calls for continuous timestamps.
    """

    def __init__(self, language: Optional[str] = None):
        self.language = language
        self.audio_buffer = io.BytesIO()
        self.time_offset = 0.0  # Cumulative time from previous chunks
        self.buffer_duration = 0.0  # Duration of current buffer
        self.min_buffer_seconds = 2.0  # Minimum audio before transcribing
        self.is_paused = False

    def add_chunk(self, audio_data: bytes) -> list[dict]:
        """
        Add audio chunk to buffer and transcribe if buffer is large enough.

        Args:
            audio_data: Raw audio bytes (WebM/Opus format)

        Returns:
            List of transcription segments (empty if buffer not ready)
        """
        if self.is_paused:
            return []

        # Append to buffer
        self.audio_buffer.write(audio_data)

        # Try to get duration of accumulated audio
        try:
            self.audio_buffer.seek(0)
            audio = AudioSegment.from_file(self.audio_buffer, format="webm")
            self.buffer_duration = len(audio) / 1000.0  # Convert ms to seconds
            self.audio_buffer.seek(0, 2)  # Seek back to end
        except Exception as e:
            logger.debug(f"Could not parse audio duration: {e}")
            return []

        # Transcribe if buffer has enough audio
        if self.buffer_duration >= self.min_buffer_seconds:
            return self._transcribe_buffer()

        return []

    def _transcribe_buffer(self) -> list[dict]:
        """Transcribe the current buffer and return segments."""
        try:
            # Convert buffer to WAV for Whisper
            self.audio_buffer.seek(0)
            audio = AudioSegment.from_file(self.audio_buffer, format="webm")

            # Save to temporary WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                audio.export(tmp.name, format="wav")
                tmp_path = tmp.name

            try:
                # Transcribe
                model = get_whisper_model()
                segments_iter, info = model.transcribe(
                    tmp_path,
                    language=self.language,
                    beam_size=5,
                )

                # Collect segments with adjusted timestamps
                segments = []
                for seg in segments_iter:
                    segments.append({
                        "start": seg.start + self.time_offset,
                        "end": seg.end + self.time_offset,
                        "text": seg.text.strip(),
                        "speaker": "Speaker",
                    })

                # Update time offset for next chunk
                self.time_offset += self.buffer_duration

                # Clear buffer
                self.audio_buffer = io.BytesIO()
                self.buffer_duration = 0.0

                return segments

            finally:
                # Clean up temp file
                os.unlink(tmp_path)

        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return []

    def pause(self):
        """Pause transcription (stop processing new chunks)."""
        self.is_paused = True

    def resume(self):
        """Resume transcription."""
        self.is_paused = False

    def flush(self) -> list[dict]:
        """
        Flush remaining audio in buffer (call when recording stops).

        Returns any remaining transcription segments.
        """
        if self.buffer_duration > 0.3:  # Only transcribe if there's meaningful audio
            return self._transcribe_buffer()
        return []

    def reset(self):
        """Reset transcriber state for new recording session."""
        self.audio_buffer = io.BytesIO()
        self.time_offset = 0.0
        self.buffer_duration = 0.0
        self.is_paused = False
