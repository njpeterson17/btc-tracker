// Bitcoin Price Tracker - Fetches 7-day and 365-day price history from CoinGecko API

const API_BASE_URL = 'https://api.coingecko.com/api/v3';

// DOM Elements
const currentPriceEl = document.getElementById('currentPrice');
const priceChangeEl = document.getElementById('priceChange');
const calendarGridEl = document.getElementById('calendarGrid');
const yearCalendarEl = document.getElementById('yearCalendar');
const yearStatsEl = document.getElementById('yearStats');
const lastUpdatedEl = document.getElementById('lastUpdated');

// Format price with currency
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

// Format percentage change
function formatPercentage(change) {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
}

// Get day name from date
function getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Get date number
function getDateNumber(date) {
    return date.getDate();
}

// Check if date is today
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Fetch Bitcoin price data for the last 7 days
async function fetchBitcoinData() {
    try {
        // Get data for the last 7 days with daily granularity
        const days = 7;
        const response = await fetch(
            `${API_BASE_URL}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch Bitcoin data');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching Bitcoin data:', error);
        throw error;
    }
}

// Fetch Bitcoin price data for the last 365 days
async function fetchYearBitcoinData() {
    try {
        // Get data for the last 365 days with daily granularity
        const days = 365;
        const response = await fetch(
            `${API_BASE_URL}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch year Bitcoin data');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching year Bitcoin data:', error);
        throw error;
    }
}

// Fetch current Bitcoin price
async function fetchCurrentPrice() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch current price');
        }
        
        const data = await response.json();
        return data.bitcoin;
    } catch (error) {
        console.error('Error fetching current price:', error);
        throw error;
    }
}

// Create calendar day element
function createCalendarDay(date, price, previousPrice, isTodayFlag) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    // Determine if price went up or down compared to previous day
    let changePercent = 0;
    let direction = 'neutral';
    
    if (previousPrice !== null) {
        changePercent = ((price - previousPrice) / previousPrice) * 100;
        direction = changePercent >= 0 ? 'up' : 'down';
    }
    
    if (isTodayFlag) {
        dayEl.classList.add('today');
    } else {
        dayEl.classList.add(direction);
    }
    
    const arrowSvg = direction === 'up' 
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
        : direction === 'down'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    
    dayEl.innerHTML = `
        <div class="day-name">${getDayName(date)}</div>
        <div class="day-date">${getDateNumber(date)}</div>
        <div class="price">${formatPrice(price)}</div>
        <div class="indicator">
            ${arrowSvg}
            ${previousPrice !== null ? formatPercentage(changePercent) : '--'}
        </div>
    `;
    
    return dayEl;
}

// Show loading state
function showLoading() {
    calendarGridEl.innerHTML = `
        <div class="loading" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
        </div>
    `;
}

// Show error state
function showError(message) {
    calendarGridEl.innerHTML = `
        <div class="error" style="grid-column: 1 / -1;">
            <p>${message}</p>
            <button onclick="init()">Try Again</button>
        </div>
    `;
    if (yearCalendarEl) {
        yearCalendarEl.innerHTML = `
            <div class="error" style="grid-column: 1 / -1; padding: 20px;">
                <p>Failed to load year data</p>
            </div>
        `;
    }
}

// Format compact price for year calendar (e.g., "42K" for $42,000)
function formatCompactPrice(price) {
    if (price >= 100000) {
        return (price / 1000).toFixed(0) + 'K';
    } else if (price >= 1000) {
        return (price / 1000).toFixed(1) + 'K';
    }
    return price.toFixed(0);
}

// Create year calendar day element
function createYearDay(date, price, previousPrice) {
    const dayEl = document.createElement('div');
    dayEl.className = 'year-day';
    
    // Determine if price went up or down compared to previous day
    let changePercent = 0;
    let direction = 'neutral';
    
    if (previousPrice !== null) {
        changePercent = ((price - previousPrice) / previousPrice) * 100;
        direction = changePercent >= 0 ? 'up' : 'down';
    }
    
    dayEl.classList.add(direction);
    
    if (isToday(date)) {
        dayEl.classList.add('today');
    }
    
    // Create tooltip content
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    const changeStr = previousPrice !== null ? formatPercentage(changePercent) : 'N/A';
    dayEl.setAttribute('data-tooltip', `${dateStr}: ${formatPrice(price)} (${changeStr})`);
    
    // Add price in corner
    const priceEl = document.createElement('span');
    priceEl.className = 'price-corner';
    priceEl.textContent = formatCompactPrice(price);
    dayEl.appendChild(priceEl);
    
    return { element: dayEl, direction };
}

// Render the 365-day calendar
function renderYearCalendar(priceData) {
    if (!yearCalendarEl) return;
    
    yearCalendarEl.innerHTML = '';
    
    const prices = priceData.prices;
    const today = new Date();
    let upDays = 0;
    let downDays = 0;
    
    // Get the last 365 data points (or all available)
    const displayData = prices.slice(-365);
    
    displayData.forEach((dataPoint, index) => {
        const [timestamp, price] = dataPoint;
        const date = new Date(timestamp);
        
        // Get previous day price for comparison
        const previousPrice = index > 0 ? displayData[index - 1][1] : null;
        
        const { element: dayEl, direction } = createYearDay(date, price, previousPrice);
        yearCalendarEl.appendChild(dayEl);
        
        // Count up/down days
        if (direction === 'up') upDays++;
        if (direction === 'down') downDays++;
    });
    
    // Update year stats
    if (yearStatsEl) {
        yearStatsEl.innerHTML = `
            <span class="stat up-days">${upDays} up days</span>
            <span class="stat down-days">${downDays} down days</span>
        `;
    }
}

// Render the 7-day calendar
function renderCalendar(priceData) {
    calendarGridEl.innerHTML = '';
    
    const prices = priceData.prices;
    const today = new Date();
    
    // We get 8 data points (7 days + today), so we'll show the last 7
    const displayData = prices.slice(-7);
    
    displayData.forEach((dataPoint, index) => {
        const [timestamp, price] = dataPoint;
        const date = new Date(timestamp);
        
        // Get previous day price for comparison (if available)
        const previousPrice = index > 0 ? displayData[index - 1][1] : null;
        const todayFlag = isToday(date);
        
        const dayEl = createCalendarDay(date, price, previousPrice, todayFlag);
        calendarGridEl.appendChild(dayEl);
    });
}

// Update current price display
function updateCurrentPrice(currentData) {
    const price = currentData.usd;
    const change24h = currentData.usd_24h_change;
    
    currentPriceEl.textContent = formatPrice(price);
    
    if (change24h !== undefined) {
        priceChangeEl.textContent = formatPercentage(change24h);
        priceChangeEl.className = `change ${change24h >= 0 ? 'up' : 'down'}`;
    }
}

// Update last updated timestamp
function updateTimestamp() {
    const now = new Date();
    lastUpdatedEl.textContent = `Last updated: ${now.toLocaleString()}`;
}

// Main initialization
async function init() {
    showLoading();
    
    try {
        // Fetch current price, 7-day data, and 365-day data
        const [historicalData, yearData, currentData] = await Promise.all([
            fetchBitcoinData(),
            fetchYearBitcoinData(),
            fetchCurrentPrice()
        ]);
        
        renderCalendar(historicalData);
        renderYearCalendar(yearData);
        updateCurrentPrice(currentData);
        updateTimestamp();
        
    } catch (error) {
        showError('Failed to load Bitcoin data. Please try again later.');
    }
}

// Auto-refresh every 60 seconds
setInterval(init, 60000);

// Initialize on page load
init();
