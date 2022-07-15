(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.mapbox = {}));
})(this, (function (exports) { 'use strict';

  const PLACE_TYPES = ["place", "postcode", "address", "poi", "locality"];

  const GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/SEARCH_TERM.json";
  const REVERSE_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/LONGITUDE_PARAM,LATITUDE_PARAM.json";

  const geocodingParams = () => {
    const key = window.MAPBOX_KEY;
    console.log(key);
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
    const key = window.MAPBOX_KEY;
    console.log(key);
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

  function mapboxSearch(search_term, options) {
    const search_params = filterBlankOptions({ ...geocodingParams(), ...options });
    const search_url = buildGeocodingRequestUrl(search_term, search_params);

    return fetchResults(search_url);
  }

  async function mapboxReverseSearch({ latitude, longitude }, options) {
    const search_params = filterBlankOptions({ ...reverseGeocodingParams(), ...options });
    const search_url = buildReverseGeocodingRequestUrl(latitude, longitude, search_params);

    return await fetchResults(search_url);
  }

  let focused_element_index = 0;

  function createDropdown(mounting_point) {
    const container = document.createElement("div");
    container.style.cssText = "position: absolute; padding-left: inherit; padding-right: inherit; z-index: 10; left: 0; right: 0;";
    container.className = "mapbox-dropdown-menu";
    container.hidden = true;

    const dropdown = document.createElement("div");
    dropdown.style.cssText = "background-color: white; border-radius: 20px; -webkit-box-shadow: -2px 5px 15px -3px rgba(0,0,0,0.5); box-shadow: -2px 5px 15px -3px rgba(0,0,0,0.5); overflow: hidden;";

    container.appendChild(dropdown);
    mounting_point.parentElement.appendChild(container);

    addKeyboardEventListenersToDropdown(mounting_point, dropdown);
    return dropdown;
  }

  function addSuggestionToDropdown(target, dropdown, suggestion_data) {
    let suggestion_element = document.createElement("div");
    let suggestion_text;
    if (suggestion_data.length === 0) {
      suggestion_element.style.cssText = "padding: 10px 15px;";
      suggestion_text = `<span style="font-size: 12px;">Pas de résultat à afficher.</span>`;
    } else {
      suggestion_text = formatSuggestion(suggestion_data);
      suggestion_element.style.cssText = "padding: 10px 15px; cursor: pointer;";
      suggestion_element.onmouseover = e => { elementFocus(e.currentTarget); };
      suggestion_element.className = "mapbox-suggestion";

      suggestion_element.onclick = () => {
        parseMapboxSuggestion(suggestion_data).then(res => {
          let selected_event = new CustomEvent('mapbox-selected', { detail: res, bubbles: true });
          target.dispatchEvent(selected_event);
        });
      };
    }
    suggestion_element.innerHTML = suggestion_text;

    dropdown.appendChild(suggestion_element);
  }

  async function parseMapboxSuggestion(suggestion_data) {
    let place_type = suggestion_data.place_type.filter(type => PLACE_TYPES.includes(type));
    let road_number, road_name, city, postcode, country, country_code, locality;
    let road, full_city;
    let api_places = suggestion_data.place_name.split(', ');
    let split_number_and_words_regex = /^(\d+)?\s?(.+)$/gm;
    const [longitude, latitude] = suggestion_data.center;

    switch (place_type[0]) {
      case "place":
        postcode = (await mapboxReverseSearch({ latitude, longitude }, { types: ["postcode"] }))[0].text;
        city = api_places[0];
        country = api_places[api_places.length -1];
        break;
      case "postcode":
        [postcode, city, country] = api_places;
        break;
      case "address":
        [road, full_city, country] = api_places;
        [, road_number, road_name] = [...road.matchAll(split_number_and_words_regex)][0];
        [, postcode, city] = [...full_city.matchAll(split_number_and_words_regex)][0];
        let country_infos = suggestion_data.context.filter(context_object => /^country\..*$/.test(context_object.id));
        country_code = country_infos[country_infos.length - 1]?.short_code?.toUpperCase();
        break;
      case "poi":
        if (api_places.length === 4) {
          [road, city, full_city, country] = api_places;
        } else {
          [,road, city, full_city, country] = api_places;
        }
        [, road_number, road_name] = [...road.matchAll(split_number_and_words_regex)][0];
        [, postcode] = full_city.split(/(\d+)/);
        break;
      case "locality":
        postcode = (await mapboxReverseSearch({ latitude, longitude }, { types: ["postcode"] }))[0].text;
        [locality, city, country] = api_places;
        break;
      default:
        console.error(`Unknown suggestion type: ${place_type[0]}`);
        break;
    }

    let address = formatAddress([road_number, road_name, city, locality, postcode, country]);

    return { road_number, road_name, city, postcode, country, suggestion_data, country_code, address, locality };

  }

  function formatSuggestion(api_result) {
    let place_name = api_result.place_name;
    let [main_name, address] = place_name.split(/,(.*)/);

    return `<span style="font-size: 12px;"><strong style="font-size: 14px;">${main_name}</strong>${address}</span>`;
  }

  function formatAddress(data) {
    return data.filter(elem => elem != null).join(', ');
  }

  function addSuggestionsToInput(target, dropdown, api_results) {
    dropdown.innerHTML = '';
    dropdown.parentElement.hidden = false;
    if (api_results.length === 0) {
      addSuggestionToDropdown(target, dropdown, []);
    } else {
      api_results.forEach(result => {
        addSuggestionToDropdown(target, dropdown, result);
      });
    }
  }

  function focusNextItem(dropdown) {
    if (dropdown.children.length === 0) return;
    if (focused_element_index === dropdown.children.length - 1) {
      focused_element_index = 0;
      elementFocus(dropdown.children[focused_element_index]);
    } else {
      focused_element_index += 1;
      elementFocus(dropdown.children[focused_element_index]);
    }
  }

  function focusPreviousItem(dropdown) {
    if (dropdown.children.length === 0) return;
    if (focused_element_index === 0) {
      focused_element_index = dropdown.children.length - 1;
      elementFocus(dropdown.children[focused_element_index]);
    } else {
      focused_element_index -= 1;
      elementFocus(dropdown.children[focused_element_index]);
    }
  }

  function elementFocus(element) {
    if (!element) return;
    let suggestions = Array.from(element.parentElement.children);
    suggestions.filter(item => item != element).forEach((elem) => elementUnfocus(elem));
    element.style.backgroundColor = "#f0faf8";
  }


  function elementUnfocus(element) {
    element.style.backgroundColor = "white";
  }

  function addKeyboardEventListenersToDropdown(target, dropdown) {
    target.addEventListener("keydown", (e) => {
      if (e.key === 'Enter') {
        if (dropdown.parentElement.hidden === false) {
          dropdown.children[focused_element_index].click();
          focused_element_index = 0;
          elementFocus(dropdown.children[focused_element_index]);
          e.preventDefault();
        }
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        if (dropdown.parentElement.hidden === true) {
          target.value = '';
        } else {
          dropdown.parentElement.hidden = true;
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (dropdown.parentElement.hidden === true && target.value.length >= 3) {
          dropdown.parentElement.hidden = false;
        } else {
          focusNextItem(dropdown);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusPreviousItem(dropdown);
      }
    });
  }

  function addMapboxListener(target, custom_options) {
    let dropdown = createDropdown(target);
    let timeout = null;

    target.addEventListener("input", (e) => {
      let input = e.currentTarget.value;
      if (input.length === 0) {
        dropdown.parentElement.hidden = true;
      }
      if (input.length < 3) return;

      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const results = await mapboxSearch(input, custom_options);
        addSuggestionsToInput(target, dropdown, results);
        elementFocus(dropdown.children[0]);
      }, 300);
    });

    document.addEventListener("click", () => {
      dropdown.parentElement.hidden = true;
    });
  }

  exports.addMapboxListener = addMapboxListener;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
