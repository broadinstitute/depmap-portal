# None of these can be used an entity_type/index_type.
blocked_entity_types = set(
    [
        "antibody",
        "compound_dose",
        "compound_dose_replicate",
        "generic_entity",
        "protein",
        "transcription_start_site",
    ]
)

entity_aliases = {
    "depmap_model": [
        {
            "label": "Cell Line Name",
            "slice_id": "slice/cell_line_display_name/all/label",
        }
    ],
}
