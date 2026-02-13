(async () => {
    const OPENAI_KEY = "YOUR API KEY GOES HERE";
    const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

    async function chatGPT(messages) {
        const es = fetch(OPENAI_ENDPOINT, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_KEY}`,
            },
            method: "POST",
            body: JSON.stringify({
                model: "gpt-4o",
                messages: messages,
                //stream: true,
                stop: ["\n\n"],
            }),
        });
        return es.then(response => {
            if(!response.ok) {
                throw new Error(`ChatGPT HTTP error! status: ${response.status}`);
            }
            return response.json();
        }).then(data => {
            return data.choices[0].message.content;
        }).catch(error => {
            console.error("ChatGPT Error:", error);
        })
    }

    console.log(await chatGPT([{role: "user", content: "Say hello, please!"}]))
})();
