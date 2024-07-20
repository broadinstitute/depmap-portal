from flask_restplus import Namespace, fields
from depmap.constellation.utils import SimilarityOption, ConnectivityOption
from werkzeug.datastructures import FileStorage


namespace = Namespace(
    "fake_namespace",
    description="""
    This name is is not actually registered onto an api object
    We want to put these model definitions in a different file because they're very large
    Normally, we would use api.model(
    However, that requires the api object, which is nice to keep in the views file
    This documentation (https://flask-restplus.readthedocs.io/en/latest/marshalling.html#the-api-model-factory) claims that from flask_restplus import Model and using this Model object should be equivalent
    However, we get an error in response marshalling when using that directly imported Model object
    Instead, Namespace allows us to access the namespace.model( object, which doesn't cause an error, and allows us to put this in a separate file
    We only need it for calling .model(, and so we have not registered it anywhere
""",
)

get_graph_definitions_request_params = {
    "uploadFile": {
        "description": 'A csv file with features, effect size, and -log10(pvalue) columns, which should used as input data for getting graph definitions. Must provide either uploadFile or resultId. The feature column may be named any of {"gene", "genes", "feature", "label"}, the effect column may be named any of {"effect", "correlation", "cor", "logfc"}, and the -log10(pvalue) column may be called {"-log10(p)", "-log10(lmpvalue)", "-log10(pvalue)", "-log10(p-value)", "logp"}',
        "type": FileStorage,
        "required": False,
    },
    "resultId": {
        "description": "Comma-delimited string of task id(s) of celery job(s), the result(s) of which should used as input data for getting graph definitions. Must provide either uploadFile or resultId.",
        "type": fields.String,
        "required": False,
    },
    "nFeatures": {
        "description": "The number of features to be used for getting graph definitions. From the input data, the top n features with the largest magnitude of effect sizes, attempting where possible to choose an equal number of positive and negative magnitude effect sizes, will be used to get graph definitions",
        "type": fields.Integer,
        "required": True,
    },
    "similarityMeasure": {
        "description": "Similarity measure to be used for the network graph",
        "type": fields.String(enum=list(SimilarityOption.__members__.keys())),
        "required": True,
    },
    "connectivity": {
        "description": "Either 1, 2, or 3, corresponding to the ConnectivityOption enums. This determines the degree of connectivity in the network graph",
        "type": fields.Integer(enum=[option.value for option in ConnectivityOption]),
        "required": True,
    },
}

_gene_sets_model = namespace.model(
    "GeneSets",
    {
        "genes": fields.List(
            fields.List(fields.String(description="Gene labels")),
            description="A list of lists of gene labels",
        ),
        "n": fields.List(fields.Integer(description="Number of genes in the set")),
        "neg_log_p": fields.List(fields.Float),
        "p_value": fields.List(fields.Float),
        "rank": fields.List(fields.Integer),
        "term": fields.List(
            fields.String(
                description="Name of gene set, e.g. 'HALLMARK TNFA SIGNALING\\n VIA NFKB'. Contains the name of the gene set collection it came from, and possibly contains newlines if it is long. Corresponds to 'gene_sets' on the Node model"
            )
        ),
        "term_short": fields.List(
            fields.String(
                description="Short display name of gene set, e.g. 'TNFA SIGNALING VIA NFKB'."
            )
        ),
        "type": fields.List(
            fields.String(
                description="Either 'gene_set_up' or 'gene_set_down'. When the two up/down are separated, this should be the same for all elements in the array"
            )
        ),
        "x": fields.List(
            fields.String(
                description="x coordinates for the overrepresentation plot. Can be ignored when presenting a table instead (celfie shows a table, constellation shows a plot"
            )
        ),
        "y": fields.List(
            fields.String(
                description="y coordinates for the overrepresentation plot. Can be ignored when presenting a table instead (celfie shows a table, constellation shows a plot"
            )
        ),
    },
    description="Parallel lists of information about gene sets",
)
get_graph_definitions_response = namespace.model(
    "Graph",
    {
        "network": fields.Nested(
            namespace.model(
                "Network",
                {
                    "edges": fields.List(
                        fields.Nested(
                            namespace.model(
                                "Edge",
                                {
                                    "from": fields.String(
                                        description="Corresponds to the id field of a node, i.e. the feature label"
                                    ),
                                    "to": fields.String(
                                        description="Corresponds to the id field of a node, i.e. the feature label"
                                    ),
                                    "weight": fields.Float,
                                },
                            )
                        )
                    ),
                    "nodes": fields.List(
                        fields.Nested(
                            namespace.model(
                                "Node",
                                {
                                    "task": fields.String(
                                        description="Task id from the original input data."
                                    ),
                                    "-log10(P)": fields.Float(
                                        description='-log10(pvalue) from the original input data. This might be the column named "-log10(p)", "-log10(lmpvalue)", "-log10(pvalue)", "-log10(p-value)", "logp", or the p value transformed with -log10 from a task id result'
                                    ),
                                    "effect": fields.Float(
                                        description='Effect size from the original input data. This might be the column named "effect", "correlation", "cor", "logfc", or from a task id result'
                                    ),
                                    "gene_sets": fields.List(
                                        fields.String(
                                            description="Terms (not short_terms) that are the names of gene sets, e.g. 'KEGG MAPK SIGNALING\\n PATHWAY', possibly containing newlines if they are long"
                                        )
                                    ),
                                    "id": fields.String(description="The feature id"),
                                    "feature": fields.String(
                                        description="The feature label"
                                    ),
                                    "should_label": fields.Boolean,
                                    "x": fields.Float(
                                        description="x location in the network graph"
                                    ),
                                    "y": fields.Float(
                                        description="y location in the network graph"
                                    ),
                                },
                            )
                        )
                    ),
                },
            )
        ),
        "overrepresentation": fields.Nested(
            namespace.model(
                "Overrepresentation",
                {
                    "gene_sets_down": fields.Nested(_gene_sets_model),
                    "gene_sets_up": fields.Nested(_gene_sets_model),
                },
            )
        ),
        "table": fields.List(
            fields.Nested(
                namespace.model(
                    "Node",
                    {
                        "-log10(P)": fields.Float(
                            description="-log10(pvalue) from the original input data"
                        ),
                        "effect": fields.Float(
                            description="Effect size from the original input data"
                        ),
                        "feature": fields.String(
                            description="Feature label from the original input data"
                        ),
                    },
                ),
                description="Table of the input data used for getting graph definitions. Used by constellation to show the input data.",
            )
        ),
    },
)
