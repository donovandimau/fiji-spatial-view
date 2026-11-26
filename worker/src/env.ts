export interface Env {
  SPATIAL_DATA: R2Bucket;
  FLIGHT_FEED: DurableObjectNamespace;
  FERRY_FEED: DurableObjectNamespace;
  AISSTREAM_KEY?: string;
  FERRY_MMSIS?: string;
  OPENSKY_CLIENT_ID?: string;
  OPENSKY_CLIENT_SECRET?: string;
  PAGES_ORIGIN?: string;
}
