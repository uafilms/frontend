import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Comments from '../components/Comments';
import Downloader from '../components/Downloader';

import '@material/web/iconbutton/filled-tonal-icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/progress/circular-progress.js';

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
    if (!prev) return incoming;
    const next = { ...prev };
    
    // Merge provider data from SSE chunks
    if (incoming.provider) {
        if (!next.providers) next.providers = {};
        const prov = incoming.provider;
        
        if (incoming.sources) {
            // Movie: merge source arrays
            next.providers[prov] = [
                ...(next.providers[prov] || []),
                ...incoming.sources
            ];
        } else if (incoming.seasons) {
            // TV: merge season→episode maps
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
    
    // Merge full providers object (from non-SSE or initial)
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
    if (sourcesList.length > 0 && !selectedSource) {
        setSelectedSource(sourcesList[0]);
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
                setData(res.data);
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

            // Отримуємо налаштування мови
            const settings = JSON.parse(localStorage.getItem('uafilms_settings') || '{}');
            let engParam = 0;
            if (settings.engSource) {
                engParam = settings.engMode === 'only_eng' ? 2 : 1;
            }

            let url = `${api.defaults.baseURL}/get?id=${id}&type=${type}&sse=1&eng=${engParam}`;
            if (token) url += `&token=${encodeURIComponent(token)}`;

            const response = await fetch(url);
            
            if (!response.ok) {
                 console.warn("Sources fetch status:", response.status);
                 setLoadingSources(false);
                 return;
            }
            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (active) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); 

                for (const line of lines) {
                    if (line.startsWith('event: complete')) {
                        if (active) setLoadingSources(false);
                        return;
                    }
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.replace('data: ', '');
                            if (jsonStr === '"done"') continue;
                            const chunk = JSON.parse(jsonStr);
                            if (active) {
                                setData(prev => {
                                    const newData = mergeData(prev, chunk);
                                    processSources(newData);
                                    return newData;
                                });
                            }
                        } catch (e) { console.error('SSE Error', e); }
                    }
                }
            }
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
      <div style={{ minHeight: '100vh', background: 'var(--md-sys-color-background)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <md-circular-progress indeterminate></md-circular-progress>
      </div>
  );

  if (error && !data) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--md-sys-color-background)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--md-sys-color-error)' }}>
            <md-icon style={{ fontSize: '48px', marginBottom: '16px' }}>error</md-icon>
            <p>{error}</p>
            <md-filled-tonal-icon-button onClick={() => navigate(-1)} style={{ marginTop: '16px' }}>
                <md-icon>arrow_back</md-icon>
            </md-filled-tonal-icon-button>
        </div>
      );
  }

  const backdropUrl = data?.backdropUrl || '';

    const settings = JSON.parse(localStorage.getItem('uafilms_settings') || '{}');
        let engParam = 0;
        if (settings.engSource) {
            engParam = settings.engMode === 'only_eng' ? 2 : 1;
        }

  let embedUrl = `${api.defaults.baseURL.replace('/api', '')}/embed?id=${id}&type=${type}`;
  if (window.cfToken) embedUrl += `&token=${encodeURIComponent(window.cfToken)}`;
  if (selectedSource) embedUrl += `&source=${selectedSource}`;
  if (engParam > 0) embedUrl += `&eng=${engParam}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--md-sys-color-background)', color: 'var(--md-sys-color-on-background)' }}>
      
      <div style={{ position: 'relative', height: '350px', width: '100%' }}>
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
            <md-filled-tonal-icon-button onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                <md-icon>arrow_back</md-icon>
            </md-filled-tonal-icon-button>
        </div>

        <div style={{ position: 'absolute', bottom: -28, right: 32, zIndex: 10 }}>
             <md-filled-tonal-icon-button 
                toggle 
                selected={isFav ? true : undefined} 
                onClick={toggleFavorite}
                style={{ width: '56px', height: '56px', '--md-filled-tonal-icon-button-icon-size': '28px', cursor: 'pointer' }}
             >
                <md-icon>favorite_border</md-icon>
                <md-icon slot="selected">favorite</md-icon>
            </md-filled-tonal-icon-button>
        </div>

        <img 
            src={backdropUrl} 
            alt="Cover" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
        />
        <div style={{ 
            position: 'absolute', bottom: 0, width: '100%', 
            background: 'linear-gradient(to top, var(--md-sys-color-background), transparent)',
            height: '200px'
        }} />
      </div>

      <div style={{ padding: '0 24px 40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', margin: '16px 0 8px 0', fontFamily: 'Roboto' }}>{data.title}</h1>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', color: 'var(--md-sys-color-outline)', marginBottom: '24px' }}>
            <md-assist-chip label={data.year?.toString() || '-'}></md-assist-chip>
            <md-assist-chip label={type === 'movie' ? 'Фільм' : 'Серіал'}></md-assist-chip>
            
            {data.imdbRating && (
                <md-assist-chip label={data.imdbRating.toString()}>
                    <md-icon slot="icon" style={{ fontVariationSettings: "'FILL' 1" }}>star</md-icon>
                </md-assist-chip>
            )}
            
            {data.genres && data.genres.length > 0 && (
                <md-assist-chip label={data.genres.join(', ')}></md-assist-chip>
            )}
        </div>

        <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--md-sys-color-primary)', marginBottom: '8px' }}>Про фільм</h3>
            <p style={{ lineHeight: '1.6', fontSize: '16px', color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '800px' }}>
                {data.overview || "Опис відсутній."}
            </p>
        </div>

        <h3 style={{ fontSize: '18px', color: 'var(--md-sys-color-on-surface)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Джерела
            {loadingSources && <md-circular-progress indeterminate style={{ '--md-circular-progress-size': '20px' }}></md-circular-progress>}
        </h3>
        
        {availableSources.length > 0 ? (
            <md-chip-set style={{ marginBottom: '16px' }}>
                {availableSources.map(s => (
                    <md-filter-chip 
                        key={s} 
                        label={formatProviderName(s)}
                        selected={selectedSource === s ? true : undefined} 
                        onClick={() => setSelectedSource(s)}
                        style={{ cursor: 'pointer' }}
                    />
                ))}
            </md-chip-set>
        ) : (
            !loadingSources && (
                <div style={{ marginBottom: '16px', color: 'var(--md-sys-color-error)' }}>
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
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color: 'var(--md-sys-color-on-surface-variant)'}}>
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