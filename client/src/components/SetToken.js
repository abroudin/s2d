import React, { useEffect } from 'react';

function SetToken(props) {
    useEffect(() => {
        const params = new URLSearchParams(props.location.search);
        const accessToken = params.get('access_token');
        if (accessToken) {
            localStorage.setItem('spotifyAccessToken', accessToken);
            props.history.push('/'); // Redirect to the main page
        } else {
            console.error("No access token found in URL");
        }
    }, [props.history, props.location.search]);

    return <div>Setting token...</div>;
}

export default SetToken;
