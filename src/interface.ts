import { FeedEntry } from "@extractus/feed-extractor";

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