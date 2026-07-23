A new set of endpoints to support searching for files (organized into file
sets) using full text search.

Okay, the plan is:

1. define a data model
2. transform yaml files -> data model

Maybe need to approach this in a few rounds:

1. add support for search
2. add support for new download page (will require data type annotation)

The data model:

```
interface File {
  name: string
  type: string    Should type and subtype be replaced with data type?
  sub_type?: string
  size: string
  url: string
  version
  pipeline_name? : string
  canonical_taiga_id: string
  sources: string[]
  description: string
  is_main_file: bool
  terms?:
  release_date: string
  md5_hash: str
  dataset_id?: str # if loaded into data explorer, the ID of the associated
  dataset. (Would be nice to avoid code relying on taiga_id)
}

interface FileSet {
  id: string
  priority: number
  etag: string # used to detect changes
  name: string
  type: string
  release_date: string
  files: File[]
  pipelines: Pipeline[] ???? how is this used?
  version_group: string
  funding: string
  terms ??? Do we register a set of terms? We've got this new embargo setup. Shouldn't we use that?
  citation: string
  sources ??? Do we really need this?
}

```

GET /filesets
GET /filesets/id
DELETE /filesets/id
POST /filesets
GET /fileset-index/search?query=...
