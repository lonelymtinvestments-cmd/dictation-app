import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    # OpenAI API (for cloud transcription)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # HuggingFace token (for pyannote speaker diarization)
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")

    # Google OAuth credentials
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Whisper model size for local transcription
    # Options: tiny, base, small, medium, large
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "base")

    # Default transcription method: "local" or "cloud"
    DEFAULT_TRANSCRIPTION_METHOD: str = os.getenv(
        "DEFAULT_TRANSCRIPTION_METHOD", "local"
    )

    # Upload directory for audio files
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")

    @classmethod
    def validate(cls) -> list[str]:
        """Validate configuration and return list of missing required variables."""
        warnings = []

        if not cls.OPENAI_API_KEY:
            warnings.append("OPENAI_API_KEY not set - cloud transcription disabled")

        if not cls.HF_TOKEN:
            warnings.append("HF_TOKEN not set - speaker diarization disabled")

        if not cls.GOOGLE_CLIENT_ID or not cls.GOOGLE_CLIENT_SECRET:
            warnings.append(
                "Google OAuth credentials not set - Google Docs integration disabled"
            )

        return warnings


config = Config()
