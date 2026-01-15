import os
import tempfile
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.oauth2.credentials import Credentials

from config import config
from models import (
    TranscriptionMethod,
    TranscriptionRequest,
    TranscriptionResult,
    SpeakerSegment,
    GoogleDocRequest,
    GoogleDocResponse,
    HealthResponse,
)
from services.transcription import (
    transcribe,
    is_whisper_available,
    is_cloud_available,
)
from services.diarization import (
    diarize,
    align_transcription_with_speakers,
    merge_consecutive_speaker_segments,
    is_diarization_available,
)
from services.google_docs import (
    create_document,
    list_folders,
    is_google_docs_available,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Dictation API",
    description="Speech-to-text transcription with speaker diarization",
    version="1.0.0",
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
os.makedirs(config.UPLOAD_DIR, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Log configuration warnings on startup."""
    warnings = config.validate()
    for warning in warnings:
        logger.warning(warning)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and available features."""
    return HealthResponse(
        status="healthy",
        whisper_available=is_whisper_available(),
        diarization_available=is_diarization_available(),
        google_docs_available=is_google_docs_available(),
    )


@app.post("/transcribe", response_model=TranscriptionResult)
async def transcribe_audio(
    file: UploadFile = File(...),
    method: TranscriptionMethod = Query(default=TranscriptionMethod.LOCAL),
    enable_diarization: bool = Query(default=True),
    language: Optional[str] = Query(default=None),
):
    """
    Transcribe uploaded audio file.

    - **file**: Audio file (WAV, MP3, WebM, etc.)
    - **method**: Transcription method (local or cloud)
    - **enable_diarization**: Enable speaker identification
    - **language**: Language code (e.g., 'en', 'es') or None for auto-detect
    """
    # Validate method availability
    if method == TranscriptionMethod.LOCAL and not is_whisper_available():
        raise HTTPException(
            status_code=400, detail="Local Whisper not available. Install openai-whisper."
        )
    if method == TranscriptionMethod.CLOUD and not is_cloud_available():
        raise HTTPException(
            status_code=400, detail="Cloud transcription not available. Set OPENAI_API_KEY."
        )

    # Save uploaded file temporarily
    suffix = os.path.splitext(file.filename)[1] if file.filename else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        logger.info(f"Processing audio file: {file.filename} ({len(content)} bytes)")

        # Run transcription
        text, trans_segments, duration = await transcribe(temp_path, method, language)

        # Run diarization if enabled and available
        if enable_diarization and is_diarization_available():
            logger.info("Running speaker diarization...")
            speaker_segments = await diarize(temp_path)
            aligned_segments = align_transcription_with_speakers(
                trans_segments, speaker_segments
            )
            merged_segments = merge_consecutive_speaker_segments(aligned_segments)
        else:
            # No diarization - use single speaker
            merged_segments = [
                SpeakerSegment(
                    speaker="Speaker",
                    start_time=seg["start"],
                    end_time=seg["end"],
                    text=seg["text"],
                )
                for seg in trans_segments
            ]

        return TranscriptionResult(
            text=text,
            segments=merged_segments,
            duration=duration,
            language=language,
        )

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up temp file
        os.unlink(temp_path)


@app.post("/save-to-docs", response_model=GoogleDocResponse)
async def save_to_google_docs(
    request: GoogleDocRequest,
    access_token: str = Query(..., description="Google OAuth access token"),
):
    """
    Save transcript to Google Docs.

    Requires a valid Google OAuth access token with docs and drive scopes.
    """
    if not is_google_docs_available():
        raise HTTPException(
            status_code=400,
            detail="Google Docs integration not configured",
        )

    try:
        # Create credentials from access token
        credentials = Credentials(token=access_token)

        result = await create_document(
            credentials=credentials,
            transcript=request.transcript,
            title=request.title,
            folder_id=request.folder_id,
        )

        return result

    except Exception as e:
        logger.error(f"Failed to save to Google Docs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/google/folders")
async def get_google_folders(
    access_token: str = Query(..., description="Google OAuth access token"),
):
    """
    List available Google Drive folders.
    """
    if not is_google_docs_available():
        raise HTTPException(
            status_code=400,
            detail="Google Docs integration not configured",
        )

    try:
        credentials = Credentials(token=access_token)
        folders = await list_folders(credentials)
        return {"folders": folders}

    except Exception as e:
        logger.error(f"Failed to list folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
