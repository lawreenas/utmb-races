// Country → continent. Names match the last part of UTMB's `startLocation`.
// Transcontinental countries are assigned by where UTMB races are held
// (e.g. Türkiye's Kaçkar race is in Anatolia → Asia).
const CONTINENTS = {
  Europe: [
    'Albania', 'Andorra', 'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia',
    'Cyprus', 'Czech Republic', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
    'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Liechtenstein',
    'Lithuania', 'Luxembourg', 'Malta', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia',
    'Norway', 'Poland', 'Portugal', 'Romania', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia',
    'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Georgia', 'Armenia',
  ],
  Asia: [
    'China', 'Chinese Taipei', 'Taiwan', 'Hong Kong', 'Japan', 'South Korea', 'Korea', 'Mongolia',
    'India', 'Nepal', 'Bhutan', 'Sri Lanka', 'Pakistan', 'Thailand', 'Vietnam', 'Malaysia',
    'Indonesia', 'Philippines', 'Singapore', 'Cambodia', 'Laos', 'Myanmar', 'Kazakhstan',
    'Kyrgyzstan', 'Uzbekistan', 'Tajikistan', 'Türkiye', 'Turkey', 'Oman', 'United Arab Emirates',
    'Saudi Arabia', 'Qatar', 'Jordan', 'Israel', 'Lebanon', 'Iran',
  ],
  'North America': [
    'United States of America', 'United States', 'USA', 'Canada', 'Mexico', 'Guatemala',
    'Costa Rica', 'Panama', 'Honduras', 'Nicaragua', 'El Salvador', 'Belize', 'Cuba',
    'Dominican Republic', 'Puerto Rico', 'Jamaica',
  ],
  'South America': [
    'Argentina', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Bolivia', 'Paraguay',
    'Uruguay', 'Venezuela',
  ],
  Africa: [
    'South Africa', 'Morocco', 'Kenya', 'Tanzania', 'Namibia', 'Réunion', 'Reunion', 'Mauritius',
    'Madagascar', 'Egypt', 'Tunisia', 'Ethiopia', 'Rwanda', 'Uganda', 'Lesotho', 'Cape Verde',
  ],
  Oceania: ['Australia', 'New Zealand', 'Fiji', 'New Caledonia', 'French Polynesia'],
};

const COUNTRY_TO_CONTINENT = Object.fromEntries(
  Object.entries(CONTINENTS).flatMap(([continent, countries]) => countries.map((c) => [c, continent])),
);

// Used when UTMB doesn't return a start location (e.g. it comes back as "undefined").
const EVENT_LOCATION_FALLBACK = {
  'HOKA UTMB Mont-Blanc': 'Chamonix, France',
};

function continentOf(country) {
  return COUNTRY_TO_CONTINENT[country] || 'Other';
}
