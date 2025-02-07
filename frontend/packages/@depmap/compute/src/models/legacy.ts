// This was used by Data Explorer 1 and Vector Catalog. It's a meaningless type
// now but there are still some references to it in legacy code.
export interface Link {
  link: string | null;
  value: string;
  label: string;
}
