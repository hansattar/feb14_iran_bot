const CITIES = ['Los Angeles', 'Toronto', 'Munich'];

const CITY_EMOJI = {
    'Los Angeles': '🇺🇸',
    'Toronto': '🇨🇦',
    'Munich': '🇩🇪',
};

const CITY_LABEL = {
    'Los Angeles': 'لس‌آنجلس',
    'Toronto': 'تورنتو',
    'Munich': 'مونیخ',
};

const CURRENCIES = [
    { key: 'USD', label: 'دلار آمریکا' },
    { key: 'CAD', label: 'دلار کانادا' },
    { key: 'EUR', label: 'یورو' },
    { key: 'GBP', label: 'پوند' },
];

const CURRENCY_LABEL = {
    'USD': 'دلار آمریکا',
    'CAD': 'دلار کانادا',
    'EUR': 'یورو',
    'GBP': 'پوند',
};

const PAGE_SIZE = 10;
const MAX_PENDING_FUNDINGS = 5;

// Right-to-Left Mark — prepend to lines mixing Persian + English
const RLM = '\u200F';

function cityLabel(city) {
    return CITY_LABEL[city] || city;
}

function currencyLabel(key) {
    return CURRENCY_LABEL[key] || key;
}

function escMd(text) {
    if (!text) return '';
    return text.replace(/_/g, '\\_');
}

function contactLink(label, telegramId, username) {
    const link = `[${label}](tg://user?id=${telegramId})`;
    if (username) return `${link} (${escMd(username)})`;
    return link;
}

module.exports = {
    CITIES,
    CITY_EMOJI,
    CITY_LABEL,
    CURRENCIES,
    CURRENCY_LABEL,
    PAGE_SIZE,
    MAX_PENDING_FUNDINGS,
    RLM,
    cityLabel,
    currencyLabel,
    escMd,
    contactLink,
};
