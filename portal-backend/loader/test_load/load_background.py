import sqlite3


def lookup_breadbox_dataset_given_id(legacy_dataset_id: str) -> str:
    """
    Returns the breadbox_dataset_id for a given legacy dataset ID string.
    """
    legacy_to_breadbox = {
        "PRISMOncologyReferenceLog2AUCMatrix": "Prism_oncology_AUC",
        "PRISMOncologyReferenceSeqLog2AUCMatrix": "Prism_oncology_AUC_seq",
        "Rep_all_single_pt_per_compound": "Rep_all_single_pt",
        "CTRP_AUC_collapsed": "CTRP_AUC",
        "GDSC1_AUC_collapsed": "GDSC1_AUC",
        "GDSC2_AUC_collapsed": "GDSC2_AUC",
        "REPURPOSING_AUC_collapsed": "Repurposing_secondary_AUC",
    }
    return legacy_to_breadbox.get(legacy_dataset_id, legacy_dataset_id)


def migrate_predictive_background(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # The same mapping used in your previous migration
    dataset_config = {
        1: "REPURPOSING_AUC_collapsed",
        2: "CTRP_AUC_collapsed",
        3: "GDSC1_AUC_collapsed",
        4: "GDSC2_AUC_collapsed",
        5: "PRISMOncologyReferenceLog2AUCMatrix",
        6: "PRISMOncologyReferenceSeqLog2AUCMatrix",
        7: "Rep_all_single_pt_per_compound",
        8: "RNAi_merged",
        9: "RNAi_Nov_DEM",
        10: "RNAi_Ach",
        11: "Chronos_Combined",
        12: "OrganoidGeneEffect",
        13: "CTRP_dose_replicate",
        14: "GDSC1_dose_replicate",
        15: "GDSC2_dose_replicate",
        16: "Repurposing_secondary_dose_replicate",
        17: "Prism_oncology_dose_replicate",
        18: "Prism_oncology_seq_dose_replicate",
    }

    try:
        cursor.execute("BEGIN TRANSACTION;")

        # 1. Create the new table with dataset_given_id as TEXT
        print("Creating new predictive_background table...")
        cursor.execute("DROP TABLE IF EXISTS predictive_background_new;")
        cursor.execute(
            """
            CREATE TABLE predictive_background_new (
                predictive_background_id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_given_id TEXT NOT NULL,
                background TEXT NOT NULL,
                UNIQUE (dataset_given_id)
            );
        """
        )

        # 2. Fetch old data
        cursor.execute(
            "SELECT predictive_background_id, dataset_id, background FROM predictive_background"
        )
        old_rows = cursor.fetchall()

        migrated_data = []
        skipped = 0

        # 3. Transform data
        for row in old_rows:
            pb_id, ds_id, background = row

            # Get the legacy name
            legacy_name = dataset_config.get(ds_id)

            if legacy_name:
                # Convert to breadbox ID using your helper function
                final_id = lookup_breadbox_dataset_given_id(legacy_name)
                migrated_data.append((pb_id, final_id, background))
            else:
                print(
                    f"Warning: No mapping found for dataset_id {ds_id}. Skipping row {pb_id}."
                )
                skipped += 1

        # 4. Insert into new table
        cursor.executemany(
            """
            INSERT INTO predictive_background_new 
            (predictive_background_id, dataset_given_id, background)
            VALUES (?, ?, ?)
        """,
            migrated_data,
        )

        # 5. Swap tables
        cursor.execute("DROP TABLE predictive_background;")
        cursor.execute(
            "ALTER TABLE predictive_background_new RENAME TO predictive_background;"
        )

        # 6. Recreate the index on the new column name
        cursor.execute(
            "CREATE INDEX ix_predictive_background_dataset_given_id ON predictive_background (dataset_given_id);"
        )

        conn.commit()
        print(
            f"Migration successful! {len(migrated_data)} rows migrated, {skipped} skipped."
        )

    except Exception as e:
        conn.rollback()
        print(f"Migration Failed: {e}")
    finally:
        conn.close()


import sqlite3


def update_to_legacy_slugs(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Mapping: Breadbox ID -> Legacy Slug
    # This reverts "Prism_oncology_AUC" back to "PRISMOncologyReferenceLog2AUCMatrix"
    breadbox_to_legacy = {
        "Prism_oncology_AUC": "PRISMOncologyReferenceLog2AUCMatrix",
        "Prism_oncology_AUC_seq": "PRISMOncologyReferenceSeqLog2AUCMatrix",
        "Rep_all_single_pt": "Rep_all_single_pt_per_compound",
        "CTRP_AUC": "CTRP_AUC_collapsed",
        "GDSC1_AUC": "GDSC1_AUC_collapsed",
        "GDSC2_AUC": "GDSC2_AUC_collapsed",
        "Repurposing_secondary_AUC": "REPURPOSING_AUC_collapsed",
    }

    try:
        cursor.execute("BEGIN TRANSACTION;")

        # Prepare the update list
        update_data = [(v, k) for k, v in breadbox_to_legacy.items()]

        # Perform the updates
        cursor.executemany(
            """
            UPDATE predictive_background 
            SET dataset_given_id = ? 
            WHERE dataset_given_id = ?
        """,
            update_data,
        )

        # Check for any remaining 'Chronos' or 'RNAi' cases
        # (Though those usually map to themselves, this ensures the transaction is active)
        conn.commit()

        # --- VERIFICATION ---
        print("Update complete. Current values in predictive_background:")
        cursor.execute("SELECT DISTINCT dataset_given_id FROM predictive_background")
        for row in cursor.fetchall():
            print(f"- {row[0]}")

    except Exception as e:
        conn.rollback()
        print(f"Update failed: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    DB_PATH = "/Users/amourey/dev/depmap-portal3/depmap-portal/portal-backend/webapp_data/data.db"
    update_to_legacy_slugs(DB_PATH)
# if __name__ == "__main__":
#     DB_PATH = "/Users/amourey/dev/depmap-portal3/depmap-portal/portal-backend/webapp_data/data.db"
#     migrate_predictive_background(DB_PATH)
