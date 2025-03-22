from flask import current_app
import os
from collections import namedtuple
import pytest
from depmap.dataset.models import (
    DependencyDataset,
    BiomarkerDataset,
    Dataset,
    Mutation,
    Translocation,
    Fusion,
)
from depmap.gene.models import Gene
from depmap.database import transaction
from depmap.utilities.exception import InvalidDatasetEnumError
from loader.cell_line_loader import load_cell_lines_metadata
from loader.gene_loader import load_hgnc_genes
from loader.transcription_start_site_loader import load_transcription_start_sites
from loader import dataset_loader, depmap_model_loader
from tests.factories import (
    DependencyDatasetFactory,
    BiomarkerDatasetFactory,
    CellLineFactory,
    MatrixFactory,
    GeneFactory,
    AntibodyFactory,
    DepmapModelFactory,
    MutationFactory,
    FusionFactory,
    TranslocationFactory,
    CompoundFactory,
    CompoundExperimentFactory,
)
from tests.utilities.df_test_utils import load_sample_cell_lines
from tests.utilities.override_fixture import override
from depmap.settings.settings import TestConfig
from depmap.access_control import PUBLIC_ACCESS_GROUP


def config(request):
    def get_test_versions():
        return {"has-version.1": "TEST_VERSION"}

    class TestVersionConfig(TestConfig):
        GET_DATASET_VERSIONS = get_test_versions

    return TestVersionConfig


@pytest.mark.parametrize(
    "enum_name, expected",
    [
        (DependencyDataset.DependencyEnum.Avana.name, DependencyDataset),
        (BiomarkerDataset.BiomarkerEnum.expression.name, BiomarkerDataset),
        ("invalid", "error"),
    ],
)
def test_get_class_from_enum_name(enum_name, expected):
    if expected != "error":
        assert Dataset._get_class_from_enum_name(enum_name) == expected
    else:
        with pytest.raises(InvalidDatasetEnumError):
            Dataset._get_class_from_enum_name(enum_name)


@pytest.mark.parametrize(
    "enum, expected",
    [
        (DependencyDataset.DependencyEnum.Avana, DependencyDataset),
        (BiomarkerDataset.BiomarkerEnum.expression, BiomarkerDataset),
    ],
)
def test_get_class_from_enum(enum, expected):
    assert Dataset._get_class_from_enum(enum) == expected


def test_get_dataset_by_id(empty_db_mock_downloads):
    dep_dataset = DependencyDatasetFactory()
    biom_dataset = BiomarkerDatasetFactory()
    empty_db_mock_downloads.session.flush()

    assert Dataset.get_dataset_by_id(dep_dataset.dataset_id).name == dep_dataset.name
    assert (
        DependencyDataset.get_dataset_by_id(dep_dataset.dependency_dataset_id).name
        == dep_dataset.name
    )

    assert Dataset.get_dataset_by_id(biom_dataset.dataset_id).name == biom_dataset.name
    assert (
        BiomarkerDataset.get_dataset_by_id(biom_dataset.biomarker_dataset_id).name
        == biom_dataset.name
    )


def test_dataset_get_dataset_by_name(empty_db_mock_downloads):
    dep_dataset = DependencyDatasetFactory()
    biom_dataset = BiomarkerDatasetFactory()
    empty_db_mock_downloads.session.flush()

    assert (
        Dataset.get_dataset_by_name(dep_dataset.name.name).dataset_id
        == dep_dataset.dataset_id
    )
    assert (
        Dataset.get_dataset_by_name(biom_dataset.name.name).dataset_id
        == biom_dataset.dataset_id
    )


