from dataclasses import dataclass
from enum import Enum
from datetime import date
from typing_extensions import TypedDict
from depmap.database import Column, Integer, Model, String

from flask import current_app, url_for
from typing import Optional, Callable, List, Dict, Set, Union
from depmap.taiga_id.models import TaigaAlias, NoSuchTaigaAlias
from depmap.access_control import get_owner_id_from_group_display_name


class DataGroup(Enum):
    """
    Use for grouping datasets in All Data Overview Data Availability graph
    """

    drug = "drug"
    rnai = "rnai"
    proteomics = "proteomics"
    sequencing = "sequencing"
    crispr = "crispr"
    methylation = "methylation"
    uncategorized = "uncategorized"

    @property
    def display_name(self):
        return {
            DataGroup.drug: "Drug Screens",
            DataGroup.rnai: "RNAi Screens",
            DataGroup.proteomics: "Proteomics",
            DataGroup.sequencing: "Sequencing",
            DataGroup.crispr: "CRISPR Screens",
            DataGroup.methylation: "Methylation",
            DataGroup.uncategorized: "Other Datasets",
        }[self]

    @staticmethod
    def get_all_display_names():
        return [type.display_name for type in DataGroup]


class FileType(Enum):
    """
    All these are just stable identifiers
    These are only used in the downloads model (eventually processed in the view)
    """

    omics = "omics"
    genetic_dependency = "genetic_dependency"
    drug_sensitivity = "drug_sensitivity"
    other = "other"

    @property
    def display_name(self):
        return {
            FileType.genetic_dependency: "Genetic Dependency",
            FileType.drug_sensitivity: "Drug Sensitivity",
            FileType.omics: "Cellular Models",
            FileType.other: "Other",
        }[self]

    @staticmethod
    def get_all_display_names():
        return [type.display_name for type in FileType]


class FileSource(Enum):
    """
    All these are just stable identifiers
    These are only used in the downloads model (eventually processed in the view)
    So the view can deal with mapping these to display names, etc
    """

    broad = "broad"
    csoft = "csoft"
    novartis = "novartis"
    marcotte = "marcotte"
    sanger = "sanger"

    @property
    def display_name(self):
        return {
            FileSource.broad: "Broad Institute",
            FileSource.csoft: "Broad Institute, Chemical Biology & Therapeutics Science Program",  # I know that it's weird to acknowledge a specific Broad department. This was introduced in commit a88e5f7 as per Paul C.'s suggestions.
            FileSource.novartis: "Novartis",
            FileSource.marcotte: "Marcotte et al.",
            FileSource.sanger: "Wellcome Trust Sanger Institute",
        }[self]

    @property
    def logo_file_name_alt(self):
        """
        Putting this here instead of the macro so that we will throw a hard error instead of just not showing anything
        """
        return {
            FileSource.broad: ("img/download/logo_broad_blue.svg", self.display_name),
            FileSource.csoft: ("img/download/logo_broad_blue.svg", self.display_name),
            FileSource.novartis: ("img/download/logo_novartis.svg", self.display_name),
            FileSource.marcotte: ("img/download/logo_marcotte.svg", self.display_name),
            FileSource.sanger: ("img/download/logo_sanger.svg", self.display_name),
        }[self]

    @staticmethod
    def get_all_display_names():
        return [source.display_name for source in FileSource]


class BucketUrl:
    def __init__(self, bucket, file_name, dl_name=None):
        self.bucket = bucket
        self.file_name = file_name
        self.dl_name = dl_name

    def __repr__(self):
        return "BucketUrl({}, {}, {})".format(
            repr(self.bucket), repr(self.file_name), repr(self.dl_name)
        )

    def get_url(self):
        # Evaluated here because requires application context, which is not
        # available during obj creation
        return url_for(
            "download.download_file",
            file_name=self.file_name,
            dl_name=self.dl_name,
            bucket=self.bucket,
        )

    @property
    def gs_path(self):
        return "gs://{}/{}".format(self.bucket, self.file_name)


class ExternalBucketUrl(BucketUrl):
    BUCKET = "depmap-external-downloads"

    def __init__(self, file_name):
        super().__init__(ExternalBucketUrl.BUCKET, file_name)


