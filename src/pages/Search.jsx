import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import MovieCard from '../components/MovieCard';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/icon/icon.js';
import '@material/web/button/filled-tonal-button.js';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const timerRef = useRef(null);

  const addToHistory = (searchQuery) => {
      const history = JSON.parse(localStorage.getItem('uafilms_search_history') || '[]');
      const newHistory = [searchQuery, ...history.filter(h => h !== searchQuery)].slice(0, 10);
      localStorage.setItem('uafilms_search_history', JSON.stringify(newHistory));
  };

  const performSearch = useCallback(async (searchQuery, pageNum = 1) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    
    if (pageNum === 1) {
        addToHistory(searchQuery);
    }

    try {
        const res = await api.get(`/search?q=${searchQuery}&page=${pageNum}`);
        if (pageNum === 1) {
            setResults(res.data.results || []);
        } else {
            setResults(prev => [...prev, ...res.data.results]);
        }
        
        setTotalPages(Number(res.data.total_pages) || 0);
        setPage(Number(pageNum));
    } catch (err) { 
        console.error("Search error:", err); 
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (qParam && qParam !== query) {
        setQuery(qParam);
        performSearch(qParam, 1);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query) {
      timerRef.current = setTimeout(() => {
        performSearch(query, 1);
      }, 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, performSearch]);

  const handleManualSearch = (e) => {
    e && e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    performSearch(query, 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      handleManualSearch(); 
    }
  };

  const loadMore = (e) => {
    e && e.stopPropagation();
    if (page < totalPages && !loading) {
        performSearch(query, page + 1);
    }
  };

  return (
    <div className="container" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <md-outlined-text-field
          label="Пошук фільмів..."
          type="search"
          value={query}
          onInput={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autocomplete="on"
          name="q"
          style={{ 
            width: '100%', 
            '--md-outlined-text-field-container-shape': '28px' 
          }}
        >
          <md-icon slot="leading-icon">search</md-icon>
        </md-outlined-text-field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
        {results.map((movie, index) => (
            <MovieCard key={`${movie.id}-${index}`} movie={movie} />
        ))}
      </div>

      {results.length > 0 && page < totalPages && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', paddingBottom: '32px' }}>
            <md-filled-tonal-button 
                onClick={loadMore} 
                disabled={loading ? true : undefined} 
                style={{ cursor: loading ? 'default' : 'pointer' }}
            >
                {loading ? 'Завантаження...' : 'Завантажити ще'}
            </md-filled-tonal-button>
        </div>
      )}
    </div>
  );
};

export default Search;