from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from breadbox.db.base_class import Base, UUIDMixin


class PredictiveModelConfig(Base, UUIDMixin):
    """Config for a model type (e.g., random forest) for a dimension type"""

    __tablename__ = "predictive_model_config"
    __table_args__ = (
        UniqueConstraint(
            "dimension_type_name",
            "model_config_name",
            name="uq_predictive_model_config_dim_type_name",
        ),
    )

    dimension_type_name: Mapped[str] = mapped_column(
        String, ForeignKey("dimension_type.name", ondelete="CASCADE"), nullable=False
    )
    dimension_type = relationship("DimensionType", foreign_keys=[dimension_type_name])

    model_config_name: Mapped[str] = mapped_column(String, nullable=False)
    model_config_description: Mapped[str] = mapped_column(String, nullable=False)
    index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PredictiveModelResult(Base, UUIDMixin):
    """Path to SQLite file with results for a config+dataset"""

    __tablename__ = "predictive_model_result"
    __table_args__ = (
        UniqueConstraint(
            "config_id",
            "actuals_dataset_id",
            "predictions_dataset_id",
            name="uq_predictive_model_result_config_datasets",
        ),
        Index("idx_predictive_model_result_config_id", "config_id"),
        Index("idx_predictive_model_result_actuals_dataset_id", "actuals_dataset_id"),
        Index(
            "idx_predictive_model_result_predictions_dataset_id",
            "predictions_dataset_id",
        ),
    )

    config_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("predictive_model_config.id", ondelete="CASCADE"),
        nullable=False,
    )
    config = relationship("PredictiveModelConfig", foreign_keys=[config_id])

    actuals_dataset_id: Mapped[str] = mapped_column(
        String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False
    )
    actuals_dataset = relationship("Dataset", foreign_keys=[actuals_dataset_id])

    predictions_dataset_id: Mapped[str] = mapped_column(
        String, ForeignKey("dataset.id", ondelete="CASCADE"), nullable=False
    )
    predictions_dataset = relationship("Dataset", foreign_keys=[predictions_dataset_id])

    filename: Mapped[str] = mapped_column(String, nullable=False)