def test_dataset_find_datasets_with_entity_ids(empty_db_mock_downloads):
    genes = GeneFactory.create_batch(2)
    dataset_1 = DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[genes[0]]),
        name=DependencyDataset.DependencyEnum.Avana,
    )
    dataset_2 = DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[genes[1]]),
        name=DependencyDataset.DependencyEnum.GeCKO,
    )
    dataset_3 = BiomarkerDatasetFactory(
        matrix=MatrixFactory(entities=[genes[1]]),
        name=BiomarkerDataset.BiomarkerEnum.expression,
    )
    DependencyDatasetFactory(
        matrix=MatrixFactory(entities=[GeneFactory()]),
        name=DependencyDataset.DependencyEnum.RNAi_merged,
    )

    # should not return the antibody dataset, because this contains antibodies and not genes, even if the two are related
    # uses of find_datasets_with_entity_ids rely on this behavior
    antibody = AntibodyFactory(gene=[genes[0]])
    BiomarkerDatasetFactory(
        matrix=MatrixFactory(entities=[antibody]),
        name=BiomarkerDataset.BiomarkerEnum.rppa,
    )

    empty_db_mock_downloads.session.flush()

    assert len(Dataset.get_all()) == 5
    assert set(
        Dataset.find_datasets_with_entity_ids([gene.entity_id for gene in genes])
    ) == {dataset_1, dataset_2, dataset_3}
    assert set(
        DependencyDataset.find_datasets_with_entity_ids(
            [gene.entity_id for gene in genes]
        )
    ) == {dataset_1, dataset_2}
    assert set(
        BiomarkerDataset.find_datasets_with_entity_ids(
            [gene.entity_id for gene in genes]
        )
    ) == {dataset_3}


def test_dataset_has_cell_line(empty_db_mock_downloads):
    cell_lines = CellLineFactory.create_batch(2)
    absent_cell_line = CellLineFactory()
    dep_matrix = MatrixFactory(cell_lines=cell_lines)
    biom_matrix = MatrixFactory(cell_lines=cell_lines)

    dep_dataset = DependencyDatasetFactory(matrix=dep_matrix)
    biom_dataset = BiomarkerDatasetFactory(matrix=biom_matrix)
    empty_db_mock_downloads.session.flush()

    assert Dataset.has_cell_line(dep_dataset.name.name, cell_lines[0].depmap_id)
    assert not Dataset.has_cell_line(dep_dataset.name.name, absent_cell_line.depmap_id)

    assert Dataset.has_cell_line(biom_dataset.name.name, cell_lines[0].depmap_id)
    assert not Dataset.has_cell_line(biom_dataset.name.name, absent_cell_line.depmap_id)


def test_dataset_has_entity(empty_db_mock_downloads):
    """
    Doesn't test the correctness of has_entity, just tests that it delegates to the correct classes 
    """
    dep_gene = GeneFactory()  # gene is in dep but not biom
    dep_matrix = MatrixFactory(entities=[dep_gene])
    dep_dataset = DependencyDatasetFactory(matrix=dep_matrix)
    biom_dataset = BiomarkerDatasetFactory()
    empty_db_mock_downloads.session.flush()

    # enum
    assert Dataset.has_entity(dep_dataset.name, dep_gene.entity_id)
    assert not Dataset.has_entity(biom_dataset.name, dep_gene.entity_id)

    # enum name
    assert Dataset.has_entity(dep_dataset.name.name, dep_gene.entity_id)
    assert not Dataset.has_entity(biom_dataset.name.name, dep_gene.entity_id)


def test_dataset_entity_type(empty_db_mock_downloads):
    """
    Test that the entity type of the second dataset is returned, despite a first dataset with a different entity type
    """
    compounds = CompoundExperimentFactory.create_batch(5)
    genes = GeneFactory.create_batch(5)
    cell_lines = CellLineFactory.create_batch(5)

    compound_matrix = MatrixFactory(entities=compounds, cell_lines=cell_lines)
    gene_matrix = MatrixFactory(entities=genes, cell_lines=cell_lines)

    DependencyDatasetFactory(
        matrix=compound_matrix, name=DependencyDataset.DependencyEnum.GDSC1_AUC
    )
    gene_dataset = DependencyDatasetFactory(
        matrix=gene_matrix, name=DependencyDataset.DependencyEnum.Avana
    )

    empty_db_mock_downloads.session.flush()

    assert gene_dataset.entity_type == genes[0].type


