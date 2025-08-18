export type OpenLibraryDoc = {
  key: string;                 // e.g. "/works/OL12345W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;            // id de cover en OL (opcional)
};

export type SearchBookResult = {
  openLibraryKey: string;      // "/works/OL12345W"
  title: string;
  authors: string[];
  firstPublishYear?: number;
  // URL final de portada para frontend (si está en la biblioteca -> URL interna)
  coverUrl?: string;
  // Bandera para UI
  inMyLibrary: boolean;
};

export type LibraryBook = {
  _id?: any;
  openLibraryKey: string;      // unique
  title: string;
  authors: string[];
  firstPublishYear?: number;
  cover?: { gridFsId: string; contentType?: string; };
  createdAt?: Date;
  updatedAt?: Date;
};
