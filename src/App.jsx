import { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [city, setCity] = useState('');
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [citiesList, setCitiesList] = useState([]);

  // Get API key from environment variables
  const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || 'abc123def456';

  const fetchWeatherData = useCallback(async (lat, lon) => {
    setLoading(true);
    setError('');
    setCurrentWeather(null);
    setForecast([]);
    try {
      // Fetch current weather
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
      const currentResponse = await fetch(currentUrl);
      
      if (!currentResponse.ok) {
        if (API_KEY === 'abc123def456') {
          throw new Error('Please add your OpenWeatherMap API key to use this app. Get a free key at https://openweathermap.org/api');
        }
        throw new Error('City not found or API error');
      }
      
      const currentData = await currentResponse.json();
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
        setForecast(forecastList);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_KEY]);

  const fetchWeatherByCity = async (cityName = city) => {
    if (!cityName.trim()) return;
    setLoading(true);
    setError('');
    setCurrentWeather(null);
    setForecast([]);
    try {
      // First, get coordinates from city name
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
      const geoResponse = await fetch(geoUrl);
      
      if (!geoResponse.ok || API_KEY === 'abc123def456') {
        throw new Error('Please add your OpenWeatherMap API key to use this app. Get a free key at https://openweathermap.org/api');
      }
      
      const geoData = await geoResponse.json();
      if (geoData.length === 0) {
        throw new Error('City not found');
      }
      
      const { lat, lon } = geoData[0];
      await fetchWeatherData(lat, lon, cityName);
      
      // Add city to list if not already present
      setCitiesList((prevList) => {
        if (!prevList.includes(cityName)) {
          return [cityName, ...prevList];
        }
        return prevList;
      });
    } catch (err) {
      setError(err.message);
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

  return (
    <div className="app-container">
      <h1 className="title">⛅ Weather App</h1>
      <div className="weather-container">
        <div className="search-section">
          <div className="input-group">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter city name..."
              className="input"
            />
            <button onClick={fetchWeatherByCity} className="button" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
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

        {error && <p className="error">❌ {error}</p>}

        {currentWeather && !loading && (
          <div className="current-weather">
            <div className="weather-header">
              <div>
                <h2 className="city-name">{currentWeather.name}, {currentWeather.sys.country}</h2>
                <p className="update-time">Last updated: {new Date(currentWeather.dt * 1000).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="weather-main">
              <img
                src={`https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}@4x.png`}
                alt={currentWeather.weather[0].description}
                className="weather-icon"
              />
              <div className="temp-section">
                <p className="temp">{Math.round(currentWeather.main.temp)}°C</p>
                <p className="condition">{currentWeather.weather[0].description}</p>
              </div>
            </div>

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
                <span className="detail-value">{currentWeather.wind.speed} m/s</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">🔍 Pressure</span>
                <span className="detail-value">{currentWeather.main.pressure} hPa</span>
              </div>
            </div>
          </div>
        )}

        {forecast.length > 0 && !loading && (
          <div className="forecast">
            <h3>📅 5-Day Forecast</h3>
            <div className="forecast-grid">
              {forecast.map((day, index) => (
                <div key={index} className="forecast-item">
                  <p className="forecast-date">
                    {new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <img
                    src={`https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png`}
                    alt={day.weather[0].description}
                    className="forecast-icon"
                  />
                  <p className="forecast-temp">{Math.round(day.main.temp)}°C</p>
                  <p className="forecast-condition">{day.weather[0].description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
