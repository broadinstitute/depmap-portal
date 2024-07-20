from depmap.public.announcements.models import Announcement
import yaml
from flask import current_app
import os


def parse_announcements_yaml(yaml_file_path):
    with open(yaml_file_path, "r") as file:
        parsed_yaml_announcements = yaml.safe_load(file)
    announcement_objs = [
        Announcement(
            title=announcement["title"],
            date=announcement["date"],
            description=announcement["description"],
        )
        for announcement in parsed_yaml_announcements
    ]
    return announcement_objs


def get_announcements_list():
    announcements_path = current_app.config["ANNOUNCEMENTS_FILE_PATH"]

    if os.path.exists(announcements_path):
        announcements = parse_announcements_yaml(announcements_path)
    else:
        announcements = []

    return announcements
