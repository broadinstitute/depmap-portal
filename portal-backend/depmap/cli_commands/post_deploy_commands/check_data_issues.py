import tempfile
import json
import os
import click
from datetime import datetime
from depmap.settings import build
from flask import current_app
from flask.cli import with_appcontext
from depmap.utilities.models import DataIssue
from depmap.taiga_id.utils import get_taiga_client
import pandas as pd
from dataclasses import dataclass, asdict
from taigapy.client_v3 import UploadedFile, LocalFormat

# this cli command is run as a separate jenkins job, because it resolves itself when run twice

env_to_taiga_id_name = {
    "istaging": {"name": "istaging-data-issues-9e7a", "file": "data_issues_summary"},
    "iqa": {"name": "iqa-data-issues-c8b1", "file": "data_issues_summary"},
    "xqa": {"name": "xqa-data-issues-8b23", "file": "data_issues_summary"},
    "xstaging": {"name": "xstaging-data-issues-4078", "file": "data_issues_summary"},
    "dqa": {"name": "dqa-data-issues-3124", "file": "data_issues_summary"},
    "dstaging": {"name": "dstaging-data-issues-993e", "file": "data_issues_summary"},
    "dev": {"name": "dev-data-issues-6ea7d", "file": "unknown_data_issues"},
}


class DataIssueDifference:
    def __init__(self, issue_type: str, previous_count: int, current_count: int):
        self.issue_type = issue_type
        self.previous_count = int(
            previous_count
        )  # type casting to deal with stray numpy types
        self.current_count = int(
            current_count
        )  # type casting to deal with stray numpy types

    def to_dict(self):
        return {
            "issue_type": self.issue_type,
            "previous_count": self.previous_count,
            "current_count": self.current_count,
        }

    def get_message(self) -> str:
        if self.previous_count == 0:
            return f'New issue data_type="{self.issue_type}", {self.current_count}'
        elif self.current_count == 0:
            return (
                f"Issue type {self.issue_type}, {self.previous_count} has been removed"
            )
        elif self.current_count > self.previous_count:
            return f"{self.current_count} data issues detected for {self.issue_type}, up from {self.previous_count} before"
        else:
            assert self.current_count < self.previous_count
            return f"{self.issue_type} data issues has been reduced from {self.previous_count} to {self.current_count}"


# the cli command here is used in the deploy-data repo, not in depmap
@click.command("check_data_issues")
@click.option("--accept_issues_and_update_reference", is_flag=True)
@click.option(
    "--acceptance_reason", type=str, required=False, default=None
)  # required if accept_issues_and_update_reference is True
@click.option(
    "--accepted_by", type=str, required=False, default=None
)  # required if accept_issues_and_update_reference is True. provide the user that accepted this
@click.option(
    "--acceptance_log_path", type=str, required=False
)  # required if accept_issues_and_update_reference is True
# @click.option("--run_number")
@with_appcontext
def check_data_issues(
    accept_issues_and_update_reference,
    acceptance_reason,
    accepted_by,
    acceptance_log_path,
):
    """
    Compares against the last record of data issues hosted on taiga
    Uploads new data issues if there are changes and accept_issues_and_update_reference is true
    """
    if accept_issues_and_update_reference:
        assert acceptance_reason is not None and accepted_by and acceptance_log_path

    issues_taiga_dataset_name = env_to_taiga_id_name[current_app.config["ENV"]]["name"]
    issues_taiga_filename = env_to_taiga_id_name[current_app.config["ENV"]]["file"]

    from datetime import datetime

    new_issues = DataIssue.get_unique_data_issues()
    if not os.path.exists("data_issues_history"):
        os.makedirs("data_issues_history")
    current_date = datetime.now()
    new_issues.to_csv(
        f"data_issues_history/data-issues-{current_date.strftime('%Y%m%dT%H%M%S')}.csv"
    )

    new_summary = get_data_issues_summary()

    # the name syntax gets the latest version, and the only file
    # this is reliant on us only having one file
    old_summary = (
        get_taiga_client()
        .get(name=issues_taiga_dataset_name, file=issues_taiga_filename)
        .set_index("data_type")
    )

    # no need to upload or do anything if they are the same
    if new_summary.equals(old_summary):
        print("No changes to data issues")
        return
    else:
        print("old summary", old_summary)
        print("--------------")
        print("new summary", new_summary)

    # else, check for differences
    new_issues, improvements = compare_data_issue_differences(old_summary, new_summary)
    all_issues_are_improvements = len(new_issues) == 0

    # we keep this as a list, so that the taiga description vs stdout output can have different joins
    #   specifically, the taiga description wants \n\n joins because of markdown
    messages = []
    if len(improvements) > 0:
        messages.append("Improved data issues:")
        messages.append(
            "\n".join(["\t" + difference.get_message() for difference in improvements])
        )
    if len(new_issues) > 0:
        messages.append("New data issues:")
        messages.append(
            "\n".join(["\t" + difference.get_message() for difference in new_issues])
        )

    # upload if there are any changes and accept_issues_and_update_reference is true
    # this is below calculating difference,  just to make sure the code above runs
    # this is also below the message construction, so that the messages can go into the description of the uploaded taiga file
    if accept_issues_and_update_reference or all_issues_are_improvements:
        if accept_issues_and_update_reference and not all_issues_are_improvements:
            messages.append(
                "Issues were detected, but accepting them and updating the reference"
            )
            append_acceptance_log(
                new_issues, acceptance_reason, accepted_by, acceptance_log_path
            )
            messages.append(f"Wrote accepted issues to ${acceptance_log_path}")

        new_issues_link = upload_data_issue_summary(
            new_summary, issues_taiga_dataset_name, messages
        )
        messages.append(
            "Uploaded new data issues summary to {}".format(new_issues_link)
        )

        # even if we pass, we still want to print things like improvements
        print("\n".join(messages))
        return
    else:
        # messages are passed as the exception message, so that they are printed at the bottom
        messages.append(
            "New issues were detected; please verify these. To say that these issues are fine and update the reference, please run with --accept_issues_and_update_reference"
        )
        # Make the command fail
        raise Exception("\n" + "\n".join(messages))


