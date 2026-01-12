from enum import Enum


class AnalysisType(str, Enum):
    # this subclasses string in order to be json serializable
    pearson = "pearson"
    association = "association"
    two_class = "two_class"
