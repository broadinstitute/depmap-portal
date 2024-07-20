import csv
from depmap.database import db
from depmap.transcription_start_site.models import TranscriptionStartSite
from depmap.gene.models import Gene
from depmap.utilities.models import log_data_issue
from depmap.utilities.caching import LazyCache


def load_transcription_start_sites(filename):
    """
    cannot use bulk_load because it does not insert entries in the entity table
    :param filename:
    :return:
    """
    inserted = 0
    skipped = 0
    missing_gene = 0
    gene_cache = LazyCache(lambda id: Gene.get_by_label(id, must=False))

    with open(filename, "rt") as fd:
        dr = csv.DictReader(fd)
        for r in dr:
            gene = gene_cache.get(r["gene"])
            if gene is None:
                missing_gene += 1
                skipped += 1
                log_data_issue(
                    "TranscriptionStartSite",
                    "Missing gene",
                    id_type="gene_symbol",
                    identifier=r["gene"],
                )
            else:
                db.session.add(
                    TranscriptionStartSite(
                        gene_id=gene.entity_id,
                        label=r["TSS_id"],
                        chromosome=r["chr"],
                        five_prime_position=r["fpos"],
                        three_prime_position=r["tpos"],
                        average_coverage=r["avg_coverage"],
                    )
                )
                inserted += 1

    print(
        "Loaded {} transcription start sites (Skipped {}, {} had missing gene)".format(
            inserted, skipped, missing_gene
        )
    )
    assert skipped < inserted  # coarse check to make sure something got loaded
