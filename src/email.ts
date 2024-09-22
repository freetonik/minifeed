export const sendEmail = async (
    to: string,
    name: string,
    from: string,
    subject: string,
    body: string,
    dev: boolean = false,
) => {
    if (dev) {
        console.log(
            `Email to ${to}\nfrom ${from}\nsubject ${subject}\nbody:${body}`,
        );
        return;
    }
    const send_request = new Request("https://api.mailchannels.net/tx/v1/send", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            personalizations: [
                {
                    to: [{ email: to, name: name }],
                },
            ],
            from: {
                email: from,
                name: "minifeed.net",
            },
            subject: subject,
            content: [
                {
                    type: "text/plain",
                    value: body,
                },
            ],
        }),
    });

    let respContent = "";
    // only send the mail on "POST", to avoid spiders, etc.
    const resp = await fetch(send_request);
    const respText = await resp.text();

    respContent = resp.status + " " + resp.statusText + "\n\n" + respText;
    return respContent;
};
