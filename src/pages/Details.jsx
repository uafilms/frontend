import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Comments from '../components/Comments';
import Downloader from '../components/Downloader';

import 'mdui/components/button-icon.js';
import 'mdui/components/icon.js';
import 'mdui/components/chip.js';
import 'mdui/components/circular-progress.js';

const formatProviderName = (provider) => {
    const map = {
        'ashdi': 'Ashdi',
        'tortuga': 'Tortuga',
        'hdvb': 'HDVB',
        'uaflix': 'UAFlix',
        'moonanime': 'MoonAnime',
        'uembed': '🇬🇧 UEmbed',
    };
    return map[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
};

const mergeData = (prev, incoming) => {
    if (!prev) {
        if (incoming.provider) {
            const wrapper = { providers: {} };
            if (incoming.sources) {
                wrapper.providers[incoming.provider] = incoming.sources;
            } else if (incoming.seasons) {
                wrapper.providers[incoming.provider] = incoming.seasons;
            }
            return wrapper;
        }
        return incoming;
    }
    const next = { ...prev };
    
    // Merge provider data from SSE chunks
    if (incoming.provider) {
        if (!next.providers) next.providers = {};
        const prov = incoming.provider;
        
        if (incoming.sources) {
            next.providers[prov] = [
                ...(next.providers[prov] || []),
                ...incoming.sources
            ];
        } else if (incoming.seasons) {
            if (!next.providers[prov]) next.providers[prov] = {};
            const existing = next.providers[prov];
            for (const [sNum, episodes] of Object.entries(incoming.seasons)) {
                if (!existing[sNum]) existing[sNum] = {};
                for (const [eNum, sources] of Object.entries(episodes)) {
                    existing[sNum][eNum] = [
                        ...(existing[sNum][eNum] || []),
                        ...sources
                    ];
                }
            }
        }
    }
    
    // Merge full providers object
    if (incoming.providers) {
        if (!next.providers) next.providers = {};
        for (const [prov, data] of Object.entries(incoming.providers)) {
            if (Array.isArray(data)) {
                next.providers[prov] = [...(next.providers[prov] || []), ...data];
            } else if (data && typeof data === 'object') {
                if (!next.providers[prov]) next.providers[prov] = {};
                for (const [sNum, episodes] of Object.entries(data)) {
                    if (!next.providers[prov][sNum]) next.providers[prov][sNum] = {};
                    for (const [eNum, sources] of Object.entries(episodes)) {
                        next.providers[prov][sNum][eNum] = [
                            ...(next.providers[prov][sNum][eNum] || []),
                            ...sources
                        ];
                    }
                }
            }
        }
    }
    
    return next;
};

const waitForTurnstileToken = async (maxRetries = 40) => {
    if (window.cfToken) return window.cfToken;
    for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (window.cfToken) return window.cfToken;
    }
    return null; 
};

