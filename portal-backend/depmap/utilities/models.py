import pandas as pd
from sqlalchemy import func

from depmap.database import Column, Integer, Model, String, db


class DataIssue(Model):
    __tablename__ = "data_issue"
    data_issue_id = Column(Integer, primary_key=True, autoincrement=True)
    data_type = Column(String)
    identifier = Column(String)
    id_type = Column(String)
    description = Column(String)

    @staticmethod
    def get_unique_data_issues():

        """
        :return: a dataframe of data_type, identifier, description
        """
        return pd.DataFrame(
            db.session.query(
                DataIssue.data_type, DataIssue.identifier, DataIssue.description,
            )
            .distinct()
            .all()
        )


def log_data_issue(data_type, description, identifier=None, id_type=None):
    print(f"log_data_issue {data_type}, {description}, {identifier}, {id_type}")
    issue = DataIssue(
        data_type=data_type,
        description=description,
        identifier=identifier,
        id_type=id_type,
    )
    db.session.add(issue)
