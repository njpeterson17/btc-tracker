// Crypto Price Tracker - Fetches 7-day and 365-day price history from CoinGecko API

const API_BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const CURRENCY_KEY = 'crypto_currency';
const COIN_KEY = 'crypto_coin';

// Coin configuration
const COINS = {
    bitcoin: {
        id: 'bitcoin',
        name: 'Bitcoin',
        symbol: 'BTC',
        color: '#F7931A',
        logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#F7931A" stroke-width="2"/>
            <path d="M15.5 10.5c.2-1.4-.9-2.1-2.3-2.6l.5-1.9-1.2-.3-.4 1.9c-.3-.1-.6-.2-1-.3l.4-1.9-1.2-.3-.5 1.9c-.3-.1-.5-.2-.8-.3l-1.7-.4-.3 1.3s.9.2.9.2c.5.1.6.5.5.8l-.5 2.1c.1 0 .2 0 .3.1l-.3-.1-.8 3.1c-.1.2-.3.5-.7.4 0 0-.9-.2-.9-.2l-.6 1.3 1.6.4c.3.1.6.2.9.3l-.5 2 1.2.3.5-1.9c.3.1.6.2.9.3l-.5 1.9 1.2.3.5-2c1.9.4 3.4.2 4-1.5.4-1.2-.1-1.8-.9-2.2.6-.1 1.1-.5 1.3-1.3z" fill="#F7931A"/>
        </svg>`
    },
    ethereum: {
        id: 'ethereum',
        name: 'Ethereum',
        symbol: 'ETH',
        color: '#627EEA',
        logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1.5L4.5 12.25L12 16.5L19.5 12.25L12 1.5Z" stroke="#627EEA" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
            <path d="M4.5 13.5L12 22.5L19.5 13.5L12 17.75L4.5 13.5Z" stroke="#627EEA" stroke-width="1.5" stroke-linejoin="round" fill="#627EEA" fill-opacity="0.3"/>
        </svg>`
    }
};

// DOM Elements
const currentPriceEl = document.getElementById('currentPrice');
const priceChangeEl = document.getElementById('priceChange');
const calendarGridEl = document.getElementById('calendarGrid');
const yearCalendarEl = document.getElementById('yearCalendar');
const yearStatsEl = document.getElementById('yearStats');
const lastUpdatedEl = document.getElementById('lastUpdated');
const currencySelectorEl = document.getElementById('currencySelector');
const coinLogoEl = document.getElementById('coinLogo');
const coinTitleEl = document.getElementById('coinTitle');
const coinTabs = document.querySelectorAll('.coin-tab');

// Currency configuration
const CURRENCIES = {
    usd: { code: 'usd', symbol: '$', locale: 'en-US' },
    eur: { code: 'eur', symbol: '€', locale: 'de-DE' },
    gbp: { code: 'gbp', symbol: '£', locale: 'en-GB' }
};

// Get current coin from localStorage or default to Bitcoin
function getCurrentCoin() {
    const saved = localStorage.getItem(COIN_KEY);
    return COINS[saved] || COINS.bitcoin;
}

// Set coin and save to localStorage
function setCoin(coinId) {
    localStorage.setItem(COIN_KEY, coinId);
    updateCoinUI();
    init();
}

// Update UI elements for current coin
function updateCoinUI() {
    const coin = getCurrentCoin();

    // Update logo
    if (coinLogoEl) {
        coinLogoEl.outerHTML = coin.logo.replace('<svg', `<svg id="coinLogo" aria-hidden="true"`);
    }

    // Update title
    if (coinTitleEl) {
        coinTitleEl.textContent = `${coin.name} Tracker`;
        coinTitleEl.style.background = `linear-gradient(135deg, var(--text-primary) 0%, ${coin.color} 100%)`;
        coinTitleEl.style.webkitBackgroundClip = 'text';
        coinTitleEl.style.webkitTextFillColor = 'transparent';
        coinTitleEl.style.backgroundClip = 'text';
    }

    // Update tab states
    coinTabs.forEach(tab => {
        const isActive = tab.dataset.coin === coin.id;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive);
    });

    // Update document title
    document.title = `${coin.name} Tracker`;
}

// Initialize coin tabs
function initCoinTabs() {
    coinTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const coinId = tab.dataset.coin;
            if (coinId && COINS[coinId]) {
                setCoin(coinId);
            }
        });
    });
    updateCoinUI();
}

// Get current currency from localStorage or default to USD
function getCurrentCurrency() {
    const saved = localStorage.getItem(CURRENCY_KEY);
    return CURRENCIES[saved] || CURRENCIES.usd;
}