const Details = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  
  const [selectedSource, setSelectedSource] = useState(null);
  const [availableSources, setAvailableSources] = useState([]);
  const [isFav, setIsFav] = useState(false);
  const [error, setError] = useState(null);

  const processSources = (currentData) => {
    if (!currentData || !currentData.providers) return;
    const sourcesList = Object.keys(currentData.providers);
    const priority = ['ashdi', 'tortuga', 'hdvb', 'uaflix', 'moonanime', 'uembed'];
    sourcesList.sort((a, b) => {
        const idxA = priority.indexOf(a);
        const idxB = priority.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
    setAvailableSources(sourcesList);
    if (sourcesList.length > 0) {
        setSelectedSource(prev => prev || sourcesList[0]);
    }
  };

  useEffect(() => {
    let active = true;
    setLoadingMeta(true);
    
    setData(null);
    setAvailableSources([]);
    setSelectedSource(null);
    setError(null);
    setLoadingSources(true);

    api.get(`/details?id=${id}&type=${type}`)
        .then(res => {
            if (active) {
                setData(prev => prev ? { ...prev, ...res.data, providers: prev.providers || res.data.providers } : res.data);
                setLoadingMeta(false);
                const favorites = JSON.parse(localStorage.getItem('uafilms_favorites') || '[]');
                setIsFav(favorites.some(f => f.id == res.data.id));
            }
        })
        .catch(err => {
            console.error("Meta fetch error:", err);
            if (active) {
                setError("Не вдалося завантажити інформацію про фільм");
                setLoadingMeta(false);
            }
        });

    return () => { active = false; };
  }, [id, type]);

  useEffect(() => {
    let active = true;
    
    const fetchSources = async () => {
        try {
            const token = await waitForTurnstileToken();
            if (!active) return;

            const settings = JSON.parse(localStorage.getItem('uafilms_settings') || '{}');
            let engParam = 0;
            if (settings.engSource) engParam = settings.engMode === 'only_eng' ? 2 : 1;

            let url = `${api.defaults.baseURL}/get?id=${id}&type=${type}&sse=1&eng=${engParam}`;

            const headers = {};
            if (token) headers['cf-turnstile-response'] = token;
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                 console.warn("Sources fetch status:", response.status);
                 setLoadingSources(false);
                 return;
            }
            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            const processBuffer = (buf) => {
                const lines = buf.split('\n\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    if (trimmed.startsWith('event: complete')) {
                        if (active) setLoadingSources(false);
                        return true; // signal: stream complete
                    }
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmed.replace('data: ', '');
                            if (jsonStr === '"done"') continue;
                            const chunk = JSON.parse(jsonStr);
                            if (active) {
                                setData(prev => {
                                    const newData = mergeData(prev, chunk);
                                    processSources(newData);
                                    return newData;
                                });
                            }
                        } catch (e) { /* ignore parse errors */ }
                    }
                }
                return false;
            };

            while (active) {
                const { value, done } = await reader.read();
                if (done) {
                    // Process remaining buffer before exiting
                    if (buffer.trim()) processBuffer(buffer);
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const blocks = buffer.split('\n\n');
                buffer = blocks.pop(); // keep incomplete tail

                if (processBuffer(blocks.join('\n\n'))) return;
            }

            // Safety: always stop loading when stream ends
            if (active) setLoadingSources(false);
        } catch (err) {
            console.error('Sources error:', err);
            if (active) setLoadingSources(false);
        }
    };

    fetchSources();

    return () => { active = false; };
  }, [id, type]);

  const toggleFavorite = () => {
    if (!data) return;
    const favorites = JSON.parse(localStorage.getItem('uafilms_favorites') || '[]');
    let newFavs;
    if (isFav) {
      newFavs = favorites.filter(f => f.id != id);
    } else {
      const minData = {
        id: data.id,
        title: data.title || data.originalTitle,
        poster_path: data.posterUrl,
        release_date: data.year + '-',
        media_type: type
      };
      newFavs = [...favorites, minData];
    }
    localStorage.setItem('uafilms_favorites', JSON.stringify(newFavs));
    setIsFav(!isFav);
  };

  if (loadingMeta) return (
      <div style={{ minHeight: '100vh', background: 'rgb(var(--mdui-color-surface))', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <mdui-circular-progress indeterminate></mdui-circular-progress>
      </div>
  );

  if (error && !data) {
      return (
        <div style={{ minHeight: '100vh', background: 'rgb(var(--mdui-color-surface))', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'rgb(var(--mdui-color-error))' }}>
            <mdui-icon style={{ fontSize: '48px', marginBottom: '16px' }} name="error"></mdui-icon>
            <p>{error}</p>
            <mdui-button-icon variant="tonal" onClick={() => navigate(-1)} style={{ marginTop: '16px' }}>
                <mdui-icon name="arrow_back"></mdui-icon>
            </mdui-button-icon>
        </div>
      );
  }

  const backdropUrl = data?.backdropUrl || '';
  const settings = JSON.parse(localStorage.getItem('uafilms_settings') || '{}');
  let engParam = 0;
  if (settings.engSource) engParam = settings.engMode === 'only_eng' ? 2 : 1;

  let embedUrl = `${api.defaults.baseURL.replace('/api', '')}/embed?id=${id}&type=${type}`;
  if (window.cfToken && window.cfToken !== 'disabled') embedUrl += `&token=${encodeURIComponent(window.cfToken)}`;
  if (selectedSource) embedUrl += `&source=${selectedSource}`;
  if (engParam > 0) embedUrl += `&eng=${engParam}`;

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(var(--mdui-color-surface))', color: 'rgb(var(--mdui-color-on-surface))' }}>
      
      <div style={{ position: 'relative', height: '350px', width: '100%' }}>
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
            <mdui-button-icon variant="tonal" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                <mdui-icon name="arrow_back"></mdui-icon>
            </mdui-button-icon>
        </div>

        <div style={{ position: 'absolute', bottom: -28, right: 32, zIndex: 10 }}>
             <mdui-button-icon 
                variant="tonal"
                selected={isFav ? true : undefined} 
                onClick={toggleFavorite}
                style={{ width: '56px', height: '56px', cursor: 'pointer' }}
             >
                <mdui-icon name="favorite_border"></mdui-icon>
                <mdui-icon slot="selected" name="favorite"></mdui-icon>
            </mdui-button-icon>
        </div>

        <img 
            src={backdropUrl} 
            alt="Cover" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
        />
        <div style={{ 
            position: 'absolute', bottom: 0, width: '100%', 
            background: 'linear-gradient(to top, rgb(var(--mdui-color-surface)), transparent)',
            height: '200px'
        }} />
      </div>

      <div style={{ padding: '0 24px 40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', margin: '16px 0 8px 0', fontFamily: 'Roboto' }}>{data.title}</h1>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', color: 'rgb(var(--mdui-color-outline))', marginBottom: '24px' }}>
            <mdui-chip variant="assist">{data.year?.toString() || '-'}</mdui-chip>
            <mdui-chip variant="assist">{type === 'movie' ? 'Фільм' : 'Серіал'}</mdui-chip>
            
            {data.imdbRating && (
                <mdui-chip variant="assist">
                    <mdui-icon slot="icon" style={{ fontVariationSettings: "'FILL' 1" }} name="star"></mdui-icon>
                    {data.imdbRating.toString()}
                </mdui-chip>
            )}
            
            {data.genres && data.genres.length > 0 && (
                <mdui-chip variant="assist">{data.genres.join(', ')}</mdui-chip>
            )}
        </div>

        <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', color: 'rgb(var(--mdui-color-primary))', marginBottom: '8px' }}>Про фільм</h3>
            <p style={{ lineHeight: '1.6', fontSize: '16px', color: 'rgb(var(--mdui-color-on-surface-variant))', maxWidth: '800px' }}>
                {data.overview || "Опис відсутній."}
            </p>
        </div>

        <h3 style={{ fontSize: '18px', color: 'rgb(var(--mdui-color-on-surface))', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Джерела
            {loadingSources && <mdui-circular-progress indeterminate style={{ width: '18px', height: '18px' }}></mdui-circular-progress>}
        </h3>
        
        {availableSources.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {availableSources.map(s => (
                    <mdui-chip 
                        key={s} 
                        variant="filter"
                        selected={selectedSource === s ? true : undefined} 
                        onClick={() => setSelectedSource(s)}
                        style={{ cursor: 'pointer' }}
                    >{formatProviderName(s)}</mdui-chip>
                ))}
            </div>
        ) : (
            !loadingSources && (
                <div style={{ marginBottom: '16px', color: 'rgb(var(--mdui-color-error))' }}>
                    Джерела не знайдені (або помилка завантаження)
                </div>
            )
        )}
        
        <div style={{ 
            width: '100%', 
            maxWidth: '1000px', 
            aspectRatio: '16/9', 
            backgroundColor: '#000', 
            borderRadius: '16px', 
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            marginTop: '16px'
        }}>
            {availableSources.length > 0 ? (
                <iframe 
                    key={embedUrl} 
                    src={embedUrl} 
                    width="100%" height="100%" 
                    frameBorder="0" allowFullScreen title="Player"
                    allow="autoplay; encrypted-media; fullscreen"
                />
            ) : (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color: 'rgb(var(--mdui-color-on-surface-variant))'}}>
                    {loadingSources ? 'Пошук джерел...' : 'Відео джерела не доступні'}
                </div>
            )}
        </div>
        
        <Downloader 
            id={data.id}
            type={type}
            title={data.title} 
            originalTitle={data.originalTitle}
            year={data.year}
            providers={data.providers}
        />

        <div style={{ marginTop: '40px' }}>
             <Comments title={data.title} imdbId={data.imdbId} />
        </div>

      </div>
    </div>
  );
};

export default Details;
