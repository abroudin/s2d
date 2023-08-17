import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LikedItems from './components/LikedItems';

function App() {
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [likedItems, setLikedItems] = useState([]);
  const [discogsResults, setDiscogsResults] = useState([]);
  const [discogsAuthenticated, setDiscogsAuthenticated] = useState(false);
  const [searchQueries, setSearchQueries] = useState([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (urlToken) {
        localStorage.setItem('spotifyAccessToken', urlToken);
        setSpotifyToken(urlToken);
        // Remove the token from the URL for security reasons
        window.history.replaceState({}, document.title, "/");
    } else {
        const storedToken = localStorage.getItem('spotifyAccessToken');
        if (storedToken) {
            setSpotifyToken(storedToken);
        }
    }
}, []);


useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const discogsAuthSuccess = urlParams.get('discogsAuthSuccess');

  if (discogsAuthSuccess === 'true') {
      setDiscogsAuthenticated(true);
      localStorage.setItem('discogsAuthenticated', 'true');
      // Clean the URL
      window.history.replaceState({}, document.title, "/");
  } else {
      const isDiscogsAuthenticated = localStorage.getItem('discogsAuthenticated');
      if (isDiscogsAuthenticated === 'true') {
          setDiscogsAuthenticated(true);
      }
  }
}, []);


  useEffect(() => {
    if (spotifyToken) {
      axios.get('https://api.spotify.com/v1/me/albums', {
        headers: {
          'Authorization': 'Bearer ' + spotifyToken
        }
      })
      .then(response => {
        setLikedItems(response.data.items);
      })
      .catch(error => {
        console.error("Error fetching liked items:", error);
      });
    }
  }, [spotifyToken]);

  const handleSpotifyLogin = () => {
    window.location.href = 'http://localhost:3000/login';
  };

  const handleDiscogsLogin = () => {
    window.location.href = 'http://localhost:3000/connect/discogs';
  };

  const fetchDiscogsData = (albumName, artistName) => {
    const discogsQuery = `${artistName} ${albumName} vinyl`;

    // Add the current query to the searchQueries state
    setSearchQueries(prev => [...prev, discogsQuery]);

    const endpointURL = `http://localhost:3000/search-discogs/${encodeURIComponent(discogsQuery)}`;

    axios.get(endpointURL, {
        withCredentials: true
    })
    .then(response => {
        const results = response.data.results;
        setDiscogsResults(prev => [...prev, results]);
    })
    .catch(error => {
        console.error("Error fetching data from Discogs Marketplace:", error);
    });
};


  useEffect(() => {
    if (likedItems.length > 0 && discogsAuthenticated) {
      likedItems.forEach(item => {
        const albumName = item.album.name;
        const artistName = item.album.artists[0].name; // Assuming the first artist is the primary artist
        fetchDiscogsData(albumName, artistName);
      });
    }
  }, [likedItems, discogsAuthenticated]);

  return (
    <div className="App">
      <h1>Spotify Liked Items</h1>
      <div>
        {!spotifyToken && <button onClick={handleSpotifyLogin}>Login with Spotify</button>}
        {spotifyToken && !discogsAuthenticated && <button onClick={handleDiscogsLogin}>Login with Discogs</button>}
      </div>
      {spotifyToken && discogsAuthenticated && <LikedItems items={likedItems} />}
      {spotifyToken && discogsAuthenticated && (
        <div>
          <h2>Discogs Marketplace Results:</h2>
          {discogsResults.map(item => (
            <div key={item.id}>
                <h3>{item.title}</h3>
                <img src={item.thumb} alt={item.title} />
                {item.marketplaceId && (
                    <a href={`https://www.discogs.com/sell/item/${item.marketplaceId}`} target="_blank" rel="noopener noreferrer">Buy on Discogs</a>
                )}
            </div>
          ))}
        </div>
      )}
      <div>
        <h2>Search Queries Made to Discogs:</h2>
        <ul>
          {searchQueries.map((query, index) => (
            <li key={index}>{query}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
