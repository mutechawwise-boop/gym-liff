export async function pushLineMessage(lineUserId, message) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN is missing");
    }

    const response = await fetch(
        "https://api.line.me/v2/bot/message/push",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
                to: lineUserId,
                messages: [
                    {
                        type: "text",
                        text: message
                    }
                ]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    return true;
}