import sqlite3


def lookup_breadbox_dataset_given_id(legacy_dataset_id: str) -> str:
    """
    Returns the breadbox_dataset_id for a given legacy dataset ID string. If
    there are no breadbox dataset ids, fallback to the legacy id.
    """
    # Mapping legacy names back to breadbox IDs
    legacy_to_breadbox = {
        "PRISMOncologyReferenceLog2AUCMatrix": "Prism_oncology_AUC",
        "PRISMOncologyReferenceSeqLog2AUCMatrix": "Prism_oncology_AUC_seq",
        "Rep_all_single_pt_per_compound": "Rep_all_single_pt",
        "CTRP_AUC_collapsed": "CTRP_AUC",
        "GDSC1_AUC_collapsed": "GDSC1_AUC",
        "GDSC2_AUC_collapsed": "GDSC2_AUC",
        "REPURPOSING_AUC_collapsed": "Repurposing_secondary_AUC",
    }

    # Check if it's in our mapping;
    # otherwise, return the ID itself (for "Chronos_Combined" and "RNAi_merged", and "Avana" (Avana seems to only be relevant for TDA))
    return legacy_to_breadbox.get(legacy_dataset_id, legacy_dataset_id)


def run_full_migration(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Mapping: original_dataset_id -> (New id, Feature Type)
    # This structure ensures no keys are overwritten.
    dataset_config = {
        1: ("REPURPOSING_AUC_collapsed", "compound_v2"),
        2: ("CTRP_AUC_collapsed", "compound_v2"),
        3: ("GDSC1_AUC_collapsed", "compound_v2"),
        4: ("GDSC2_AUC_collapsed", "compound_v2"),
        5: ("PRISMOncologyReferenceLog2AUCMatrix", "compound_v2"),
        6: ("PRISMOncologyReferenceSeqLog2AUCMatrix", "compound_v2"),
        7: ("Rep_all_single_pt_per_compound", "compound_v2"),
        8: ("RNAi_merged", "gene"),
        9: ("RNAi_Nov_DEM", "gene"),
        10: ("RNAi_Ach", "gene"),
        11: ("Chronos_Combined", "gene"),
        12: ("OrganoidGeneEffect", "gene"),
        13: ("CTRP_dose_replicate", "compound_v2"),
        14: ("GDSC1_dose_replicate", "compound_v2"),
        15: ("GDSC2_dose_replicate", "compound_v2"),
        16: ("Repurposing_secondary_dose_replicate", "compound_v2"),
        17: ("Prism_oncology_dose_replicate", "compound_v2"),
        18: ("Prism_oncology_seq_dose_replicate", "compound_v2"),
    }

    try:
        print("Caching lookup tables...")
        # Cache Gene Mappings: entity_id -> entrez_id
        cursor.execute("SELECT entity_id, entrez_id FROM gene")
        gene_lookup = {row[0]: str(row[1]) for row in cursor.fetchall()}

        # Cache Compound Mappings: entity_id -> compound_id
        cursor.execute(
            """
            SELECT ce.entity_id, c.compound_id 
            FROM compound_experiment ce
            JOIN compound c ON ce.compound_id = c.entity_id
        """
        )
        compound_lookup = {row[0]: str(row[1]) for row in cursor.fetchall()}
        print(compound_lookup)
        # Start Migration
        cursor.execute("BEGIN TRANSACTION;")

        # 1. Create the new SQLAlchemy-compliant table
        cursor.execute("DROP TABLE IF EXISTS predictive_model_new;")
        cursor.execute(
            """
            CREATE TABLE predictive_model_new (
                predictive_model_id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_given_id TEXT NOT NULL,
                pred_model_feature_id TEXT NOT NULL,
                pred_model_feature_type TEXT NOT NULL,
                label TEXT NOT NULL,
                pearson FLOAT NOT NULL
            );
        """
        )

        # 2. Recreate Indexes
        cursor.execute(
            "CREATE INDEX ix_pm_dataset_given_id ON predictive_model_new (dataset_given_id);"
        )
        cursor.execute(
            "CREATE INDEX ix_pm_feature_id ON predictive_model_new (pred_model_feature_id);"
        )
        cursor.execute(
            "CREATE INDEX ix_pm_feature_type ON predictive_model_new (pred_model_feature_type);"
        )

        # 3. Transform Data
        cursor.execute(
            "SELECT predictive_model_id, dataset_id, entity_id, label, pearson FROM predictive_model"
        )
        old_rows = cursor.fetchall()

        migrated_data = []
        skipped = 0

        for row in old_rows:
            pm_id, ds_id, ent_id, label, pearson = row

            config = dataset_config.get(ds_id)
            if not config:
                skipped += 1
                continue

            ds_slug, feat_type = config

            # Assign correct feature_id based on the type
            new_feat_id = None
            if feat_type == "gene":
                new_feat_id = gene_lookup.get(ent_id)
            elif feat_type == "compound_v2":
                new_feat_id = compound_lookup.get(ent_id)

            if new_feat_id:
                if feat_type == "compound_v2":
                    print((pm_id, ds_slug, new_feat_id, feat_type, label, pearson))
                migrated_data.append(
                    (pm_id, ds_slug, new_feat_id, feat_type, label, pearson)
                )
            else:
                skipped += 1

        # 4. Insert and Rename
        cursor.executemany(
            """
            INSERT INTO predictive_model_new 
            (predictive_model_id, dataset_given_id, pred_model_feature_id, pred_model_feature_type, label, pearson)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            migrated_data,
        )

        cursor.execute("DROP TABLE predictive_model;")
        cursor.execute("ALTER TABLE predictive_model_new RENAME TO predictive_model;")

        conn.commit()

        # --- VERIFICATION STEP ---
        print("\n" + "=" * 30)
        print("MIGRATION SUMMARY")
        print("=" * 30)
        print(f"Successfully migrated: {len(migrated_data)} rows")
        print(f"Skipped rows:         {skipped}")

        print("\nRow distribution by Feature Type:")
        cursor.execute(
            """
            SELECT pred_model_feature_type, COUNT(*) 
            FROM predictive_model 
            GROUP BY pred_model_feature_type
        """
        )
        for feat_type, count in cursor.fetchall():
            print(f"- {feat_type}: {count} rows")
        print("=" * 30)

    except Exception as e:
        conn.rollback()
        print(f"Migration Failed: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    run_full_migration(
        "/Users/amourey/dev/depmap-portal3/depmap-portal/portal-backend/webapp_data/data.db"
    )
