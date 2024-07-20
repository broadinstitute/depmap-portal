from depmap.entity.models import Model
from depmap.database import Column, Integer, String


class OncokbDatasetVersionDate(Model):
    """
    OncoKB Dataset Version using which the mutations dataset is annotated
    """

    __tablename__ = "oncokb_dataset_version"

    oncokb_dataset_version_id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String, nullable=False)
    date = Column(String, nullable=False)
