import re
import datetime

# NOTE: Discourse formats date strings like '2024-06-13T15:21:00.035Z'. Theoretically if we use python 3.11 we can use datetime.fromisoformat() with original datestring but our builds use 3.9 so we play safe by modifying the datestring such that we dont match the ending 'Z' character
# NOTE: "bumped_at" property appears to represent the date and time for the topic post content last modified
# NOTE: "last_posted_at" property appears to be updated when post gets pinned. Unsure what else it represents
# Sort by pinned posts first, then most recent update
def reformat_date(date_string):
    """
    Takes in the date string format from discourse response and returns a datetime
    """
    match = re.match("(.*)Z$", date_string)
    assert match, f"No matched date for {date_string}"
    return datetime.datetime.fromisoformat(match.group(1))