def test_dataset_taiga_id_exists(empty_db_mock_downloads):
    DependencyDatasetFactory(taiga_id="taiga-id-exists")
    empty_db_mock_downloads.session.flush()

    assert Dataset.taiga_id_exists("taiga-id-exists")
    assert not Dataset.taiga_id_exists("invalid")


def test_biomarker_dataset_has_entity_by_label(empty_db_mock_downloads):
    """
    Separate test out of laziness, because this only applies to BiomarkerDataset. Was built for partials linking to interactive 
    """
    biom_gene = GeneFactory()
    other_gene = GeneFactory()
    matrix = MatrixFactory(entities=[biom_gene])
    biom_dataset = BiomarkerDatasetFactory(matrix=matrix)
    empty_db_mock_downloads.session.flush()

    assert biom_dataset.name != BiomarkerDataset.BiomarkerEnum.rppa
    assert BiomarkerDataset.has_entity(biom_dataset.name, biom_gene.entity_id)
    assert BiomarkerDataset.has_entity(
        biom_dataset.name, biom_gene.label, by_label=True
    )
    assert not BiomarkerDataset.has_entity(
        biom_dataset.name, other_gene.label, by_label=True
    )


@pytest.mark.parametrize(
    "enum, expected",
    [
        (DependencyDataset.DependencyEnum.Avana, True),
        (DependencyDataset.DependencyEnum.GeCKO, True),
        (DependencyDataset.DependencyEnum.RNAi_Ach, False),
        (DependencyDataset.DependencyEnum.GDSC1_AUC, False),
    ],
)
def test_dataset_is_crispr(empty_db_mock_downloads, enum, expected):
    dataset = DependencyDatasetFactory(name=enum)
    empty_db_mock_downloads.session.flush()
    assert (dataset.data_type.name == "crispr") == expected


@pytest.mark.parametrize(
    "enum, expected",
    [
        (DependencyDataset.DependencyEnum.RNAi_Ach, True),
        (DependencyDataset.DependencyEnum.RNAi_Nov_DEM, True),
        (DependencyDataset.DependencyEnum.RNAi_merged, True),
        (DependencyDataset.DependencyEnum.Avana, False),
    ],
)
def test_dataset_is_rnai(empty_db_mock_downloads, enum, expected):
    dataset = DependencyDatasetFactory(name=enum)
    empty_db_mock_downloads.session.flush()
    assert (dataset.data_type.name == "rnai") == expected


@pytest.mark.parametrize(
    "enum, expected",
    [
        (DependencyDataset.DependencyEnum.GDSC1_AUC, True),
        (DependencyDataset.DependencyEnum.Avana, False),
    ],
)
def test_dataset_is_auc(empty_db_mock_downloads, enum, expected):
    dataset = DependencyDatasetFactory(name=enum)
    empty_db_mock_downloads.session.flush()
    assert (dataset.units == "AUC") == expected


def test_get_all(empty_db_mock_downloads):
    DependencyDatasetFactory(name=DependencyDataset.DependencyEnum.Avana)
    DependencyDatasetFactory(name=DependencyDataset.DependencyEnum.GeCKO)
    BiomarkerDatasetFactory(name=BiomarkerDataset.BiomarkerEnum.expression)
    empty_db_mock_downloads.session.flush()

    assert len(Dataset.get_all()) == 3
    assert len(DependencyDataset.get_all()) == 2
    assert len(BiomarkerDataset.get_all()) == 1


@pytest.mark.parametrize(
    "name, case_sensitive_name",
    [
        ("rnai_ach", DependencyDataset.DependencyEnum.RNAi_Ach.name),
        ("rnai_ACH", DependencyDataset.DependencyEnum.RNAi_Ach.name),
        ("nonexistent_name", None),
    ],
)
def test_get_case_sensitive_name(name, case_sensitive_name):
    assert DependencyDataset.get_case_sensitive_name(name) == case_sensitive_name


