export type Bindings = {
    DB: D1Database;
    ASSETS: R2Bucket;

    FEED_UPDATE_QUEUE: Queue;
    ITEM_VECTORIZE_QUEUE: Queue;
    ITEM_SCRAPE_QUEUE: Queue;
    SEARCH_INDEX_QUEUE: Queue;

    SESSIONS_KV: KVNamespace;
    BLACKLIST_URLS: KVNamespace;
    UTILITY_LISTS_KV: KVNamespace;

    TYPESENSE_API_KEY: string;
    TYPESENSE_API_KEY_SEARCH: string;
    TYPESENSE_ITEMS_COLLECTION: string;
    TYPESENSE_FEEDS_COLLECTION: string;
    TYPESENSE_CLUSTER: string;
    MAE_SERVICE_API_KEY: string;

    AWS_SES_ACCESS_KEY: string;
    AWS_SES_ACCESS_KEY_SECRET: string;

    ENVIRONMENT: string;

    VECTORIZE: Vectorize;
    AI: Ai;
};
