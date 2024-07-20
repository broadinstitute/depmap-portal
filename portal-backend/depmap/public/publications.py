from dataclasses import dataclass
from typing import List, Optional, Sequence, Union

ALL_ENVS = ("dmc", "skyros", "public", "peddep")


@dataclass
class Publication:
    journal: str
    date: str
    title: str
    authorlist: str
    abstract: str
    link: str
    doi: str
    minisite_label: Optional[str] = None
    minisite_link: Optional[str] = None
    env: Union[
        str, Sequence[str]
    ] = ALL_ENVS  # the environments that can see this document. Defaults to all


@dataclass
class Pubsections:
    name: str
    publications: List[Publication]
    env: Union[
        str, Sequence[str]
    ] = ALL_ENVS  # the environments that can see this document. Defaults to all


def filter_publications(pubsections, env_type):
    def is_allowed_env_type(env_types: Union[str, Sequence]):
        "Check to confirm that the current env_type is one of the env_types listed as allowed"
        if type(env_types) == str:
            return env_type == env_types
        else:
            return env_type in env_types

    def filter_pubsection(pubsection):
        publications = [
            Publication(
                journal=publication.journal,
                date=publication.date,
                title=publication.title,
                authorlist=publication.authorlist,
                abstract=publication.abstract,
                link=publication.link,
                doi=publication.doi,
                env=publication.env,
            )
            for publication in pubsection.publications
            if is_allowed_env_type(publication.env)
        ]

        return Pubsections(pubsection.name, publications)

    pubsections = [
        filter_pubsection(pubsection)
        for pubsection in pubsections
        if is_allowed_env_type(pubsection.env)
    ]

    return pubsections