def test_get_compound_experiment_datasets_with_compound(empty_db_mock_downloads):
    """
    The tested function only checks for presence of compound experiments, not of compounds
    This test checks that
        If a dataset (matrix_1) has two compound experiments of a queried compound, we get both compound experiments back
        If a compound experiment of a queried compound (compound_exp_1) is in two datasets, we get both datasets back
        We do not get back compound experiments not in any dataset (compound_exp_no_dataset), even if they match the compound
        We do not get back compound experiments not matching the compound (compound_exp_different_compound)

    dataset_2 is Avana, because in theory the function doesn't actually care whether the dataset 'should' be a compound dataset, just what its row entities are
    """
    compound = CompoundFactory()
    compound_exp_1 = CompoundExperimentFactory(compound=compound)  # in GDSC1_AUC
    compound_exp_2 = CompoundExperimentFactory(
        compound=compound
    )  # in Avana and Rep_all_single_pt and GDSC1_AUC

    compound_exp_no_dataset = CompoundExperimentFactory(
        compound=compound
    )  # unused variable because name describes purpose
    compound_exp_different_compound = CompoundExperimentFactory()

    matrix_1 = MatrixFactory(entities=[compound_exp_1, compound_exp_2])
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_AUC, matrix=matrix_1, priority=2
    )
    matrix_2 = MatrixFactory(entities=[compound_exp_2, compound_exp_different_compound])
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Avana, matrix=matrix_2
    )
    dataset_3 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Rep_all_single_pt,
        matrix=matrix_2,
        priority=1,
    )
    empty_db_mock_downloads.session.flush()

    expected_pairs = [  # ordered by priority first, then by compound experiment entity id
        (compound_exp_2, dataset_3),
        (compound_exp_1, dataset_1),
        (compound_exp_2, dataset_1),
        (compound_exp_2, dataset_2),
    ]

    result = DependencyDataset.get_compound_experiment_priority_sorted_datasets_with_compound(
        compound.entity_id
    )
    assert len(expected_pairs) == len(result)

    assert result == expected_pairs


