export type Destination = {
  slug: string;
  name: string;
  region?: string;
  paragraphs: string[];
  image_key?: string | null;
  country?: string;
  longitude?: number | null;
  latitude?: number | null;
};