publications_sections = [
    Pubsections(
        name="",
        publications=[
            Publication(
                journal="Nature Cancer",
                date="2022.04.18",
                title="Phosphate dysregulation via the XPR1–KIDINS220 protein complex is a therapeutic vulnerability in ovarian cancer",
                authorlist="Daniel P. Bondeson, Brenton R. Paolella, Adhana Asfaw, Michael V. Rothberg, Michael Mannstadt, James M. McFarland, Francisca Vazquez & Todd R. Golub",
                abstract="Despite advances in precision medicine, the clinical prospects for patients with ovarian and uterine cancers have not substantially improved. Here, we analyzed genome-scale CRISPR–Cas9 loss-of-function screens across 851 human cancer cell lines and found that frequent overexpression of SLC34A2—encoding a phosphate importer—is correlated with sensitivity to loss of the phosphate exporter XPR1, both in vitro and in vivo. In patient-derived tumor samples, we observed frequent PAX8-dependent overexpression of SLC34A2, XPR1 copy number amplifications and XPR1 messenger RNA overexpression. Mechanistically, in SLC34A2-high cancer cell lines, genetic or pharmacologic inhibition of XPR1-dependent phosphate efflux leads to the toxic accumulation of intracellular phosphate. Finally, we show that XPR1 requires the novel partner protein KIDINS220 for proper cellular localization and activity, and that disruption of this protein complex results in acidic “vacuolar” structures preceding cell death. These data point to the XPR1–KIDINS220 complex and phosphate dysregulation as a therapeutic vulnerability in ovarian cancer.",
                link="https://www.nature.com/articles/s43018-022-00360-7",
                doi="doi.org/10.1038/s43018-022-00360-7",
            ),
            Publication(
                journal="bioRxiv",
                date="2022.03.03",
                title="Partial gene suppression improves identification of cancer vulnerabilities when CRISPR-Cas9 knockout is pan-lethal",
                authorlist="J. Michael Krill-Burger, Joshua M. Dempster, Ashir A. Borah, Brenton R. Paolella, William C. Hahn, James M. McFarland, Francisca Vazquez & Aviad Tsherniak",
                abstract="Hundreds of genome-wide loss-of-function screens have been performed, as part of efforts such as The Cancer Dependency Map, to create a catalog of genetic dependencies in a diverse set of cancer contexts. In recent years, large-scale screening efforts have shifted perturbation technology from RNAi to CRISPR-Cas9, due to the superior efficacy and specificity of CRISPR-Cas9-mediated approaches. However, questions remain about the extent to which partial suppression of gene targets could result in selective dependency across cell lines, potentially revealing a larger set of targetable cancer vulnerabilities than can be identified using CRISPR knockout alone. Here, we use CRISPR-Cas9 and RNAi screening data for more than 400 shared cell lines to represent knockout and partial suppression genetic perturbation modalities and evaluate the utility of each for therapeutic target discovery and the inference of gene function. We find that CRISPR screens identify more dependencies, and yield more accurate predictive models and co-dependency relationships overall. However, RNAi outperforms CRISPR in identifying associations (omics, drug, co-dependencies) with genes that are common dependencies for most cell lines (pan-dependencies). As pan-dependencies occur frequently in the CRISPR dataset (~2,000 genes), using results from both RNAi and CRISPR analyses facilitates the discovery of predictive models and associated co-dependencies for a wider range of gene targets than could be detected using either dataset alone. These findings can aid in the interpretation of contrasting results obtained from CRISPR and RNAi screens and reinforce the importance of partial gene suppression methods in building a cancer dependency map.",
                link="https://www.biorxiv.org/content/10.1101/2022.03.02.482624v1",
                doi="doi.org/10.1101/2022.03.02.482624",
            ),
            Publication(
                journal="Cell Systems",
                date="2022.01.26",
                title="Sparse dictionary learning recovers pleiotropy from human cell fitness screens",
                authorlist="Joshua Pan, Jason J. Kwon, Jessica A. Talamas, Ashir A. Borah, Aviad Tsherniak, Marinka Zitnik, James M. McFarland & William C. Hahn",
                abstract="In high-throughput functional genomic screens, each gene product is commonly assumed to exhibit a singular biological function within a defined protein complex or pathway. In practice, a single gene perturbation may induce multiple cascading functional outcomes, a genetic principle known as pleiotropy. Here, we model pleiotropy in fitness screen collections by representing each gene perturbation as the sum of multiple perturbations of biological functions, each harboring independent fitness effects inferred empirically from the data. Our approach (Webster) recovered pleiotropic functions for DNA damage proteins from genotoxic fitness screens, untangled distinct signaling pathways upstream of shared effector proteins from cancer cell fitness screens, and predicted the stoichiometry of an unknown protein complex subunit from fitness data alone. Modeling compound sensitivity profiles in terms of genetic functions recovered compound mechanisms of action. Our approach establishes a sparse approximation mechanism for unraveling complex genetic architectures underlying high-dimensional gene perturbation readouts.",
                link="https://www.cell.com/cell-systems/fulltext/S2405-4712(21)00488-9",
                doi="doi.org/10.1016/j.cels.2021.12.005",
            ),
            Publication(
                journal="Genome Biology",
                date="2021.12.20",
                title="Chronos: a cell population dynamics model of CRISPR experiments that improves inference of gene fitness effects",
                authorlist="Joshua M. Dempster, Isabella Boyle, Francisca Vazquez, David E. Root, Jesse S. Boehm, William C. Hahn, Aviad Tsherniak & James M. McFarland",
                abstract="CRISPR loss of function screens are powerful tools to interrogate biology but exhibit a number of biases and artifacts that can confound the results. Here, we introduce Chronos, an algorithm for inferring gene knockout fitness effects based on an explicit model of cell proliferation dynamics after CRISPR gene knockout. We test Chronos on two pan-cancer CRISPR datasets and one longitudinal CRISPR screen. Chronos generally outperforms competitors in separation of controls and strength of biomarker associations, particularly when longitudinal data is available. Additionally, Chronos exhibits the lowest copy number and screen quality bias of evaluated methods.",
                link="https://genomebiology.biomedcentral.com/articles/10.1186/s13059-021-02540-7",
                doi="doi.org/10.1186/s13059-021-02540-7",
            ),
            Publication(
                journal="Cell",
                date="2021.12.09",
                title="Microenvironment drives cell state, plasticity, and drug response in pancreatic cancer",
                authorlist="Srivatsan Raghavan, Peter S. Winter, Andrew W. Navia, Hannah L. Williams, Willian C. Hahn, Andrew J. Aguirre & Alex K. Shalek",
                abstract="Prognostically relevant RNA expression states exist in pancreatic ductal adenocarcinoma (PDAC), but our understanding of their drivers, stability, and relationship to therapeutic response is limited. To examine these attributes systematically, we profiled metastatic biopsies and matched organoid models at single-cell resolution. In vivo, we identify a new intermediate PDAC transcriptional cell state and uncover distinct site- and state-specific tumor microenvironments (TMEs). Benchmarking models against this reference map, we reveal strong culture-specific biases in cancer cell transcriptional state representation driven by altered TME signals. We restore expression state heterogeneity by adding back in vivo-relevant factors and show plasticity in culture models. Further, we prove that non-genetic modulation of cell state can strongly influence drug responses, uncovering state-specific vulnerabilities. This work provides a broadly applicable framework for aligning cell states across in vivo and ex vivo settings, identifying drivers of transcriptional plasticity and manipulating cell state to target associated vulnerabilities.",
                link="https://www.cell.com/cell/fulltext/S0092-8674(21)01332-5",
                doi="doi.org/10.1016/j.cell.2021.11.017",
            ),
            Publication(
                journal="Nature Genetics",
                date="2021.12.02",
                title="Paralog knockout profiling identifies DUSP4 and DUSP6 as a digenic dependence in MAPK pathway-driven cancers",
                authorlist="Takahiro Ito, Michael J. Young, Ruitong Li, Sidharth Jain, Francisca Vazquez, John G. Doench, Mahdi Zamanighomi & William R. Sellers",
                abstract="Although single-gene perturbation screens have revealed a number of new targets, vulnerabilities specific to frequently altered drivers have not been uncovered. An important question is whether the compensatory relationship between functionally redundant genes masks potential therapeutic targets in single-gene perturbation studies. To identify digenic dependencies, we developed a CRISPR paralog targeting library to investigate the viability effects of disrupting 3,284 genes, 5,065 paralog pairs and 815 paralog families. We identified that dual inactivation of DUSP4 and DUSP6 selectively impairs growth in NRAS and BRAF mutant cells through the hyperactivation of MAPK signaling. Furthermore, cells resistant to MAPK pathway therapeutics become cross-sensitized to DUSP4 and DUSP6 perturbations such that the mechanisms of resistance to the inhibitors reinforce this mechanism of vulnerability. Together, multigene perturbation technologies unveil previously unrecognized digenic vulnerabilities that may be leveraged as new therapeutic targets in cancer.",
                link="https://www.nature.com/articles/s41588-021-00967-z",
                doi="doi.org/10.1038/s41588-021-00967-z",
            ),
            Publication(
                journal="Cancer Research",
                date="2021.12.01",
                title="Are CRISPR Screens Providing the Next Generation of Therapeutic Targets?",
                authorlist="Francisca Vazquez & William R. Sellers",
                abstract="CRISPR screens combined with molecular and genetic profiling of large panels of cell lines are helping to systematically identify cancer vulnerabilities. These large-scale screens, together with focused in vivo and isogenic cell line screens, have identified a growing number of promising targets and led directly to numerous target-specific drug discovery programs, several of which have reached clinical testing. However, systematic loss-of-function studies are still in their early stages. Genetic redundancy, the limitation of cell line models for many cancer types, and the difficulty of conducting complex in vitro and in vivo screens remain opportunities for discovery. We expect that over the next few years, efforts like the Cancer Dependency Map along with more focused screens will play a significant role in the creation of a roadmap of oncology therapeutic targets.",
                link="https://cancerres.aacrjournals.org/content/81/23/5806.long",
                doi="doi.org/10.1158/0008-5472.CAN-21-1784",
            ),
            Publication(
                journal="Nature Genetics",
                date="2021.07.12",
                title="Genome-scale screens identify factors regulating tumor cell responses to natural killer cells",
                authorlist="Michal Sheffer, Emily Lowry, Nicky Beelen, Minasri Borah, Satu Mustjoki, Aedin C. Culhane, Lotte Wieten & Constantine S. Mitsiades",
                abstract="To systematically define molecular features in human tumor cells that determine their degree of sensitivity to human allogeneic natural killer (NK) cells, we quantified the NK cell responsiveness of hundreds of molecularly annotated ‘DNA-barcoded’ solid tumor cell lines in multiplexed format and applied genome-scale CRISPR-based gene-editing screens in several solid tumor cell lines, to functionally interrogate which genes in tumor cells regulate the response to NK cells. In these orthogonal studies, NK cell–sensitive tumor cells tend to exhibit ‘mesenchymal-like’ transcriptional programs; high transcriptional signature for chromatin remodeling complexes; high levels of B7-H6 (NCR3LG1); and low levels of HLA-E/antigen presentation genes. Importantly, transcriptional signatures of NK cell–sensitive tumor cells correlate with immune checkpoint inhibitor (ICI) resistance in clinical samples. This study provides a comprehensive map of mechanisms regulating tumor cell responses to NK cells, with implications for future biomarker-driven applications of NK cell immunotherapies.",
                link="https://www.nature.com/articles/s41588-021-00889-w",
                doi="doi.org/10.1038/s41588-021-00889-w",
            ),
            Publication(
                journal="Cancer Cell",
                date="2021.07.14",
                title="STAG2 loss rewires oncogenic and developmental programs to promote metastasis in Ewing sarcoma",
                authorlist="Biniam Adane, Gabriela Alexe, Bo Kyung A. Seong, Diana Lu, Richard A. Young, Brian D. Crompton & Kimberly Stegmaier",
                abstract="The core cohesin subunit STAG2 is recurrently mutated in Ewing sarcoma but its biological role is less clear. Here, we demonstrate that cohesin complexes containing STAG2 occupy enhancer and polycomb repressive complex (PRC2)-marked regulatory regions. Genetic suppression of STAG2 leads to a compensatory increase in cohesin-STAG1 complexes, but not in enhancer-rich regions, and results in reprogramming of cis-chromatin interactions. Strikingly, in STAG2 knockout cells the oncogenic genetic program driven by the fusion transcription factor EWS/FLI1 was highly perturbed, in part due to altered enhancer-promoter contacts. Moreover, loss of STAG2 also disrupted PRC2-mediated regulation of gene expression. Combined, these transcriptional changes converged to modulate EWS/FLI1, migratory, and neurodevelopmental programs. Finally, consistent with clinical observations, functional studies revealed that loss of STAG2 enhances the metastatic potential of Ewing sarcoma xenografts. Our findings demonstrate that STAG2 mutations can alter chromatin architecture and transcriptional programs to promote an aggressive cancer phenotype.",
                link="https://www.cell.com/cancer-cell/fulltext/S1535-6108(21)00273-7",
                doi="doi.org/10.1016/j.ccell.2021.05.007",
            ),
            Publication(
                journal="Cancer Research",
                date="2021.06.07",
                title="Gene fusions create partner and collateral dependencies essential to cancer cell survival",
                authorlist="Riaz Gillani, Bo Kyung A. Seong, Jett Crowdis, Katherine A. Janeway, James M. McFarland, Kimberly Stegmaier & Eliezer M. Van Allen",
                abstract="Gene fusions frequently result from rearrangements in cancer genomes. In many instances, gene fusions play an important role in oncogenesis; in other instances, they are thought to be passenger events. Although regulatory element rearrangements and copy number alterations resulting from these structural variants (SV) are known to lead to transcriptional dysregulation across cancers, the extent to which these events result in functional dependencies with an impact on cancer cell survival is variable. Here we used CRISPR-Cas9 dependency screens to evaluate the fitness impact of 3,277 fusions across 645 cell lines from the Cancer Dependency Map (DepMap). We found that 35% of cell lines harbored either a fusion partner dependency or a collateral dependency on a gene within the same topologically associating domain (TAD) as a fusion partner. Fusion-associated dependencies revealed numerous novel oncogenic drivers and clinically translatable alterations. Broadly, fusions can result in partner and collateral dependencies that have biological and clinical relevance across cancer types.",
                link="https://aacrjournals.org/cancerres/article/81/15/3971/670248",
                doi="doi: 10.1158/0008-5472.CAN-21-0791",
            ),
            Publication(
                journal="Cancer Discovery",
                date="2021.04.21",
                title="Selective modulation of a pan-essential protein as a therapeutic strategy in cancer",
                authorlist="Clare F. Malone, Neekesh V Dharia, Guillaume Kugener, Alexandra B. Forman, David E. Root, Todd R. Golub, Francisca Vazquez & Kimberly Stegmaier",
                abstract="Cancer dependency maps, which use CRISPR/Cas9 depletion screens to profile the landscape of genetic dependencies in hundreds of cancer cell lines, have identified context-specific dependencies that could be therapeutically exploited. An ideal therapy is both lethal and precise, but these depletion screens cannot readily distinguish between gene effects that are cytostatic or cytotoxic. Here, we employ a diverse panel of functional genomic screening assays to identify NXT1 as a selective and rapidly lethal in vivo-relevant genetic dependency in MYCN-amplified neuroblastoma. NXT1 heterodimerizes with NXF1 and together they form the principle mRNA nuclear export machinery. We describe a previously unrecognized mechanism of synthetic lethality between NXT1 and its paralog NXT2: their common essential binding partner NXF1 is lost only in the absence of both. We propose a potential therapeutic strategy for tumor-selective elimination of a protein that, if targeted directly, is expected to cause widespread toxicity.",
                link="https://cancerdiscovery.aacrjournals.org/content/early/2021/04/19/2159-8290.CD-20-1213",
                doi="doi.org/10.1158/2159-8290.CD-20-1213",
            ),
            Publication(
                journal="Molecular Biology of the Cell",
                date="2021.04.19",
                title="Predicting cell health phenotypes using image-based morphology profiling",
                authorlist="Gregory P. Way, Maria Kost-Alimova, Tsukasa Shibue, William F. Harrington, William C. Hahn, Anne E. Carpenter, Francisca Vazquez & Shantanu Singh",
                abstract="Genetic and chemical perturbations impact diverse cellular phenotypes, including multiple indicators of cell health. These readouts reveal toxicity and antitumorigenic effects relevant to drug discovery and personalized medicine. We developed two customized microscopy assays, one using four targeted reagents and the other three targeted reagents, to collectively measure 70 specific cell health phenotypes including proliferation, apoptosis, reactive oxygen species, DNA damage, and cell cycle stage. We then tested an approach to predict multiple cell health phenotypes using Cell Painting, an inexpensive and scalable image-based morphology assay. In matched CRISPR perturbations of three cancer cell lines, we collected both Cell Painting and cell health data. We found that simple machine learning algorithms can predict many cell health readouts directly from Cell Painting images, at less than half the cost. We hypothesized that these models can be applied to accurately predict cell health assay outcomes for any future or existing Cell Painting dataset. For Cell Painting images from a set of 1500+ compound perturbations across multiple doses, we validated predictions by orthogonal assay readouts. We provide a web app to browse predictions: http://broad.io/cell-health-app. Our approach can be used to add cell health annotations to Cell Painting datasets.",
                link="https://doi.org/10.1091/mbc.E20-12-0784",
                doi="doi.org/10.1091/mbc.E20-12-0784",
            ),
            Publication(
                journal="Gut",
                date="2021.03.31",
                title="Pan-ERBB kinase inhibition augments CDK4/6 inhibitor efficacy in oesophageal squamous cell carcinoma ",
                authorlist="Jin Zhou, Zhong Wu, Zhouwei Zhang, Louisa Goss, James McFarland, Alan Diehl, Matthew Meyerson, Kwok-Kin Wong & Adam Bass",
                abstract="Oesophageal squamous cell carcinoma (OSCC), like other squamous carcinomas, harbour highly recurrent cell cycle pathway alterations, especially hyperactivation of the CCND1/CDK4/6 axis, raising the potential for use of existing CDK4/6 inhibitors in these cancers. Although CDK4/6 inhibition has shown striking success when combined with endocrine therapy in oestrogen receptor positive breast cancer, CDK4/6 inhibitor palbociclib monotherapy has not revealed evidence of efficacy to date in OSCC clinical studies. Herein, we sought to elucidate the identification of key dependencies in OSCC as a foundation for the selection of targets whose blockade could be combined with CDK4/6 inhibition.",
                link="https://gut.bmj.com/content/early/2021/03/30/gutjnl-2020-323276",
                doi="doi.org/10.1136/gutjnl-2020-323276",
            ),
            Publication(
                journal="British Journal of Cancer",
                date="2021.03.29",
                title="Bridging the gap between cancer cell line models and tumours using gene expression data",
                authorlist="Javad Noorbakhsh, Francisca Vazquez & James M. McFarland",
                abstract="Cancer cell line models are a cornerstone of cancer research, yet our understanding of how well they represent the molecular features of patient tumours remains limited. Our recent work provides a computational approach to systematically compare large gene expression datasets to better understand which cell lines most closely resemble each tumour type, as well as identify potential gaps in our current cancer models.",
                link="https://www.nature.com/articles/s41416-021-01359-0",
                doi="doi.org/10.1038/s41416-021-01359-0",
            ),
            Publication(
                journal="Nature Genetics",
                date="2021.03.22",
                title="A first-generation pediatric cancer dependency map",
                authorlist="Neekesh V. Dharia, Guillaume Kugener, Lillian M. Guenther, Clare F. Malone,... James M. McFarland, Aviad Tsherniak, Todd R. Golub, Francisca Vazquez & Kimberly Stegmaier",
                minisite_label="Visit the minisite",
                minisite_link="https://depmap.org/peddep/",
                abstract="Exciting therapeutic targets are emerging from CRISPR-based screens of high mutational-burden adult cancers. A key question, however, is whether functional genomic approaches will yield new targets in pediatric cancers, known for remarkably few mutations, which often encode proteins considered challenging drug targets. To address this, we created a first-generation pediatric cancer dependency map representing 13 pediatric solid and brain tumor types. Eighty-two pediatric cancer cell lines were subjected to genome-scale CRISPR–Cas9 loss-of-function screening to identify genes required for cell survival. In contrast to the finding that pediatric cancers harbor fewer somatic mutations, we found a similar complexity of genetic dependencies in pediatric cancer cell lines compared to that in adult models. Findings from the pediatric cancer dependency map provide preclinical support for ongoing precision medicine clinical trials. The vulnerabilities observed in pediatric cancers were often distinct from those in adult cancer, indicating that repurposing adult oncology drugs will be insufficient to address childhood cancers.",
                link="https://www.nature.com/articles/s41588-021-00819-w",
                doi="doi.org/10.1038/s41588-021-00819-w",
            ),
            Publication(
                journal="Nature Communications",
                date="2021.03.12",
                title="Integrated cross-study datasets of genetic dependencies in cancer",
                authorlist="Clare Pacini, Joshua M. Dempster, Isabella Boyle, Emanuel Gonçalves, Hanna Najgebauer,... James M. McFarland, Mathew J. Garnett, Aviad Tsherniak & Francesco Iorio",
                minisite_label="Visit the Broad-Sanger minisite",
                minisite_link="https://depmap.org/broad-sanger/",
                abstract="CRISPR-Cas9 viability screens are increasingly performed at a genome-wide scale across large panels of cell lines to identify new therapeutic targets for precision cancer therapy. Integrating the datasets resulting from these studies is necessary to adequately represent the heterogeneity of human cancers and to assemble a comprehensive map of cancer genetic vulnerabilities. Here, we integrated the two largest public independent CRISPR-Cas9 screens performed to date (at the Broad and Sanger institutes) by assessing, comparing, and selecting methods for correcting biases due to heterogeneous single guide RNA efficiency, gene-independent responses to CRISPR-Cas9 targeting originated from copy number alterations...",
                link="https://doi.org/10.1038/s41467-021-21898-7",
                doi="doi.org/10.1038/s41467-021-21898-7",
            ),
            Publication(
                journal="Cell",
                date="2021.03.04",
                title="An expanded universe of cancer targets",
                authorlist="William C. Hahn, Joel S. Bader, Theodore P. Braun, Andrea Califano, William A. Weiss, Daniela S. Gerhard & the Cancer Target Discovery and Development Network",
                abstract="The characterization of cancer genomes has provided insight into somatically altered genes across tumors, transformed our understanding of cancer biology, and enabled tailoring of therapeutic strategies. However, the function of most cancer alleles remains mysterious, and many cancer features transcend their genomes. Consequently, tumor genomic characterization does not influence therapy for most patients. Approaches to understand the function and circuitry of cancer genes provide complementary approaches to elucidate both oncogene and non-oncogene dependencies. Emerging work indicates that the diversity of therapeutic targets engendered by non-oncogene dependencies is much larger than the list of recurrently mutated genes. Here we describe a framework for this expanded list of cancer targets, providing novel opportunities for clinical translation.",
                link="https://doi.org/10.1016/j.cell.2021.02.020",
                doi="doi.org/10.1016/j.cell.2021.02.020",
            ),
            Publication(
                journal="Nature",
                date="2021.01.26",
                title="Cancer research needs a better map",
                authorlist="Jesse S. Boehm, Mathew J. Garnett, David J. Adams, Hayley E. Francies, Todd R. Golub, William C. Hahn, Francesco Iorio, James M. McFarland, Leopold Parts & Francisca Vazquez",
                abstract="Almost 15 years ago, scientists and clinicians set out to characterize genomes of tumours from thousands of patients. The result? The Cancer Genome Atlas (TCGA) and International Cancer Genome Consortium (ICGC). Nearly every targeted cancer drug approved over the past decade has drawn from the data sets generated by these efforts. This information is now also providing clues to triangulate which individuals can benefit from new types of drug, such as pembrolizumab and nivolumab, which help the immune system to fight cancer. TCGA generated more than 2.5 petabytes of data measuring mutations, gene expression and protein levels across 33 cancer types. It catalysed innovation in DNA sequencing technology and genome analysis. It ultimately collected data from some 11,000 patients — data that thousands of researchers use. This work redefined cancers on the molecular level, and painted a picture of the mutations that occur in common tumour types.",
                link="https://www.nature.com/articles/d41586-021-00182-0",
                doi="doi.org/10.1038/d41586-021-00182-0",
            ),
            Publication(
                journal="Cancer Cell",
                date="2021.01.21",
                title="Targeting pan-essential genes in cancer: Challenges and opportunities",
                authorlist="Liang Chang, Paloma Ruiz, Takahiro Ito & William R. Sellers",
                abstract="Despite remarkable successes in the clinic, cancer targeted therapy development remains challenging and the failure rate is disappointingly high. This problem is partly due to the misapplication of the targeted therapy paradigm to therapeutics targeting pan-essential genes, which can result in therapeutics whereby efficacy is attenuated by dose-limiting toxicity. Here we summarize the key features of successful chemotherapy and targeted therapy agents, and use case studies to outline recurrent challenges to drug development efforts targeting pan-essential genes. Finally, we suggest strategies to avoid previous pitfalls for ongoing and future development of pan-essential therapeutics.",
                link="https://www.cell.com/cancer-cell/fulltext/S1535-6108(20)30656-5",
                doi="doi.org/10.1016/j.ccell.2020.12.008",
            ),
            Publication(
                journal="Nature Communications",
                date="2021.01.04",
                title="Global computational alignment of tumor and cell line transcriptional profiles",
                authorlist="Allison Warren, Yejia Chen, Andrew Jones, Tsukasa Shibue, William C. Hahn, Jesse S. Boehm, Francisca Vazquez, Aviad Tsherniak & James M. McFarland",
                abstract="Cell lines are key tools for preclinical cancer research, but it remains unclear how well they represent patient tumor samples. Direct comparisons of tumor and cell line transcriptional profiles are complicated by several factors, including the variable presence of normal cells in tumor samples. We thus develop an unsupervised alignment method (Celligner) and apply it to integrate several large-scale cell line and tumor RNA-Seq datasets. Although our method aligns the majority of cell lines with tumor samples of the same cancer type, it also reveals large differences in tumor similarity across cell lines...",
                link="https://www.nature.com/articles/s41467-020-20294-x",
                doi="doi.org/10.1038/s41467-020-20294-x",
            ),
            Publication(
                journal="Cell Reports",
                date="2020.12.15",
                title="Synthetic Lethal Interaction between the ESCRT Paralog Enzymes VPS4A and VPS4B in Cancers Harboring Loss of Chromosome 18q or 16q",
                authorlist="Jasper E. Neggers, Brenton R. Paolella, Adhana Asfaw, Michael V. Rothberg... William C. Hahn, Kimberly Stegmaier, Todd R. Golub, Francisca Vazquez & Andrew J. Aguirre",
                abstract="Few therapies target the loss of tumor suppressor genes in cancer. We examine CRISPR-SpCas9 and RNA-interference loss-of-function screens to identify new therapeutic targets associated with genomic loss of tumor suppressor genes. The endosomal sorting complexes required for transport (ESCRT) ATPases VPS4A and VPS4B score as strong synthetic lethal dependencies. VPS4A is essential in cancers harboring loss of VPS4B adjacent to SMAD4 on chromosome 18q and VPS4B is required in tumors with co-deletion of VPS4A and CDH1 (E-cadherin) on chromosome 16q...",
                link="https://www.cell.com/cell-reports/fulltext/S2211-1247(20)31482-0?_returnURL=https%3A%2F%2Flinkinghub.elsevier.com%2Fretrieve%2Fpii%2FS2211124720314820%3Fshowall%3Dtrue",
                doi="doi.org/10.1016/j.celrep.2020.108493",
            ),
            Publication(
                journal="Nature Communications",
                date="2020.08.27",
                title="Multiplexed single-cell transcriptional response profiling to define cancer vulnerabilities and therapeutic mechanism of action",
                authorlist="James M. McFarland, Brenton R. Paolella, Allison Warren, Kathryn Geiger-Schuller,... Aviv Regev, Andrew J. Aguirre, Francisca Vazquez, & Aviad Tsherniak",
                abstract="Assays to study cancer cell responses to pharmacologic or genetic perturbations are typically restricted to using simple phenotypic readouts such as proliferation rate. Information-rich assays, such as gene-expression profiling, have generally not permitted efficient profiling of a given perturbation across multiple cellular contexts. Here, we develop MIX-Seq, a method for multiplexed transcriptional profiling of post-perturbation responses across a mixture of samples with single-cell resolution, using SNP-based computational demultiplexing of single-cell RNA-sequencing data...",
                link="https://www.nature.com/articles/s41467-020-17440-w",
                doi="doi.org/10.1038/s41467-020-17440-w",
            ),
            Publication(
                journal="Molecular Systems Biology",
                date="2020.07.21",
                title="The Cancer Dependency Map enables drug mechanism‐of‐action investigations",
                authorlist="Francisca Vazquez & Jesse Boehm",
                abstract="How do small molecules exert their effects in mammalian cells? This seemingly simple question continues to represent one of the fundamental challenges of modern translational science and as such has long been the subject of intense scientific scrutiny. In their recent study, Garnett and colleagues (Gonçalves et al, 2020) demonstrate proof‐of‐concept for a new way to attack this problem systematically for Oncology drugs, by identifying correlated CRISPR‐ and drug‐killing profiles in the Cancer Dependency Map dataset.",
                link="https://www.embopress.org/doi/full/10.15252/msb.20209757",
                doi="doi.org/10.15252/msb.20209757",
            ),
            Publication(
                journal="Nature Cancer",
                date="2020.01.20",
                title="Discovering the anticancer potential of non-oncology drugs by systematic viability profiling",
                authorlist="Steven M. Corsello, Rohith T. Nagari, Ryan D. Spangler, Jordan Rossen, Mustafa Kocak,... Jesse S. Boehm, Christopher C. Mader, Aviad Tsherniak & Todd R. Golub",
                minisite_label="Visit the minisite",
                minisite_link="https://depmap.org/repurposing/",
                abstract="Anticancer uses of non-oncology drugs have occasionally been found, but such discoveries have been serendipitous. We sought to create a public resource containing the growth-inhibitory activity of 4,518 drugs tested across 578 human cancer cell lines. We used PRISM (profiling relative inhibition simultaneously in mixtures), a molecular barcoding method, to screen drugs against cell lines in pools. An unexpectedly large number of non-oncology drugs selectively inhibited subsets of cancer cell lines in a manner predictable from... ",
                link="https://www.nature.com/articles/s43018-019-0018-6",
                doi="doi.org/10.1038/s43018-019-0018-6",
            ),
            Publication(
                journal="Nature Communications",
                date="2019.12.20",
                title="Agreement between two large pan-cancer CRISPR-Cas9 gene dependency data sets",
                authorlist="Joshua M. Dempster, Clare Pacini, Sasha Pantel, Fiona M. Behan,... David E. Root, Mathew J. Garnett, Aviad Tsherniak & Francesco Iorio",
                minisite_label="Visit the Broad-Sanger minisite",
                minisite_link="https://depmap.org/broad-sanger/",
                abstract="Genome-scale CRISPR-Cas9 viability screens performed in cancer cell lines provide a systematic approach to identify cancer dependencies and new therapeutic targets. As multiple large-scale screens become available, a formal assessment of the reproducibility of these experiments becomes necessary. We analyze data from recently published pan-cancer CRISPR-Cas9 screens performed at the Broad and Sanger Institutes. Despite significant differences in experimental protocols and reagents, we find that the screen results are highly... ",
                link="https://www.nature.com/articles/s41467-019-13805-y",
                doi="doi.org/10.1038/s41467-019-13805-y",
            ),
            Publication(
                journal="Cell",
                date="2019.10.17",
                title="Optical Pooled Screens in Human Cells",
                authorlist="David Feldman, Avtar Singh, Jonathan L. Schmid-Burgk, Rebecca J Carlson,... Anja Mezger, Anthony J. Garrity, Feng Zhang & Paul C. Blainey",
                abstract="Genetic screens are critical for the systematic identification of genes underlying cellular phenotypes. Pooling gene perturbations greatly improves scalability but is not compatible with imaging of complex and dynamic cellular phenotypes. Here, we introduce a pooled approach for optical genetic screens in mammalian cells. We use targeted in situ sequencing to demultiplex a library of genetic perturbations following image-based phenotyping. We screened a set of 952 genes across millions of cells for involvement in nuclear factor κB (NF-κB)... ",
                link="https://doi.org/10.1016/j.cell.2019.09.016",
                doi="doi.org/10.1016/j.cell.2019.09.016",
            ),
            Publication(
                journal="Cell Reports",
                date="2019.08.27",
                title="Small-Molecule and CRISPR Screening Converge to Reveal Receptor Tyrosine Kinase Dependencies in Pediatric Rhabdoid Tumors",
                authorlist="Elaine M. Oberlick, Matthew G. Rees, Brinton Seashore-Ludlow, Francisca Vazquez,... William C. Hahn, Elizabeth A. Stewart, Stuart L. Schreiber & Charles W.M. Roberts",
                abstract="Cancer is often seen as a disease of mutations and chromosomal abnormalities. However, some cancers, including pediatric rhabdoid tumors (RTs), lack recurrent alterations targetable by current drugs and need alternative, informed therapeutic options. To nominate potential targets, we performed a high-throughput small-molecule screen complemented by a genome-scale CRISPR-Cas9 gene-knockout screen in a large number of RT and control cell lines. These approaches converged to reveal several receptor... ",
                link="https://doi.org/10.1016/j.celrep.2019.07.021",
                doi="doi.org/10.1016/j.celrep.2019.07.021",
            ),
            Publication(
                journal="Nature",
                date="2019.05.08",
                title="Next-generation characterization of the Cancer Cell Line Encyclopedia",
                authorlist="Mahmoud Ghandi, Franklin W. Huang, Judit Jané-Valbuena, Gregory V. Kryukov,... Todd R. Golub, Levi A. Garraway & William R. Sellers",
                abstract="Large panels of comprehensively characterized human cancer models, including the Cancer Cell Line Encyclopedia (CCLE), have provided a rigorous framework with which to study genetic variants, candidate targets, and small-molecule and biological therapeutics and to identify new marker-driven cancer dependencies. To improve our understanding of the molecular features that contribute to cancer phenotypes, including drug responses, here we have expanded the characterizations of cancer cell lines to include genetic,... ",
                link="https://www.nature.com/articles/s41586-019-1186-3",
                doi="doi.org/10.1038/s41586-019-1186-3",
            ),
            Publication(
                journal="Nature Medicine",
                date="2019.05.08",
                title="The landscape of cancer cell line metabolism",
                authorlist="Haoxin Li, Shaoyang Ning, Mahmoud Ghandi, Gregory V. Kryukov,... Stuart L. Schreiber, Clary B. Clish, Levi A. Garraway & William R. Sellers",
                abstract="Despite considerable efforts to identify cancer metabolic alterations that might unveil druggable vulnerabilities, systematic characterizations of metabolism as it relates to functional genomic features and associated dependencies remain uncommon. To further understand the metabolic diversity of cancer, we profiled 225 metabolites in 928 cell lines from more than 20 cancer types in the Cancer Cell Line Encyclopedia (CCLE) using liquid chromatography–mass spectrometry (LC-MS). This resource enables unbiased association analysis...",
                link="https://www.nature.com/articles/s41591-019-0404-8",
                doi="doi.org/10.1038/s41591-019-0404-8",
            ),
            Publication(
                journal="Nature",
                date="2019.04.10",
                title="WRN helicase is a synthetic lethal target in microsatellite unstable cancers",
                authorlist="Edmond M. Chan, Tsukasa Shibue, James M. McFarland, Benjamin Gaeta,... Todd R. Golub, Aviad Tsherniak, Francisca Vazquez & Adam J. Bass",
                minisite_label="Visit the minisite",
                minisite_link="https://depmap.org/WRN/",
                abstract="Synthetic lethality—an interaction between two genetic events through which the co-occurrence of these two genetic events leads to cell death, but each event alone does not—can be exploited for cancer therapeutics. DNA repair processes represent attractive synthetic lethal targets, because many cancers exhibit an impairment of a DNA repair pathway, which can lead to dependence on specific repair proteins. The success of poly(ADP-ribose) polymerase 1 (PARP-1) inhibitors in cancers with deficiencies in homologous recombination highlights the potential of this approach. Hypothesizing that other DNA repair defects,... ",
                link="https://www.nature.com/articles/s41586-019-1102-x",
                doi="doi.org/10.1038/s41586-019-1102-x",
            ),
            Publication(
                journal="Nature",
                date="2018.12.17",
                title="Loss of ADAR1 in tumours overcomes resistance to immune checkpoint blockade",
                authorlist="Jeffrey J. Ishizuka, Robert T. Manguso, Collins K. Cheruiyot, Kevin Bi,... John G. Doench, David Kozono, Erez Y. Levanon & W. Nicholas Haining",
                abstract="Most patients with cancer either do not respond to immune checkpoint blockade or develop resistance to it, often because of acquired mutations that impair antigen presentation. Here we show that loss of function of the RNA-editing enzyme ADAR1 in tumour cells profoundly sensitizes tumours to immunotherapy and overcomes resistance to checkpoint blockade. In the absence of ADAR1, A-to-I editing of interferon-inducible RNA species is reduced, leading to double-stranded RNA ligand sensing by PKR and MDA5; this results in growth inhibition... ",
                link="https://www.nature.com/articles/s41586-018-0768-9",
                doi="doi.org/10.1038/s41586-018-0768-9",
            ),
            Publication(
                journal="Nature Communications",
                date="2018.11.02",
                title="Improved estimation of cancer dependencies from large-scale RNAi screens using model-based normalization and data integration",
                authorlist="James M. McFarland, Zandra V. Ho, Guillaume Kugener, Joshua M. Dempster,... Todd R. Golub, William C. Hahn, David E. Root & Aviad Tsherniak",
                minisite_label="Visit the minisite",
                minisite_link="https://depmap.org/R2-D2/",
                abstract="The availability of multiple datasets comprising genome-scale RNAi viability screens in hundreds of diverse cancer cell lines presents new opportunities for understanding cancer vulnerabilities. Integrated analyses of these data to assess differential dependency across genes and cell lines are challenging due to confounding factors such as batch effects and variable screen quality, as well as difficulty assessing gene dependency on an absolute scale. To address these issues, we incorporated cell line screen-quality parameters and hierarchical Bayesian inference into DEMETER2, an analytical framework...",
                link="https://www.nature.com/articles/s41467-018-06916-5",
                doi="doi.org/10.1038/s41467-018-06916-5",
            ),
            Publication(
                journal="Nature Genetics",
                date="2017.10.30",
                title="Computational correction of copy number effect improves specificity of CRISPR-Cas9 essentiality screens in cancer cells",
                authorlist="Robin M. Meyers, Jordan G. Bryan, James M. McFarland, Barbara A. Weir,... David E. Root, William C. Hahn, & Aviad Tsherniak",
                minisite_label="Visit the minisite",
                minisite_link="https://depmap.org/ceres/",
                abstract="The CRISPR–Cas9 system has revolutionized gene editing both at single genes and in multiplexed loss-of-function screens, thus enabling precise genome-scale identification of genes essential for proliferation and survival of cancer cells1,2. However, previous studies have reported that a gene-independent antiproliferative effect of Cas9-mediated DNA cleavage confounds such measurement of genetic dependency, thereby leading to false-positive results in copy number–amplified regions3,4. We developed CERES, a computational method...",
                link="https://www.nature.com/articles/ng.3984",
                doi="doi.org/10.1038/ng.3984",
            ),
            Publication(
                journal="Cell",
                date="2017.07.27",
                title="Defining a Cancer Dependency Map",
                authorlist="Aviad Tsherniak, Francisca Vazquez, Phillip G. Montgomery, Barbara A. Weir,... Todd R. Golub, Jesse S. Boehm, & William C. Hahn",
                minisite_label="Visit the minisite",
                minisite_link="https://depmap.org/rnai/",
                abstract="Most human epithelial tumors harbor numerous alterations, making it difficult to predict which genes are required for tumor survival. To systematically identify cancer dependencies, we analyzed 501 genome-scale loss-of-function screens performed in diverse human cancer cell lines. We developed DEMETER, an analytical framework that segregates on- from off-target effects of RNAi. 769 genes were differentially required in subsets of these cell lines at a threshold of six SDs from the mean. We found predictive models for 426 dependencies....",
                link="https://doi.org/10.1016/j.cell.2017.06.010",
                doi="doi.org/10.1016/j.cell.2017.06.010",
            ),
            Publication(
                journal="Nature",
                date="2017.07.19",
                title="In vivo CRISPR screening identifies Ptpn2 as a cancer immunotherapy target",
                authorlist="Robert T. Manguso, Hans W. Pope, Margaret D. Zimmer, Flavian D. Brown,... David E. Root, Arlene H. Sharpe, John G. Doench & W. Nicholas Haining",
                abstract="Immunotherapy with PD-1 checkpoint blockade is effective in only a minority of patients with cancer, suggesting that additional treatment strategies are needed. Here we use a pooled in vivo genetic screening approach using CRISPR–Cas9 genome editing in transplantable tumours in mice treated with immunotherapy to discover previously undescribed immunotherapy targets. We tested 2,368 genes expressed by melanoma cells to identify those that synergize with or cause resistance to checkpoint blockade. We recovered the known immune...",
                link="https://www.nature.com/articles/nature23270",
                doi="doi.org/10.1038/nature23270",
            ),
            Publication(
                journal="Nature Medicine",
                date="2017.04.07",
                title="The Drug Repurposing Hub: a next-generation drug library and information resource",
                authorlist="Steven M. Corsello, Joshua A. Bittker, Zihan Liu, Joshua Gould,... Christopher C. Mader, Aravind Subramanian, & Todd R. Golub",
                abstract="Drug repurposing, the application of an existing therapeutic to a new disease indication, holds the promise of rapid clinical impact at a lower cost than de novo drug development. To date there has not been a systematic effort to identify such opportunities, limited in part by the lack of a comprehensive library of clinical compounds suitable for testing. To address this challenge, we hand-curated a collection of 4,707 compounds, experimentally confirmed their identity, and annotated them with literature-reported targets...",
                link="https://www.nature.com/articles/nm.4306",
                doi="doi.org/10.1038/nm.4306",
            ),
            Publication(
                journal="Cell",
                date="2016.12.15",
                title="Perturb-Seq: Dissecting Molecular Circuits with Scalable Single-Cell RNA Profiling of Pooled Genetic Screens",
                authorlist="Atray Dixit, Oren Parnas, Biyu Li, Jenny Chen,...  Eric S. Lander, Jonathan S. Weissman, Nir Friedman, & Aviv Regev ",
                abstract="Genetic screens help infer gene function in mammalian cells, but it has remained difficult to assay complex phenotypes-such as transcriptional profiles-at scale. Here, we develop Perturb-seq, combining single-cell RNA sequencing (RNA-seq) and clustered regularly interspaced short palindromic repeats (CRISPR)-based perturbations to perform many such assays in a pool. We demonstrate Perturb-seq by analyzing 200,000 cells in immune cells and cell lines, focusing on transcription factors regulating the response of dendritic cells...",
                link="https://doi.org/10.1016/j.cell.2016.11.038",
                doi="10.1016/j.cell.2016.11.038",
            ),
            Publication(
                journal="Science",
                date="2016.03.11",
                title="MTAP deletion confers enhanced dependency on the PRMT5 arginine methyltransferase in cancer cells",
                authorlist="Gregory V. Kryukov, Frederick H. Wilson, Jason R. Ruth, Joshiawa Paulk,... Clary B. Clish, James E. Bradner, William C. Hahn, Levi A. Garraway",
                abstract="The discovery of cancer dependencies has the potential to inform therapeutic strategies and to identify putative drug targets. Integrating data from comprehensive genomic profiling of cancer cell lines and from functional characterization of cancer cell dependencies, we discovered that loss of the enzyme methylthioadenosine phosphorylase (MTAP) confers a selective dependence on protein arginine methyltransferase 5 (PRMT5) and its binding partner WDR77. MTAP is frequently lost due to its proximity to the commonly deleted tumor...",
                link="https://science.sciencemag.org/content/351/6278/1214",
                doi="doi.org/10.1126/science.aad5214",
            ),
            Publication(
                journal="Nature Biotechnology",
                date="2016.02.29",
                title="High-throughput identification of genotype-specific cancer vulnerabilities in mixtures of barcoded tumor cell lines",
                authorlist="Channing Yu, Aristotle M. Mannan, Griselda Metta Yvone, Kenneth N. Ross,... Stuart L. Schreiber, Andrew L. Kung, & Todd R. Golub",
                abstract="Hundreds of genetically characterized cell lines are available for the discovery of genotype-specific cancer vulnerabilities. However, screening large numbers of compounds against large numbers of cell lines is currently impractical, and such experiments are often difficult to control1,2,3,4. Here we report a method called PRISM that allows pooled screening of mixtures of cancer cell lines by labeling each cell line with 24-nucleotide barcodes. PRISM revealed the expected patterns of cell killing seen in conventional (unpooled) assays...",
                link="https://www.nature.com/articles/nbt.3460",
                doi="doi.org/10.1038/nbt.3460",
            ),
            Publication(
                journal="Nature Chemical Biology",
                date="2015.12.14",
                title="Correlating chemical sensitivity and basal gene expression reveals mechanism of action",
                authorlist="Matthew G. Rees, Brinton Seashore-Ludlow, Jaime H. Cheah, Drew J. Adams,... Paul A. Clemons, Alykhan F. Shamji, & Stuart L. Schreiber",
                abstract="Changes in cellular gene expression in response to small-molecule or genetic perturbations have yielded signatures that can connect unknown mechanisms of action (MoA) to ones previously established. We hypothesized that differential basal gene expression could be correlated with patterns of small-molecule sensitivity across many cell lines to illuminate the actions of compounds whose MoA are unknown. To test this idea, we correlated the sensitivity patterns of 481 compounds with ∼19,000 basal transcript levels across 823 different...",
                link="https://www.nature.com/articles/nchembio.1986",
                doi="doi.org/10.1038/nchembio.1986",
            ),
            Publication(
                journal="Nature",
                date="2015.11.16",
                title="Pharmacogenomic agreement between two cancer cell line data sets",
                authorlist="The Cancer Cell Line Encyclopedia Consortium & The Genomics of Drug Sensitivity in Cancer Consortium",
                abstract="Large cancer cell line collections broadly capture the genomic diversity of human cancers and provide valuable insight into anti-cancer drug response. Here we show substantial agreement and biological consilience between drug sensitivity measurements and their associated genomic predictors from two publicly available large-scale pharmacogenomics resources: The Cancer Cell Line Encyclopedia and the Genomics of Drug Sensitivity in Cancer databases....",
                link="https://www.nature.com/articles/nature15736",
                doi="doi.org/10.1038/nature15736",
            ),
            Publication(
                journal="Nature",
                date="2012.03.28",
                title="The Cancer Cell Line Encyclopedia enables predictive modelling of anticancer drug sensitivity",
                authorlist="TJordi Barretina, Giordano Caponigro, Nicolas Stransky, Kavitha Venkatesan,... William R. Sellers, Robert Schlegel, & Levi A. Garraway",
                abstract="The systematic translation of cancer genomic data into knowledge of tumour biology and therapeutic possibilities remains challenging. Such efforts should be greatly aided by robust preclinical model systems that reflect the genomic diversity of human cancers and for which detailed genetic and pharmacological annotation is available1. Here we describe the Cancer Cell Line Encyclopedia (CCLE): a compilation of gene expression, chromosomal copy number and massively parallel sequencing data from 947 human cancer cell lines. When coupled with pharmacological profiles for 24 anticancer drugs across 479 of the cell lines....",
                link="https://www.nature.com/articles/nature11003",
                doi="doi.org/10.1038/nature11003",
            ),
        ],
    )
]
