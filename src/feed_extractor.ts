import { extract, FeedData } from "@extractus/feed-extractor";

export async function extractRSS(RSSUrl: string): Promise<FeedData> {
    return await extract(RSSUrl, {
        descriptionMaxLen: 0,
        getExtraEntryFields: (feedEntry) => {
            const {
                // this is plaintext of description, which may come from anything
                description: content_from_description,

                // if both description and content present, `description` is taken from description and we lose content, so here we save it
                // also, content is for ATOM format
                content: content_from_content,

                // this is for RSS format and RDF format
                "content:encoded": content_from_content_encoded,

                // for JSON format
                content_html: content_from_content_html,

                //
                pubdate: pubdate,
            } = feedEntry as {
                description: string;
                content: string;
                "content:encoded": string;
                content_html: string;
                pubdate: string;
            };
            return {
                content_from_description,
                content_from_content_encoded,
                content_from_content,
                content_from_content_html,
                pubdate,
            };
        },
    });
    
}

export interface feedValidationResult {
    validated: boolean;
    messages: string[];
}

export function validateFeedData(feedData: FeedData): feedValidationResult {
    let result: feedValidationResult = {
        validated: true,
        messages: [],
    };

    if (!feedData.title || feedData.title.length == 0) {
        result.validated = false;
        result.messages.push("Feed title is missing");
    }

    if (!feedData.entries || feedData.entries.length == 0) {
        result.validated = false;
        result.messages.push("Feed entries are missing");
    }

    if (feedData.entries) {
        let index = 0;
        for (const item of feedData.entries) {
            if (!item.title || item.title.length == 0) {
                result.validated = false;
                result.messages.push(`Feed item title is missing at index ${index}`);
            }
            let link = item.link || item.id;
            if (!link || link.length == 0) {
                result.validated = false;
                result.messages.push(`Feed item link is missing at index ${index}`);
            }
            index++;
        }
    }

    return result;
}
