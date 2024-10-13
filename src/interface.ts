import { FeedEntry } from "@extractus/feed-extractor";

export interface MFFeedEntry extends FeedEntry {
    content_html: string;
    content_from_description: string;
    content_from_content_encoded: string;
    content_from_content: string;
    content_from_content_html: string;
    pubdate: string;
}

// stored in table items_related_cache.content as JSON
export type RelatedItemCached = {
    title: string;
    item_id: number;
    item_sqid: string;
    feed_title: string;
    feed_id: number;
    feed_sqid: string;
    url: string;
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
