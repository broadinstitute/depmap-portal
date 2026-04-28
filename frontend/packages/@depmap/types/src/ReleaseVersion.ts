export interface ReleaseFile {
  file_name: string;
  datatype: string;
  size?: string | null;
  description?: string | null;
  bucket_url?: string | null;
  taiga_id?: string | null;
  canonical_taiga_id?: string | null;
  md5_hash?: string | null;
  version?: number | null;
  pipeline_name?: string | null;
  is_main_file: boolean;
}

export interface ReleasePipeline {
  pipeline_name: string;
  description?: string | null;
}

export interface ReleaseVersion {
  id: string;
  release_name: string;
  version_name: string;
  version_date: string; // string (YYYY-MM-DD)
  citation?: string | null;
  description?: string | null;
  funding?: string | null;
  terms?: string | null;
  files?: ReleaseFile[] | null;
  release_pipelines?: ReleasePipeline[];
}
