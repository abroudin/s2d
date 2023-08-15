import React from 'react';

function LikedAlbums({ items }) {
  return (
    <div>
      {items.map(item => (
        <div key={item.album.id}>
          <img src={item.album.images[0].url} alt={item.album.name} width="200" />
          <h2>{item.album.name}</h2>
          <p>{item.album.artists[0].name}</p>
        </div>
      ))}
    </div>
  );
}

export default LikedAlbums;