// Set currency and save to localStorage
function setCurrency(currencyCode) {
    localStorage.setItem(CURRENCY_KEY, currencyCode);
    init();
}

// Initialize currency selector
function initCurrencySelector() {
    if (!currencySelectorEl) return;
    const current = getCurrentCurrency();
    currencySelectorEl.value = current.code;
    currencySelectorEl.addEventListener('change', (e) => {
        setCurrency(e.target.value);
    });
}

// Format price with currency
function formatPrice(price) {
    const currency = getCurrentCurrency();
    return new Intl.NumberFormat(currency.locale, {
        style: 'currency',
        currency: currency.code.toUpperCase(),
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

// Fetch with exponential backoff retry for rate limiting
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);

            if (response.status === 429) {
                // Rate limited - wait and retry
                if (attempt < retries) {
                    const waitTime = delay * Math.pow(2, attempt);
                    console.log(`Rate limited. Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            const waitTime = delay * Math.pow(2, attempt);
            console.log(`Request failed. Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// Fetch price data for specified coin and number of days
async function fetchCoinData(days = 7) {
    const coin = getCurrentCoin();
    const currency = getCurrentCurrency();
    const url = `${API_BASE_URL}/coins/${coin.id}/market_chart?vs_currency=${currency.code}&days=${days}&interval=daily`;
    return await fetchWithRetry(url);
}

// Get cache key for current coin
function getCacheKey() {
    const coin = getCurrentCoin();
    return `${coin.id}_year_data`;
}

// Get cached year data or fetch fresh
async function getCachedYearData() {
    const cacheKey = getCacheKey();
    const cached = localStorage.getItem(cacheKey);
    const currency = getCurrentCurrency();

    if (cached) {
        try {
            const { data, timestamp, currencyCode } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            // Use cache if less than 1 hour old and same currency
            if (age < CACHE_DURATION && currencyCode === currency.code) {
                console.log('Using cached year data');
                return data;
            }
        } catch (e) {
            console.log('Cache parse error, fetching fresh data');
        }
    }

    console.log('Fetching fresh year data');
    const data = await fetchCoinData(365);

    // Cache the data
    localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
        currencyCode: currency.code
    }));

    return data;
}

// Fetch current price
async function fetchCurrentPrice() {
    const coin = getCurrentCoin();
    const currency = getCurrentCurrency();
    const url = `${API_BASE_URL}/simple/price?ids=${coin.id}&vs_currencies=${currency.code}&include_24hr_change=true`;
    return await fetchWithRetry(url);
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
        <div class="day-date">${getDateNumber(date)}</div>
        <div class="price">${formatPrice(price)}</div>
        <div class="indicator">
            ${arrowSvg}
            ${previousPrice !== null ? formatPercentage(changePercent) : '--'}
        </div>
    `;

    return dayEl;
}

// Show loading state for both calendars
function showLoading() {
    calendarGridEl.innerHTML = `
        <div class="loading" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
        </div>
    `;
    if (yearCalendarEl) {
        yearCalendarEl.innerHTML = `
            <div class="loading year-loading">
                <div class="spinner"></div>
            </div>
        `;
    }
}

// Show error state (XSS-safe)
function showError(message) {
    calendarGridEl.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.style.gridColumn = '1 / -1';

    const errorText = document.createElement('p');
    errorText.textContent = message;
    errorDiv.appendChild(errorText);

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Try Again';
    retryBtn.addEventListener('click', init);
    errorDiv.appendChild(retryBtn);

    calendarGridEl.appendChild(errorDiv);

    if (yearCalendarEl) {
        yearCalendarEl.innerHTML = '';
        const yearErrorDiv = document.createElement('div');
        yearErrorDiv.className = 'error';
        yearErrorDiv.style.gridColumn = '1 / -1';
        yearErrorDiv.style.padding = '20px';

        const yearErrorText = document.createElement('p');
        yearErrorText.textContent = 'Failed to load year data';
        yearErrorDiv.appendChild(yearErrorText);

        yearCalendarEl.appendChild(yearErrorDiv);
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
function createYearDay(date, price, previousPrice, showPrice = true, index = 0) {
    const dayEl = document.createElement('div');
    dayEl.className = 'year-day';
    dayEl.setAttribute('tabindex', '0');
    dayEl.setAttribute('role', 'gridcell');
    dayEl.setAttribute('data-index', index);

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
    const tooltipText = `${dateStr}: ${formatPrice(price)} (${changeStr})`;
    dayEl.setAttribute('data-tooltip', tooltipText);
    dayEl.setAttribute('aria-label', tooltipText);

    // Add price in corner (only on larger screens)
    if (showPrice) {
        const priceEl = document.createElement('span');
        priceEl.className = 'price-corner';
        priceEl.textContent = formatCompactPrice(price);
        dayEl.appendChild(priceEl);
    }

    return { element: dayEl, direction };
}

// Create empty placeholder for year calendar
function createEmptyDay() {
    const dayEl = document.createElement('div');
    dayEl.className = 'year-day neutral';
    dayEl.style.visibility = 'hidden';
    dayEl.setAttribute('aria-hidden', 'true');
    return dayEl;
}

// Setup keyboard navigation for year calendar
function setupYearCalendarKeyboardNav() {
    if (!yearCalendarEl) return;

    yearCalendarEl.addEventListener('keydown', (e) => {
        const current = document.activeElement;
        if (!current.classList.contains('year-day')) return;

        const allDays = Array.from(yearCalendarEl.querySelectorAll('.year-day[tabindex="0"]'));
        const currentIndex = allDays.indexOf(current);

        let newIndex = currentIndex;

        switch (e.key) {
            case 'ArrowRight':
                newIndex = Math.min(currentIndex + 1, allDays.length - 1);
                e.preventDefault();
                break;
            case 'ArrowLeft':
                newIndex = Math.max(currentIndex - 1, 0);
                e.preventDefault();
                break;
            case 'ArrowDown':
                newIndex = Math.min(currentIndex + 7, allDays.length - 1);
                e.preventDefault();
                break;
            case 'ArrowUp':
                newIndex = Math.max(currentIndex - 7, 0);
                e.preventDefault();
                break;
            case 'Home':
                newIndex = 0;
                e.preventDefault();
                break;
            case 'End':
                newIndex = allDays.length - 1;
                e.preventDefault();
                break;
        }

        if (newIndex !== currentIndex && allDays[newIndex]) {
            allDays[newIndex].focus();
        }
    });
}

// Render the 365-day calendar
function renderYearCalendar(priceData) {
    if (!yearCalendarEl) return;

    const coin = getCurrentCoin();
    yearCalendarEl.innerHTML = '';
    yearCalendarEl.setAttribute('role', 'grid');
    yearCalendarEl.setAttribute('aria-label', `365-day ${coin.name} price history`);

    const prices = priceData.prices;
    let upDays = 0;
    let downDays = 0;

    // Get the last 365 data points (or all available)
    const displayData = prices.slice(-365);

    if (displayData.length === 0) return;

    // Get the day of week for the first data point (0 = Sunday, 6 = Saturday)
    const firstDate = new Date(displayData[0][0]);
    const startDayOfWeek = firstDate.getDay();

    // Add empty placeholders to align the first day to the correct column
    for (let i = 0; i < startDayOfWeek; i++) {
        yearCalendarEl.appendChild(createEmptyDay());
    }

    // Check if we should show prices (based on screen width)
    const showPrices = window.innerWidth > 1200;

    displayData.forEach((dataPoint, index) => {
        const [timestamp, price] = dataPoint;
        const date = new Date(timestamp);

        // Get previous day price for comparison
        const previousPrice = index > 0 ? displayData[index - 1][1] : null;

        const { element: dayEl, direction } = createYearDay(date, price, previousPrice, showPrices, index);
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

    // Setup keyboard navigation
    setupYearCalendarKeyboardNav();
}

// Render the 7-day calendar
function renderCalendar(priceData) {
    const coin = getCurrentCoin();
    calendarGridEl.innerHTML = '';
    calendarGridEl.setAttribute('role', 'grid');
    calendarGridEl.setAttribute('aria-label', `7-day ${coin.name} price history`);

    const prices = priceData.prices;

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
    const coin = getCurrentCoin();
    const currency = getCurrentCurrency();
    const price = currentData[coin.id][currency.code];
    const changeKey = `${currency.code}_24h_change`;
    const change24h = currentData[coin.id][changeKey];

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
    initCurrencySelector();
    initCoinTabs();

    try {
        // Fetch current price, 7-day data (always fresh), and year data (potentially cached)
        const [historicalData, yearData, currentData] = await Promise.all([
            fetchCoinData(7),
            getCachedYearData(),
            fetchCurrentPrice()
        ]);

        renderCalendar(historicalData);
        renderYearCalendar(yearData);
        updateCurrentPrice(currentData);
        updateTimestamp();

    } catch (error) {
        console.error('Error initializing:', error);
        const coin = getCurrentCoin();
        showError(`Failed to load ${coin.name} data. Please try again later.`);
    }
}

// Auto-refresh every 60 seconds
setInterval(init, 60000);

// Initialize on page load
init();
