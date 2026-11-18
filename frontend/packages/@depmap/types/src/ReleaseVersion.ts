export interface ReleaseFile {
  id: string;
  filename: string;
  datatypes?: string[];
  size?: number;
  description?: string;
  download_url?: string;
}

export interface ReleaseVersion {
  id?: string;
  release_name: string;
  version_name: string;
  version_date?: string;
  description?: string;
  files?: ReleaseFile[];
}

export interface GetReleaseVersionsParams {
  include_files?: boolean;
  datatype?: string;
  start_date?: string;
  end_date?: string;
  release_name?: string;
}

export interface GetReleaseVersionParams {
  include_files?: boolean;
}
