export type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

export type SearchBookResult = {
  openLibraryKey: string;
  title: string;
  authors: string[];
  firstPublishYear?: number;
  coverUrl?: string;
  inMyLibrary: boolean;
};

export type LibraryBook = {
  _id?: any;
  openLibraryKey: string;
  title: string;
  authors: string[];
  firstPublishYear?: number;
  cover_i?: number;
  createdAt?: Date;
  updatedAt?: Date;
};