class DmcBucketUrl(BucketUrl):
    BUCKET = "depmap-dmc-downloads"

    def __init__(self, file_name, dl_name=None):
        super().__init__(DmcBucketUrl.BUCKET, file_name=file_name, dl_name=dl_name)

    def __repr__(self):
        return "DmcBucketUrl({})".format(repr(self.file_name))


class InternalBucketUrl(BucketUrl):
    BUCKET = "depmap-internal-downloads"

    def __init__(self, file_name, dl_name=None):
        super().__init__(InternalBucketUrl.BUCKET, file_name=file_name, dl_name=dl_name)

    def __repr__(self):
        return "InternalBucketUrl({})".format(repr(self.file_name))


class RetractedUrl:
    def __repr__(self):
        return "RetractedUrl()"

    def get_url(self):
        raise ValueError("Invalid attempt to get a retracted url")


class SummaryStatsDict(TypedDict):
    value: int
    label: str


class SummaryStats:
    """
    Stats about a download that are computed in download_loader.
    """

    def __init__(self, stats: List[SummaryStatsDict]):
        self.stats = stats

    def __repr__(self):
        return "SummaryStats({})".format(repr(self.stats))


class DownloadSettings:
    def __init__(self, latest_release_name, latest_release_date):
        self.latest_release_name = latest_release_name
        self.latest_release_date = latest_release_date


dmc_exclusive_embargo = "DMC Exclusive: publication restriction on embargoed data"
internal_embargo = "Publication restriction on embargoed data"
pi_sponsored_embargo = "PI-sponsored: publication restriction until PI publishes"
no_embargo = "Public: no publication restrictions"


class ReleaseTerms(Enum):
    """
    Key to look up
    """

    # string is used as terms_id
    depmap = "depmap"
    achilles = "achilles"
    drive = "drive"
    achilles_drive_marcotte = "achilles_drive_marcotte"
    gdsc = "gdsc"
    project_score = "project_score"
    ccle = "ccle"
    ctd2 = "ctd2"
    dmc = "dmc"

    # the data has been published with a journal article and did not specify specific licensing terms
    published_with_no_license = "published_with_no_license"

    # the data is being shared non-publicly, pre-publication
    unpublished = "unpublished"

    internal = "internal"

    @staticmethod
    def get_all_terms():
        return [terms.name for terms in ReleaseTerms]

    @staticmethod
    def get_terms_to_text():
        terms = {
            "achilles": """The Achilles project distributes its data under a <a target="_blank" href="https://creativecommons.org/licenses/by/4.0/">CC Attribution 4.0 license</a>.""",
            "drive": """The DRIVE dataset was published in Cell under a <a target="_blank" href="https://creativecommons.org/licenses/by/4.0/">CC Attribution 4.0 license</a>.""",
            "achilles_drive_marcotte": """This combination of the Broad Institute Project Achilles, Novartis Project DRIVE, and Marcotte et al. breast cell line datasets is distributed under a <a target="_blank" href="https://creativecommons.org/licenses/by/4.0/">CC Attribution 4.0 license</a>.""",
            "gdsc": """These data were processed from data published on Sanger's website. <a target="_blank" href="http://www.cancerrxgene.org/legal">Click here to see Sanger's terms and conditions</a>.""",
            "project_score": """These data were processed from data published on Sanger's Project Score portal. <a target="_blank" href="https://score.depmap.sanger.ac.uk/documentation#usage">Click here to see Sanger's terms and conditions</a>.""",
            "ccle": """CCLE publishes it's data under the <a target="_blank" href="{}">Terms and Conditions linked here.</a>""".format(
                url_for("ccle", path="terms_and_conditions")
            ),
            "depmap": """DepMap publishes it's data under the <a target="_blank" href="{}">Terms and Conditions linked here.</a>""".format(
                url_for("public.terms")
            ),
            "ctd2": """The CTD^2 releases data in accordance with their <a target="_blank" href="https://ocg.cancer.gov/programs/ctd2/using-ctd2-data">data release policy</a>""",
            "dmc": """Data for the Dependency Map Consortium is made available under the <a target="_blank" href="{}">Terms and Conditions linked here.</a>""".format(
                url_for("public.terms")
            ),
            "unpublished": "",
            "published_with_no_license": "",
            # TODO: Are there specific terms and conditions text for internal beyond the embargo text?
            "internal": "",
        }

        show_embargo_info = current_app.config["ENABLED_FEATURES"].show_embargo_info

        def add_embargo(terms, text):
            embargo = terms_requiring_embargo[ReleaseTerms(terms)]

            return f"<h1>{embargo}</h1><p>{text}</p>"

        if show_embargo_info:
            terms = {k: add_embargo(k, v) for k, v in terms.items()}

        return terms


