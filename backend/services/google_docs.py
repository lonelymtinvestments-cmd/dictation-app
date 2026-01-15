import logging
from datetime import datetime
from typing import Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from config import config
from models import TranscriptionResult, GoogleDocResponse

logger = logging.getLogger(__name__)


def format_timestamp(seconds: float) -> str:
    """Format seconds as HH:MM:SS."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def format_transcript_for_doc(transcript: TranscriptionResult, title: str) -> str:
    """
    Format transcript as text for Google Doc.
    """
    lines = [
        title,
        "=" * len(title),
        "",
        f"Duration: {format_timestamp(transcript.duration)}",
        f"Language: {transcript.language or 'Auto-detected'}",
        "",
        "-" * 50,
        "",
    ]

    current_speaker = None
    for seg in transcript.segments:
        timestamp = format_timestamp(seg.start_time)

        if seg.speaker != current_speaker:
            current_speaker = seg.speaker
            lines.append(f"\n[{timestamp}] {seg.speaker}:")
            lines.append(seg.text)
        else:
            lines.append(seg.text)

    return "\n".join(lines)


async def create_document(
    credentials: Credentials,
    transcript: TranscriptionResult,
    title: Optional[str] = None,
    folder_id: Optional[str] = None,
) -> GoogleDocResponse:
    """
    Create a new Google Doc with the transcript.

    Args:
        credentials: Google OAuth credentials
        transcript: Transcription result to save
        title: Document title (auto-generated if None)
        folder_id: Google Drive folder ID (root if None)

    Returns:
        GoogleDocResponse with document details
    """
    # Generate title if not provided
    if not title:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        title = f"Transcript - {timestamp}"

    # Build service clients
    docs_service = build("docs", "v1", credentials=credentials)
    drive_service = build("drive", "v3", credentials=credentials)

    # Create empty document
    logger.info(f"Creating Google Doc: {title}")
    doc = docs_service.documents().create(body={"title": title}).execute()
    document_id = doc["documentId"]

    # Format transcript content
    content = format_transcript_for_doc(transcript, title)

    # Insert content into document
    requests = [
        {
            "insertText": {
                "location": {"index": 1},
                "text": content,
            }
        }
    ]
    docs_service.documents().batchUpdate(
        documentId=document_id, body={"requests": requests}
    ).execute()

    # Move to folder if specified
    if folder_id:
        drive_service.files().update(
            fileId=document_id, addParents=folder_id, fields="id, parents"
        ).execute()

    document_url = f"https://docs.google.com/document/d/{document_id}"

    logger.info(f"Created document: {document_url}")

    return GoogleDocResponse(
        document_id=document_id, document_url=document_url, title=title
    )


async def list_folders(credentials: Credentials) -> list[dict]:
    """
    List Google Drive folders the user has access to.
    """
    drive_service = build("drive", "v3", credentials=credentials)

    results = (
        drive_service.files()
        .list(
            q="mimeType='application/vnd.google-apps.folder' and trashed=false",
            spaces="drive",
            fields="files(id, name)",
            orderBy="name",
        )
        .execute()
    )

    return results.get("files", [])


def is_google_docs_available() -> bool:
    """Check if Google Docs integration is available."""
    return bool(config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET)
