export interface Subcategory {
  id: number;
  slug: string;
  title: string;
  topics: Topic[];
}

export interface Topic {
  id: number;
  slug: string;
  title: string;
  post_content: any;
  creation_date: string;
  update_date: string;
}