terms_requiring_embargo = {
    ReleaseTerms.depmap: no_embargo,
    ReleaseTerms.internal: internal_embargo,
    ReleaseTerms.achilles: no_embargo,
    ReleaseTerms.drive: no_embargo,
    ReleaseTerms.achilles_drive_marcotte: no_embargo,
    ReleaseTerms.gdsc: no_embargo,
    ReleaseTerms.project_score: no_embargo,
    ReleaseTerms.ccle: no_embargo,
    ReleaseTerms.ctd2: no_embargo,
    ReleaseTerms.dmc: dmc_exclusive_embargo,
    ReleaseTerms.published_with_no_license: no_embargo,
    ReleaseTerms.unpublished: pi_sponsored_embargo,
}


class MockTerms:
    value = None

    def __repr__(self):
        return "MockTerms"


class DownloadRelease:
    def __init__(
        self,
        name,
        type,
        release_date,
        description,
        all_files,
        version_group=None,
        funding=None,
        terms=None,
        citation=None,
        group=None,
        sources=None,
        owner_group_display_name="Public",
        virtual_dataset_id=None,
    ):
        """
        :param type: Used in determine which category of checkboxes to put the release group/name
        :param all_files: Specifies row ordering
        :param citation: None if unpublished
        :param group: If set, used instead of name field for checkbox label
        :param sources: If set, sets source for all files unless overriden by file-specific source. if not set, defaults to broad
        :param owner_group_display_name: The display name of the access control group which is allowed to see this release
        type checks are present in case strings are accidentally used
        """
        self.__owner_group_display_name = owner_group_display_name
        self.name: str = name
        self.virtual_dataset_id = virtual_dataset_id

        assert isinstance(type, ReleaseType)
        self.type: ReleaseType = type

        assert isinstance(release_date, date)
        # should only be accessed via get_release_date, in case of
        # file-specific override
        self.__release_date: date = release_date

        self.description: str = description

        self.version_group: Optional[str] = version_group

        self.funding: str = funding

        if terms is None:  # internal
            assert citation is None
            for file in all_files:
                if isinstance(file._url, RetractedUrl):
                    assert file.retraction_override is not None
                else:
                    assert isinstance(file._url, DmcBucketUrl) or isinstance(
                        file._url, InternalBucketUrl
                    ), file._url
            terms = MockTerms()
        else:
            assert isinstance(terms, ReleaseTerms)
        # should only be accessed via get_terms, in case of file-specific
        # override
        self.__terms: Union[ReleaseTerms, MockTerms] = terms

        assert all([isinstance(file, DownloadFile) for file in all_files])
        self.all_files: List[DownloadFile] = all_files

        if sources:
            assert all([isinstance(source, FileSource) for source in sources])
            for file in self.all_files:
                if not file._source_specified:  # sources set on a file takes precedence
                    file.sources = sources
        self._sources = sources

        self.google_storage_locations = {
            (file._url.bucket, file._url.file_name)
            for file in all_files
            if isinstance(file._url, BucketUrl)
        }

        self.files_by_name = {file.name: file for file in all_files}

        self.citation = citation
        self._group = group

    def __repr__(self):
        r = (
            "DownloadRelease("
            + "name={},"
            + "type={},"
            + "release_date={},"
            + "description={},"
        ).format(
            repr(self.name),
            str(self.type),
            repr(self.__release_date),
            repr(self.description),
        )

        if self.__owner_group_display_name != "Public":
            r += "owner_group_display_name={},".format(
                repr(self.__owner_group_display_name),
            )

        if self.version_group is not None:
            r += "version_group={},".format(repr(self.version_group))

        if self.funding is not None:
            r += "funding={},".format(repr(self.funding))

        if not isinstance(self.__terms, MockTerms):
            r += "terms={},".format(str(self.__terms))

        if self.citation:
            r += "citation={},".format(repr(self.citation))

        if self._group is not None:
            r += "group={},".format(repr(self._group))

        if self._sources is not None:
            r += "sources=[{}],".format(",".join(repr(f) for f in self._sources))

        r += "all_files=[{}])".format(",".join(repr(f) for f in self.all_files))

        return r

    @property
    def owner_id(self):
        return get_owner_id_from_group_display_name(self.__owner_group_display_name)

    @property
    def group(self) -> str:
        return self._group if self._group else self.name

    def get_file_by_name(self, filename, must=True):
        file = self.files_by_name.get(filename)
        if file is None and must:
            raise AssertionError(
                "Could not find file {} in {}".format(filename, self.name)
            )
        return file

    def get_release_date(self, file) -> date:
        if file is not None and file.date_override:
            return file.date_override
        else:
            return self.__release_date

    def get_terms(self, file) -> ReleaseTerms:
        if file is not None and file.terms_override:
            terms = file.terms_override
        else:
            terms = self.__terms

        return terms


