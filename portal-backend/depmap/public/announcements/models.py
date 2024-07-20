from pydantic import BaseModel, Field, validator
import markdown
from datetime import datetime


def markdown_to_html(text):
    html = markdown.markdown(text)
    return html


class Announcement(BaseModel):
    title: str
    date: str = Field(description="Date must be in format 'mm.dd.yy'")
    description: str = Field(
        description="Should be a markdown string for initialization. The instance returns description as an HTML string"
    )
    _transform_description = validator("description", pre=True)(markdown_to_html)

    @validator("date", pre=True)
    def validate_date_format(cls, v):
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
