
import { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [city, setCity] = useState('');
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [citiesList, setCitiesList] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null); // Track current location (lat, lon)

  // Get API key from environment variables
  const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';

  // Define fetchWeatherData FIRST so it can be used in useEffect
  const fetchWeatherData = useCallback(async (lat, lon, locationName, countryCode) => {
    setLoading(true);
    setError('');
    setCurrentWeather(null);
    setForecast([]);
    try {
      console.log('🔍 Fetching weather for:', locationName, countryCode, 'at', lat, lon);
      
      // Fetch current weather
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const currentResponse = await fetch(currentUrl);
      
      if (!currentResponse.ok) {
        throw new Error(`API Error: ${currentResponse.status} ${currentResponse.statusText}`);
      }
      
      const currentData = await currentResponse.json();
      console.log('✅ Weather data received:', currentData);
      
      if (locationName) currentData.name = locationName;
      if (countryCode) {
        if (!currentData.sys) currentData.sys = {};
        currentData.sys.country = countryCode;
      }
      setCurrentWeather(currentData);

      // Fetch 5-day forecast
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const forecastResponse = await fetch(forecastUrl);
      
      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        // Group forecast by day (take one entry per day at noon)
        const dailyForecasts = {};
        forecastData.list.forEach((item) => {
          const date = new Date(item.dt * 1000).toLocaleDateString();
          if (!dailyForecasts[date]) {
            dailyForecasts[date] = item;
          }
        });
        const forecastList = Object.values(dailyForecasts).slice(1, 6);
        console.log('✅ Forecast data received:', forecastList);
        setForecast(forecastList);
      }
    } catch (err) {
      console.error('❌ Error fetching weather:', err);
      setError(err.message || 'Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  }, [API_KEY]);

  // Auto-fetch location on app load AFTER fetchWeatherData is defined
  useEffect(() => {
    if (!API_KEY) {
      console.warn('⚠️ API key not configured');
      setError('API key not configured. Please check your .env file');
      return;
    }

    console.log('🚀 App loaded, requesting geolocation...');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('📍 Location found:', latitude, longitude);
          
          setCurrentLocation({ latitude, longitude });
          try {
            const revGeoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`;
            const revGeoRes = await fetch(revGeoUrl);
            if (revGeoRes.ok) {
              const revGeoData = await revGeoRes.json();
              if (Array.isArray(revGeoData) && revGeoData.length > 0) {
                const cityName = revGeoData[0].name;
                const countryCode = revGeoData[0].country;
                console.log('🏙️ City detected:', cityName, countryCode);
                
                setCity(cityName);
                await fetchWeatherData(latitude, longitude, cityName, countryCode);
              } else {
                console.warn('⚠️ No city found for coordinates');
              }
            } else {
              console.warn('⚠️ Reverse geolocation failed');
            }
          } catch (err) {
            console.error('❌ Auto-location error:', err);
          }
        },
        (err) => {
          console.warn('📍 Geolocation permission denied:', err.message);
          setError('Location access denied. You can still search for a city.');
        }
      );
    } else {
      console.warn('⚠️ Geolocation not supported by browser');
      setError('Geolocation not supported by your browser');
    }
  }, [API_KEY, fetchWeatherData]);

  const fetchWeatherByCity = async (cityNameParam) => {
    const cityName = (typeof cityNameParam === 'string' ? cityNameParam : city).trim();
    if (!cityName) {
      setError('Please enter a city name.');
      return;
    }
    console.log('🔎 Searching for city:', cityName);
    
    setLoading(true);
    setError('');
    setCurrentWeather(null);
    setForecast([]);
    try {
      // Get coordinates from city name
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
      const geoResponse = await fetch(geoUrl);
      if (!geoResponse.ok) {
        throw new Error('City search failed. Please try another city.');
      }
      const geoData = await geoResponse.json();
      if (!Array.isArray(geoData) || geoData.length === 0) {
        throw new Error(`City not found: "${cityName}"`);
      }
      const { lat, lon, name: resolvedName, country } = geoData[0];
      console.log('📍 City found at:', lat, lon, ':', resolvedName);
      
      await fetchWeatherData(lat, lon, resolvedName || cityName, country);
      // Add city to list if not already present (case-insensitive)
      setCitiesList((prevList) => {
        const normalized = cityName.toLowerCase();
        if (!prevList.some((c) => c.toLowerCase() === normalized)) {
          return [resolvedName || cityName, ...prevList];
        }
        return prevList;
      });
      setCity(resolvedName || cityName);
    } catch (err) {
      console.error('❌ City search error:', err);
      setError(err.message || 'Failed to fetch weather.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      fetchWeatherByCity();
    }
  };

  const handleCityClick = (selectedCity) => {
    setCity(selectedCity);
    fetchWeatherByCity(selectedCity);
  };

  const removeCityFromList = (cityToRemove) => {
    setCitiesList((prevList) => prevList.filter((c) => c !== cityToRemove));
  };

  // Geolocation handler
  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    console.log('📍 User clicked location button');
    
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('📍 Location obtained:', latitude, longitude);
        
        setCurrentLocation({ latitude, longitude }); // Store location
        try {
          // Reverse geocode to get nearest city name
          const revGeoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`;
          const revGeoRes = await fetch(revGeoUrl);
          let cityName = '';
          let countryCode = '';
          if (revGeoRes.ok) {
            const revGeoData = await revGeoRes.json();
            if (Array.isArray(revGeoData) && revGeoData.length > 0) {
              cityName = revGeoData[0].name;
              countryCode = revGeoData[0].country;
              console.log('🏙️ City resolved:', cityName, countryCode);
            }
          }
          // Await the weather data fetch
          await fetchWeatherData(latitude, longitude, cityName, countryCode);
          if (cityName) {
            setCity(cityName);
            setCitiesList((prevList) => {
              const normalized = cityName.toLowerCase();
              if (!prevList.some((c) => c.toLowerCase() === normalized)) {
                return [cityName, ...prevList];
              }
              return prevList;
            });
          }
        } catch (err) {
          console.error('❌ Location handler error:', err);
          setError(err.message || 'Unable to fetch weather data.');
          setLoading(false);
        }
      },
      (err) => {
        console.warn('⚠️ Location denied:', err.message);
        setError('Location access denied. Please enable it in browser settings.');
        setLoading(false);
      }
    );
  }

  // Filtered city suggestions
  const filteredSuggestions = city
    ? citiesList.filter((c) => c.toLowerCase().includes(city.toLowerCase()))
    : [];

  return (
    <div className="app-container">
      <h1 className="title">⛅ Weather App</h1>
      {currentLocation && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '10px' }}>
          📍 Current Location: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
          {city && <span> • {city}</span>}
        </div>
      )}
      <div className="weather-container">
        <div className="search-section">
          <div className="input-group">
            <div className="search-input-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder="Search for a city..."
                className="input"
                disabled={loading}
                autoComplete="off"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="suggestions-dropdown">
                  {filteredSuggestions.map((suggestion) => (
                    <li
                      key={suggestion}
                      className="suggestion-item"
                      onMouseDown={() => {
                        setCity(suggestion);
                        setShowSuggestions(false);
                        fetchWeatherByCity(suggestion);
                      }}
                    >
                      <span className="suggestion-icon">📍</span>
                      <span className="suggestion-text">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={fetchWeatherByCity} className="button" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={handleUseMyLocation}
              className="location-button"
              disabled={loading}
              title="Use my location"
            >
              📍 Use My Location
            </button>
          </div>
          {citiesList.length > 0 && (
            <div className="cities-list">
              <h3>Recent Cities:</h3>
              <ul className="city-items">
                {citiesList.map((cityItem) => (
                  <li key={cityItem} className="city-item">
                    <button
                      className="city-button"
                      onClick={() => handleCityClick(cityItem)}
                    >
                      {cityItem}
                    </button>
                    <button
                      className="remove-button"
                      onClick={() => removeCityFromList(cityItem)}
                      title="Remove city"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Fetching weather data...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p className="error">❌ {error}</p>
            <p style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>
              Try searching for a city or enable location access in browser settings.
            </p>
          </div>
        )}

        {currentWeather && !loading && (
          <div className="current-weather">
            <div className="weather-header">
              <div>
                <h2 className="city-name">
                  {city || currentWeather.name}, {currentWeather.sys?.country || 'N/A'}
                </h2>
                <p className="update-time">
                  Last updated: {new Date(currentWeather.dt * 1000).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="weather-main">
              {currentWeather.weather && currentWeather.weather[0] && (
                <>
                  <img
                    src={`https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}@4x.png`}
                    alt={currentWeather.weather[0].description}
                    className="weather-icon"
                  />
                  <div className="temp-section">
                    <p className="temp">{Math.round(currentWeather.main.temp)}°C</p>
                    <p className="condition">{currentWeather.weather[0].description}</p>
                  </div>
                </>
              )}
            </div>

            {currentWeather.main && (
              <div className="weather-details">
                <div className="detail-item">
                  <span className="detail-label">🌡️ Feels Like</span>
                  <span className="detail-value">{Math.round(currentWeather.main.feels_like)}°C</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">💧 Humidity</span>
                  <span className="detail-value">{currentWeather.main.humidity}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">💨 Wind Speed</span>
                  <span className="detail-value">{currentWeather.wind?.speed || 'N/A'} m/s</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">🔍 Pressure</span>
                  <span className="detail-value">{currentWeather.main.pressure} hPa</span>
                </div>
              </div>
            )}
          </div>
        )}

        {forecast.length > 0 && !loading && (
          <div className="forecast">
            <h3>📅 5-Day Forecast</h3>
            <div className="forecast-grid">
              {forecast.map((day, index) => (
                <div key={index} className="forecast-item">
                  <p className="forecast-date">
                    {new Date(day.dt * 1000).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {day.weather && day.weather[0] && (
                    <>
                      <img
                        src={`https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png`}
                        alt={day.weather[0].description}
                        className="forecast-icon"
                      />
                      <p className="forecast-temp">{Math.round(day.main.temp)}°C</p>
                      <p className="forecast-condition">{day.weather[0].description}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !currentWeather && !error && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p>👇 Search for a city or use location to see weather</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
