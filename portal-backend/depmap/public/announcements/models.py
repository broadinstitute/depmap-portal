from pydantic import BaseModel, Field, field_validator
import markdown
from datetime import datetime


class Announcement(BaseModel):
    title: str
    date: str = Field(description="Date must be in format 'mm.dd.yy'")
    description: str = Field(
        description="Should be a markdown string for initialization. The instance returns description as an HTML string"
    )

    @field_validator("description", mode="before")
    @classmethod
    def transform_description(cls, text: str) -> str:
        return markdown.markdown(text)

    @field_validator("date", mode="before")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        format = "%m.%d.%y"

        try:
            # First confirm if given date string is in expected format and can be converted into a datetime object
            datetime_input = datetime.strptime(v, format)
            # Convert datetime object back to string. Ensures output format is 'mm.dd.yy' (1.21.23 => 01.21.23)
            output_date_str = datetime_input.strftime(format)
        except Exception as e:
            raise ValueError(
                f"Bad date format:'{v}'! Date must be in format 'mm.dd.yy'"
            ) from e

        if datetime_input.year > datetime.now().year:
            raise ValueError(f"Bad date format:'{v}'! Year cannot be in the future")

        return output_date_str
