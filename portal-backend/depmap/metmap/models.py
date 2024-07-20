from depmap.database import (
    db,
    Column,
    Float,
    ForeignKey,
    Integer,
    Model,
    String,
)
import enum


class MetMap500(Model):
    __tablename__ = "metmap_500"
    metmap_id = Column(Integer, primary_key=True, autoincrement=True)
    ci_05 = Column(Float)
    ci_95 = Column(Float)
    mean = Column(Float)
    penetrance = Column(Float)
    tissue = Column(String)
    depmap_id = Column(String, ForeignKey("cell_line.depmap_id"), nullable=False)

    @staticmethod
    def has_cell_line(depmap_id: str):
        return db.session.query(
            MetMap500.query.filter_by(depmap_id=depmap_id).exists()
        ).scalar()

    @staticmethod
    def get_all_by_depmap_id(depmap_id: str):
        return (
            MetMap500.query.filter_by(depmap_id=depmap_id)
            .order_by(MetMap500.tissue.asc())
            .all()
        )

    @property
    def serialize(self):
        # keys are renamed for consistency with the petal plot code and usage
        # in the UI
        return {
            "lower": self.ci_05,
            "upper": self.ci_95,
            "mean": self.mean,
            "penetrance": self.penetrance,
            "target": self.tissue,
        }
