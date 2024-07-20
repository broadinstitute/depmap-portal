import yaml
from typing import Any, Dict, List, Union
from depmap.public.documentation import Column, DocLink, Document, Section, Subsection


def parse_yaml(yaml_str: str) -> Dict[str, List[Dict[str, Union[List, str, Dict]]]]:
    parsed_yaml = yaml.load(yaml_str, Loader=yaml.SafeLoader)
    return parsed_yaml


def make_documents(subsection: Dict[str, Any]) -> List[Document]:
    documents: List[Dict[str, Any]] = subsection.get("documents", [])
    document_list: List[Document] = []

    for doc in documents:
        links: List[Dict[str, Any]] = doc.get("links", [])
        link_list: List[DocLink] = []
        for link in links:
            link_list.append(
                DocLink(link.get("link_label", None), link.get("link", None))
            )

        show_warning: bool = doc.get("link_show_dmc_warning", False)
        document = Document(
            text=doc.get("text", ""),
            links=link_list,
            link_show_dmc_warning=show_warning,
        )

        document_list.append(document)

    return document_list


def make_subsections(column: Dict[str, Any]) -> List[Subsection]:
    final_subsections: List[Subsection] = []

    # column is still just a dictionary of the "subsections" key and a list of dictionaries, so we need
    # to extract that dictionary using the subsections key
    subsections: List[Dict[str, Any]] = column.get("subsections", [])

    for subsect in subsections:
        name = subsect.get("name", "")
        documents = make_documents(subsect)
        subsection = Subsection(name, documents)
        final_subsections.append(subsection)

    return final_subsections


def make_columns(inital_columns: List[Dict[str, Any]]) -> List[Column]:
    final_columns: List[Column] = []

    # column = 1 list of subsections
    for column in inital_columns:
        subsections = make_subsections(column)
        final_column = Column(subsections)
        final_columns.append(final_column)

    return final_columns


def make_section(section: Dict[str, Any]) -> Section:
    name = section.get("name", "")
    initial_columns: List[Dict[str, Any]] = section.get("columns", [{}])

    # A column is just a list of subsections, so initial_columns should be 1 or more lists of subsections
    columns = make_columns(initial_columns)

    final_section = Section(name, columns)

    return final_section


def make_sections(content: str) -> List[Section]:
    result: List[Section] = []

    parsed_yaml: Dict[str, List[Dict[str, Union[List, str, Dict]]]] = parse_yaml(
        content
    )
    sections: List[Dict[str, Any]] = parsed_yaml.get("sections", None)

    for s in sections:
        section = make_section(s)
        result.append(section)

    return result


def parse_resources_file(filepath: str) -> List[Section]:
    yaml_file: str = ""
    with open(filepath) as fp:
        yaml_file = fp.read()

    # Don't keep going if there's nothing to process! Would cause crash
    if yaml_file == "":
        return []

    final_sections: List[Section] = make_sections(yaml_file)

    return final_sections