# for global search support. Release and file name allow link from search directly to downloads page modals
class DownloadFileGlobalSearch(Model):
    __tablename__ = "download_file"
    file_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)
    release_name = Column(String)

    def __init__(self, name, release_name):
        self.name = name
        self.release_name = release_name


@dataclass
class FileSubtype:
    code: str
    label: str
    position: int


class DownloadFile:
    def __init__(
        self,
        name: str,
        type: FileType,
        size: str,
        url: Union[BucketUrl, RetractedUrl, str],
        version: Optional[int] = None,
        sub_type: Optional[FileSubtype] = None,  # Required on the most current release
        taiga_id: Optional[str] = None,
        canonical_taiga_id: Optional[str] = None,
        sources: Optional[List[FileSource]] = None,
        description: Optional[str] = None,
        is_main_file: Optional[bool] = False,
        satisfies_db_taiga_id: Optional[str] = None,
        date_override: Optional[date] = None,
        terms_override: Optional[ReleaseTerms] = None,
        retraction_override: Optional[Union[RetractedUrl, str]] = None,
        summary_stats: Optional[SummaryStats] = None,
        md5_hash: Optional[str] = None,
        display_label: Optional[str] = None,
    ):
        """
        :param sources: defaults to Broad. file-specific sources overrides release sources, but is the same thing
        """
        self.name: str = name
        self.display_label = display_label
        assert isinstance(type, FileType)
        self.type: FileType = type
        self.sub_type: Optional[FileSubtype] = sub_type

        self.version: Optional[int] = version

        self.size: str = size
        self._url: Union[BucketUrl, RetractedUrl, str] = url

        # Download file yaml configs might receive updated taiga_ids
        # that don't have a match in the TaigaAlias table. This is a new
        # field (as of 11/23/22) that will be filled out on future runs of
        # depmap-release-read-mes/to_downloads.py. If it's filled out with a
        # value, this is what the portal should consider the true canonical_taiga_id.
        self.canonical_taiga_id = canonical_taiga_id

        self.original_taiga_id = taiga_id
        self.original_satisfies_db_taiga_id = satisfies_db_taiga_id

        if sources:
            assert all([isinstance(source, FileSource) for source in sources])
            self._source_specified = True
        else:
            sources = [FileSource.broad]
            # if sources is set on release, will use that unless specified here
            self._source_specified = False
        self.sources: List[FileSource] = sources

        self.description: Optional[str] = description
        self.is_main_file = is_main_file

        if date_override is not None:
            assert isinstance(date_override, date)
        self.date_override = date_override

        if terms_override is not None:
            assert isinstance(terms_override, ReleaseTerms)
        self.terms_override = terms_override

        if retraction_override is not None:
            # if override is set, ignore the original url
            url = RetractedUrl()

        if isinstance(url, RetractedUrl):
            assert retraction_override is not None
        self.retraction_override: Optional[
            Union[RetractedUrl, str]
        ] = retraction_override

        self.summary_stats: Optional[SummaryStats] = summary_stats

        self.md5_hash = md5_hash

    def __str__(self):
        return '<DownloadFile "{}">'.format(self.name)

    def __repr__(self):
        r = (
            "DownloadFile("
            + "name={},"
            + "type={},"
            + "size={},"
            + "url={},"
            + "taiga_id={},"
        ).format(
            repr(self.name),
            str(self.type),
            repr(self.size),
            repr(self._url),
            repr(self.original_taiga_id),
        )

        if self.sources is not None and (
            len(self.sources) > 1 or self.sources[0] != FileSource.broad
        ):
            r += "sources=[{}],".format(
                ", ".join([str(source) for source in self.sources])
            )

        if self.description is not None:
            r += "description={},".format(repr(self.description))

        if self.is_main_file:
            r += "is_main_file={},".format(repr(self.is_main_file))

        if self.original_satisfies_db_taiga_id is not None:
            r += "satisfies_db_taiga_id={},".format(
                repr(self.original_satisfies_db_taiga_id)
            )

        if self.date_override is not None:
            r += "date_override={},".format(repr(self.date_override))

        if self.terms_override is not None:
            r += "terms_override={},".format(str(self.terms_override))

        if self.retraction_override is not None:
            r += "retraction_override={},".format(repr(self.retraction_override))

        if self.summary_stats is not None:
            r += "summary_stats={},".format(repr(self.summary_stats))

        if self.md5_hash is not None:
            r += "md5_hash={},".format(repr(self.md5_hash))

        return r + ")"

    @property
    def taiga_id(self):
        if self.original_taiga_id is None:
            return None

        # If the yaml downloads config has been updated without a redeploy or db rebuild,
        # TaigaAlias won't have a matching canonical_taiga_id. So we first check if the
        # canonical_taiga_id is filled out in the yaml.
        if self.canonical_taiga_id:
            canonical_taiga_id = self.canonical_taiga_id
        else:
            try:
                canonical_taiga_id = TaigaAlias.get_canonical_taiga_id(
                    self.original_taiga_id
                )
            except NoSuchTaigaAlias as ex:
                if current_app.config["ENV"] == "dev":  # pyright: ignore
                    # this is a bit of a hack but it is handy for locally
                    # testing themes without having the taiga aliases all
                    # loaded into the DB correctly. It's only the really
                    # old releases which are missing canonical taiga IDs
                    # so just assume those IDs are canonical already because
                    # they don't matter.
                    print(f"Warning: {ex}, assuming ID is canonical ID")
                    canonical_taiga_id = self.original_taiga_id
                else:
                    raise

        return canonical_taiga_id

    @property
    def satisfies_db_taiga_id(self):
        if self.original_satisfies_db_taiga_id is None:
            return None

        if self.canonical_taiga_id:
            canonical_taiga_id = self.canonical_taiga_id
        else:
            canonical_taiga_id = TaigaAlias.get_canonical_taiga_id(
                self.original_satisfies_db_taiga_id
            )

        return canonical_taiga_id

    @property
    def url(self):
        if isinstance(self._url, str):
            return self._url
        elif isinstance(self._url, RetractedUrl):
            return None
        else:
            return self._url.get_url()

    @property
    def is_retracted(self):
        return isinstance(self._url, RetractedUrl)

    @property
    def taiga_id_for_db_lookup(self):
        if self.satisfies_db_taiga_id:
            taiga_id = self.satisfies_db_taiga_id
        else:
            taiga_id = self.taiga_id
        return taiga_id

    def get_sources_display_names(self) -> List[str]:
        """
        creates a dict with properties
        converts to display name where applicable
        """
        return [source.display_name for source in self.sources]

    def get_sources_logos(self):
        """
        list of logo file names
        """
        return [
            {
                "src": url_for("static", filename=source.logo_file_name_alt[0]),
                "alt": source.logo_file_name_alt[1],
            }
            for source in self.sources
        ]


class ReleaseType(Enum):
    """
    These are just used to determine groupings of checkboxes
    """

    depmap_release = "depmap_release"
    rnai = "rnai"
    drug = "drug"
    other_omics = "other_omics"
    other_crispr = "other_crispr"
    other = "other"
    metmap = "metmap"

    @property
    def display_name(self):
        return {
            ReleaseType.depmap_release: "DepMap Releases (CRISPR + Omics)",
            ReleaseType.rnai: "RNAi Screens",
            ReleaseType.drug: "Drug Screens",
            ReleaseType.other_omics: "Other Omics",
            ReleaseType.other_crispr: "Other CRISPR Screens",
            ReleaseType.other: "Other",
            ReleaseType.metmap: "MetMap",
        }[self]

    @staticmethod
    def get_all_display_names():
        return [type.display_name for type in ReleaseType]
