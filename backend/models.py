from pydantic import BaseModel
from typing import Optional
from enum import Enum


class TranscriptionMethod(str, Enum):
    LOCAL = "local"
    CLOUD = "cloud"


class SpeakerSegment(BaseModel):
    """A segment of speech from a single speaker."""

    speaker: str
    start_time: float  # seconds
    end_time: float  # seconds
    text: str


class TranscriptionResult(BaseModel):
    """Result of transcription with optional speaker diarization."""

    text: str  # Full transcript text
    segments: list[SpeakerSegment]  # Speaker-labeled segments
    duration: float  # Total audio duration in seconds
    language: Optional[str] = None


class TranscriptionRequest(BaseModel):
    """Request parameters for transcription."""

    method: TranscriptionMethod = TranscriptionMethod.LOCAL
    enable_diarization: bool = True
    language: Optional[str] = None  # Auto-detect if None


class GoogleDocRequest(BaseModel):
    """Request to save transcript to Google Docs."""

    transcript: TranscriptionResult
    title: Optional[str] = None  # Auto-generate if None
    folder_id: Optional[str] = None  # Root folder if None


class GoogleDocResponse(BaseModel):
    """Response after creating/updating a Google Doc."""

    document_id: str
    document_url: str
    title: str


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    whisper_available: bool
    diarization_available: bool
    google_docs_available: bool