def get_data_issues_summary():
    issues = DataIssue.get_unique_data_issues()
    # count the number of issues per data_type
    df = (
        issues.groupby("data_type")
        .apply(lambda x: pd.DataFrame(dict(count=[len(x)])))
        .reset_index()[["data_type", "count"]]
    ).set_index("data_type")
    return df


def compare_data_issue_differences(old_summary, new_summary):
    # threshold of issue count changes greater than which we want to alert
    improvements = []
    new_issues = []

    # report new issues, and issues that are no longer present
    added_issue_types = set(new_summary.index) - set(old_summary.index)
    removed_issue_types = set(old_summary.index) - set(new_summary.index)

    if len(added_issue_types) > 0:
        for issue_type in added_issue_types:
            new_issues.append(
                DataIssueDifference(issue_type, 0, new_summary.loc[issue_type]["count"])
            )

    if len(removed_issue_types) > 0:
        for issue_type in removed_issue_types:
            improvements.append(
                DataIssueDifference(issue_type, old_summary.loc[issue_type]["count"], 0)
            )

    # report changes in counts
    merged_df = old_summary.rename(columns={"count": "old_count"}).merge(
        new_summary.rename(columns={"count": "new_count"}),
        how="inner",
        left_index=True,
        right_index=True,
    )
    merged_df["difference"] = merged_df["new_count"] - merged_df["old_count"]

    count_increases = merged_df[merged_df["difference"] > 0]

    if len(count_increases) > 0:
        count_increase_issues = [
            DataIssueDifference(issue_type, old_count, new_count)
            for issue_type, old_count, new_count in zip(
                count_increases.index,
                count_increases["old_count"],
                count_increases["new_count"],
            )
        ]
        new_issues = new_issues + count_increase_issues

    count_decreases = merged_df[merged_df["difference"] < 0]
    if len(count_decreases) > 0:
        count_decrease_issues = [
            DataIssueDifference(issue_type, old_count, new_count)
            for issue_type, old_count, new_count in zip(
                count_decreases.index,
                count_decreases["old_count"],
                count_decreases["new_count"],
            )
        ]
        improvements = improvements + count_decrease_issues

    return new_issues, improvements


def append_acceptance_log(
    new_issues, acceptance_reason, accepted_by, acceptance_log_path
) -> None:
    with open(acceptance_log_path, "a") as fd:
        for issue in new_issues:
            issue_dict = issue.to_dict()
            issue_dict["timestamp"] = str(datetime.now())
            issue_dict["reason"] = acceptance_reason
            issue_dict["user"] = accepted_by
            fd.write(json.dumps(issue_dict) + "\n")


def upload_data_issue_summary(df, taiga_id_dataset_name, messages):
    file_name = "data_issues_summary"
    # using double \n, because of markdown formatting
    description = "Data issues from db build\n\nSHA of deploy step: {} (because this is a post-deploy task, we only know the SHA used for the deploy, which may not be the one used for the database. Additionally, more than one commit may have been used to build the database due to the USE_PREVIOUS option of the jenkins database build)\n\nTravis Build: {}\n\nDate: {}".format(
        build.SHA, build.BUILD, datetime.now()
    )
    description = description + "\n\n" + "\n\n".join(messages)

    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = os.path.join(temp_dir, file_name)
        df.to_csv(file_path)
        new_data_issues_taiga_id = get_taiga_client().update_dataset(
            permaname=taiga_id_dataset_name,
            additions=[
                UploadedFile(
                    name=file_name, local_path=file_path, format=LocalFormat.CSV_TABLE
                )
            ],
            reason=description,
        )
        assert (
            new_data_issues_taiga_id is not None
        ), f"Recieved none when uploading data issues to {taiga_id_dataset_name}"
    return "https://cds.team/taiga/dataset_version/{}".format(new_data_issues_taiga_id)
