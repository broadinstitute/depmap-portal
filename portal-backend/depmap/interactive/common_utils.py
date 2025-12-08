from collections import namedtuple

# index refers to index in matrix
RowSummary = namedtuple("RowSummary", "index entity_id label")

def format_features_from_value(value_list):
    return [{"label": x, "value": x} for x in value_list]


def format_features_from_label_aliases(label_aliases_list):
    features = []
    for entity_label, aliases in label_aliases_list:
        if len(aliases) > 0:
            feature_label = "{} ({})".format(entity_label, ", ".join(aliases))
        else:
            feature_label = entity_label
        features.append({"label": feature_label, "value": entity_label})
    return features
