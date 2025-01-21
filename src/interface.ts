import type { FeedEntry } from '@extractus/feed-extractor';

export interface MFFeedEntry extends FeedEntry {
    content_html: string;
    content_from_description: string;
    content_from_content_encoded: string;
    content_from_content: string;
    content_from_content_html: string;
    pubdate: string;
}

export type ItemRow = {
    item_id: number;
    created: string;
    feed_id: number;
    title: string;
    description: string;
    content_html: string;
    content_html_scraped: string;
    url: string;
    pub_date: string;
    item_sqid: string;
};

export type FeedRow = {
    feed_id: number;
    created: string;
    type: string;
    title: string;
    url: string;
    rss_url: string;
    verified: boolean;
    feed_sqid: string;
    description: string;
};

export type MFQueueMessage = {
    type: string;
    feed_id?: number;
    item_id?: number;
};

// SEARCH RESULTS
export type ItemSearchResult = {
    document: ItemSearchResultDocument;
    highlight: ItemSearchResultHighlight;
};

export type FeedSearchResult = {
    document: FeedSearchResultDocument;
    highlight: ItemSearchResultHighlight;
};

export type FeedSearchResultDocument = {
    title: string;
    type: string;
    feed_sqid: string;
    url: string;
    rss_url: string;
};

export type ItemSearchResultDocument = {
    title: string;
    type: string;
    feed_sqid: string;
    feed_title: string;
    item_sqid: string;
    url: string;
    pub_date: string;
};

export type ItemSearchResultHighlight = {
    title?: ItemSearchResultHighlightEntity;
    content?: ItemSearchResultHighlightEntity;
};

export type ItemSearchResultHighlightEntity = {
    matched_tokens: Array<unknown>;
    snippet: string;
};

// SEARCH DOCUMENT
export type ItemSearchDocument = {
    id: string;
    title: string;
    content: string;
    type: string;
    item_sqid: string;
    url: string;
    pub_date: string;
    feed_id: number;
    feed_sqid: string;
    feed_title: string;
};

export type FeedSearchDocument = {
    id: string;
    title: string;
    type: string;
    content: string;
    feed_id: number;
    // non-searchable fields
    feed_sqid: string;
    url: string;
    rss_url: string;
};

// SCRAPING
export type ArticleInfo = {
    url: string;
    title: string;
    HTMLcontent: string;
    textContent: string;
    description: string;
    published: string;
};

// SUBSCRIPTIONS (billing)
export enum SubscriptionTier {
    FREE = 0,
    PRO = 1,
}

export enum HomePageSubsectionPreference {
    ALL = 'all',
    SUBSCRIPTIONS = 'subscriptions',
    FAVORITES = 'favorites',
    FRIENDFEED = 'friendfeed',
}