def test_dependency_dataset_has_entity(empty_db_mock_downloads):
    """
    Test DependencyDataset.has_entity(enum, gene_id)
    Not pytest parameterizing cos don't want to reload everything every time
    """
    with transaction():
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        load_hgnc_genes(os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv"))
        load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv"),
        )
        depmap_model_loader.load_depmap_model_metadata(
            os.path.join(loader_data_dir, "cell_line/models_metadata.csv")
        )
        dependency_datasets = {
            DependencyDataset.DependencyEnum.Avana: {
                "matrix_file_name_root": "dataset/avana",
                "display_name": "CRISPR CERES (Achilles Avana)",
                "units": "Gene Effect (CERES)",
                "data_type": "CRISPR",
                "priority": 2,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.GeCKO: {
                "matrix_file_name_root": "dataset/gecko",
                "display_name": "CRISPR CERES (Achilles GeCKO)",
                "units": "Gene Effect (CERES)",
                "data_type": "CRISPR",
                "priority": 4,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
            DependencyDataset.DependencyEnum.RNAi_Ach: {
                "matrix_file_name_root": "dataset/rnai_ach",
                "display_name": "RNAi (Broad)",
                "units": "Gene Effect (DEMETER)",
                "data_type": "rnai",
                "priority": 1,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
        }
        for dep_enum, dataset in dependency_datasets.items():
            dataset_loader.load_single_input_file_dependency_dataset(
                dep_enum, dataset, PUBLIC_ACCESS_GROUP
            )

        gene = Gene(
            entity_alias=[],
            label="dummy",
            name="dummy",
            description="",
            entrez_id=0,
            ensembl_id="ENSG0",
            hgnc_id="HGNC:0",
            locus_type="fake locus",
        )
        empty_db_mock_downloads.session.add(
            gene
        )  # add one more gene not present in anything

    symbol_to_id = {gene.label: gene.entity_id for gene in Gene.query.all()}

    enum_gene_id_expected = [
        (DependencyDataset.DependencyEnum.Avana, symbol_to_id["AMY1A"], True),
        (DependencyDataset.DependencyEnum.Avana, symbol_to_id["dummy"], False),
        (DependencyDataset.DependencyEnum.GeCKO, symbol_to_id["ANOS1"], True),
        (DependencyDataset.DependencyEnum.GeCKO, symbol_to_id["dummy"], False),
        (DependencyDataset.DependencyEnum.RNAi_Ach, symbol_to_id["AMY1A"], True),
        (DependencyDataset.DependencyEnum.RNAi_Ach, symbol_to_id["dummy"], False),
    ]

    for enum, gene_id, expected in enum_gene_id_expected:
        assert (
            DependencyDataset.has_entity(enum, gene_id) == expected
        ), "Fail for {}, {}, {}".format(enum, gene_id, expected)


def test_biomarker_dataset_has_entity(empty_db_mock_downloads):
    """
    Test BiomarkerDataset.has_entity(biom_enum_or_name, entity, direct=True, by_label=False):
    Not pytest parameterizing cos don't want to reload everything every time
    """
    with transaction():
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        load_hgnc_genes(os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv"))
        # load_cell_lines_metadata(
        #     os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        # )
        load_sample_cell_lines()
        load_transcription_start_sites(
            os.path.join(loader_data_dir, "transcription_start_site/rrbs_tss_info.csv")
        )
        biomarker_datasets = {
            BiomarkerDataset.BiomarkerEnum.expression: {
                "display_name": "Expression",
                "units": "TPM (log2)",
                "data_type": "RNA Expression",
                "priority": 1,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
            BiomarkerDataset.BiomarkerEnum.mutation_pearson: {
                "display_name": "Mutation",
                "units": "Mutation",
                "data_type": "mutation",
                "priority": None,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
            # BiomarkerDataset.BiomarkerEnum.rppa: {
            #     "display_name": "RPPA",
            #     "units": "RPPA signal (log2)",
            #     "data_type": "Protein Expression",
            #     "priority": 1,
            #     "global_priority": None,
            #     "taiga_id": "placeholder-taiga-id.1",
            # },
            BiomarkerDataset.BiomarkerEnum.rrbs: {
                "display_name": "RRBS",
                "units": "Methylation Fraction",
                "data_type": "methylation",
                "priority": None,
                "global_priority": None,
                "taiga_id": "placeholder-taiga-id.1",
            },
        }
        for biomarker_enum, biomarker_dataset in biomarker_datasets.items():
            file_path = os.path.join(
                empty_db_mock_downloads.app.config["LOADER_DATA_DIR"],
                "dataset",
                biomarker_enum.name + ".hdf5",
            )
            dataset_loader.load_biomarker_dataset(
                biomarker_enum, biomarker_dataset, file_path, PUBLIC_ACCESS_GROUP
            )

        gene = Gene(
            entity_alias=[],
            label="dummy",
            name="dummy",
            description="",
            entrez_id=0,
            ensembl_id="ENSG0",
            hgnc_id="HGNC:0",
            locus_type="fake locus",
        )
        empty_db_mock_downloads.session.add(
            gene
        )  # add one more gene not present in anything

    symbol_to_id = {gene.label: gene.entity_id for gene in Gene.query.all()}

    TestCase = namedtuple("TestCase", "dataset, gene, by_label, direct, expected")

    test_cases = [
        TestCase(
            dataset=BiomarkerDataset.BiomarkerEnum.expression,
            gene="ANOS1",
            by_label=True,
            direct=True,
            expected=True,
        ),
        TestCase(
            dataset=BiomarkerDataset.BiomarkerEnum.expression,
            gene=symbol_to_id["ANOS1"],
            by_label=False,
            direct=False,
            expected=True,
        ),
        TestCase(
            dataset=BiomarkerDataset.BiomarkerEnum.expression,
            gene="ANOS1",
            by_label=True,
            direct=False,
            expected=True,
        ),
        TestCase(
            dataset=BiomarkerDataset.BiomarkerEnum.expression,
            gene=symbol_to_id["ANOS1"],
            by_label=False,
            direct=False,
            expected=True,
        ),
        TestCase(
            dataset=BiomarkerDataset.BiomarkerEnum.expression,
            gene="does not exist",
            by_label=True,
            direct=True,
            expected=False,
        ),
        # TestCase(
        #     dataset=BiomarkerDataset.BiomarkerEnum.rppa,
        #     gene="ANOS1",
        #     by_label=True,
        #     direct=True,
        #     expected=False,
        # ),
        # TestCase(
        #     dataset=BiomarkerDataset.BiomarkerEnum.rppa,
        #     gene=symbol_to_id["ANOS1"],
        #     by_label=False,
        #     direct=True,
        #     expected=False,
        # ),
        # TestCase(
        #     dataset=BiomarkerDataset.BiomarkerEnum.rppa,
        #     gene="ANOS1",
        #     by_label=True,
        #     direct=False,
        #     expected=True,
        # ),
        # TestCase(
        #     dataset=BiomarkerDataset.BiomarkerEnum.rppa,
        #     gene=symbol_to_id["ANOS1"],
        #     by_label=False,
        #     direct=False,
        #     expected=True,
        # ),
        # TestCase(
        #     dataset=BiomarkerDataset.BiomarkerEnum.rppa,
        #     gene="does not exist",
        #     by_label=True,
        #     direct=True,
        #     expected=False,
        # ),
    ]

    for test_case in test_cases:
        assert (
            BiomarkerDataset.has_entity(
                test_case.dataset,
                test_case.gene,
                by_label=test_case.by_label,
                direct=test_case.direct,
            )
            == test_case.expected
        ), "Fail for {}, {}, {}, {}, {}".format(
            test_case.dataset,
            test_case.gene,
            test_case.by_label,
            test_case.direct,
            test_case.expected,
        )


def test_mutation_translocation_fusion_has_gene(empty_db_mock_downloads):
    """
    Test has_gene for:
        Mutation
        Translocation
        Fusion
    Not pytest parameterizing cos don't want to reload everything every time
    """
    with transaction():
        loader_data_dir = empty_db_mock_downloads.app.config["LOADER_DATA_DIR"]
        load_hgnc_genes(os.path.join(loader_data_dir, "gene/hgnc-database-1a29.1.csv"))

        load_cell_lines_metadata(
            os.path.join(loader_data_dir, "cell_line/cell_line_metadata.csv")
        )
        load_sample_cell_lines()

        dataset_loader.load_translocations(
            os.path.join(loader_data_dir, "dataset/translocations.csv"),
            "placeholder-taiga-id.1",
        )
        dataset_loader.load_fusions(
            os.path.join(loader_data_dir, "dataset/fusions.csv"),
            "placeholder-taiga-id.1",
        )
        dataset_loader.load_mutations(
            os.path.join(loader_data_dir, "dataset/mutations.csv"),
            "placeholder-taiga-id.1",
        )
        gene = Gene(
            entity_alias=[],
            label="test_gene",
            name="test_gene",
            description="",
            entrez_id=0,
            ensembl_id="ENSG0",
            hgnc_id="HGNC:0",
            locus_type="fake locus",
        )
        empty_db_mock_downloads.session.add(
            gene
        )  # add one more gene not present in anything

    symbol_to_id = {gene.label: gene.entity_id for gene in Gene.query.all()}

    model_gene_id_expected = [
        # mutations has a by_label option and is tested later
        (Translocation, symbol_to_id["AMY1A"], True),  # gene 1
        (Translocation, symbol_to_id["TNS2"], True),  # gene 2
        (Translocation, symbol_to_id["test_gene"], False),
        (Fusion, symbol_to_id["ANOS1"], True),  # left gene
        (Fusion, symbol_to_id["F8A1"], True),  # right gene
        (Fusion, symbol_to_id["test_gene"], False),
    ]

    for model, gene_id, expected in model_gene_id_expected:
        assert model.has_gene(gene_id) == expected, "Fail for {}, {}, {}".format(
            model, gene_id, expected
        )

    # mutations has a by_label option, test that as well
    mutations_by_label_expected = [
        ("HNF1B", True),
        ("test_gene", False),
    ]
    for gene_id, expected in mutations_by_label_expected:
        assert (
            Mutation.has_gene(symbol_to_id[gene_id], by_label=False) == expected
        ), "Fail for {}, {}, {} by_label=False".format(Mutation, gene_id, expected)
        assert (
            Mutation.has_gene(gene_id, by_label=True) == expected
        ), "Fail for {}, {}, {} by_label=True".format(Mutation, gene_id, expected)


@pytest.mark.parametrize(
    "model, factory",
    [
        (Mutation, MutationFactory),
        (Fusion, FusionFactory),
        (Translocation, TranslocationFactory),
    ],
)
def test_mutation_translocation_fusion_has_cell_line(
    empty_db_mock_downloads, model, factory
):
    cell_line_in = DepmapModelFactory(stripped_cell_line_name="cell_line_in")
    cell_line_out = DepmapModelFactory(stripped_cell_line_name="cell_line_out")
    factory(cell_line=cell_line_in.cell_line)
    empty_db_mock_downloads.session.flush()

    assert model.has_cell_line(cell_line_in.model_id)
    assert not model.has_cell_line(cell_line_out.cell_line.depmap_id)


def test_mutation_get_non_silent_rows(empty_db_mock_downloads):
    """
    Test that
        Hostpot mutations that are silent are still retrieved
    """
    gene = GeneFactory()
    MutationFactory(gene=gene, variant_info="MISSENSE")
    mut1 = MutationFactory(gene=gene, variant_info="MISSENSE")
    mut2 = MutationFactory(gene=gene, variant_info="MISSENSE")

    empty_db_mock_downloads.session.flush()

    df = Mutation.get_non_silent_rows(gene.label)
    assert len(df) == 3

    mutation_ids = df["mutation_id"].values
    for mutation in [mut1, mut2]:
        assert mutation.mutation_id in mutation_ids


def test_get_datasets_in_order(empty_db_mock_downloads):
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC1_dose_replicate, priority=1
    )
    dataset_2 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.CTRP_dose_replicate
    )
    dataset_3 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.GDSC2_dose_replicate, priority=2
    )
    dataset_4 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Combined, priority=1
    )
    dataset_5 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Achilles, priority=2
    )
    dataset_6 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.RNAi_merged, priority=1
    )
    # Unqueried dataset example
    dataset_7 = BiomarkerDatasetFactory(name=BiomarkerDataset.BiomarkerEnum.expression)
    empty_db_mock_downloads.session.flush()

    assert [
        x.name
        for x in DependencyDataset.get_datasets_in_order(
            data_type=DependencyDataset.DataTypeEnum.drug_screen
        )
    ] == [
        dataset_1.name,
        dataset_3.name,
        dataset_2.name,
        dataset_4.name,
        dataset_6.name,
        dataset_5.name,
    ]


def test_get_dataset_by_data_type_priority(empty_db_mock_downloads):
    dataset_1 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Combined, priority=1
    )
    dataset_2 = DependencyDatasetFactory(name=DependencyDataset.DependencyEnum.Rep1M)
    dataset_3 = DependencyDatasetFactory(
        name=DependencyDataset.DependencyEnum.Chronos_Achilles, priority=2
    )

    assert (
        DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.crispr
        )
        == dataset_1
    )
    assert (
        DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.crispr, 2
        )
        == dataset_3
    )
    assert (
        DependencyDataset.get_dataset_by_data_type_priority(
            DependencyDataset.DataTypeEnum.drug_screen
        )
        == None
    )
