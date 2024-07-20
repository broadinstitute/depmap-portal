from depmap.cansar.extension import parse_protein_response

SAMPLE_OUTPUT = {
    "data": {
        "cansar_db": {
            "id": "P15056",
            "image": "https://cdn.rcsb.org/images/rutgers/uw/1uwh/1uwh.pdb1-500.jpg",
            "name": "BRAF",
            "subcellular": {
                "sources_filtered": {
                    "THE HUMAN PROTEIN ATLAS": {
                        "locations": ["Cytosol", "Vesicles"],
                        "home_page": "http://www.proteinatlas.org/",
                    }
                },
                "locations_standardised": {
                    "cell membrane": {
                        "THE HUMAN PROTEIN ATLAS": False,
                        "UniProt": True,
                        "GO terms": False,
                    },
                    "organelle membrane": {
                        "THE HUMAN PROTEIN ATLAS": False,
                        "UniProt": False,
                        "GO terms": False,
                    },
                    "organelle": {
                        "THE HUMAN PROTEIN ATLAS": False,
                        "UniProt": False,
                        "GO terms": True,
                    },
                    "nucleus": {
                        "THE HUMAN PROTEIN ATLAS": False,
                        "UniProt": True,
                        "GO terms": True,
                    },
                    "cytoplasm": {
                        "THE HUMAN PROTEIN ATLAS": True,
                        "UniProt": True,
                        "GO terms": True,
                    },
                    "nuclear membrane": {
                        "THE HUMAN PROTEIN ATLAS": False,
                        "UniProt": False,
                        "GO terms": False,
                    },
                    "extracellular": {
                        "THE HUMAN PROTEIN ATLAS": False,
                        "UniProt": False,
                        "GO terms": False,
                    },
                },
                "sources_unfiltered": {
                    "THE HUMAN PROTEIN ATLAS": {
                        "locations": ["Cytosol", "Vesicles"],
                        "home_page": "http://www.proteinatlas.org/",
                    },
                    "UniProt": {
                        "locations": ["cell membrane", "cytoplasm", "nucleus"],
                        "home_page": "http://www.uniprot.org/",
                    },
                    "GO terms": {
                        "locations": [
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0044297">cell body</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0005829">cytosol</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0005622">intracellular</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0043231">intracellular membrane-bounded organelle</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0005739">mitochondrion</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0043005">neuron projection</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0005634">nucleus</a>',
                            '<a target="_blank" href="http://www.ebi.ac.uk/ego/DisplayGoTerm?id=GO:0005886">plasma membrane</a>',
                        ],
                        "home_page": "http://www.geneontology.org/",
                    },
                },
            },
            "full_name": "Serine/threonine-protein kinase B-raf",
            "description": "Also known as BRAF_HUMAN, BRAF, BRAF1, RAFB1. Protein kinase involved in the transduction of mitogenic signals from the cell membrane to the nucleus. May play a role in the postsynaptic responses of hippocampal neuron. Phosphorylates MAP2K1, and thereby contributes to the MAP kinase signal transduction pathway. Monomer. Homodimer. Heterodimerizes with RAF1, and the heterodimer possesses a highly increased kinase activity compared to the respective homodimers or monomers. Heterodimerization is mitogen-regulated and enhanced by 14-3-3 proteins. MAPK1/ERK2 activation can induce a negative feedback that promotes the dissociation of the heterodimer by phosphorylating BRAF at Thr-753. Found in a complex with at least BRAF, HRAS, MAP2K1, MAPK3 and RGS14. Interacts with RIT1. Interacts (via N-terminus) with RGS14 (via RBD domains); the interaction mediates the formation of a ternary complex with RAF1, a ternary complex inhibited by GNAI1 (By similarity). Interacts with DGKH (PubMed:19710016). Interacts with PRMT5 (PubMed:21917714). Interacts with KSR2 (PubMed:21441910). Interacts with AKAP13, MAP2K1 and KSR1. Identified in a complex with AKAP13, MAP2K1 and KSR1 (PubMed:21102438). Interacts with FNIP1 and FNIP2 (PubMed:27353360).",
            "ligand_druggability": {"score": 1.3, "percentile_score": 93},
            "features": {
                "drug_target": True,
                "has_extra_anal1": True,
                "has_rnai": True,
                "druggable_structure": True,
                "available_structure": True,
                "available_mutation_data": True,
                "bioactive_compounds": True,
                "druggable_by_ligand_based_assessment": True,
                "enzyme": True,
            },
            "network_druggability": {
                "other_therapeutics": {"percentile_score": 93.87},
                "overall": {"percentile_score": 98.5},
                "cancer_therapeutics": {"percentile_score": 99.3},
                "cancer_associated": {"percentile_score": 97.14},
            },
            "links": [
                {"title": "uniprot", "link": "http://www.uniprot.org/uniprot/P15056"},
                {
                    "title": "enzyme classification",
                    "link": "http://enzyme.expasy.org/EC/2.7.11.1",
                },
            ],
        }
    },
    "sources": [
        {"id": "cansar_db", "name": "canSAR", "url": "https://cansar.icr.ac.uk/"}
    ],
}
{
    "drug_target": True,
    "has_extra_anal1": True,
    "has_rnai": True,
    "druggable_structure": True,
    "available_structure": True,
    "available_mutation_data": True,
    "bioactive_compounds": True,
    "druggable_by_ligand_based_assessment": True,
    "enzyme": True,
}


def test_format_compound_parse():
    r = parse_protein_response(SAMPLE_OUTPUT)
    assert r.druggable_by_ligand_based_assessment
    assert r.druggable_structure
    assert r.enzyme
    assert r.bioactive_compounds
