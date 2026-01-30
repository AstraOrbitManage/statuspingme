export interface UpdateImage {
  id: string;
  url: string;
  filename?: string;
}

export interface UpdateLink {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

export interface Update {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
  images?: UpdateImage[];
  link?: UpdateLink;
}
