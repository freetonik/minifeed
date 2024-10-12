export type Bindings = {
    DB: D1Database;
    FEED_UPDATE_QUEUE: Queue;
    SESSIONS_KV: KVNamespace;

    TYPESENSE_API_KEY: string;
    TYPESENSE_API_KEY_SEARCH: string;
    TYPESENSE_ITEMS_COLLECTION: string;
    TYPESENSE_BLOGS_COLLECTION: string;
    TYPESENSE_CLUSTER: string;
    MAE_SERVICE_API_KEY: string;

    AWS_SES_ACCESS_KEY: string;
    AWS_SES_ACCESS_KEY_SECRET: string;

    ENVIRONMENT: string;

    VECTORIZE: Vectorize;
    AI: Ai;
};
