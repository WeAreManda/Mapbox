export const PLACE_TYPES = ["place", "postcode", "address", "poi", "locality"];

const GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/SEARCH_TERM.json";
const REVERSE_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/LONGITUDE_PARAM,LATITUDE_PARAM.json";

const geocodingParams = () => {
  const key = window.MAPBOX_KEY
  return {
    access_token: key,
    types: PLACE_TYPES.join(","),
    limit: 5,
    bbox: [-5.47, 41.03, 11.23, 51.66],
    country: "fr",
    language: "fr"
  }
};
const reverseGeocodingParams = () => {
  const key = window.MAPBOX_KEY
  return {
    access_token: key,
    types: PLACE_TYPES.join(","),
    limit: 5,
    country: "fr"
  }
};

function buildGeocodingRequestUrl(search_term, options) {
  const search_url = GEOCODING_URL.replace('SEARCH_TERM', search_term);
  return search_url.concat('?' + new URLSearchParams(options).toString());
}

function buildReverseGeocodingRequestUrl(latitude, longitude, options) {
  let search_url = REVERSE_GEOCODING_URL.replace('LATITUDE_PARAM', latitude);
  search_url = search_url.replace('LONGITUDE_PARAM', longitude);
  return search_url.concat('?' + new URLSearchParams(options).toString());
}

async function fetchResults(search_url) {
  return (await fetch(search_url)
    .then(data => { return data.json(); })
    .then(res => { return res.features || []; }));
}

function filterBlankOptions(object) {
  return Object.entries(object).reduce((a,[k,v]) => (v == null ? a : (a[k]=v, a)), {});
}

export function mapboxSearch(search_term, options) {
  const search_params = filterBlankOptions({ ...geocodingParams(), ...options });
  const search_url = buildGeocodingRequestUrl(search_term, search_params);

  return fetchResults(search_url);
}

export async function mapboxReverseSearch({ latitude, longitude }, options) {
  const search_params = filterBlankOptions({ ...reverseGeocodingParams(), ...options });
  const search_url = buildReverseGeocodingRequestUrl(latitude, longitude, search_params);

  return await fetchResults(search_url);
}
