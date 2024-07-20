from depmap.public.announcements.models import Announcement
from depmap.public.announcements.utils import parse_announcements_yaml
from pydantic import ValidationError
import pytest


@pytest.mark.parametrize(
    "bad_date", ["12.23", "01/02/23", "Jan/02/23", "13.2.23", "1.2.33",],
)
def test_bad_announcement_dates(bad_date):
    with pytest.raises(ValidationError):
        Announcement(title="Test Date", date=bad_date, description="test")


def test_announcements():
    announcements = parse_announcements_yaml(
        "tests/depmap/public/announcements/test_announcements.yaml",
    )
    assert len(announcements) == 3

    expected_announcements = [
        Announcement(
            title="Fixed Bug in Custom Analysis and Celligner Results",
            date="11.07.23",
            description="<p>In the previous deploy, the celligner results were not updated and custom analysis was lot loading for some users. Fixes for these issues has been added.</p>",
        ),
        Announcement(
            title="New DepMap Data!",
            date="11.01.23",
            description='<p>The 23Q4 release is now live and contains several new datasets, portal tools, metadata and pipeline improvements. Please read the <a href="https://drive.google.com/drive/folders/1OnlGEcHvuKWL8CseuvnpSPjwD1V3GIOe">release notes</a> for more details.</p>',
        ),
        Announcement(
            title="",
            date="09.25.23",
            description="<p>We are excited to announce the launch of the Context Explorer, a brand new tool to discover selective gene dependencies and drug sensitivities, as well as see available data. The Context Explorer allows you to browse through lineages and primary disease types to investigate results for a context of your choosing. </p>\n<p>In the scope of the Context Explorer, a selective vulnerability is one that shows up more strongly and/or more frequently in the selected context as compared to a defined “out-group”. Each vulnerability can also be clicked on to be viewed in greater detail, both in and outside of the selected context. </p>\n<p>The Context Explorer can be connected to Data Explorer 2, and all results are downloadable. We are looking forward to hearing your feedback on this tool!</p>",
        ),
    ]

    for i, announcement in enumerate(announcements):
        assert announcement.title == expected_announcements[i].title
        assert announcement.date == expected_announcements[i].date
        assert announcement.description == expected_announcements[i].description
