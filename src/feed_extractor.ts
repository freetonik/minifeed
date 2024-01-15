import { extract } from "@extractus/feed-extractor";

export const extractRSS = async(RSSUrl:string) => {
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

			} = feedEntry
			return {
				content_from_description, content_from_content_encoded, content_from_content, content_from_content_html
			}
		}
	});
}