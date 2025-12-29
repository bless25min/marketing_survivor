export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });
        }

        // Login Endpoint
        if (url.pathname === "/auth/login") {
            const redirectUri = `${url.origin}/auth/callback`;
            const state = crypto.randomUUID(); // Simple state for security

            // Construct LINE Auth URL
            const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${env.LINE_CHANNEL_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&bot_prompt=aggressive&scope=profile%20openid`;

            return Response.redirect(lineAuthUrl, 302);
        }

        // Callback Endpoint
        if (url.pathname === "/auth/callback") {
            const code = url.searchParams.get("code");
            if (!code) return new Response("Missing code", { status: 400 });

            const redirectUri = `${url.origin}/auth/callback`;

            // Exchange Code for Token
            const tokenParams = new URLSearchParams();
            tokenParams.append("grant_type", "authorization_code");
            tokenParams.append("code", code);
            tokenParams.append("redirect_uri", redirectUri);
            tokenParams.append("client_id", env.LINE_CHANNEL_ID);
            tokenParams.append("client_secret", env.LINE_CHANNEL_SECRET);

            const tokenResp = await fetch("https://api.line.me/oauth2/v2.1/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            const tokenData = await tokenResp.json();
            if (!tokenData.id_token) {
                return new Response("Failed to get token: " + JSON.stringify(tokenData), { status: 400 });
            }

            // Verify ID Token to get User Profile (Simpler than profile API for just picture)
            // Ideally we verify signature, but for this quick implementation we trust direct response
            // Decode JWT (Display Name, Picture)
            // For robustness, let's call the /v2/profile endpoint using access_token
            const profileResp = await fetch("https://api.line.me/v2/profile", {
                headers: { "Authorization": `Bearer ${tokenData.access_token}` }
            });
            const profile = await profileResp.json();

            const pictureUrl = profile.pictureUrl || "";

            // Redirect back to game with pictureUrl
            return Response.redirect(`${url.origin}/?pictureUrl=${encodeURIComponent(pictureUrl)}`, 302);
        }

        // Serve Static Assets (Default Behavior for Pages/Workers Sites)
        // If using 'assets' binding or standard fetch
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response("Not Found", { status: 404 });
    }
};
