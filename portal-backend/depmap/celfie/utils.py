from depmap.enums import BiomarkerEnum

# Define as global variable
global celfie_datasets
celfie_datasets = [
    BiomarkerEnum.expression.name,
    BiomarkerEnum.copy_number_relative.name,
    BiomarkerEnum.mutations_damaging.name,
    BiomarkerEnum.mutations_hotspot.name,
]
